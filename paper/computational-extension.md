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
