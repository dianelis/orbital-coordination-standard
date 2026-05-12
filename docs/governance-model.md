# Governance Model

SAIL is meant to support system accountability without requiring all-or-nothing disclosure.

## Transparency Tiers

| Tier | Audience | Information |
| --- | --- | --- |
| Public | Researchers, civil society, public | Broad autonomy description, safety summary, non-sensitive incidents |
| Operator-to-operator | Spacecraft operators and coordination services | Maneuver intent, ephemeris references, uncertainty, degraded state |
| Regulator confidential | Licensing and safety authorities | Stress-test results, thresholds, audit records, failure analysis |
| Emergency | Authorized traffic coordination bodies | Rapid failure notifications and degraded tracking status |

## Governance Goals

- Make autonomy testable before deployment.
- Make cross-operator maneuver coordination machine-readable.
- Preserve proprietary implementation details.
- Create evidence for post-event review.
- Encourage compatibility with civil SSA/STC systems such as TraCSS and international counterparts.

## Adoption Path

1. Use SAIL in open simulations and academic studies.
2. Add SAIL export/import to operator test harnesses.
3. Validate message examples against CCSDS-derived orbit and conjunction data.
4. Run cross-operator tabletop exercises.
5. Submit lessons learned to standards bodies and civil space traffic coordination programs.
