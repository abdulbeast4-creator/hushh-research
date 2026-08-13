"""Route test for POST /api/one/location/auto-share."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.middleware import require_vault_owner_token
from api.routes.one import location as location_routes
from api.routes.one.location import router


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[require_vault_owner_token] = lambda: {"user_id": "u1"}
    return TestClient(app)


def test_set_auto_share_route_on(client, monkeypatch):
    class FakeService:
        def set_auto_share_enabled(self, *, user_id, enabled):
            assert user_id == "u1"
            assert enabled is True
            return {
                "autoShareEnabled": True,
                "action": "fan_out",
                "affectedShareCount": 3,
            }

    monkeypatch.setattr(location_routes, "_service", lambda: FakeService())
    res = client.post("/api/one/location/auto-share", json={"enabled": True})
    assert res.status_code == 200
    body = res.json()
    assert body["autoShareEnabled"] is True
    assert body["action"] == "fan_out"
    assert body["affectedShareCount"] == 3


def test_set_auto_share_route_off(client, monkeypatch):
    class FakeService:
        def set_auto_share_enabled(self, *, user_id, enabled):
            assert enabled is False
            return {
                "autoShareEnabled": False,
                "action": "teardown",
                "affectedShareCount": 1,
            }

    monkeypatch.setattr(location_routes, "_service", lambda: FakeService())
    res = client.post("/api/one/location/auto-share", json={"enabled": False})
    assert res.status_code == 200
    assert res.json()["action"] == "teardown"


def test_set_auto_share_route_requires_enabled(client):
    res = client.post("/api/one/location/auto-share", json={})
    assert res.status_code == 422
