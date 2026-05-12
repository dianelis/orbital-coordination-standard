from __future__ import annotations

from pathlib import Path

from orbital_coordination_standard.validator import load_json, validate_message


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = load_json(ROOT / "schemas" / "sail-message.schema.json")


def test_all_valid_examples_validate() -> None:
    paths = sorted((ROOT / "examples" / "messages").glob("*.valid.json"))
    assert paths

    for path in paths:
        validate_message(load_json(path), SCHEMA)


def test_maneuver_intent_requires_audit() -> None:
    message = load_json(ROOT / "examples" / "messages" / "maneuver-intent.valid.json")
    message.pop("audit")

    try:
        validate_message(message, SCHEMA)
    except Exception as exc:
        assert "audit" in str(exc)
    else:
        raise AssertionError("maneuver intent without audit should fail validation")
