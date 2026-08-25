# ATLAS-CREATURE-GAMEPLAY-PROFILES

```yaml
issue: 165
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: ee7c8a53e6b5ac46c7620065bcf5e03694e24c5b
branch: feat/creature-gameplay-profiles-165
pr: 170
status: verifying
programme: ATLAS-CREATURE-GAMEPLAY-PROFILES
game_issue: Oteryn/Oteryn-Game#136
game_pr: Oteryn/Oteryn-Game#138
game_sha: b56ce339281d252a9e01a5a2bed583582bf29e68
game_capability: creature-gameplay-profiles-v1
game_schema: 1
game_semantic_digest: sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28
```

## Outcome

Consume the exact merged Game gameplay-profile projection through a bounded lazy browser service and expose truthful NPC/monster Gameplay profiles while preserving the existing Semantic inspector and #113 direct creature interaction.

## Active overlap

- PR #162 / Issue #145 owns walking-in-place runtime and currently touches `web/fullworld-creatures.mjs`.
- PR #163 / Issue #115 owns creature presentation and currently touches `web/fullworld-creatures.mjs` and `web/fullworld-app.mjs`.
- Issue #113 is merged and its quick-card/interaction seam is canonical.
- PR #143 is merged; Farm Explorer stays a consumer, never gameplay-fact authority.

Pure consumer/state/model and publication paths are owned here. Shared runtime wiring must be rebased against fresh #162/#163 state before final-head freeze.

## Acceptance

- [x] Exact merged Game SHA/digest are pinned and committed publication bytes rebuild exactly.
- [x] Consumer rejects malformed/mixed/corrupt/unbounded products and lazily fetches one entity shard with bounded LRU cache.
- [x] `inspector=gameplay|semantic|live` is durable; gameplay default; unavailable live falls back to gameplay.
- [x] NPC Sells/Buys/Services/Travel and monster Loot/Stats/Resistances/Spawns distinguish COMPLETE from non-complete absence.
- [x] Quick card remains immediate and gains only bounded proven profile summaries.
- [x] Existing Semantic facts remain available.
- [ ] Desktop/mobile direct creature E2E, visual review, exact-head Molehill gate, CI/provenance/security, merged-main Synology live gameplay acceptance all pass.

## Verification checkpoint

- Rebased cleanly onto main@ee7c8a53e6b5ac46c7620065bcf5e03694e24c5b.
- Exact Game publication: 1049 NPC / 1800 monster profiles / 508 shards / sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28.
- CI-equivalent deterministic Node matrix after rebase: 302/302 PASS, 0 fail, 0 skip.
- Required Playwright census is now 70 (64 merged-main + 6 gameplay journeys).
- Molehill browser qualification pending serialized machine lock.

## Excluded

No Game mutation, no Platform/legacy/wiki fallback, no item identity invention, no live Game state, no task-branch deployment.
