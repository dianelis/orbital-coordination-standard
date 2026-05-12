# Contributing

This project welcomes contributions to the draft standard, schemas, examples, tests, and simulator.

## Contribution Types

- Clarify requirements in the SAIL draft specification.
- Add valid or invalid example messages.
- Improve JSON Schema coverage.
- Add toy scenarios for cross-operator coordination.
- Propose mappings to existing standards such as CCSDS CDM, OMM, OEM, and OCM.

## Design Rules

- Preserve operator autonomy. SAIL shares intent and constraints, not command authority.
- Keep proprietary algorithms abstract. Message fields should expose safety-relevant behavior without requiring source-code disclosure.
- Prefer explicit uncertainty fields over implied precision.
- Every safety-relevant message should be auditable.

## Development

```bash
python -m pip install -e ".[dev]"
pytest
ruff check .
```
