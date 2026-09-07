# Oteryn Atlas

`Oteryn-Atlas` is the derived semantic browser atlas for the Oteryn ecosystem.

## Authority boundary

- `Oteryn-Game` owns canonical World/Content semantics.
- `Oteryn-Atlas` consumes explicit, versioned, public-safe Game exports and owns derived publication/indexing, browser rendering, search, inspection and Atlas-specific presentation.
- Legacy OTBM/Tibia/Canary/Crystal data is migration/reference evidence only and is not a browser-runtime source of truth.
- Atlas must not become a second authoritative item/NPC/monster/loot/world database or invent Game-owned coordinates, floors, ordering or identities.

## Current product scope

The repository has progressed beyond the original bounded Semantic Thais Z7 proof. Current Atlas source contains the FullWorld publication/runtime path and browser capabilities including map navigation, floor/mode state, semantic search, creature/NPC presentation and inspection, and related derived exploration surfaces.

Game data remains external authority; Atlas publications are derived, integrity-checked products rather than canonical game state.

## Temporary maintenance state

Atlas is currently in the temporary maintenance lifecycle tracked by GitHub Issue #315. The historical product verification/deployment workflow stack is suspended while corrective engineering and verification reconstruction proceed through protected repository governance. Production publication/deployment remains suspended until current authority explicitly restores it.

For mutable status and execution rules, use:

1. protected `main`;
2. root `AGENTS.md`;
3. Issue #315;
4. the workflow files currently present under `.github/workflows/`.

Historical prompts, evidence, plans and suspended workflow copies are provenance or implementation material; they are not substitutes for current lifecycle authority.

## Repository areas

- `src/` — browser/runtime code and derived Atlas semantics;
- `web/` — browser portal surfaces;
- `tools/` — publication, generation, verification and maintenance tooling;
- `e2e/` — retained Playwright/Docker verification harness;
- `docs/` — architecture, operations, maintenance, agent-task and evidence material;
- `.github/workflows/` — current active GitHub Actions topology.

Before changing verification or live-deployment behavior, follow the capability routes referenced from `AGENTS.md` rather than resurrecting historical workflow assumptions.
