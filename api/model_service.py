from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from .schemas import SatellitePredictionInput

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "satellite_coordination_pressure_model.joblib"
METRICS_PATH = ROOT / "models" / "satellite_coordination_pressure_metrics.json"
PREDICTIONS_PATH = ROOT / "models" / "satellite_coordination_pressure_predictions.csv"
DASHBOARD_DATA_PATH = ROOT / "models" / "satellite_coordination_dashboard_data.json"
CURRENT_YEAR = 2026

FEATURE_COLUMNS = [
    "Users",
    "Purpose",
    "Class of Orbit",
    "Type of Orbit",
    "Country of Operator/Owner",
    "Perigee (Kilometers)",
    "Apogee (Kilometers)",
    "Eccentricity",
    "Inclination (Degrees)",
    "Period (Minutes)",
    "Launch Mass (Kilograms)",
    "Expected Lifetime (Years)",
    "launch_year",
    "satellite_age_years",
    "mean_altitude_km",
    "altitude_span_km",
]


@lru_cache(maxsize=1)
def load_model() -> Any:
    return joblib.load(MODEL_PATH)


@lru_cache(maxsize=1)
def load_metrics() -> dict[str, Any]:
    with METRICS_PATH.open("r", encoding="utf-8") as handle:
        metrics = json.load(handle)

    return {
        **metrics,
        "api_version": "0.1",
        "model_artifact": str(MODEL_PATH.relative_to(ROOT)),
        "prediction_artifact": str(PREDICTIONS_PATH.relative_to(ROOT)),
    }


@lru_cache(maxsize=1)
def load_predictions() -> pd.DataFrame:
    predictions = pd.read_csv(PREDICTIONS_PATH)
    return predictions.rename(
        columns={
            "Official Name of Satellite": "name",
            "NORAD Number": "norad",
            "Operator/Owner": "operator",
            "Purpose": "purpose",
            "Class of Orbit": "orbit",
            "mean_altitude_km": "altitude",
            "coordination_pressure_score": "score",
            "predicted_coordination_pressure_tier": "tier",
        }
    )


@lru_cache(maxsize=1)
def load_dashboard_data() -> dict[str, Any]:
    with DASHBOARD_DATA_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def prediction_records(
    tier: str | None = None,
    orbit: str | None = None,
    purpose: str | None = None,
    search: str | None = None,
    limit: int = 5000,
    offset: int = 0,
) -> dict[str, Any]:
    data = load_predictions()
    filtered = filter_predictions(data, tier=tier, orbit=orbit, purpose=purpose, search=search)
    page = filtered.iloc[offset : offset + limit]
    return {
        "total": int(len(data)),
        "count": int(len(filtered)),
        "limit": limit,
        "offset": offset,
        "items": clean_records(page),
    }


def filter_predictions(
    data: pd.DataFrame,
    tier: str | None = None,
    orbit: str | None = None,
    purpose: str | None = None,
    search: str | None = None,
) -> pd.DataFrame:
    filtered = data
    if tier and tier != "all":
        filtered = filtered[filtered["tier"].astype(str).str.lower() == tier.lower()]
    if orbit and orbit != "all":
        filtered = filtered[filtered["orbit"].astype(str) == orbit]
    if purpose and purpose != "all":
        filtered = filtered[filtered["purpose"].astype(str) == purpose]
    if search:
        query = search.lower()
        haystack = (
            filtered["name"].fillna("").astype(str)
            + " "
            + filtered["operator"].fillna("").astype(str)
            + " "
            + filtered["norad"].fillna("").astype(str)
        ).str.lower()
        filtered = filtered[haystack.str.contains(query, regex=False)]
    return filtered


def dashboard_summary() -> dict[str, Any]:
    enriched = load_dashboard_data()
    data = load_predictions()
    return {
        "total_satellites": int(len(data)),
        "tier_counts": int_counts(data["tier"]),
        "orbit_counts": int_counts(data["orbit"]),
        "top_operators": top_counts(data["operator"]),
        "top_purposes": top_counts(data["purpose"]),
        "average_score": float(data["score"].mean()),
        "p90_score": float(data["score"].quantile(0.9)),
        "layers": enriched["layers"],
        "governance": enriched["governance"],
    }


def dashboard_data() -> dict[str, Any]:
    data = load_dashboard_data()
    return {
        **data,
        "metadata": {
            **data["metadata"],
            "data_source": "FastAPI",
            "api_version": "0.1",
        },
    }


def layer_data() -> dict[str, Any]:
    return load_dashboard_data()["layers"]


def operator_data() -> list[dict[str, Any]]:
    return load_dashboard_data()["operators"]


def governance_data() -> dict[str, Any]:
    return load_dashboard_data()["governance"]


def scenario_data() -> list[dict[str, Any]]:
    return load_dashboard_data()["scenarios"]


def scenario_detail(scenario_id: str) -> dict[str, Any]:
    for scenario in scenario_data():
        if scenario["id"] == scenario_id:
            return scenario
    raise KeyError(scenario_id)


def sail_flow_data() -> dict[str, Any]:
    return load_dashboard_data()["sail_flow"]


def evidence_report_data() -> list[dict[str, Any]]:
    return load_dashboard_data()["evidence_reports"]


def satellite_explanation(norad: str) -> dict[str, Any]:
    target = str(norad).replace("NORAD-", "").strip()
    for satellite in load_dashboard_data()["satellites"]:
        if str(satellite.get("norad")).replace(".0", "") == target:
            return {
                "satellite": satellite,
                "feature_contributions": explanation_from_satellite(satellite),
            }
    raise KeyError(norad)


def explanation_from_satellite(satellite: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "label": "Orbit and altitude pressure",
            "value": float(satellite.get("maneuver_coordination_pressure") or 0),
        },
        {
            "label": "Routing dependency pressure",
            "value": float(satellite.get("routing_dependency_pressure") or 0),
        },
        {
            "label": "Operator interoperability pressure",
            "value": float(satellite.get("operator_interoperability_pressure") or 0),
        },
        {
            "label": "Disposal governance pressure",
            "value": float(satellite.get("disposal_governance_pressure") or 0),
        },
        {
            "label": "Audit priority",
            "value": float(satellite.get("audit_priority") or 0),
        },
    ]


def options() -> dict[str, list[str]]:
    data = load_predictions()
    return {
        "tiers": sorted(value for value in data["tier"].dropna().astype(str).unique()),
        "orbits": sorted(value for value in data["orbit"].dropna().astype(str).unique()),
        "purposes": sorted(value for value in data["purpose"].dropna().astype(str).unique()),
        "operators": sorted(value for value in data["operator"].dropna().astype(str).unique()),
    }


def predict_satellite(payload: SatellitePredictionInput) -> dict[str, Any]:
    model = load_model()
    features = satellite_input_to_features(payload)
    frame = pd.DataFrame([features], columns=FEATURE_COLUMNS)
    tier = str(model.predict(frame)[0])

    probabilities: dict[str, float] = {}
    if hasattr(model, "predict_proba"):
        classes = model.named_steps["model"].classes_
        proba = model.predict_proba(frame)[0]
        probabilities = {str(label): float(value) for label, value in zip(classes, proba)}

    return {
        "predicted_coordination_pressure_tier": tier,
        "class_probabilities": probabilities,
        "features_used": features,
    }


def satellite_input_to_features(payload: SatellitePredictionInput) -> dict[str, Any]:
    mean_altitude = None
    altitude_span = None
    if payload.perigee_km is not None and payload.apogee_km is not None:
        mean_altitude = (payload.perigee_km + payload.apogee_km) / 2
        altitude_span = payload.apogee_km - payload.perigee_km

    age = CURRENT_YEAR - payload.launch_year if payload.launch_year else None

    return {
        "Users": payload.users,
        "Purpose": payload.purpose,
        "Class of Orbit": payload.class_of_orbit,
        "Type of Orbit": payload.type_of_orbit,
        "Country of Operator/Owner": payload.country_of_operator_owner,
        "Perigee (Kilometers)": payload.perigee_km,
        "Apogee (Kilometers)": payload.apogee_km,
        "Eccentricity": payload.eccentricity,
        "Inclination (Degrees)": payload.inclination_deg,
        "Period (Minutes)": payload.period_minutes,
        "Launch Mass (Kilograms)": payload.launch_mass_kg,
        "Expected Lifetime (Years)": payload.expected_lifetime_years,
        "launch_year": payload.launch_year,
        "satellite_age_years": age,
        "mean_altitude_km": mean_altitude,
        "altitude_span_km": altitude_span,
    }


def int_counts(series: pd.Series) -> dict[str, int]:
    return {str(key): int(value) for key, value in series.fillna("Unknown").value_counts().items()}


def top_counts(series: pd.Series, limit: int = 10) -> list[dict[str, Any]]:
    counts = series.fillna("Unknown").value_counts().head(limit)
    return [{"label": str(key), "value": int(value)} for key, value in counts.items()]


def clean_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    records = frame[["name", "norad", "operator", "purpose", "orbit", "altitude", "score", "tier"]].to_dict(
        orient="records"
    )
    return [{key: none_if_nan(value) for key, value in record.items()} for record in records]


def none_if_nan(value: Any) -> Any:
    if pd.isna(value):
        return None
    return value
