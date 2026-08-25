# ATLAS-CREATURE-GAMEPLAY-PROFILES

```yaml
issue: 165
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 5697b3c0dd3d544dab363e8e1e09cf76b3cca6ba
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

## Integration state

- PR #163 / Issue #115 is merged into `main@5697b3c0dd3d544dab363e8e1e09cf76b3cca6ba`; its labels/badges presentation controller is preserved.
- PR #162 / Issue #145 remains a separate draft for walking-in-place animation and is not imported into this task.
- Issue #113 remains the canonical quick-card/interaction seam.
- Farm Explorer remains a consumer and never becomes gameplay-fact authority.
- Shared runtime was integrated by normal non-force merge-up; no open draft branch was cherry-picked.

## Acceptance

- [x] Exact merged Game SHA/digest are pinned and committed publication bytes rebuild exactly.
- [x] Consumer rejects malformed/mixed/corrupt/unbounded products and lazily fetches one entity shard with bounded LRU cache.
- [x] `inspector=gameplay|semantic|live` is durable; gameplay default; unavailable live falls back to gameplay.
- [x] NPC Sells/Buys/Services/Travel and monster Loot/Stats/Resistances/Spawns distinguish COMPLETE from non-complete absence.
- [x] Quick card remains immediate and gains only bounded proven profile summaries.
- [x] Existing Semantic facts remain available.
- [ ] Desktop/mobile direct creature E2E, 17-frame visual review, exact-head Molehill gate, CI/provenance/security and merged-main Synology gameplay acceptance all pass.

## Verification checkpoint

- Integrated current main by normal merge-up at `5697b3c0dd3d544dab363e8e1e09cf76b3cca6ba`; targeted integration contracts: 30/30 PASS.
- Exact Game publication: 1049 NPC / 1800 monster profiles / 508 shards / `sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28`.
- CI-equivalent deterministic Node matrix after integration and live-acceptance GREEN: 357/357 PASS, 0 fail, 0 skip.
- Extraction provenance verifier: PASS, 144 mapped rows against exact legacy `e417c5e7c22986bf4acef0495eb47f7b72c97cce`.
- Required Playwright census is 77 (71 merged-main scenarios + six gameplay journeys); required formal visual census is 17 (15 merged-main frames + desktop/mobile Gameplay).
- Synology candidate/live gameplay manifest contract and live Chromium Sam/Rat gameplay contract: 8/8 PASS locally; merged-main execution remains pending until PR merge.
- Final exact-head Molehill browser qualification and visual review remain pending serialized machine lock.

## Excluded

No Game mutation, no Platform/legacy/wiki fallback, no item identity invention, no live Game state, no task-branch deployment.
