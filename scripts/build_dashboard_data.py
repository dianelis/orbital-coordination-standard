from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE_CANDIDATES = [ROOT / "data" / "database.csv", ROOT.parent / "database.csv", ROOT / "database.csv"]
PREDICTIONS_PATH = ROOT / "models" / "satellite_coordination_pressure_predictions.csv"
METRICS_PATH = ROOT / "models" / "satellite_coordination_pressure_metrics.json"
OUTPUT_PATH = ROOT / "models" / "satellite_coordination_dashboard_data.json"
CURRENT_YEAR = 2026

SCENARIOS = [
    {
        "id": "mass-conjunction-alert",
        "name": "Mass conjunction alert",
        "layer": "neighborhood",
        "description": "Many satellites in dense low-altitude shells receive simultaneous screening alerts.",
        "multiplier": 1.18,
        "affected": lambda frame: (frame["orbit"] == "LEO")
        & (frame["mean_altitude_km"].between(300, 1400)),
    },
    {
        "id": "ground-station-outage",
        "name": "Ground station outage",
        "layer": "infrastructure",
        "description": "Traffic must reroute through fewer gateway regions, increasing load-balancing pressure.",
        "multiplier": 1.12,
        "affected": lambda frame: frame["purpose"].str.contains("Communications", case=False, na=False),
    },
    {
        "id": "degraded-tracking-accuracy",
        "name": "Degraded tracking accuracy",
        "layer": "spacecraft",
        "description": "Uncertainty grows when state estimates or ephemerides are stale.",
        "multiplier": 1.10,
        "affected": lambda frame: frame["governance_visibility_score"] < 0.72,
    },
    {
        "id": "failed-software-update",
        "name": "Failed software update",
        "layer": "infrastructure",
        "description": "A common-mode autonomy update changes routing or maneuver thresholds across a fleet.",
        "multiplier": 1.14,
        "affected": lambda frame: frame["operator_fleet_size"] >= 20,
    },
    {
        "id": "cross-operator-maneuver-conflict",
        "name": "Cross-operator maneuver conflict",
        "layer": "neighborhood",
        "description": "Two maneuverable active satellites respond to the same event with incompatible assumptions.",
        "multiplier": 1.16,
        "affected": lambda frame: (frame["tier"] == "high") & (frame["orbit"].isin(["LEO", "MEO"])),
    },
    {
        "id": "partial-deorbit-failure",
        "name": "Partial deorbit failure",
        "layer": "spacecraft",
        "description": "A spacecraft loses enough capability that disposal becomes a coordination problem.",
        "multiplier": 1.13,
        "affected": lambda frame: frame["Expected Lifetime (Years)"].isna()
        | (frame["age_years"] > 10),
    },
]


def main() -> None:
    source = load_source_catalog()
    predictions = pd.read_csv(PREDICTIONS_PATH)
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    enriched = enrich_catalog(source, predictions)

    dashboard_data = {
        "metadata": {
            "generated_by": "scripts/build_dashboard_data.py",
            "dataset": {
                "name": "UCS Satellite Database - Active Satellites",
                "url": "https://www.kaggle.com/datasets/ucsusa/active-satellites",
            },
            "model": {
                "selected_model": metrics["selected_model"],
                "holdout_accuracy": metrics["holdout_accuracy"],
                "holdout_f1_weighted": metrics["holdout_f1_weighted"],
                "target": metrics["target"],
            },
            "record_count": int(len(enriched)),
            "note": "Research simulation artifact. Not an operational flight safety system.",
        },
        "satellites": satellite_records(enriched),
        "layers": layer_summary(enriched),
        "operators": operator_summary(enriched),
        "governance": governance_summary(enriched),
        "scenarios": scenario_results(enriched),
        "sail_flow": sail_flow(enriched),
        "evidence_reports": evidence_reports(enriched),
    }

    OUTPUT_PATH.write_text(json.dumps(dashboard_data, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} with {len(enriched)} satellites")


def load_source_catalog() -> pd.DataFrame:
    for path in SOURCE_CANDIDATES:
        if path.exists():
            return pd.read_csv(path)
    raise FileNotFoundError("Could not find database.csv in data/, repo root, or parent folder.")


def clean_number(series: pd.Series) -> pd.Series:
    text = series.astype(str).str.replace(",", "", regex=False)
    numeric_text = text.str.extract(r"([-+]?\d*\.?\d+)")[0]
    return pd.to_numeric(numeric_text, errors="coerce")


def enrich_catalog(source: pd.DataFrame, predictions: pd.DataFrame) -> pd.DataFrame:
    work = source.copy()
    pred = predictions.copy()

    for column in [
        "NORAD Number",
        "Perigee (Kilometers)",
        "Apogee (Kilometers)",
        "Eccentricity",
        "Inclination (Degrees)",
        "Period (Minutes)",
        "Launch Mass (Kilograms)",
        "Expected Lifetime (Years)",
    ]:
        if column in work:
            work[column] = clean_number(work[column])

    work["Date of Launch"] = pd.to_datetime(work["Date of Launch"], errors="coerce")
    work["launch_year"] = work["Date of Launch"].dt.year
    work["age_years"] = CURRENT_YEAR - work["launch_year"]
    work["mean_altitude_km"] = work[["Perigee (Kilometers)", "Apogee (Kilometers)"]].mean(axis=1)
    work["altitude_span_km"] = work["Apogee (Kilometers)"] - work["Perigee (Kilometers)"]

    merged = work.merge(
        pred[
            [
                "NORAD Number",
                "coordination_pressure_score",
                "coordination_pressure_tier",
                "predicted_coordination_pressure_tier",
            ]
        ],
        on="NORAD Number",
        how="left",
    )
    merged["tier"] = merged["predicted_coordination_pressure_tier"].fillna(
        merged["coordination_pressure_tier"]
    )
    merged["score"] = merged["coordination_pressure_score"].fillna(0)
    merged["operator"] = merged["Operator/Owner"].fillna("Unknown operator")
    merged["purpose"] = merged["Purpose"].fillna("Unknown purpose")
    merged["orbit"] = merged["Class of Orbit"].astype(str).str.strip().replace({"nan": "Unknown"})
    merged["operator_fleet_size"] = merged["operator"].map(merged["operator"].value_counts())

    merged = add_risk_profiles(merged)
    merged = add_governance_scores(merged)
    merged = add_layer_priorities(merged)
    return merged


def add_risk_profiles(frame: pd.DataFrame) -> pd.DataFrame:
    work = frame.copy()
    purpose = work["purpose"].str.lower()
    orbit = work["orbit"].str.upper()
    score = work["score"].fillna(0)
    fleet_scaled = (work["operator_fleet_size"].fillna(0) / work["operator_fleet_size"].max()).clip(0, 1)
    low_altitude = work["mean_altitude_km"].between(300, 1400).fillna(False).astype(float)
    eccentric = (work["Eccentricity"].fillna(0) > 0.05).astype(float)
    missing_lifetime = work["Expected Lifetime (Years)"].isna().astype(float)
    old_sat = (work["age_years"].fillna(0) > 10).astype(float)

    work["maneuver_coordination_pressure"] = clamp(
        0.45 * score + 0.25 * low_altitude + 0.15 * eccentric + 0.15 * orbit.eq("LEO").astype(float)
    )
    work["routing_dependency_pressure"] = clamp(
        0.42 * score
        + 0.30 * purpose.str.contains("communications", regex=False).astype(float)
        + 0.16 * fleet_scaled
        + 0.12 * orbit.eq("LEO").astype(float)
    )
    work["operator_interoperability_pressure"] = clamp(
        0.38 * score
        + 0.30 * fleet_scaled
        + 0.18 * purpose.str.contains("communications|navigation", regex=True).astype(float)
        + 0.14 * orbit.isin(["LEO", "MEO"]).astype(float)
    )
    work["disposal_governance_pressure"] = clamp(
        0.32 * score
        + 0.28 * missing_lifetime
        + 0.20 * old_sat
        + 0.12 * (work["altitude_span_km"].fillna(0) > 100).astype(float)
        + 0.08 * orbit.eq("LEO").astype(float)
    )
    work["audit_priority"] = clamp(
        0.30 * work["maneuver_coordination_pressure"]
        + 0.22 * work["routing_dependency_pressure"]
        + 0.22 * work["operator_interoperability_pressure"]
        + 0.26 * work["disposal_governance_pressure"]
    )
    return work


def add_governance_scores(frame: pd.DataFrame) -> pd.DataFrame:
    work = frame.copy()
    fields = [
        "operator",
        "purpose",
        "orbit",
        "Type of Orbit",
        "Date of Launch",
        "Expected Lifetime (Years)",
        "Launch Mass (Kilograms)",
        "Period (Minutes)",
        "NORAD Number",
    ]
    present = pd.DataFrame({field: work[field].notna().astype(float) for field in fields})
    work["governance_visibility_score"] = present.mean(axis=1)
    work["governance_visibility_tier"] = pd.cut(
        work["governance_visibility_score"],
        bins=[-0.01, 0.62, 0.82, 1.01],
        labels=["low", "medium", "high"],
    ).astype(str)
    return work


def add_layer_priorities(frame: pd.DataFrame) -> pd.DataFrame:
    work = frame.copy()
    values = work[
        [
            "maneuver_coordination_pressure",
            "operator_interoperability_pressure",
            "routing_dependency_pressure",
        ]
    ].to_numpy()
    labels = ["spacecraft", "neighborhood", "infrastructure"]
    work["dominant_layer"] = [labels[int(row.argmax())] for row in values]
    return work


def clamp(series: pd.Series) -> pd.Series:
    return series.astype(float).clip(0, 1)


def satellite_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    cols = [
        "Official Name of Satellite",
        "NORAD Number",
        "operator",
        "purpose",
        "orbit",
        "Type of Orbit",
        "mean_altitude_km",
        "score",
        "tier",
        "maneuver_coordination_pressure",
        "routing_dependency_pressure",
        "operator_interoperability_pressure",
        "disposal_governance_pressure",
        "audit_priority",
        "governance_visibility_score",
        "governance_visibility_tier",
        "dominant_layer",
    ]
    records = frame[cols].rename(
        columns={
            "Official Name of Satellite": "name",
            "NORAD Number": "norad",
            "Type of Orbit": "orbit_type",
            "mean_altitude_km": "altitude",
        }
    )
    return clean_records(records)


def layer_summary(frame: pd.DataFrame) -> dict[str, Any]:
    return {
        "spacecraft": layer_block(
            frame,
            "maneuver_coordination_pressure",
            "Local execution, maneuverability, state quality, and disposal constraints.",
        ),
        "neighborhood": layer_block(
            frame,
            "operator_interoperability_pressure",
            "Adjacent satellites, shared shells, cross-operator interactions, and maneuver intent.",
        ),
        "infrastructure": layer_block(
            frame,
            "routing_dependency_pressure",
            "Fleet routing, load balancing, service continuity, and common-mode failures.",
        ),
    }


def layer_block(frame: pd.DataFrame, column: str, description: str) -> dict[str, Any]:
    top = frame.sort_values(column, ascending=False).head(8)
    return {
        "description": description,
        "average_pressure": float(frame[column].mean()),
        "high_pressure_count": int((frame[column] >= 0.72).sum()),
        "top_satellites": satellite_brief(top, column),
    }


def operator_summary(frame: pd.DataFrame) -> list[dict[str, Any]]:
    grouped = frame.groupby("operator", dropna=False)
    rows = []
    for operator, group in grouped:
        rows.append(
            {
                "operator": str(operator),
                "satellite_count": int(len(group)),
                "high_pressure_count": int((group["tier"] == "high").sum()),
                "average_score": float(group["score"].mean()),
                "average_audit_priority": float(group["audit_priority"].mean()),
                "dominant_orbit": mode_or_unknown(group["orbit"]),
                "dominant_purpose": mode_or_unknown(group["purpose"]),
                "governance_visibility": float(group["governance_visibility_score"].mean()),
            }
        )
    return sorted(rows, key=lambda row: (row["high_pressure_count"], row["average_score"]), reverse=True)[:30]


def governance_summary(frame: pd.DataFrame) -> dict[str, Any]:
    return {
        "visibility_counts": int_counts(frame["governance_visibility_tier"]),
        "average_visibility": float(frame["governance_visibility_score"].mean()),
        "audit_priority_average": float(frame["audit_priority"].mean()),
        "audit_priority_high_count": int((frame["audit_priority"] >= 0.72).sum()),
        "lowest_visibility_satellites": satellite_brief(
            frame.sort_values("governance_visibility_score").head(10),
            "governance_visibility_score",
        ),
    }


def scenario_results(frame: pd.DataFrame) -> list[dict[str, Any]]:
    scenarios = []
    for scenario in SCENARIOS:
        mask = scenario["affected"](frame)
        affected = frame[mask].copy()
        if affected.empty:
            post_high = 0
            residual = "low"
            recovery = 0
        else:
            stress_score = clamp(affected["score"] * scenario["multiplier"])
            post_high = int((stress_score >= 0.72).sum())
            residual = residual_class(stress_score.mean())
            recovery = int(round(20 + len(affected) * 0.15 + post_high * 0.08))

        scenarios.append(
            {
                "id": scenario["id"],
                "name": scenario["name"],
                "layer": scenario["layer"],
                "description": scenario["description"],
                "affected_satellites": int(len(affected)),
                "post_stress_high_pressure": post_high,
                "required_sail_messages": int(len(affected) * 3 + post_high * 2),
                "audit_records_required": int(len(affected) + post_high),
                "estimated_recovery_minutes": recovery,
                "residual_risk_class": residual,
                "top_affected": satellite_brief(affected.sort_values("score", ascending=False).head(8), "score"),
            }
        )
    return scenarios


def sail_flow(frame: pd.DataFrame) -> dict[str, Any]:
    sample = frame.sort_values("score", ascending=False).iloc[0]
    object_id = f"NORAD-{int(sample['NORAD Number'])}" if pd.notna(sample["NORAD Number"]) else "NORAD-UNKNOWN"
    counterparty = "NORAD-COUNTERPARTY"
    event_id = "CDM-SIM-0001"
    return {
        "selected_satellite": {
            "name": sample["Official Name of Satellite"],
            "object_id": object_id,
            "operator": sample["operator"],
            "pressure_score": float(sample["score"]),
        },
        "messages": [
            message("STATE_UPDATE", object_id, sample["operator"], "autonomous", "routine"),
            message(
                "CONJUNCTION_ALERT_REFERENCE",
                object_id,
                "CoordinationHub",
                "mitigation_recommended",
                "urgent",
                event_id=event_id,
                counterparty=counterparty,
            ),
            message(
                "MANEUVER_INTENT",
                object_id,
                sample["operator"],
                "claiming_responsibility",
                "urgent",
                event_id=event_id,
                counterparty=counterparty,
            ),
            message(
                "RESPONSIBILITY_CLAIM",
                counterparty,
                "CounterpartyOperator",
                "deferring_responsibility",
                "urgent",
                event_id=event_id,
                counterparty=object_id,
            ),
            message(
                "POST_MANEUVER_CONFIRMATION",
                object_id,
                sample["operator"],
                "executed_nominal",
                "elevated",
                event_id=event_id,
                counterparty=counterparty,
            ),
        ],
    }


def message(
    message_type: str,
    object_id: str,
    operator: str,
    status: str,
    urgency: str,
    event_id: str | None = None,
    counterparty: str | None = None,
) -> dict[str, Any]:
    return {
        "message_type": message_type,
        "object_id": object_id,
        "operator_id": operator,
        "counterparty_object_id": counterparty,
        "urgency": urgency,
        "related_event_id": event_id,
        "status": status,
        "audit_relevance": "preserves decision evidence without sharing proprietary autonomy code",
    }


def evidence_reports(frame: pd.DataFrame) -> list[dict[str, Any]]:
    reports = []
    for scenario in scenario_results(frame):
        recovered = scenario["residual_risk_class"] in {"low", "medium"}
        audit_completeness = min(0.99, 0.72 + scenario["audit_records_required"] / 5000)
        reports.append(
            {
                "scenario": scenario["name"],
                "layer": scenario["layer"],
                "what_failed": scenario["description"],
                "what_recovered": "SAIL intent sharing and audit records reduce coordination ambiguity."
                if recovered
                else "Residual risk remains high and requires escalation.",
                "affected_satellites": scenario["affected_satellites"],
                "required_sail_messages": scenario["required_sail_messages"],
                "audit_completeness": float(audit_completeness),
                "estimated_recovery_minutes": scenario["estimated_recovery_minutes"],
                "residual_risk_class": scenario["residual_risk_class"],
                "regulator_summary": (
                    f"{scenario['name']} affects {scenario['affected_satellites']} satellites and "
                    f"requires approximately {scenario['required_sail_messages']} SAIL coordination messages."
                ),
            }
        )
    return reports


def satellite_brief(frame: pd.DataFrame, score_column: str) -> list[dict[str, Any]]:
    rows = []
    for _, row in frame.iterrows():
        rows.append(
            {
                "name": none_if_nan(row.get("Official Name of Satellite", row.get("name"))),
                "norad": none_if_nan(row.get("NORAD Number", row.get("norad"))),
                "operator": none_if_nan(row.get("operator")),
                "orbit": none_if_nan(row.get("orbit")),
                "purpose": none_if_nan(row.get("purpose")),
                "score": float(row.get(score_column, 0) or 0),
            }
        )
    return rows


def int_counts(series: pd.Series) -> dict[str, int]:
    return {str(key): int(value) for key, value in series.fillna("Unknown").value_counts().items()}


def mode_or_unknown(series: pd.Series) -> str:
    modes = series.fillna("Unknown").mode()
    return str(modes.iloc[0]) if not modes.empty else "Unknown"


def residual_class(value: float) -> str:
    if value >= 0.75:
        return "high"
    if value >= 0.55:
        return "medium"
    return "low"


def clean_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records = frame.to_dict(orient="records")
    return [{key: none_if_nan(value) for key, value in record.items()} for record in records]


def none_if_nan(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, float):
        return float(value)
    return value


if __name__ == "__main__":
    main()
