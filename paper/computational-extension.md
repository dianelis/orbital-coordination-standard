# Computational Extension for the Final Paper

## Proposed Section Title

Toward a Satellite Autonomy Interoperability Layer

## Section Draft

The three-layer autonomy framework can be extended into a computational and standards-oriented project by defining an interoperability layer for cross-operator satellite coordination. This layer, called the Satellite Autonomy Interoperability Layer (SAIL), would not allow companies to command each other's spacecraft. Instead, it would allow operators to share state, maneuver intent, responsibility claims, and post-maneuver confirmations in a machine-readable format.

SAIL addresses the neighborhood autonomy gap identified in the paper. A spacecraft-level collision avoidance maneuver may be locally rational, but if another operator cannot see the maneuver intent, the event remains a coordination problem. Likewise, an infrastructure-level routing or service decision may preserve one constellation's performance while shifting congestion or uncertainty into another operator's neighborhood. A standard message layer gives operators and regulators a way to observe these interactions without requiring public disclosure of proprietary autonomy algorithms.

The proposed standard complements existing conjunction and orbit data formats. Conjunction messages can describe a close approach, and orbit data messages can describe predicted states. SAIL adds the next question: what does the autonomous system intend to do, under what authority, with what uncertainty, and how will the decision be audited after execution?

The open-source implementation includes a JSON Schema, example coordination messages, a validator, and a toy simulation. The simulation compares an uncoordinated active-active conjunction with a SAIL-mediated exchange. In the uncoordinated case, both maneuverable satellites may act independently. In the SAIL case, one operator claims maneuver responsibility, the other defers, and post-maneuver confirmation completes the audit trail. This simple result illustrates the paper's larger claim: governing megaconstellations requires visibility into system behavior, not just object-level compliance.

## Figure Idea

Show two side-by-side flows:

- Without SAIL: alert -> both operators maneuver -> conflict uncertainty remains
- With SAIL: alert -> maneuver intent -> responsibility claim -> confirmation -> audit record

## Table Idea

| Paper layer | SAIL contribution |
| --- | --- |
| Spacecraft autonomy | State update, maneuverability, autonomy mode |
| Neighborhood autonomy | Maneuver intent, responsibility claim, post-maneuver confirmation |
| Infrastructure autonomy | Audit record, software version, stress-test evidence |

## Appendix Section Draft

### Appendix: Computational Prototype for Cross-Operator Satellite Coordination

To support the paper's three-layer model of satellite autonomy, I developed an open-source computational prototype called the Orbital Coordination Standard. The prototype translates the paper's conceptual argument into a testable software artifact: a proposed Satellite Autonomy Interoperability Layer (SAIL), a toy coordination simulation, a trained coordination-pressure model, a FastAPI service, and a dashboard for visualizing constellation-scale behavior.

The prototype uses the UCS active satellite catalog as a research dataset and trains a supervised model to estimate a surrogate coordination-pressure tier for each satellite. This tier is not a prediction of collision probability or operational risk. Instead, it is a research signal used to identify which satellites would likely require greater coordination visibility under dense, multi-operator conditions. The model output is then connected to six stress-test scenarios, including mass conjunction alerts, degraded tracking accuracy, ground-station outages, failed software updates, cross-operator maneuver conflicts, and partial deorbit failures.

The dashboard visualizes the results through the same three layers used in the paper. At the spacecraft layer, it highlights local maneuverability, disposal, and audit-priority pressures. At the neighborhood layer, it shows cross-operator maneuver intent and responsibility claims. At the infrastructure layer, it shows fleet-level routing dependency, common-mode software risk, and operator concentration. A communication-graph view simulates SAIL-style messages across the satellite catalog, including state updates, conjunction alert references, maneuver intents, responsibility claims, and post-maneuver confirmations.

This appendix artifact is not intended as an operational spaceflight system. Its purpose is to demonstrate that the paper's governance claim can be made computationally concrete: if megaconstellations behave like layered robotic infrastructure, then regulation and safety analysis should examine not only individual spacecraft, but also the machine-readable coordination signals exchanged among spacecraft, operators, and oversight systems.
