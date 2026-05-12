from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app


client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_predictions_endpoint_returns_model_rows() -> None:
    response = client.get("/api/predictions?limit=1")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1420
    assert data["count"] == 1420
    assert len(data["items"]) == 1
    assert {"name", "operator", "orbit", "score", "tier"} <= set(data["items"][0])


def test_live_prediction_endpoint() -> None:
    response = client.post(
        "/api/predict",
        json={
            "users": "Commercial",
            "purpose": "Communications",
            "class_of_orbit": "LEO",
            "type_of_orbit": "Non-Polar Inclined",
            "country_of_operator_owner": "USA",
            "perigee_km": 550,
            "apogee_km": 570,
            "eccentricity": 0.001,
            "inclination_deg": 53,
            "period_minutes": 95,
            "launch_mass_kg": 260,
            "expected_lifetime_years": 5,
            "launch_year": 2026,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_coordination_pressure_tier"] in {"low", "medium", "high"}
    assert data["class_probabilities"]
