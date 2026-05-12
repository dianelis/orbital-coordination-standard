# Data

The notebook looks for the satellite catalog in this order:

1. `data/database.csv`
2. `../database.csv`
3. `database.csv`

For local development in the original paper folder, the second path is already available. For a fresh clone, place the satellite catalog at `data/database.csv`.

Dataset source:

[UCS Satellite Database - Active Satellites](https://www.kaggle.com/datasets/ucsusa/active-satellites)

Before publishing third-party data in this repository, verify the source license and attribution requirements. The current repository tracks trained baseline outputs, not the original source CSV.
