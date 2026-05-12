# FastAPI Service

The API is the middle layer between the trained model artifacts and the React dashboard.

Run from the repository root:

```bash
uvicorn api.main:app --reload --port 8000
```

Then open the dashboard with the static server:

```bash
python3 -m http.server 8765
```

Dashboard URL:

```text
http://localhost:8765/dashboard/
```

## Endpoints

- `GET /health`
- `GET /api/metrics`
- `GET /api/summary`
- `GET /api/options`
- `GET /api/predictions`
- `POST /api/predict`

Example live prediction:

```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
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
    "launch_year": 2026
  }'
```

This service is for research simulation and dashboard exploration only. It is not an operational flight safety system.
