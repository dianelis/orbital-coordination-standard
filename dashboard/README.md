# Dashboard

Static React dashboard for visualizing the trained coordination pressure model through the FastAPI middle layer.

Run the API from the repository root:

```bash
uvicorn api.main:app --reload --port 8000
```

In a second terminal, run the static dashboard:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://localhost:8765/dashboard/
```

The dashboard reads:

- `GET http://localhost:8000/api/dashboard-data`

It uses CDN-loaded React, Tailwind, and Lucide icons, so no frontend build step is required.

On GitHub Pages, the dashboard falls back to static model artifacts because Pages cannot run the FastAPI service. Locally, it uses FastAPI first and falls back to static files only if the API is unavailable.

## Views

- Overview: coordination-pressure KPIs and model outputs
- Three layers: spacecraft, neighborhood, and infrastructure autonomy views
- Stress tests: paper-aligned constellation failure scenarios
- SAIL flow: state, alert, maneuver intent, responsibility, and confirmation messages
- Governance: visibility and audit-priority scoring
- Operators: fleet-level comparison
- Evidence: regulator-style stress-test report cards
