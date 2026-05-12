from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


class ValidationFailure(Exception):
    """Raised when a SAIL message fails schema or semantic validation."""


def default_schema_path() -> Path:
    return Path(__file__).resolve().parents[2] / "schemas" / "sail-message.schema.json"


def load_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as exc:
        raise ValidationFailure(f"invalid JSON: {exc}") from exc
    except OSError as exc:
        raise ValidationFailure(f"could not read file: {exc}") from exc

    if not isinstance(data, dict):
        raise ValidationFailure("top-level JSON value must be an object")
    return data


def validate_message(message: dict[str, Any], schema: dict[str, Any]) -> None:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(message), key=lambda error: list(error.path))
    if errors:
        first = errors[0]
        path = ".".join(str(part) for part in first.path) or "<root>"
        raise ValidationFailure(f"{path}: {first.message}")

    _validate_temporal_order(message)


def validate_file(path: Path, schema_path: Path | None = None) -> None:
    schema = load_json(schema_path or default_schema_path())
    message = load_json(path)
    validate_message(message, schema)


def _parse_utc(value: str, field_name: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValidationFailure(f"{field_name} is not a valid ISO 8601 timestamp") from exc


def _validate_temporal_order(message: dict[str, Any]) -> None:
    created_at = _parse_utc(message["created_at"], "created_at")
    valid_until = _parse_utc(message["valid_until"], "valid_until")

    if valid_until <= created_at:
        raise ValidationFailure("valid_until must be later than created_at")

    payload = message.get("payload", {})
    maneuver_window = payload.get("maneuver_window")
    if maneuver_window:
        start = _parse_utc(maneuver_window["start"], "maneuver_window.start")
        end = _parse_utc(maneuver_window["end"], "maneuver_window.end")
        if end <= start:
            raise ValidationFailure("maneuver_window.end must be later than maneuver_window.start")
