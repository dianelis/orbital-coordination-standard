# Orbital Coordination Standard

An open research standard for cross-operator satellite synchronization, maneuver intent sharing, and autonomous space traffic coordination.

Live dashboard: [https://dianelis.github.io/orbital-coordination-standard/dashboard/](https://dianelis.github.io/orbital-coordination-standard/dashboard/)

This repository defines **SAIL: Satellite Autonomy Interoperability Layer**. SAIL is a proposed interoperability layer for satellites and operators that need to coordinate in a crowded orbital environment without exposing proprietary flight software or giving another company control of their spacecraft.

The guiding principle is:

> Shared intent, not shared control.

SAIL is designed to complement existing space data standards such as CCSDS Conjunction Data Messages and Orbit Data Messages. Those formats help describe objects, trajectories, and conjunctions. SAIL focuses on the missing coordination layer: what an autonomous system intends to do, what constraints it is operating under, and how that decision can be audited later.

## Current Project

This repository now includes both the proposed standard and a working research prototype around it:

- **SAIL v0.1 draft standard** for state sharing, maneuver intent, responsibility claims, and post-maneuver confirmation.
- **JSON Schema and examples** for validating SAIL messages.
- **Python validator CLI** for checking SAIL-compliant message files.
- **Toy coordination simulation** showing coordinated vs. uncoordinated active-active conjunction behavior.
- **Machine learning notebook** that trains a coordination-pressure model from an active satellite catalog.
- **Trained baseline model artifacts** for dashboard exploration.
- **FastAPI model service** that exposes metrics, predictions, summaries, and live single-satellite prediction.
- **React dashboard** with black/Bottega green styling for visualizing model outputs and paper-facing proof-of-work views.
- **Communication message graph** that turns stress scenarios into SAIL-style state, alert, responsibility, maneuver intent, and confirmation messages across the satellite catalog.
- **GitHub Pages deployment** for the static dashboard.

The project is a research and education prototype. It is not an operational collision avoidance system or certified flight safety tool.

## Repository Structure

```text
orbital-coordination-standard/
  api/                      FastAPI model service for dashboard and live prediction
  dashboard/                Static React dashboard for trained model results
  data/                     Dataset placement notes
  docs/                     Human-readable project and governance docs
  examples/                 Valid example messages and scenarios
  models/                   Trained baseline model artifacts and predictions
  notebook/                 ML training notebook
  paper/                    Draft text for adding the project to the final paper
  schemas/                  JSON Schemas for interoperable messages
  spec/                     Versioned SAIL standard drafts
  src/                      Python validator package
  sim/                      Toy coordination simulation
  tests/                    Validator and schema tests
```

## Dataset

The model uses the Union of Concerned Scientists active satellite catalog distributed on Kaggle:

[UCS Satellite Database - Active Satellites](https://www.kaggle.com/datasets/ucsusa/active-satellites)

For a fresh clone, place the source CSV at `data/database.csv`. In the original paper workspace, the notebook also supports loading `../database.csv`.

The trained model does not predict real collision probability. It creates a transparent surrogate target called `coordination_pressure_tier`, which is useful for simulation seeding and dashboard exploration.

## What SAIL Covers

- Identity, operator, constellation, and object metadata
- Time synchronization and message expiration
- Maneuverability and degraded-state reporting
- Maneuver intent sharing
- Responsibility claims for active-active conjunctions
- Post-maneuver confirmation
- Audit records for autonomous safety decisions

## What SAIL Does Not Do

- It does not command another operator's spacecraft.
- It does not replace national licensing, TraCSS, Space-Track, EU SST, or CCSDS standards.
- It does not provide operational collision avoidance advice.
- It is not a certified flight safety system.

## Starter Commands

```bash
python -m pip install -e ".[dev,notebook,api]"
python -m orbital_coordination_standard validate examples/messages/maneuver-intent.valid.json
python sim/run_toy_sim.py
pytest
```

## Model Training

The training workflow lives in:

```text
notebook/satellite_coordination_ml.ipynb
```

It:

- loads the active satellite catalog;
- engineers orbital, mission, and operator features;
- creates the surrogate `coordination_pressure_tier` target;
- compares candidate models;
- selects `HistGradientBoostingClassifier`;
- exports model metrics, a `.joblib` model, and satellite-level predictions under `models/`.

Current baseline model:

```text
selected model: hist_gradient_boosting
holdout accuracy: 0.9331
weighted F1: 0.9330
```

Generated artifacts:

```text
models/satellite_coordination_pressure_model.joblib
models/satellite_coordination_pressure_metrics.json
models/satellite_coordination_pressure_predictions.csv
models/satellite_coordination_dashboard_data.json
```

## API

The FastAPI service is the middle layer between the trained model and the dashboard.

Run locally:

```bash
uvicorn api.main:app --reload --port 8000
```

Useful endpoints:

```text
GET  /health
GET  /api/metrics
GET  /api/summary
GET  /api/options
GET  /api/predictions
GET  /api/dashboard-data
GET  /api/layers
GET  /api/operators
GET  /api/governance
GET  /api/scenarios
GET  /api/sail-flow
GET  /api/evidence-reports
GET  /api/communication-graph
GET  /api/communication-graph?scenario={scenario_id}
GET  /api/satellites/{norad}/messages
GET  /api/satellites/{norad}/explain
POST /api/predict
```

## Dashboard

The trained model results can be explored through a FastAPI-backed React dashboard:

```bash
uvicorn api.main:app --reload --port 8000
```

In another terminal:

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765/dashboard/`.

The dashboard uses CDN-loaded React, Tailwind, and Lucide icons with shadcn-inspired components. It reads a paper-aligned dashboard data object from the FastAPI service, which loads the committed baseline model artifacts from `models/`.

Dashboard views:

- Overview: coordination-pressure KPIs and model outputs
- Three layers: spacecraft, neighborhood, and infrastructure autonomy
- Stress tests: mass conjunction alerts, outages, software faults, degraded tracking, maneuver conflicts, and partial deorbit failure
- SAIL flow: machine-readable state, alert, intent, responsibility, and confirmation sequence
- Messages: scenario-specific satellite communication graph and per-object message logs
- Governance: visibility and audit-priority scoring
- Operators: fleet-level comparison
- Evidence: regulator-style stress-test report cards

On GitHub Pages, the same dashboard runs in static mode and reads the committed dashboard JSON artifact directly.

## GitHub Pages

The hosted dashboard is available at:

[https://dianelis.github.io/orbital-coordination-standard/dashboard/](https://dianelis.github.io/orbital-coordination-standard/dashboard/)

GitHub Pages cannot run the FastAPI service, so the hosted dashboard uses the committed static dashboard data artifact as a fallback. Local development still uses FastAPI first.

## Project Status

SAIL v0.1 is a research draft. The purpose of this repository is to make the concept testable, reviewable, and extensible.

The current milestone is an end-to-end research prototype: standard draft, validator, toy simulation, trained coordination-pressure model, FastAPI API, scenario stress tests, SAIL flow visualization, governance scoring, operator comparison, evidence reports, and hosted dashboard.

## License

The standard text and examples are released under CC-BY-4.0. Source code is released under the MIT License. See `LICENSE`.
