# Notebook

Open `satellite_coordination_ml.ipynb` to train a data-driven coordination pressure model from the satellite catalog.

The notebook:

- loads the satellite CSV;
- cleans orbital and mission fields;
- creates a transparent simulation target called `coordination_pressure_tier`;
- compares baseline models;
- trains the selected model;
- saves the local model artifact under `models/`;
- exports satellite-level risk seeds that can feed future simulations.

This is a simulation-support model, not an operational spaceflight safety model.
