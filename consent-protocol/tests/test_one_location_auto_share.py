"""Service tests for the One Location Auto-share fan-out / teardown.

These exercise the three behaviours the feature promises without a live
database:

  * toggle ON fans out an auto-share grant to every location-eligible,
    key-ready peer that has none yet, tagging each grant metadata.source =
    'auto_share';
  * a peer that becomes eligible later (accepted connection / Circle join)
    auto-starts a share only while the owner's flag is ON;
  * toggle OFF tears down ONLY the auto-created shares and never a manually
    created one.

The service's DB seam is stubbed at `create_grant`, `revoke_grant`,
`list_verified_recipients`, `_has_active_grant`, and `_execute_*`, so the tests
assert the reconciliation logic itself rather than SQL.
"""

from __future__ import annotations

import pytest

from hushh_mcp.services.one_location_agent_service import (
    AUTO_SHARE_GRANT_SOURCE,
    OneLocationAgentError,
    OneLocationAgentService,
)


class _Recorder:
    def __init__(self) -> None:
        self.created: list[dict] = []
        self.revoked: list[str] = []


@pytest.fixture()
def service(monkeypatch):
    svc = OneLocationAgentService()
    recorder = _Recorder()

    # No real preference row; default the flag ON unless a test overrides it.
    monkeypatch.setattr(svc, "get_auto_share_enabled", lambda *, user_id: True)

    # The preference upsert in set_auto_share_enabled is a no-op write here.
    monkeypatch.setattr(svc, "_execute_one", lambda *a, **k: None)

    def _fake_create_grant(**kwargs):
        recorder.created.append(kwargs)
        return {
            "id": f"grant-{len(recorder.created)}",
            "recipientUserId": kwargs["recipient_user_id"],
        }

    def _fake_revoke_grant(*, owner_user_id, grant_id):
        recorder.revoked.append(grant_id)
        return {"id": grant_id, "status": "revoked"}

    monkeypatch.setattr(svc, "create_grant", _fake_create_grant)
    monkeypatch.setattr(svc, "revoke_grant", _fake_revoke_grant)
    # No peer starts with an existing active grant unless a test says so.
    monkeypatch.setattr(
        svc,
        "_has_active_grant",
        lambda *, owner_user_id, recipient_user_id: False,
    )

    svc._recorder = recorder  # type: ignore[attr-defined]
    return svc


def _recipient(user_id: str, *, ready: bool = True) -> dict:
    return {"userId": user_id, "canReceiveLocation": ready}


def test_toggle_on_fans_out_to_eligible_ready_peers(service, monkeypatch):
    monkeypatch.setattr(
        service,
        "list_verified_recipients",
        lambda *, owner_user_id: [
            _recipient("peer-ready-1"),
            _recipient("peer-ready-2"),
            _recipient("peer-not-ready", ready=False),
        ],
    )

    result = service.set_auto_share_enabled(user_id="owner", enabled=True)

    assert result["action"] == "fan_out"
    assert result["affectedShareCount"] == 2
    created_recipients = {c["recipient_user_id"] for c in service._recorder.created}
    assert created_recipients == {"peer-ready-1", "peer-ready-2"}
    # Every auto-created grant carries the provenance marker and enforces the
    # relationship gate.
    for call in service._recorder.created:
        assert call["source"] == AUTO_SHARE_GRANT_SOURCE
        assert call["enforce_connection"] is True


def test_toggle_on_skips_peer_with_existing_active_grant(service, monkeypatch):
    monkeypatch.setattr(
        service,
        "list_verified_recipients",
        lambda *, owner_user_id: [_recipient("peer-with-manual-share")],
    )
    # This peer already has a manual share; fan-out must not create a second one.
    monkeypatch.setattr(
        service,
        "_has_active_grant",
        lambda *, owner_user_id, recipient_user_id: True,
    )

    result = service.set_auto_share_enabled(user_id="owner", enabled=True)

    assert result["affectedShareCount"] == 0
    assert service._recorder.created == []


def test_auto_start_for_new_peer_requires_flag_on(service, monkeypatch):
    monkeypatch.setattr(
        service, "get_auto_share_enabled", lambda *, user_id: False
    )

    grant = service.auto_start_share_for_new_peer(
        owner_user_id="owner", peer_user_id="new-peer"
    )

    assert grant is None
    assert service._recorder.created == []


def test_auto_start_for_new_peer_creates_tagged_grant_when_on(service, monkeypatch):
    monkeypatch.setattr(
        service, "get_auto_share_enabled", lambda *, user_id: True
    )

    grant = service.auto_start_share_for_new_peer(
        owner_user_id="owner", peer_user_id="new-peer"
    )

    assert grant is not None
    assert len(service._recorder.created) == 1
    call = service._recorder.created[0]
    assert call["recipient_user_id"] == "new-peer"
    assert call["source"] == AUTO_SHARE_GRANT_SOURCE
    assert call["enforce_connection"] is True


def test_toggle_off_teardown_revokes_only_auto_share_grants(service, monkeypatch):
    # The teardown select returns ONLY grants tagged source='auto_share'; a
    # manual grant is never returned by that query, so it is never revoked.
    monkeypatch.setattr(
        service,
        "_execute_many",
        lambda *a, **k: [{"id": "auto-1"}, {"id": "auto-2"}],
    )

    result = service.set_auto_share_enabled(user_id="owner", enabled=False)

    assert result["action"] == "teardown"
    assert result["affectedShareCount"] == 2
    assert set(service._recorder.revoked) == {"auto-1", "auto-2"}
    # Teardown never creates a grant.
    assert service._recorder.created == []


def test_toggle_off_with_no_auto_shares_is_noop(service, monkeypatch):
    monkeypatch.setattr(service, "_execute_many", lambda *a, **k: [])

    result = service.set_auto_share_enabled(user_id="owner", enabled=False)

    assert result["affectedShareCount"] == 0
    assert service._recorder.revoked == []


def test_set_auto_share_requires_user(service):
    with pytest.raises(OneLocationAgentError) as exc:
        service.set_auto_share_enabled(user_id="", enabled=True)
    assert exc.value.code == "LOCATION_AUTH_REQUIRED"
