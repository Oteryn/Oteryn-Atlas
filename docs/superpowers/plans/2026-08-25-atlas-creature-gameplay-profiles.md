# Atlas Creature Gameplay Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Game-owned immutable creature gameplay profile and an Atlas Gameplay inspector tab that truthfully shows NPC trade/services and monster loot/combat facts while preserving the existing Semantic/provenance view.

**Architecture:** Oteryn-Game owns a new `creature-gameplay-profiles-v1` producer and capability contract. Oteryn-Atlas consumes only that immutable projection through a bounded lazy loader, joins it to placements by `entity_id`, renders a user-facing Gameplay tab, and extends exact-head browser plus merged-main Synology live acceptance to exercise real NPC trade and monster loot flows.

**Tech Stack:** Python 3 stdlib Game producer/tests, canonical JSON + SHA-256, vanilla ES modules, Canvas/DOM FullWorld UI, Node test runner, Playwright/Chromium, GitHub Actions, Docker, Synology merged-main acceptance.

**Spec:** `docs/superpowers/specs/2026-08-25-atlas-creature-gameplay-profiles-design.md`

## Global Constraints

- Oteryn-Game is the only canonical owner of gameplay-profile semantics and public-field classification.
- Atlas must not parse OTBM, Canary/Crystal XML/Lua, Platform data, wiki/community data, or display-name matches as runtime authority.
- Platform may not become an Atlas gameplay-profile transit/data source.
- Existing creature placement `record_id` remains placement identity; gameplay joins use `entity_id` only.
- Empty data is authoritative absence only when the relevant subsection state is `COMPLETE`.
- `Gameplay` is the default inspector tab; `Semantic` remains intact; `Live state` remains reserved for genuinely dynamic facts.
- No arbitrary Lua execution, `eval`, server boot, or runtime script execution is allowed to extract gameplay profiles.
- No task branch may deploy to Synology. Live deployment/acceptance occurs only from merged Atlas `main`.
- Exact-head browser qualification follows Atlas `AGENTS.md`, `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`, and current visual acceptance requirements.
- Coordinate with Atlas #114 Item & Spawn Farm Explorer and #117 Hunt Intelligence: this programme owns creature gameplay-profile facts; those programmes may consume the merged profile primitives but must not duplicate Game authority.

---

### Task 1: Allocate implementation lifecycle in both repositories

**Files:**
- Read: `Oteryn/Oteryn-Game/AGENTS.md`
- Read: `Oteryn/Oteryn-Atlas/AGENTS.md`
- Read: `Oteryn/Oteryn-Game/docs/contracts/OTERYN_GAME_ATLAS_EXPORT_CONTRACT_V1.md`
- Read: `Oteryn/Oteryn-Atlas/docs/superpowers/specs/2026-08-25-atlas-creature-gameplay-profiles-design.md`
- Read: `Oteryn/Oteryn-Atlas/docs/superpowers/plans/2026-08-25-atlas-creature-gameplay-profiles.md`

**Interfaces:**
- Consumes: current protected `main` in Game and Atlas, programme Issue #159.
- Produces: one Game implementation issue/branch/PR and one Atlas implementation issue/branch/PR, exact base SHAs, overlap report, and final cross-repository dependency order.

- [ ] **Step 1: Refresh GitHub authority and overlapping work**

Resolve exact `main` SHA, active related PRs/issues, branch protection, and current Game/Atlas contract state. Search specifically for `creature_loot`, `npc_shop`, gameplay profiles, creature inspector, #114, #117, and any newer successor to the Game→Atlas contract.

- [ ] **Step 2: Create the Game implementation issue**

The issue body must state that Game changes are export/read-model only, that arbitrary Lua execution is forbidden, and that Atlas remains read-only until the Game PR merges.

- [ ] **Step 3: Create dedicated Game branch from exact current Game main**

Use a branch name equivalent to:

```text
feat/creature-gameplay-profiles-v1
```

- [ ] **Step 4: Create or update the Atlas implementation issue**

Reference #159 and the exact merged Game issue. Record that Atlas implementation cannot pin a candidate Game SHA as final authority; it must consume the exact merged Game SHA.

- [ ] **Step 5: Do not modify Atlas runtime yet**

Stop this task with only lifecycle allocation complete. Game producer is the dependency.

### Task 2: Freeze the Game capability contract and shared creature identity seam

**Files:**
- Create: `Oteryn-Game/docs/contracts/OTERYN_GAME_ATLAS_CREATURE_GAMEPLAY_PROFILES_V1.md`
- Create: `Oteryn-Game/tools/game-atlas-creatures/identity.py`
- Modify: `Oteryn-Game/tools/game-atlas-creatures/export.py`
- Modify: `Oteryn-Game/tools/game-atlas-creatures/self_test.py`
- Test: `Oteryn-Game/tools/game-atlas-creatures/self_test.py`

**Interfaces:**
- Consumes: current `static-creatures-v1`/`animated-creatures-v1` entity identity rules.
- Produces: reusable `stable_creature_entity_id(kind: str, normalized_name: str) -> str` and the normative gameplay profile contract.

- [ ] **Step 1: Write a regression proving entity IDs do not change when identity code is factored**

Add fixture assertions for at least one NPC and one monster. Expected IDs must equal the current exporter output before refactoring.

- [ ] **Step 2: Run the creature exporter self-test and confirm the new regression fails before the helper exists**

Run:

```bash
python tools/game-atlas-creatures/self_test.py
```

Expected: FAIL because `identity.py`/shared function is not yet present.

- [ ] **Step 3: Implement the shared identity helper**

The helper must preserve the existing hash semantics exactly. Both placement exporter and gameplay producer will import this helper rather than independently reimplement entity identity.

- [ ] **Step 4: Re-run the self-test**

Expected: PASS with byte-/identity-compatible placement output.

- [ ] **Step 5: Write the Game-owned capability contract**

Freeze:

```text
capability = creature-gameplay-profiles-v1
profile_schema_version = 1
```

Define NPC `shop/services/travel`, monster `loot/stats/resistances`, referenced-item records, subsection state vocabulary, integer probability representation `chance_ppm`, fail-closed unknown/partial semantics, provenance, deterministic ordering, digest rules, and public safety.

- [ ] **Step 6: Commit**

```bash
git add docs/contracts/OTERYN_GAME_ATLAS_CREATURE_GAMEPLAY_PROFILES_V1.md tools/game-atlas-creatures/identity.py tools/game-atlas-creatures/export.py tools/game-atlas-creatures/self_test.py
git commit -m "feat(atlas): define creature gameplay profile contract"
```

### Task 3: Build the Game gameplay-profile producer with static fail-closed extraction

**Files:**
- Create: `Oteryn-Game/tools/game-atlas-creature-gameplay/export.py`
- Create: `Oteryn-Game/tools/game-atlas-creature-gameplay/self_test.py`
- Create: `Oteryn-Game/tools/game-atlas-creature-gameplay/fixtures/complete-npc.lua`
- Create: `Oteryn-Game/tools/game-atlas-creature-gameplay/fixtures/partial-npc.lua`
- Create: `Oteryn-Game/tools/game-atlas-creature-gameplay/fixtures/complete-monster.lua`
- Create: `Oteryn-Game/tools/game-atlas-creature-gameplay/fixtures/partial-monster.lua`

**Interfaces:**
- Consumes: `stable_creature_entity_id`, bounded migration/reference evidence roots.
- Produces: `export_gameplay_profiles(npc_root, monster_root) -> dict` with normalized profiles and referenced items.

- [ ] **Step 1: Write failing synthetic tests for complete NPC shop and travel**

Synthetic fixture expectations must include exact integer prices, Sell/Buy separation, normalized services, and static travel destination/price.

- [ ] **Step 2: Write failing synthetic tests for complete monster loot/stats/resistances**

Include an exact conversion example such as source chance `80000/100000` becoming `chance_ppm=800000`, plus min/max count and basic numeric stats.

- [ ] **Step 3: Write failing tests for unsupported dynamic constructs**

The partial NPC and monster fixtures must contain bounded examples of dynamic mutation/callback syntax that the extractor deliberately does not execute. Expected result: proven entries remain, subsection state is `PARTIAL`, and a closed reason code is emitted.

- [ ] **Step 4: Write failing tests for complete-empty versus unknown-empty**

A statically complete empty shop/loot must produce `COMPLETE` with an empty list. Missing/unsupported evidence must produce `UNKNOWN`/`PARTIAL`, never complete empty.

- [ ] **Step 5: Run producer self-test and verify RED**

Run:

```bash
python tools/game-atlas-creature-gameplay/self_test.py
```

Expected: FAIL because producer is not implemented.

- [ ] **Step 6: Implement the minimal bounded static extractor**

The producer may parse only explicit configuration shapes covered by tests. It must not execute source code. Every unsupported shape marks the affected subsection non-COMPLETE.

- [ ] **Step 7: Implement referenced-item normalization**

Deduplicate item facts. Resolved stable/export identity is used when the Game evidence supports it; otherwise preserve label with `item_ref: null` and a non-RESOLVED item state. Never promote display-name equality to canonical identity.

- [ ] **Step 8: Run producer self-test and verify GREEN**

Expected: all synthetic tests PASS.

- [ ] **Step 9: Commit**

```bash
git add tools/game-atlas-creature-gameplay
git commit -m "feat(atlas): export creature gameplay profiles"
```

### Task 4: Make the Game product deterministic, sharded, bounded, and independently auditable

**Files:**
- Modify: `Oteryn-Game/tools/game-atlas-creature-gameplay/export.py`
- Modify: `Oteryn-Game/tools/game-atlas-creature-gameplay/self_test.py`
- Create: `Oteryn-Game/.github/workflows/game-atlas-creature-gameplay-profiles.yml`
- Create: `Oteryn-Game/docs/agents/evidence/OTV2-20260825-atlas-creature-gameplay-profiles-readiness.md`

**Interfaces:**
- Consumes: normalized gameplay profiles from Task 3.
- Produces: deterministic manifest + shards, semantic digest, measured census, hard bounds, CI evidence.

- [ ] **Step 1: Add determinism tests**

Shuffle source discovery/order and prove canonical product bytes and semantic digest remain identical for semantically identical input.

- [ ] **Step 2: Add corruption and limit tests**

Test malformed identity, duplicate entity profile, duplicate item ref, invalid `chance_ppm`, negative price/count, oversized strings, excessive rows, unsafe shard path, digest mismatch, and byte/count mismatch.

- [ ] **Step 3: Implement manifest and deterministic shard packaging**

Shard lookup must be derived from stable entity identity, not display name. Every shard entry includes path, bytes, digest, profile count, and deterministic ordering metadata required by the contract.

- [ ] **Step 4: Measure the real authoritative/reference evidence census inside the Game-owned importer boundary**

Record actual counts and p95/max sizes for NPC profiles, monster profiles, referenced items, shop rows, loot rows, travel rows, and produced shard bytes. Use those measurements to freeze hard producer bounds with safety margin. Do not copy synthetic fixture sizes as production limits.

- [ ] **Step 5: Add the dedicated Game workflow**

The workflow must run producer self-tests, deterministic double-build comparison, contract checks, and a bounded real-evidence census without publishing a production artifact automatically.

- [ ] **Step 6: Run all Game checks required by current `AGENTS.md` and changed paths**

At minimum include the new producer tests, existing creature exporter tests, governance validation, `git diff --check`, and current required workspace/CI checks.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/game-atlas-creature-gameplay-profiles.yml docs/agents/evidence/OTV2-20260825-atlas-creature-gameplay-profiles-readiness.md tools/game-atlas-creature-gameplay
git commit -m "test(atlas): qualify creature gameplay profile export"
```

### Task 5: Review and merge the Game producer before Atlas implementation

**Files:**
- No product file changes unless review finds a defect.

**Interfaces:**
- Produces: exact merged Game SHA and semantic product digest that Atlas can pin.

- [ ] **Step 1: Push the Game branch and open one PR**

PR body must reference the Game issue, explain public-safe migration-evidence normalization, list measured bounds, and state that no Game gameplay runtime behavior changes.

- [ ] **Step 2: Perform independent review/audit**

Review specifically for arbitrary execution, silent omission under `COMPLETE`, identity/name joins, non-determinism, unbounded data, and leaked private/source details.

- [ ] **Step 3: Resolve review findings with regressions**

Every defect gets a permanent test before the fix.

- [ ] **Step 4: Require all current Game checks green**

Do not merge on stale or partial CI evidence.

- [ ] **Step 5: Squash merge with exact expected head SHA**

- [ ] **Step 6: Record exact merged Game SHA and gameplay semantic digest in the Atlas implementation issue**

Atlas work may now begin.

### Task 6: Add the bounded Atlas gameplay-profile consumer

**Files:**
- Create: `Oteryn-Atlas/src/browser/creature-gameplay-profiles.mjs`
- Create: `Oteryn-Atlas/tests/creature-gameplay-profiles.mjs`
- Modify: current Atlas publication/build workflow(s) that materialize Game-owned creature products
- Test: `Oteryn-Atlas/tests/creature-gameplay-profiles.mjs`

**Interfaces:**
- Consumes: exact merged Game `creature-gameplay-profiles-v1` manifest/shards.
- Produces: `createCreatureGameplayProfileService(options)` with `get(entityId)` returning `ready|unavailable|error`.

- [ ] **Step 1: Write failing manifest validation tests**

Reject wrong contract/capability/schema, unknown subsection state, malformed producer SHA/digest, unsafe shard paths, excessive bytes/counts, and invalid identity.

- [ ] **Step 2: Write failing lazy lookup/cache tests**

Prove only the selected entity shard is fetched and cache limits evict deterministically.

- [ ] **Step 3: Write failing profile validation tests**

Cover shop/loot integer bounds, complete-empty vs unknown-empty, invalid item refs, duplicate identities, unsafe strings, and malformed resistances.

- [ ] **Step 4: Run tests and verify RED**

```bash
node --test tests/creature-gameplay-profiles.mjs
```

- [ ] **Step 5: Implement the service**

Return deeply frozen consumer models. A gameplay-product error must not throw through the base creature overlay/render loop.

- [ ] **Step 6: Run tests and verify GREEN**

- [ ] **Step 7: Pin exact merged Game producer revision/digest through existing provenance publication rules**

Do not hard-code a pre-merge candidate SHA. Ensure mixed placement/gameplay generations fail closed.

- [ ] **Step 8: Commit**

```bash
git add src/browser/creature-gameplay-profiles.mjs tests/creature-gameplay-profiles.mjs .github tools web data
git commit -m "feat(atlas): consume creature gameplay profiles"
```

### Task 7: Add inspector tab state without regressing Semantic

**Files:**
- Create: `Oteryn-Atlas/src/browser/creature-inspector-state.mjs`
- Create: `Oteryn-Atlas/tests/creature-inspector-state.mjs`
- Modify: `Oteryn-Atlas/web/fullworld.html`
- Modify: `Oteryn-Atlas/web/fullworld-creatures.mjs`
- Modify: `Oteryn-Atlas/web/fullworld-mobile.mjs`
- Modify: `Oteryn-Atlas/web/fullworld.css`

**Interfaces:**
- Consumes: selected `record_id`, profile service result.
- Produces: durable `inspector=gameplay|semantic|live` state and accessible tab UI.

- [ ] **Step 1: Write failing pure state tests**

Cover default `gameplay`, explicit semantic, unknown value fallback, unavailable live fallback, reload serialization, and selection change retaining a valid tab.

- [ ] **Step 2: Run state tests and verify RED**

- [ ] **Step 3: Implement pure state reducer/parser**

No DOM access in the pure module.

- [ ] **Step 4: Replace the hard-coded two-button tab markup**

Create accessible tab semantics with stable IDs/data attributes. `Gameplay` and `Semantic` are enabled for selected creatures; `Live state` remains disabled until a separate authority exists.

- [ ] **Step 5: Preserve current Semantic renderer**

Move/refactor only as needed to render it under the Semantic panel. Do not delete stable ID/provenance rows.

- [ ] **Step 6: Add URL/history wiring**

Selection via quick card `Details` sets `inspector=gameplay`. Tab switching updates URL without losing `creature=`.

- [ ] **Step 7: Run deterministic state/source-contract tests**

- [ ] **Step 8: Commit**

```bash
git add src/browser/creature-inspector-state.mjs tests/creature-inspector-state.mjs web/fullworld.html web/fullworld-creatures.mjs web/fullworld-mobile.mjs web/fullworld.css
git commit -m "feat(ui): add gameplay inspector tab state"
```

### Task 8: Render NPC Gameplay truthfully and bounded

**Files:**
- Create: `Oteryn-Atlas/web/fullworld-creature-gameplay.mjs`
- Create: `Oteryn-Atlas/src/browser/creature-gameplay-model.mjs`
- Create: `Oteryn-Atlas/tests/creature-gameplay-model.mjs`
- Modify: `Oteryn-Atlas/web/fullworld-creatures.mjs`
- Modify: `Oteryn-Atlas/web/fullworld.css`

**Interfaces:**
- Consumes: validated NPC profile + referenced items + current placement entity ID.
- Produces: normalized display sections for Sells, Buys, Services, Travel, Locations summary.

- [ ] **Step 1: Write model tests for complete/partial/unknown NPC sections**

Assert exact user-copy distinction: complete empty may say `No items sold`; unknown/partial may not.

- [ ] **Step 2: Write tests for item-row links**

Resolved item identity creates an internal Atlas item action/reference; unresolved item identity renders non-clickable text.

- [ ] **Step 3: Write tests for large-shop windowing/search**

The model must expose a bounded initial row set and deterministic filtering without creating an unbounded DOM list.

- [ ] **Step 4: Run model tests and verify RED**

- [ ] **Step 5: Implement the pure display model**

- [ ] **Step 6: Implement the DOM renderer/controller**

Use `textContent`/DOM nodes only; do not inject source HTML. Loading, unavailable, partial, and error states are explicit.

- [ ] **Step 7: Wire NPC profile loading to selected entity ID**

A profile load failure leaves Semantic usable.

- [ ] **Step 8: Commit**

```bash
git add src/browser/creature-gameplay-model.mjs tests/creature-gameplay-model.mjs web/fullworld-creature-gameplay.mjs web/fullworld-creatures.mjs web/fullworld.css
git commit -m "feat(ui): show NPC gameplay profiles"
```

### Task 9: Render monster Gameplay and placement-backed Spawns

**Files:**
- Modify: `Oteryn-Atlas/src/browser/creature-gameplay-model.mjs`
- Modify: `Oteryn-Atlas/tests/creature-gameplay-model.mjs`
- Modify: `Oteryn-Atlas/web/fullworld-creature-gameplay.mjs`
- Modify: `Oteryn-Atlas/web/fullworld-creatures.mjs`

**Interfaces:**
- Consumes: validated monster profile and existing placement records keyed by `entity_id`.
- Produces: Loot, Stats, Resistances/Immunities, and bounded Spawns presentation.

- [ ] **Step 1: Write loot rendering model tests**

Verify `chance_ppm` -> display percent conversion, min/max count labels, unresolved item handling, complete-empty distinction, and deterministic sort modes.

- [ ] **Step 2: Write stats/resistance tests**

Null/unsupported fields never become zero; negative resistance modifiers are preserved exactly and displayed with explicit sign semantics.

- [ ] **Step 3: Write placement join tests**

Join by `entity_id` only. Include two monsters with identical display names but different identities and prove no cross-join occurs.

- [ ] **Step 4: Run tests and verify RED**

- [ ] **Step 5: Implement monster model and renderer**

- [ ] **Step 6: Implement bounded spawn summary from existing placement source**

Do not duplicate spawn facts into the gameplay product. Preserve origin/uncertainty from the placement source.

- [ ] **Step 7: Commit**

```bash
git add src/browser/creature-gameplay-model.mjs tests/creature-gameplay-model.mjs web/fullworld-creature-gameplay.mjs web/fullworld-creatures.mjs
git commit -m "feat(ui): show monster gameplay profiles"
```

### Task 10: Integrate quick-card summaries and durable navigation

**Files:**
- Modify: `Oteryn-Atlas/web/fullworld-creatures.mjs`
- Modify: `Oteryn-Atlas/tests/creature-interaction-runtime-contract.mjs`
- Modify/Create: focused URL/history tests under `Oteryn-Atlas/tests/`

**Interfaces:**
- Consumes: profile load state and existing #113 quick-card state.
- Produces: optional bounded `Shop · N sells · M buys` / `Loot · N entries` summaries and Details -> Gameplay navigation.

- [ ] **Step 1: Write regression that quick card opens immediately before profile load completes**

- [ ] **Step 2: Write regression that profile summary never changes direct-hit/chooser selection behavior**

- [ ] **Step 3: Write URL round-trip tests**

Prove `creature=` and `inspector=` survive reload/history together.

- [ ] **Step 4: Implement summary enhancement and Details routing**

Only display counts from proven entries. Never display `0 loot` from UNKNOWN/PARTIAL empty data.

- [ ] **Step 5: Run targeted #113 interaction regressions plus new gameplay tests**

- [ ] **Step 6: Commit**

```bash
git add web/fullworld-creatures.mjs tests
git commit -m "feat(ui): connect creature cards to gameplay profiles"
```

### Task 11: Add exact desktop/mobile browser and visual acceptance

**Files:**
- Create: `Oteryn-Atlas/e2e/tests/creature-gameplay-desktop.spec.mjs`
- Create: `Oteryn-Atlas/e2e/tests/creature-gameplay-mobile.spec.mjs`
- Modify: `Oteryn-Atlas/e2e/user-visual-scenarios.json` if current contract requires explicit new frames
- Modify: current test support only where necessary; do not weaken or skip existing oracles

**Interfaces:**
- Consumes: exact Atlas head and exact pinned Game gameplay product.
- Produces: real-browser behavior/visual evidence for the user journey.

- [ ] **Step 1: Add desktop NPC journey**

Directly click a real rendered NPC -> quick card -> Details -> Gameplay -> assert at least one exact known Sell/Buy row and price from the pinned Game product -> switch Semantic -> verify existing provenance -> switch back -> reload and preserve state.

- [ ] **Step 2: Add desktop monster journey**

Directly click a real rendered monster -> Details -> assert one exact Loot row/chance/count and Stats field -> verify Spawns are placement-backed.

- [ ] **Step 3: Add uncertainty journey**

Use a production-available profile with PARTIAL/UNKNOWN subsection when possible; otherwise use the repository's accepted test publication mechanism, never a runtime mutation hook. Assert no false empty claim.

- [ ] **Step 4: Add mobile journeys**

Tap NPC and monster directly; verify Gameplay tab controls, long row readability, Details/focus/Escape behavior, and no clipping/occlusion.

- [ ] **Step 5: Add large-profile boundedness case**

Use deterministic test data to prove row windowing/search stays responsive and does not render the full pathological list at once.

- [ ] **Step 6: Run targeted Playwright during development**

- [ ] **Step 7: Run the complete exact-head Molehill Docker Playwright gate with workers=1 and retries=0**

Use repository `e2e/run.ps1`; do not run a competing full gate concurrently.

- [ ] **Step 8: Open and review every required user-facing screenshot before approval**

Bind visual review to exact Atlas SHA, summary digest, and screenshot digests.

- [ ] **Step 9: Publish `atlas-local-e2e=success` only through the repository publisher**

- [ ] **Step 10: Commit any necessary test/evidence-contract changes before the final exact-head run, then rerun exact-head**

### Task 12: Extend merged-main Synology live acceptance to test the actual feature

**Files:**
- Modify: `Oteryn-Atlas/.github/workflows/synology-live-acceptance.yml`
- Modify/Create: a focused live browser script under `Oteryn-Atlas/e2e/tests/` or `Oteryn-Atlas/e2e/support/` following current workflow conventions
- Test: deterministic source-contract tests for the live workflow/script

**Interfaces:**
- Consumes: merged Atlas main + exact Game gameplay product publication.
- Produces: live evidence that the actual Gameplay tab works, not merely creature rendering/search.

- [ ] **Step 1: Write a source-contract regression that live acceptance must reference Gameplay tab selectors/content**

This must fail on the pre-feature live smoke that only searches/selects/inspects creatures.

- [ ] **Step 2: Extend live desktop smoke**

Use direct creature activation. Assert one NPC trade row, switch Semantic, and verify no runtime errors.

- [ ] **Step 3: Extend live mobile smoke**

Use direct monster activation. Assert one Loot row and one Stats fact, then switch Semantic.

- [ ] **Step 4: Bind live result to exact Atlas revision and gameplay product digest**

- [ ] **Step 5: Run deterministic workflow/source tests**

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/synology-live-acceptance.yml e2e tests
git commit -m "test(live): qualify creature gameplay profiles"
```

### Task 13: Full Atlas qualification, independent review, merge, and live closeout

**Files:**
- No new product files unless verification or review finds a defect.

**Interfaces:**
- Produces: merged Atlas main, green protected gates, successful live gameplay acceptance, closed issues, cleaned branches.

- [ ] **Step 1: Run the complete deterministic Atlas CI-equivalent suite required by current `.github/workflows/ci.yml`**

Record exact command and exact pass/fail counts.

- [ ] **Step 2: Run `git diff --check` and review the complete changed-file set**

Confirm no legacy/runtime authority shortcut, no source HTML injection, no direct Game runtime mutation, and no duplicate Hunt/Farm authority.

- [ ] **Step 3: Perform independent code/design review**

Review Game/Atlas compatibility tuple, completeness semantics, item/entity identity, lazy bounds, quick-card isolation, inspector accessibility, and live acceptance depth.

- [ ] **Step 4: Push exact Atlas head and open one implementation PR**

Reference #159 and the Atlas implementation issue. Include exact merged Game SHA/digest and verification evidence.

- [ ] **Step 5: Require all exact-head GitHub checks green**

At minimum current protected `atlas-gate` and `provenance-gate`, plus applicable CodeQL/feature workflows.

- [ ] **Step 6: Squash merge with exact expected head SHA**

- [ ] **Step 7: Let merged-main Synology deployment run under existing authority**

Do not manually deploy the feature branch.

- [ ] **Step 8: Require terminal live acceptance**

The live browser evidence must include the actual NPC Gameplay and monster Gameplay assertions introduced in Task 12.

- [ ] **Step 9: Verify issue closure and branch cleanup**

Delete completed task branches according to policy. Preserve bounded final evidence references.

- [ ] **Step 10: Report terminal outcome**

Report exact merged Game SHA, exact merged Atlas SHA, product digest, deterministic test counts, exact-head browser result, visual review status, protected gates, live desktop/mobile gameplay acceptance, and any intentionally unsupported profile subsections.
