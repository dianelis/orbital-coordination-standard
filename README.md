# Orbital Coordination Standard

An open research standard for cross-operator satellite synchronization, maneuver intent sharing, and autonomous space traffic coordination.

This repository defines **SAIL: Satellite Autonomy Interoperability Layer**. SAIL is a proposed interoperability layer for satellites and operators that need to coordinate in a crowded orbital environment without exposing proprietary flight software or giving another company control of their spacecraft.

The guiding principle is:

> Shared intent, not shared control.

SAIL is designed to complement existing space data standards such as CCSDS Conjunction Data Messages and Orbit Data Messages. Those formats help describe objects, trajectories, and conjunctions. SAIL focuses on the missing coordination layer: what an autonomous system intends to do, what constraints it is operating under, and how that decision can be audited later.

## Repository Structure

```text
orbital-coordination-standard/
  docs/                     Human-readable project and governance docs
  spec/                     Versioned SAIL standard drafts
  schemas/                  JSON Schemas for interoperable messages
  examples/                 Valid example messages and scenarios
  paper/                    Draft text for adding the project to the final paper
  src/                      Python validator package
  sim/                      Toy coordination simulation
  tests/                    Validator and schema tests
```

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
python -m pip install -e ".[dev]"
python -m orbital_coordination_standard validate examples/messages/maneuver-intent.valid.json
python sim/run_toy_sim.py
pytest
```

## Project Status

SAIL v0.1 is a research draft. The purpose of this repository is to make the concept testable, reviewable, and extensible.

The first useful milestone is a small simulation showing how cross-operator maneuver intent sharing changes outcomes during close approaches, degraded ephemeris, and conflicting autonomous decisions.

## License

The standard text and examples are released under CC-BY-4.0. Source code is released under the MIT License. See `LICENSE`.
