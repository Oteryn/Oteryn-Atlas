# ATLAS-CREATURE-GAMEPLAY-PROFILES

```yaml
issue: 165
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 12bd459f51c6d8721cdb85c25f926128efb0748f
branch: fix/creature-gameplay-live-acceptance-165
pr: 214
status: verifying
authoritative_implementation_pr: 170
authoritative_implementation_merge: 12bd459f51c6d8721cdb85c25f926128efb0748f
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

- Implementation PR #170 passed its exact-head 77/77 zero-retry Molehill gate, 17/17 manual visual review, `atlas-local-e2e`, `atlas-gate` and `provenance-gate`, then squash-merged as protected `main@12bd459f51c6d8721cdb85c25f926128efb0748f`.
- The first merged-main Synology Live Acceptance run `33064019881` staged, built and cut over that exact revision successfully, but its desktop Chromium step failed before the required Gameplay proof and rollback restored `baa45ac3010eed54aac936662a0cb8aa892181f9`.
- Root cause is acceptance-script state, not Game/Atlas publication data: Gameplay is intentionally the default inspector tab, while the live script immediately applied Semantic-only `Record`/provenance assertions after search without explicitly selecting Semantic.
- Issue #165 is reopened. Repair PR #214 is acceptance-only: deterministic RED guard first, then explicit desktop/mobile Semantic tab selection before Semantic assertions. Gameplay Sam/Rat proof remains unchanged.
- PR #162 / Issue #145 remains separate and is not imported. Issue #113 remains the canonical quick-card/interaction seam.

## Execution routing / lanes

Strategy: `parallel_first`. The repair has one tiny writer lane and independent verification lanes; final integration is serial.

- `repair`: `tests/synology-live-workflow.mjs`, `e2e/tests/live-creature-preview.cjs`, this checkpoint; branch/PR #214 only.
- `hosted-gates`: exact-head deterministic/CI/provenance/security evidence; no host lease.
- `molehill-browser`: exact-head full browser/visual evidence if the repository classifier requires it; one bounded Molehill heavy-E2E lease through the repository-approved route.
- `live-closeout`: exact merged-main Synology deployment/live evidence after protected squash merge of #214.
- integration order: RED -> GREEN -> exact-head hosted + required Molehill gate -> protected merge -> merged-main live closeout.

## Acceptance

- [x] Exact merged Game SHA/digest are pinned and committed publication bytes rebuild exactly.
- [x] Consumer/runtime/UI, Gameplay default, truthful completeness and Semantic preservation are implemented by #170.
- [x] PR #170 exact-head 77/77 zero-retry browser gate, 17/17 visual review, `atlas-local-e2e`, `atlas-gate` and `provenance-gate` passed before merge.
- [x] Merged-main failure `33064019881` was preserved with rollback evidence and received a deterministic regression before repair.
- [ ] PR #214 exact-head required verification passes and protected squash merge lands.
- [ ] A new merged-main Synology Live Acceptance succeeds without rollback and proves exact revision/container/header, committed Gameplay manifest, real Sam trade and real Rat loot.

## Verification checkpoint

- Exact Game publication: 1049 NPC / 1800 monster profiles / 508 shards / `sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28`.
- PR #170 final browser evidence: 77/77 PASS, workers=1, retries=0; 17/17 full-frame screenshots manually reviewed and digest-bound.
- Failed merged-main run: `33064019881`; evidence artifact `9644140444`; failure at `e2e/tests/live-creature-preview.cjs::assertCreatureInspector` because Gameplay was active while the assertion expected Semantic-only rows; rollback PASS.
- Repair RED commit: `ff01d0e250ca22f1748ec4e163854da85d0f7c52`.
- Minimal GREEN implementation commit: `25279270c5ad7c14d0b353330369a5adca9a626b` explicitly selects `#inspector-tab-semantic` on desktop/mobile before Semantic assertions and does not alter Gameplay proof.
- Deterministic exact-head CI on `25279270...`: 398/398 PASS, 0 fail, 0 skip, including the new live Semantic-selection regression.

## Excluded

No Game mutation, no runtime-data/schema change, no Platform/legacy/wiki fallback, no item identity invention, no fabricated live Game state, no retry/tolerance weakening and no task-branch deployment.
