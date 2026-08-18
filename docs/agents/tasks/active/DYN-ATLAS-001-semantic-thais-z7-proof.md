# DYN-ATLAS-001 — Semantic Thais Z7 Proof

```yaml
task_id: DYN-ATLAS-001
title: Semantic Thais Z7 Proof
status: blocked
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 0fa9b37d6aab111ecde9ade9b344cc6552e4f265
branch: feat/DYN-ATLAS-001-semantic-thais-z7-proof
pr: pending
owner: ChatGPT autonomous execution
created_at: 2026-08-18T09:24:00+02:00
owned_paths:
  - docs/agents/tasks/active/DYN-ATLAS-001-semantic-thais-z7-proof.md
  - src/**
  - static/**
  - tests/**
  - package.json
  - package-lock.json
  - svelte.config.js
  - vite.config.ts
  - tsconfig.json
  - playwright.config.ts
```

## Goal

Execute the canonical `DYN-ATLAS-001 — Semantic Thais Z7 Proof` as a bounded Atlas consumer proof without turning Atlas into a second World authority and without parsing OTBM/Legacy IR in browser runtime.

## Canonical authority pinned for preflight

- Platform programme/prompt: `blakinio/Oteryn-Platform@c14c790b63401acb84552a4c7e45743e0bc007c5`
  - `docs/maps/oteryn-dynamic-semantic-atlas-program.md`
  - `docs/maps/oteryn-dynamic-semantic-atlas-execution-prompt.md`
- Game contracts: `blakinio/Oteryn-v2@16c665223c1256cc7e4a8a97cf2bc34cd278423c`
  - `docs/contracts/OTERYN_GAME_ATLAS_EXPORT_CONTRACT_V1.md`
  - `docs/contracts/OTERYN_WORLD_SPATIAL_COORDINATE_PROFILE_V1.md`
- Legacy/reference migration source: `blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce`
  - `docs/maps/otbm-atlas-conversation-handover-20260813.md`
  - `tools/otbm_atlas/**`

## Preflight evidence

### PROVEN

- `Oteryn/Oteryn-Atlas` now exists as the authorized physical Atlas repository and the GitHub integration has admin/push access.
- Atlas bootstrap `main` is `0fa9b37d6aab111ecde9ade9b344cc6552e4f265`; repository governance explicitly preserves Game authority and forbids browser-runtime OTBM fallback.
- No pre-existing DYN-ATLAS-001 PR or repository task owns the implementation paths.
- Game export contract `oteryn-game-atlas-export-v1` requires immutable public-safe snapshots, Game-owned producer semantics, explicit coordinate profile, fail-closed consumer validation, and forbids OTBM/Legacy IR/Canary/Crystal as alternate/fallback world truth.
- Game spatial contract `oteryn-world-spatial-v1` is accepted and defines native +X east, +Y south, finite half-open bounds, explicit `FloorId`, explicit `PresentationOrderKey`, anchor/footprint and displacement semantics.
- The same spatial contract explicitly does **not** define a legacy OTBM/Tibia coordinate/floor mapping; it requires a pinned importer profile with provenance.
- Legacy Otheryn migration evidence pins CrystalServer source `zimbadev/crystalserver@5e89bf8329ea406cb4ea8f4a18f32954f13e5418`, canonical `world.otbm` SHA-256 `3bd40d14fefec41f24c4b3ae879e420be1a831ef55b95dcbec721e587a09b034`, and the historical Thais regression region `X=32280..32440`, `Y=32155..32305`, legacy `Z=7`.
- The same evidence records 24,311 tiles for that 161x151 region, 24,292 ground items, historical 15,037 child-item count, newer semantic-parser 14,993 child-item count, 39,329 historical render operations, 872 unique appearance IDs, 1,000 unique sprite IDs and zero missing appearance/sprite references in the legacy reference pipeline.
- Legacy asset location/provenance is pinned to `vendor/map-analysis/tibia-client/15.25.bd5a04/assets/` in Otheryn, but the accepted Game export contract explicitly states that this does not grant third-party asset redistribution rights.

### DERIVED

- The historical Thais rectangle is sufficient as a reproducible **legacy source selection rule**, but it cannot yet be promoted to a native Game/Atlas fixture because legacy `Z=7` has no accepted mapping to native `FloorId`.
- Preserving legacy tile item order directly in an Atlas fixture without a Game-owned importer/export mapping would let legacy representation leak into canonical presentation ordering.
- Committing or republishing Tibia/CipSoft sprite assets to this public Atlas repository is not authorized by provenance alone.

### UNKNOWN

- Accepted Game-owned importer profile mapping legacy CrystalServer/Tibia `x/y/z` and tile item ordering into `oteryn-world-spatial-v1`, including exact mapping of legacy `Z=7` to native `FloorId` and explicit `PresentationOrderKey` assignment.
- Explicit rights/authorization for redistribution of the pinned Tibia asset subset from Otheryn into public `Oteryn-Atlas`, or an approved non-proprietary/public-safe appearance fixture that can satisfy DYN-ATLAS-001 sprite-dedup/render/parity gates.
- Game-owned bounded semantic export fixture/digest for the selected Thais slice under `oteryn-game-atlas-export-v1`.

### CONFLICT

- None in accepted architecture. The current blocker is missing required evidence/contracts, not contradictory authority.

## Stop condition

The canonical execution prompt requires stopping without workaround when the proof cannot truthfully preserve canonical coordinate/floor/stack semantics or when fixture licensing/provenance is unresolved.

That condition is reached before Atlas runtime implementation:

1. native spatial semantics exist, but the required **legacy importer mapping** for the pinned Thais `Z=7` source does not;
2. source asset provenance exists, but **redistribution rights / approved public-safe sprite fixture authority** do not.

Atlas will not guess `FloorId`, copy legacy stack order into canonical presentation order, or publish proprietary assets to make a demo appear complete.

## Validation performed

- live repository/install permission check: PASS — `Oteryn/Oteryn-Atlas` available with admin/push;
- current `main`/bootstrap check: PASS — `0fa9b37d6aab111ecde9ade9b344cc6552e4f265`;
- task/PR overlap search: PASS — no existing DYN-ATLAS-001 PR found;
- Platform canonical prompt/programme read: PASS;
- Game export/spatial contract read: PASS;
- legacy Thais source/bounds/provenance read: PASS;
- accepted legacy importer mapping search: BLOCKED — none located beyond the spatial contract requirement for an explicit importer profile;
- asset redistribution/public-safe fixture gate: BLOCKED — provenance is present but redistribution permission is not established by the accepted contracts;
- browser/runtime implementation and E2E: NOT_APPLICABLE until the two authority gates above are closed.

## Next action

Close the blockers in their owning authority before resuming this branch:

1. Game: accept a bounded/versioned CrystalServer/Tibia legacy spatial+presentation importer profile and produce/pin a Game-owned Thais semantic fixture/export digest for the regression region;
2. Asset authority: record explicit redistribution authorization for the required sprite subset **or** approve a legally/public-safe replacement appearance fixture that still exercises deduplication, multi-tile/anchor/displacement and visual reference requirements.

After both are proven, resume DYN-ATLAS-001 on this branch, implement the consumer/renderer proof, run deterministic rebuild/negative/renderer/navigation/measurement tests, and require exact-head CI before merge-ready status.
