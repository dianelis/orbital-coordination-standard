from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .validator import ValidationFailure, validate_file


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sail-validate",
        description="Validate SAIL v0.1 JSON messages against the project schema.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser("validate", help="Validate one or more SAIL messages.")
    validate.add_argument("paths", nargs="+", type=Path, help="Message JSON files to validate.")
    validate.add_argument(
        "--schema",
        type=Path,
        default=None,
        help="Optional schema path. Defaults to schemas/sail-message.schema.json.",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "validate":
        failures = 0
        for path in args.paths:
            try:
                validate_file(path, schema_path=args.schema)
            except ValidationFailure as exc:
                failures += 1
                print(f"FAIL {path}: {exc}", file=sys.stderr)
            else:
                print(f"PASS {path}")
        return 1 if failures else 0

    parser.error(f"Unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
