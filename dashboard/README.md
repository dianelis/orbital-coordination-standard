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

- `GET http://localhost:8000/api/metrics`
- `GET http://localhost:8000/api/predictions`

It uses CDN-loaded React, Tailwind, and Lucide icons, so no frontend build step is required.
