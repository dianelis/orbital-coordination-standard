# Implementation Guide

SAIL can be implemented in three profiles. The profiles are intentionally separated so the standard can be useful before direct satellite-to-satellite coordination is realistic or approved.

## Profile A: Operator Gateway

Each company runs a gateway that converts internal flight dynamics, autonomy, and operations data into SAIL messages.

```text
Operator autonomy system -> Operator SAIL gateway -> Other operator gateway
```

This is the easiest deployment model because it does not require changing spacecraft radios or onboard flight software.

## Profile B: Civil Coordination Hub

Operators exchange SAIL messages through a trusted hub.

```text
Operator A gateway -> Civil coordination hub -> Operator B gateway
```

The hub does not command satellites. It validates message structure, timestamps, object identity, and routing to authorized recipients.

## Profile C: Future Onboard Relay

Satellites exchange limited SAIL messages directly or through inter-satellite links.

```text
Satellite A autonomy manager -> SAIL onboard profile -> Satellite B autonomy manager
```

This profile should be limited to constrained messages such as degraded-state beacons, intent summaries, and post-maneuver confirmations. Full operational deployment would require authentication, spectrum authorization, flight software certification, and operator-specific safety cases.

## Synchronization Cycle

A typical conjunction coordination cycle:

1. Operators publish `STATE_UPDATE` messages.
2. A screening source or coordination hub issues `CONJUNCTION_ALERT_REFERENCE`.
3. One operator publishes `MANEUVER_INTENT`.
4. The counterparty publishes `RESPONSIBILITY_CLAIM`.
5. The maneuvering operator publishes `POST_MANEUVER_CONFIRMATION`.
6. Both operators retain audit records.

## Minimum Operational Controls

Operational deployments should add controls outside the JSON payload:

- Mutual authentication
- Message signing
- Replay protection
- Rate limits
- Access control by object, operator, and event
- Transport-layer encryption
- Incident logging

## Conformance Levels

| Level | Name | Requirement |
| --- | --- | --- |
| L0 | Schema valid | Produces messages that validate against SAIL JSON Schema |
| L1 | Time safe | Rejects expired messages and invalid time windows |
| L2 | Coordination safe | Handles responsibility claims and conflicts |
| L3 | Auditable | Stores complete decision records |
| L4 | Exercise ready | Participates in simulated cross-operator stress tests |
