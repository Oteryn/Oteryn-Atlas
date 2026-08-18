# DYN-ATLAS-001 — Semantic Thais Z7 Proof

```yaml
task_id: DYN-ATLAS-001
title: Semantic Thais Z7 Proof
status: blocked
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 0fa9b37d6aab111ecde9ade9b344cc6552e4f265
branch: feat/DYN-ATLAS-001-semantic-thais-z7-proof
pr: 1
owner: ChatGPT autonomous execution
created_at: 2026-08-18T09:24:00+02:00
updated_at: 2026-08-18T09:42:00+02:00
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
- Game authority after blocker repair/closeout: `blakinio/Oteryn-v2@ade3005cdf9ad6daeb87dc20a6546d5c29ee61da`
  - `docs/contracts/OTERYN_GAME_ATLAS_EXPORT_CONTRACT_V1.md`
  - `docs/contracts/OTERYN_WORLD_SPATIAL_COORDINATE_PROFILE_V1.md`
  - `docs/contracts/OTERYN_CRYSTALSERVER_LEGACY_SPATIAL_IMPORT_PROFILE_V1.md`
- Legacy/reference migration source: `blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce`
  - `docs/maps/otbm-atlas-conversation-handover-20260813.md`
  - `tools/otbm_atlas/**`
- Independent legacy floor-direction evidence: `opentibiabr/otclient@dd5641492a71e966b96b8a91398b44bb3df67d88`, `modules/game_cyclopedia/tab/map/map.lua`.

## Preflight evidence

### PROVEN

- `Oteryn/Oteryn-Atlas` exists as the authorized physical Atlas repository and the connected GitHub App has admin/push access.
- Atlas bootstrap `main` is `0fa9b37d6aab111ecde9ade9b344cc6552e4f265`; repository governance preserves Game authority and forbids browser-runtime OTBM fallback.
- No pre-existing DYN-ATLAS-001 implementation PR/path owner existed before PR #1.
- Game export contract `oteryn-game-atlas-export-v1` requires immutable public-safe snapshots, Game-owned producer semantics, explicit coordinate profile, fail-closed consumer validation, and forbids OTBM/Legacy IR/Canary/Crystal as alternate/fallback world truth.
- Game spatial contract `oteryn-world-spatial-v1` defines native +X east, +Y south, finite half-open bounds, explicit `FloorId`, explicit `PresentationOrderKey`, anchor/footprint and displacement semantics.
- The previously missing legacy mapping is now accepted. Game PR #329 exact head `5cc065b0c1ed36113fb65f97ed327af2fb8ebe37` passed Agent Governance #1612, Architecture Semantic Audit #202, Merge Authority Audit #425 and Merge Gate #466, then squash-merged as `227e4e3bd64c3911280c8388e2a833cb210f24fd`. Closeout PR #330 merged as `ade3005cdf9ad6daeb87dc20a6546d5c29ee61da`.
- Accepted importer profile `oteryn-crystalserver-legacy-spatial-import-v1` maps legacy x/y by checked identity, legacy `Z` to `FloorId=-Z`, inclusive legacy bounds to native half-open bounds, and visible ground/top-level source order to explicit `PresentationOrderKey { plane:0, order:index }`; nested container children are not visible spatial stack entries.
- Therefore the historical Thais source selection `X=32280..32440`, `Y=32155..32305`, legacy `Z=7` maps to native `x=[32280,32441)`, `y=[32155,32306)`, `floor=-7`.
- Legacy Otheryn migration evidence pins CrystalServer source `zimbadev/crystalserver@5e89bf8329ea406cb4ea8f4a18f32954f13e5418`, canonical `world.otbm` SHA-256 `3bd40d14fefec41f24c4b3ae879e420be1a831ef55b95dcbec721e587a09b034`, and the historical Thais regression counts: 24,311 tiles, 24,292 ground items, historical 15,037 child items, newer semantic-parser 14,993 child items, 39,329 render operations, 872 unique appearance IDs, 1,000 unique sprite IDs and zero missing appearance/sprite refs in the legacy reference pipeline.
- Legacy asset provenance/location is pinned to `vendor/map-analysis/tibia-client/15.25.bd5a04/assets/` in Otheryn, but the accepted Game export contract explicitly states that provenance does not grant third-party redistribution rights.
- The user-supplied `/mnt/data/otservbr(4).otbm` was independently hashed as `a80de1dda6a9aca3956a9d5b7fb2e0caebb451570d26853fc21beb40d5f31da2`; it does **not** match the canonical CrystalServer world digest above and therefore is not substituted for the pinned proof source.
- The user-supplied `/mnt/data/assets(1).zip` was independently hashed as `01c45146e2fcec3f4087844e0cbc1817fb1d60b310a35ac5d88c07aab6f73d1a`; possession/upload alone does not establish redistribution rights or a canonical appearance profile.
- Atlas PR #1 exact prior checkpoint head `001bf2ae00651a945e0fa6ab155d9921eacc852a` passed repository CI run `32111494565`.

### DERIVED

- The coordinate/floor/presentation-order authority blocker is closed; Atlas no longer needs or may invent legacy `Z7`/stack semantics.
- The uploaded OTBM cannot be used as a silent replacement source because its digest differs from the pinned source authority.
- Committing or republishing Tibia/CipSoft sprite pixels to this public Atlas repository is not authorized by provenance or possession alone.
- A synthetic/public-safe appearance fixture could exercise renderer mechanics, but without a Game-owned bounded semantic export and an approved visual/parity basis it would not truthfully complete the named Thais proof; a partial demo is therefore not treated as acceptance.

### UNKNOWN

- Explicit rights/authorization for redistribution/publication of the exact pinned Tibia asset subset needed for Thais Z7, **or** an accepted non-proprietary/public-safe appearance fixture and parity basis that is sufficient for the canonical DYN-ATLAS acceptance criteria.
- A Game-owned bounded semantic export artifact/fixture and digest for the selected Thais slice under `oteryn-game-atlas-export-v1`.
- A Game-owned appearance spatial profile for the selected proof assets sufficient to preserve required anchor/footprint/displacement semantics.

### CONFLICT

- None in accepted architecture. The remaining stop is missing asset/appearance authority and producer fixture evidence, not contradictory contracts.

## Stop condition

The canonical execution prompt requires stopping without workaround when fixture licensing/provenance is unresolved, and explicitly rejects a partial visual demo as completion when semantic/determinism/authority gates are not proven.

The original Game coordinate/floor/order stop has been repaired and merged. The **current real stop condition** is now:

1. no explicit redistribution/publication authorization for the pinned Tibia/CipSoft pixel assets, and no accepted public-safe replacement appearance/parity fixture sufficient for DYN-ATLAS-001;
2. no bounded Game-owned Thais semantic export artifact/digest exists yet under the accepted export + importer profiles.

The first condition alone is sufficient to stop a complete browser sprite/render/parity proof. Atlas will not publish proprietary pixels, infer rights from possession, substitute a mismatched uploaded OTBM, or manufacture visual parity evidence.

## Validation performed

- repository/install permission check: PASS — `Oteryn/Oteryn-Atlas` available with admin/push;
- Atlas bootstrap main: PASS — `0fa9b37d6aab111ecde9ade9b344cc6552e4f265`;
- task/PR overlap: PASS — PR #1 is the sole DYN-ATLAS-001 task PR in Atlas;
- Platform canonical prompt/programme: PASS, pinned;
- Game export/spatial/importer authority: PASS — importer PR #329 merged and task archived by PR #330;
- legacy Thais source/bounds/count/provenance: PASS, pinned;
- uploaded OTBM digest comparison: PASS — supplied hash differs from canonical source and is rejected as implicit substitution;
- asset archive digest capture: PASS — digest recorded, rights remain UNKNOWN;
- Atlas prior checkpoint CI: PASS — run `32111494565`;
- browser/runtime implementation and E2E: NOT_APPLICABLE at this stop generation because the canonical asset/appearance gate prevents a truthful complete proof.

## Next action

Owner/asset authority must provide **one** of the following before DYN-ATLAS-001 can resume:

- explicit authorization/proven rights for the exact sprite/appearance subset required by the pinned Thais proof, together with the Game-owned appearance spatial profile; or
- an accepted legally/public-safe replacement appearance fixture and named parity basis that satisfies the canonical proof rather than only producing a placeholder demo.

In parallel or immediately after that gate closes, Game must produce/pin the bounded Thais semantic export artifact/digest under `oteryn-game-atlas-export-v1` + `oteryn-world-spatial-v1` + `oteryn-crystalserver-legacy-spatial-import-v1`. Then Atlas may implement Svelte/TypeScript/PixiJS consumer rendering, immutable chunks, deduplication, semantic picking/inspector, deterministic navigation and required measurements on a new exact-head implementation generation.
