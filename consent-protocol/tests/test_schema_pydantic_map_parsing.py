"""Pydantic schema parsing contracts for map/dict fields.

Covers two behavioural contracts:
1. Duplicate JSON keys — Python's json parser (used by Pydantic's model_validate_json)
   resolves duplicates as last-value-wins (RFC 8259 §4 leaves this implementation-defined;
   CPython and pydantic-core/jiter both choose last-wins).
2. Invalid map structures — non-dict payloads supplied to Dict / Optional[Dict] fields
   must raise ValidationError; null and empty-dict are still accepted.
"""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from api.models.schemas import ChatRequest, DataAccessResponse


# ---------------------------------------------------------------------------
# Duplicate JSON keys: last-value-wins contract
# ---------------------------------------------------------------------------


class TestDuplicateJsonKeysLastValueWins:
    def test_duplicate_top_level_field_last_wins(self) -> None:
        """Duplicate top-level scalar: last occurrence replaces earlier ones."""
        raw = '{"userId": "first_user", "userId": "last_user", "message": "hello"}'
        model = ChatRequest.model_validate_json(raw)
        assert model.userId == "last_user"

    def test_duplicate_nested_map_key_last_wins(self) -> None:
        """Duplicate key inside a Dict[str, Any] field: last value wins."""
        raw = '{"userId": "u1", "message": "hi", "sessionState": {"k": "first", "k": "last"}}'
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState is not None
        assert model.sessionState["k"] == "last"

    def test_duplicate_nested_map_key_numeric_overrides_earlier(self) -> None:
        raw = '{"userId": "u1", "message": "hi", "sessionState": {"x": 1, "x": 99}}'
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState is not None
        assert model.sessionState["x"] == 99

    def test_multiple_duplicate_keys_each_resolved_independently(self) -> None:
        raw = (
            '{"userId": "u1", "message": "hi",'
            ' "sessionState": {"a": 1, "b": 2, "a": 10, "b": 20}}'
        )
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState == {"a": 10, "b": 20}

    def test_pydantic_and_stdlib_json_agree_on_last_value_wins(self) -> None:
        """model_validate_json and json.loads must resolve duplicates identically."""
        raw = '{"userId": "first", "userId": "second", "message": "m"}'
        via_stdlib = json.loads(raw)
        via_pydantic = ChatRequest.model_validate_json(raw)
        assert via_stdlib["userId"] == via_pydantic.userId

    def test_duplicate_optional_data_key_last_wins(self) -> None:
        raw = '{"status_code": 200, "data": {"key": "old", "key": "new"}}'
        model = DataAccessResponse.model_validate_json(raw)
        assert model.data is not None
        assert model.data["key"] == "new"

    def test_triplicate_key_last_of_three_wins(self) -> None:
        raw = (
            '{"userId": "u1", "message": "hi",'
            ' "sessionState": {"k": "one", "k": "two", "k": "three"}}'
        )
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState is not None
        assert model.sessionState["k"] == "three"


# ---------------------------------------------------------------------------
# Invalid map structures: must be rejected with ValidationError
# ---------------------------------------------------------------------------


class TestInvalidMapStructuresRejected:
    def test_session_state_as_list_rejected(self) -> None:
        raw = '{"userId": "u1", "message": "hi", "sessionState": [1, 2, 3]}'
        with pytest.raises(ValidationError):
            ChatRequest.model_validate_json(raw)

    def test_session_state_as_string_rejected(self) -> None:
        raw = '{"userId": "u1", "message": "hi", "sessionState": "not-a-dict"}'
        with pytest.raises(ValidationError):
            ChatRequest.model_validate_json(raw)

    def test_session_state_as_integer_rejected(self) -> None:
        raw = '{"userId": "u1", "message": "hi", "sessionState": 42}'
        with pytest.raises(ValidationError):
            ChatRequest.model_validate_json(raw)

    def test_session_state_as_boolean_rejected(self) -> None:
        raw = '{"userId": "u1", "message": "hi", "sessionState": true}'
        with pytest.raises(ValidationError):
            ChatRequest.model_validate_json(raw)

    def test_data_field_as_list_rejected(self) -> None:
        raw = '{"status_code": 200, "data": ["a", "b"]}'
        with pytest.raises(ValidationError):
            DataAccessResponse.model_validate_json(raw)

    def test_data_field_as_scalar_rejected(self) -> None:
        raw = '{"status_code": 200, "data": "plaintext"}'
        with pytest.raises(ValidationError):
            DataAccessResponse.model_validate_json(raw)

    def test_data_field_as_number_rejected(self) -> None:
        raw = '{"status_code": 200, "data": 3.14}'
        with pytest.raises(ValidationError):
            DataAccessResponse.model_validate_json(raw)


# ---------------------------------------------------------------------------
# Boundary: valid edge cases that must NOT be rejected
# ---------------------------------------------------------------------------


class TestValidMapEdgeCases:
    def test_null_optional_map_accepted(self) -> None:
        """Explicit JSON null for Optional[Dict] is valid."""
        raw = '{"userId": "u1", "message": "hi", "sessionState": null}'
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState is None

    def test_empty_map_accepted(self) -> None:
        raw = '{"userId": "u1", "message": "hi", "sessionState": {}}'
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState == {}

    def test_absent_optional_map_defaults_to_none(self) -> None:
        raw = '{"userId": "u1", "message": "hi"}'
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState is None

    def test_nested_map_value_accepted(self) -> None:
        raw = '{"userId": "u1", "message": "hi", "sessionState": {"nested": {"a": 1}}}'
        model = ChatRequest.model_validate_json(raw)
        assert model.sessionState == {"nested": {"a": 1}}
