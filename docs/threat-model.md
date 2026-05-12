# Threat Model

SAIL messages can influence safety-relevant decisions, so the standard must assume mistakes, delays, and adversarial misuse.

## Primary Risks

- Stale intent messages used after expiration
- False maneuver claims
- Conflicting responsibility claims
- Incorrect object identity
- Understated uncertainty
- Replay of old messages
- Unauthenticated or spoofed operator messages
- Denial of service during conjunction response

## Baseline Mitigations

- Mandatory `created_at` and `valid_until` fields
- Mandatory object and operator identifiers
- Mandatory uncertainty metadata for state and intent
- Explicit decision mode: autonomous, human-approved, pending, or emergency
- Audit fields linking decisions to input data and software version
- Recommended cryptographic signing outside the JSON payload

## Non-Goals

SAIL v0.1 does not define a cryptographic trust infrastructure, radio protocol, or ground-network authentication system. Those are required for operational deployment, but this draft focuses on the application message semantics.
