# Hunt Intelligence upstream readiness — 2026-08-24

## Scope

This is Atlas-side read-only evidence for Issue #117. It does not create, allocate, activate, or modify any work in `Oteryn/Oteryn-Game`.

## Exact upstream provenance

- Game repository: `Oteryn/Oteryn-Game`
- inspected `main`: `30c733c8c8cb4a1fbcf63010bcb6709a9109dde6`
- Game mutation by this programme: **none**

## Capability classification

| Capability | State | Evidence |
| --- | --- | --- |
| `hunt-catalog-v1` | `UPSTREAM_BLOCKED` | Exact-revision `git grep` returned no `hunt-catalog-v1` / Hunt Catalog producer or publication. The general Game→Atlas contract is still runtime `NOT_IMPLEMENTED` and forbids Atlas-side reconstruction of missing Game facts. |
| `hunt-performance-v1` | `UPSTREAM_BLOCKED` | Exact-revision `git grep` returned no `hunt-performance-v1` / Hunt Performance producer or publication. `docs/architecture/ANL-02_GAMEPLAY_BALANCE_WORLD_ANALYTICS_CONTRACT_CANDIDATE.md` reports `ImplementationStatus: NOT_STARTED` and grants no production authority. |

## Atlas consequence

The Atlas consumer readiness layer may be implemented and tested with synthetic test-only fixtures. Production Hunt Catalog, VERIFIED hunt navigation/routes, MEASURED panels, saturation/history, and the recommender remain unavailable. Atlas must not manufacture Hunt Areas, routes, XP/profit/risk values, or measured cohorts to fill those gaps.

The implemented consumer contract requires an explicitly accepted upstream `contract_id` and exact Game revision before accepting either future capability. Browser readiness projection strips Game SHA and internal evidence details.

## Upstream requirement (suggestion only)

A future separately authorized Game programme may evaluate publishing a stable Hunt Catalog/route-access capability and a privacy-safe Hunt Performance aggregate with the scoping, attribution, cohort, metric, completeness, valuation and privacy semantics described in `docs/agents/tasks/active/ATLAS-HUNT-INTELLIGENCE-PROJECT.md`. This note is not authority to modify Game.
