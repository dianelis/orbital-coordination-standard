from __future__ import annotations

from pydantic import BaseModel, Field


class SatellitePredictionInput(BaseModel):
    """Single satellite input for live coordination pressure prediction."""

    users: str | None = Field(default=None, examples=["Commercial"])
    purpose: str | None = Field(default=None, examples=["Communications"])
    class_of_orbit: str | None = Field(default=None, examples=["LEO"])
    type_of_orbit: str | None = Field(default=None, examples=["Sun-Synchronous"])
    country_of_operator_owner: str | None = Field(default=None, examples=["USA"])
    perigee_km: float | None = Field(default=None, ge=0, examples=[550])
    apogee_km: float | None = Field(default=None, ge=0, examples=[570])
    eccentricity: float | None = Field(default=None, ge=0, examples=[0.001])
    inclination_deg: float | None = Field(default=None, ge=0, examples=[53])
    period_minutes: float | None = Field(default=None, ge=0, examples=[95.5])
    launch_mass_kg: float | None = Field(default=None, ge=0, examples=[260])
    expected_lifetime_years: float | None = Field(default=None, ge=0, examples=[5])
    launch_year: int | None = Field(default=None, ge=1957, examples=[2026])


class PredictionResponse(BaseModel):
    predicted_coordination_pressure_tier: str
    class_probabilities: dict[str, float]
    features_used: dict[str, str | float | int | None]
