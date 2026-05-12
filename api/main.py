from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .model_service import (
    dashboard_summary,
    load_metrics,
    options,
    predict_satellite,
    prediction_records,
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
