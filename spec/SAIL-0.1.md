# SAIL v0.1: Satellite Autonomy Interoperability Layer

Status: Research Draft  
Date: 2026-05-12

## 1. Purpose

SAIL defines a machine-readable message layer for cross-operator satellite coordination. It supports synchronization, maneuver intent sharing, responsibility negotiation, post-maneuver confirmation, and auditability.

SAIL is built around one rule:

> Shared intent, not shared control.

An operator may use SAIL to communicate what its spacecraft or fleet intends to do. SAIL does not authorize another operator to command that spacecraft.

## 2. Relationship to Existing Standards

SAIL is intended to complement, not replace, existing standards and systems.

- CCSDS Conjunction Data Message: close-approach event information
- CCSDS Orbit Data Messages: orbit state, mean elements, ephemeris, comprehensive orbit data
- Civil coordination systems such as TraCSS: conjunction screening and space traffic coordination services

SAIL adds an application-level coordination object for autonomous or semi-autonomous response.

## 3. Message Types

SAIL v0.1 defines five core message types.

| Message type | Purpose |
| --- | --- |
| `STATE_UPDATE` | Shares current spacecraft status and maneuverability |
| `CONJUNCTION_ALERT_REFERENCE` | References an external conjunction event or screening result |
| `MANEUVER_INTENT` | Declares a planned or possible maneuver |
| `RESPONSIBILITY_CLAIM` | Claims, defers, requests, or disputes maneuver responsibility |
| `POST_MANEUVER_CONFIRMATION` | Confirms execution and expected post-maneuver state |

## 4. Common Envelope

Every SAIL message must include:

- `sail_version`
- `message_id`
- `message_type`
- `created_at`
- `valid_until`
- `operator_id`
- `object_id`
- `coordination_context`

Time values must use RFC 3339 / ISO 8601 UTC timestamps.

## 5. Coordination Context

The `coordination_context` object describes why a message exists.

Required fields:

- `context_type`: `nominal`, `conjunction`, `degraded_state`, `disposal`, `exercise`, or `emergency`
- `urgency`: `routine`, `elevated`, `urgent`, or `emergency`
- `related_event_id`: optional external CDM, screening, or incident identifier

## 6. Autonomy and Decision Mode

Safety-relevant messages must disclose how the decision was made:

- `autonomous`
- `human_approved`
- `human_pending`
- `pre_authorized_rule`
- `emergency_fallback`

This field communicates the governance posture of a decision without exposing proprietary algorithms.

## 7. Maneuver Intent Semantics

`MANEUVER_INTENT` messages should be sent when a maneuver may affect conjunction screening, nearby traffic, or shell-level coordination.

Required maneuver fields:

- `maneuver_id`
- `purpose`
- `maneuver_window`
- `intent_status`
- `decision_mode`
- `expected_post_maneuver_state`
- `uncertainty`

`intent_status` may be:

- `planned`
- `possible`
- `executing`
- `cancelled`
- `completed`

## 8. Responsibility Semantics

`RESPONSIBILITY_CLAIM` messages communicate coordination posture.

Allowed claims:

- `claiming_responsibility`
- `deferring_responsibility`
- `requesting_counterparty_action`
- `unable_to_maneuver`
- `disputing_event`
- `emergency_override`

An operator that claims responsibility is stating intent to mitigate according to its own authority and constraints. It is not assuming legal liability through the message alone.

## 9. Audit Requirements

Every autonomous safety decision should create an audit object containing:

- Input data references
- Risk threshold class
- Decision mode
- Active software version
- Communication status
- Override status
- Result status

Audit details may be shared at different transparency tiers.

## 10. Expiration

Consumers must not use a SAIL message for autonomous safety decisions after `valid_until`.

## 11. Safety Disclaimer

SAIL v0.1 is a research draft. It is not an operational flight safety system, certified collision avoidance product, or regulatory requirement.
