from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCENARIO_PATH = ROOT / "examples" / "scenarios" / "two-operator-conjunction.json"


@dataclass(frozen=True)
class OperatorState:
    operator_id: str
    object_id: str
    maneuverability: str
    risk_score: float


def load_scenario(path: Path = SCENARIO_PATH) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def simulate_without_sail(objects: list[OperatorState]) -> dict:
    movable = [obj for obj in objects if obj.maneuverability == "available"]
    if len(movable) > 1:
        return {
            "coordination_mode": "without_sail",
            "outcome": "conflicting_autonomous_actions",
            "responsible_operator": None,
            "residual_risk_class": "medium",
            "audit_complete": False,
        }
    if len(movable) == 1:
        return {
            "coordination_mode": "without_sail",
            "outcome": "single_operator_maneuver",
            "responsible_operator": movable[0].operator_id,
            "residual_risk_class": "low",
            "audit_complete": False,
        }
    return {
        "coordination_mode": "without_sail",
        "outcome": "no_maneuver_available",
        "responsible_operator": None,
        "residual_risk_class": "high",
        "audit_complete": False,
    }


def simulate_with_sail(objects: list[OperatorState]) -> dict:
    candidates = sorted(
        [obj for obj in objects if obj.maneuverability == "available"],
        key=lambda obj: obj.risk_score,
        reverse=True,
    )

    if not candidates:
        return {
            "coordination_mode": "with_sail",
            "outcome": "unable_to_maneuver",
            "responsible_operator": None,
            "residual_risk_class": "high",
            "audit_complete": True,
        }

    responsible = candidates[0]
    return {
        "coordination_mode": "with_sail",
        "outcome": "responsibility_claimed_and_confirmed",
        "responsible_operator": responsible.operator_id,
        "residual_risk_class": "low",
        "audit_complete": True,
    }


def main() -> int:
    scenario = load_scenario()
    objects = [
        OperatorState(
            operator_id=item["operator_id"],
            object_id=item["object_id"],
            maneuverability=item["maneuverability"],
            risk_score=float(item["initial_risk_score"]),
        )
        for item in scenario["objects"]
    ]

    results = [simulate_without_sail(objects), simulate_with_sail(objects)]
    print(json.dumps({"scenario_id": scenario["scenario_id"], "results": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
