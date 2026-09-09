# Oteryn Atlas

`Oteryn-Atlas` is the derived semantic browser atlas for the Oteryn ecosystem.

## Authority boundary

- `Oteryn-Game` owns canonical World/Content semantics.
- Atlas consumes explicit, versioned, public-safe Game exports and owns derived publication/indexing, browser rendering, search, inspection, and Atlas presentation.
- Legacy OTBM/Tibia/Canary/Crystal data is migration/reference evidence only, not browser-runtime authority.
- Atlas must not become a second canonical item/NPC/monster/loot/world database or invent Game-owned coordinates, floors, ordering, or identities.

## Active verification model

Selective verification is blocking authority on protected `main`. PRs are evaluated through protected `pull_request_target`; Merge Queue uses direct `merge_group: checks_requested`. Protected workflow/planner/catalog/impact/stable-ID policy decides the obligations, while candidate bytes remain inert verification subjects.

Verification profile and data capability are independent. The data capabilities are `qualification_fixture`, `bounded_real_world`, and `real_fullworld`; ordinary verification uses the minimum truthful capability, while FullWorld/Molehill is specialist-only when the oracle genuinely requires it. Accepted deterministic/browser retries are zero.

Existing repository and organization rulesets plus Merge Queue remain merge authority. Verification success does not imply publication or deployment authority; those are separate lifecycles.

## Repository areas

- `src/` — browser/runtime code and derived Atlas semantics;
- `web/` — browser portal surfaces;
- `tools/` — publication, generation, verification, and governance tooling;
- `e2e/` — Playwright/Docker verification harness;
- `docs/` — architecture, operations, agent, and historical evidence;
- `.github/workflows/` — current active GitHub Actions topology.

For verification placement read `docs/agents/operations/VERIFICATION_CAPABILITY.md`. For separately authorized live operations read `docs/agents/operations/LIVE_DEPLOYMENT.md`, `docs/operations/ATLAS-LIVE-OPERATIONS.md`, and `docs/recovery/ATLAS-LIVE-RECOVERY.md`.

Completed maintenance/restoration material is historical evidence, not standing authority to restart retired lifecycle phases.