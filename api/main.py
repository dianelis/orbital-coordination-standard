from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .model_service import (
    dashboard_data,
    dashboard_summary,
    evidence_report_data,
    governance_data,
    layer_data,
    load_metrics,
    operator_data,
    options,
    predict_satellite,
    prediction_records,
    sail_flow_data,
    satellite_explanation,
    scenario_data,
    scenario_detail,
)
from .schemas import PredictionResponse, SatellitePredictionInput

app = FastAPI(
    title="SAIL Coordination Model API",
    version="0.1.0",
    description="FastAPI middle layer for the trained satellite coordination pressure model.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8765",
        "http://127.0.0.1:8765",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/metrics")
def metrics() -> dict:
    return load_metrics()


@app.get("/api/summary")
def summary() -> dict:
    return dashboard_summary()


@app.get("/api/dashboard-data")
def full_dashboard_data() -> dict:
    return dashboard_data()


@app.get("/api/layers")
def layers() -> dict:
    return layer_data()


@app.get("/api/operators")
def operators() -> list[dict]:
    return operator_data()


@app.get("/api/governance")
def governance() -> dict:
    return governance_data()


@app.get("/api/scenarios")
def scenarios() -> list[dict]:
    return scenario_data()


@app.get("/api/scenarios/{scenario_id}")
def scenario(scenario_id: str) -> dict:
    try:
        return scenario_detail(scenario_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown scenario") from exc


@app.get("/api/sail-flow")
def sail_flow() -> dict:
    return sail_flow_data()


@app.get("/api/evidence-reports")
def evidence_reports() -> list[dict]:
    return evidence_report_data()


@app.get("/api/satellites/{norad}/explain")
def explain_satellite(norad: str) -> dict:
    try:
        return satellite_explanation(norad)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown satellite") from exc


@app.get("/api/options")
def dashboard_options() -> dict[str, list[str]]:
    return options()


@app.get("/api/predictions")
def predictions(
    tier: str | None = Query(default=None),
    orbit: str | None = Query(default=None),
    purpose: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=5000, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
) -> dict:
    return prediction_records(
        tier=tier,
        orbit=orbit,
        purpose=purpose,
        search=search,
        limit=limit,
        offset=offset,
    )


@app.post("/api/predict", response_model=PredictionResponse)
def predict(payload: SatellitePredictionInput) -> dict:
    return predict_satellite(payload)
