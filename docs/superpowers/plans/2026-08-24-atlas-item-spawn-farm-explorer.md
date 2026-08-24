# Atlas Item & Spawn Farm Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a native FullWorld Item & Spawn Farm Explorer that joins Game-owned item/loot/task facts to verified creature placements, renders readable heatmap/cluster/detail LOD, and calculates truthfully labelled item-farm and kill-target estimates.

**Architecture:** Oteryn-Atlas consumes a versioned, public-safe Game-owned farm-intelligence publication only when one is already accepted and compatible; otherwise the affected production capability fails closed as upstream-blocked. Atlas compiles bounded farm-intelligence and creature-keyed spatial products, then consumes them through pure estimator/state/LOD modules and one FullWorld explorer controller. Game facts remain authoritative; Atlas calculations remain derived/estimated.

**Tech Stack:** Python 3 deterministic builders/validators, JavaScript ES modules, Node.js `node:test`, Canvas/WebGL-compatible FullWorld overlays, Playwright Chromium/Docker, existing GitHub `atlas-gate` / `provenance-gate` lifecycle.

**Spec:** `docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-design.md`

**Normative review:** `docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-review.md`

**Execution prompt:** `docs/agents/prompts/ATLAS-ITEM-SPAWN-FARM-EXPLORER.md`

## Global Constraints

- Atlas lifecycle authority: `Oteryn/Oteryn-Atlas#114`; parent `#11`; verification `#85`; visual-user acceptance `#111`.
- Upstream Game capability lifecycle: `Oteryn/Oteryn-Game#75`; this Atlas alias has NO Game write authority and inspects it read-only only.
- Current merged Hunt Intelligence/Game Intelligence contract is the future measured KPH/analytics authority; Farm Explorer must not create a duplicate analytics/profile system.
- Creature interaction/presentation geometry: `Oteryn/Oteryn-Atlas#113` and `#115`; reuse their canonical seams when present.
- Historical design baseline was Atlas `db5de3938ef815fb467dd2ad911a1ed92b13dccf`. Final hardening inspected Atlas `main@42d268aa98a7d48e8a7a9ed2e95e4a9c14753909` and read-only Game `main@55e30e23c3d5775ce760c6b210ea77f152b359ae`. These are evidence only; refresh Atlas before mutation and Game read-only before consumption.
- Oteryn-Game owns item, creature, loot, probability, quantity, task, weekly classification, placement and accepted respawn facts. Atlas owns validation, indexes, LOD aggregates and derived estimates.
- **Writable repository: Oteryn-Atlas only.** Game may be inspected read-only. Missing Game capability becomes `UPSTREAM_REQUIREMENT` / `UPSTREAM_BLOCKED` in Atlas evidence; no Game issue/branch/file/commit/PR/comment/review/contract/workflow mutation is authorized.
- Never use TibiaRoute, wiki/fansites, browser-side OTBM/Lua/XML parsing, sprite similarity, filenames, guessed regions or names-only joins as runtime authority.
- Generated UI mock-up values are illustrative only. No example number/place/task/drop/spawn/respawn/time from the mock-up may enter real fixtures or product claims.
- No unweighted `average drop chance` across multiple source creatures.
- `monster_spawns` are factual exported placement records. Placement count is not live occupancy, simultaneous capacity or guaranteed kills per cycle.
- `spawn_time_seconds`, if projected, remains provenance-bound to the accepted creature publication and is not by itself proof of the complete live respawn algorithm.
- V1 time estimates require an explicit `effective kills/hour` source. No universal KPH default and no fixed solo/party multiplier.
- Item estimator labels use defined `Expected`, `P50`, `P80`, `P95`; basic kill-target estimate is `N / KPH` with no invented uncertainty range.
- Authoritative task quantity/kill count initializes the estimator target while remaining separately visible as a Game fact; user edits are estimate state only.
- Runtime stays inside the existing FullWorld shell; no second map application and no unrelated global navigation rewrite.
- Playwright retries remain `0`; no arbitrary sleeps, broad tolerances or test-only authority bypasses.
- `Oteryn/Oteryn-Game` is read-only for this execution. Never create/update Game files, branches, issues, PRs, comments, reviews or workflows; missing capability is `UPSTREAM_BLOCKED` in Atlas.
- Live Atlas acceptance occurs only from merged `main`; Molehill-PC owns heavy PR browser qualification, Synology merged-main live acceptance.

---

### Task 1: Read-only upstream capability and compatibility preflight

**Writable repository:** `Oteryn/Oteryn-Atlas` only

**Read-only upstream:** `Oteryn/Oteryn-Game`

**Files:**
- No Game files.
- Record immutable upstream evidence in Atlas Issue/PR evidence, not as a second mutable status database.
- Synthetic schema fixtures needed later remain test-only and may not be presented as current Game facts.

**Interfaces:**
- Consumes: current read-only Game `main`, accepted Game -> Atlas contracts/publications, static-creature publication, ADRs and source/provenance identities.
- Produces: capability matrix and compatibility tuple covering world/profile, content/ruleset revision, modifier context, creature identity scheme/revision, semantic/source digest and publication root.

- [ ] **Step 1: Refresh GitHub authority.** Resolve current Atlas `main`, #114/#113/#115/#85/#111/#11 and overlapping Atlas PRs. Resolve Game `main` and #75 read-only. Do not invoke a write-capable Game action.
- [ ] **Step 2: Inspect accepted upstream publications.** Classify item catalogue, monster-drop relations, probability/process semantics, quantity model, task/weekly/credit semantics, creature identity, placement origin/activation and timer semantics as `AVAILABLE|UPSTREAM_BLOCKED|MALFORMED|STALE|INCOMPATIBLE`.
- [ ] **Step 3: Prove compatibility before joins.** A farm relation joins spatial placements only when the complete compatibility tuple passes. Display-name matching never repairs mismatch.
- [ ] **Step 4: Classify identity scope.** Treat migration-derived `monster-entity:*` IDs as export-scheme identities unless Game explicitly guarantees cross-revision canonical continuity.
- [ ] **Step 5: Classify origin/activation.** Default farm supply/ranking uses only origins with proven activation for the selected context. Conditional/event/quest/world-change/unknown records remain conditional or unavailable.
- [ ] **Step 6: Decide the truthful implementation envelope.** If no accepted farm-intelligence publication exists, continue only with Atlas validation/math/LOD/UI and synthetic test fixtures; production farm facts remain `UPSTREAM_BLOCKED`. Do not create or modify a Game producer.
- [ ] **Step 7: Record exact evidence.** Persist read-only Game SHA/publication identities and capability matrix in Atlas PR/Issue evidence before Task 2.

---

### Task 2: Atlas farm publication and creature-keyed spatial index

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `tools/build-farm-intelligence.py`
- Create: `tools/build-farm-spatial-index.py`
- Create: `tools/build-farm-bundle.py`
- Create: `tests/farm-intelligence-build.py`
- Create: `tests/farm-spatial-index.py`
- Create: `tests/farm-bundle.py`
- Generated products: `data/farm-intelligence/**`, `data/farm-spatial/**` according to the current publication policy; do not commit large generated artifacts unless current repository policy requires them.

**Interfaces:**
- Consumes: an already accepted compatible upstream farm snapshot when `AVAILABLE`, plus the exact accepted creature publication. If upstream farm data is blocked, runtime farm facts stay unavailable while synthetic tests exercise only schema/logic boundaries.
- Produces: bounded farm item/task search/detail products, creature-identity keyed placement/aggregate shards, and one content-addressed atomic farm bundle manifest pinning both roots plus compatibility tuple. No name-only join or mixed-generation cutover.

- [ ] **Step 1: Refresh Atlas preflight and upstream classification.** Resolve current `main`, #114, PR overlap, #113/#115 status and publication rules; consume real farm facts only when Task 1 classified the exact upstream product `AVAILABLE`.

- [ ] **Step 2: Write RED farm-product tests.** Use a synthetic schema fixture containing one fixed-quantity relation, one exact PMF relation, one bounded-unknown relation and one task. Assert exact Game revision/digest binding, capability preservation, canonical ordering and deterministic output.

- [ ] **Step 3: Write RED spatial tests.** Use two stable creature IDs with intentionally identical display names. Assert only exact entity ID joins and that a name match never repairs an unresolved identity.

- [ ] **Step 4: Write RED placement/timer/activation tests.** Assert `placement_count` is distinct from live occupancy/capacity. Preserve source origin/activation. Conditional, event, quest, runtime-change or unknown placements are excluded from default ranking/yield unless authoritative activation semantics prove eligibility. Any projected timer remains exact-source-root bound.

- [ ] **Step 5: Run RED.** Run:

```bash
python tests/farm-intelligence-build.py
python tests/farm-spatial-index.py
python tests/farm-bundle.py
```

Expected: failure because builders do not exist.

- [ ] **Step 6: Implement `build-farm-intelligence.py`.** Validate Game contract/version/digest before writing any output. Preserve probability/quantity per source creature. Build bounded item/task search and detail shards. Do not emit `averageDropChance`.

- [ ] **Step 7: Implement `build-farm-spatial-index.py`.** Read only accepted creature projection data, key by accepted stable creature identity, preserve origin/activation, emit floor-isolated placement shards and deterministic multi-resolution cells. Mark aggregate identity non-authoritative and preserve accepted timer data without live-state promotion.

- [ ] **Step 8: Implement and RED/GREEN the atomic farm bundle.** `build-farm-bundle.py` validates farm-intelligence/farm-spatial/creature roots and the full compatibility tuple, then emits one content-addressed manifest. Reject missing, mixed-generation or incompatible roots without disabling the base map.

- [ ] **Step 9: Prove deterministic roots.** Build twice from identical bytes and require identical product roots. Change one source relation and require farm root change; change one creature placement and require spatial root change; change one compatibility field and require bundle rejection/root change.

- [ ] **Step 10: Run GREEN and commit.** Run all three farm build tests, relevant existing creature-index tests and `git diff --check`; commit publication layer without UI scope.

---

### Task 3: Pure estimator, URL state and LOD logic

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `src/browser/farm-intelligence.mjs`
- Create: `src/browser/farm-state.mjs`
- Create: `src/browser/farm-lod.mjs`
- Create: `tests/farm-intelligence.mjs`
- Create: `tests/farm-state.mjs`
- Create: `tests/farm-lod.mjs`

**Interfaces:**

```js
export function expectedKillsFixed({ targetQuantity, probability, successQuantity }) {}
export function completionProbabilityFixed({ kills, targetQuantity, probability, successQuantity }) {}
export function completionThresholdFixed({ targetProbability, targetQuantity, probability, successQuantity, maxKills }) {}
export function completionProbabilityPmf({ kills, targetQuantity, perKillPmf, maxState }) {}
export function completionThresholdPmf({ targetProbability, targetQuantity, perKillPmf, maxKills, maxState }) {}
export function estimateTimeHours({ kills, effectiveKph }) {}
export function estimateKillTargetTimeHours({ targetKills, effectiveKph }) {}
```

`farm-state.mjs` exports `parseFarmState(params)` and `serializeFarmState(state, params)`. `farm-lod.mjs` exports `chooseFarmLod({ mode, zoom, projectedDensity, visiblePlacements })` plus deterministic cluster/cell helpers.

- [ ] **Step 1: Write RED fixed-drop oracle tests.** For `p=0.5`, target `2`, `q=1`, require expected kills `4` and completion probability after 2 kills `0.25`. For `q=2`, target `3`, require `r=2` successful rolls before threshold calculations.

- [ ] **Step 2: Write RED P50/P80/P95 and numerical-stability tests.** Assert minimal thresholds. Add tiny-`p`, near-one-`p`, large-target and monotonic `P50 <= P80 <= P95` cases plus an independent high-precision oracle/error bound.

- [ ] **Step 3: Write RED PMF/process tests.** Require explicit stationary IID per-qualifying-kill semantics before convolution/threshold math. Reject pity/stateful/sequence-dependent/unknown process semantics, malformed PMFs, oversize bounds and unreachable zero-yield models.

- [ ] **Step 4: Write RED KPH/time-base tests.** Reject absent, zero, negative and non-finite KPH. Every KPH carries progress scope plus time base (`active_hunt`, `hunt_wall`, `trip_wall` or accepted successor); incompatible time bases are not silently compared. No vague speed multipliers.

- [ ] **Step 5: Write RED multiple-source/acquisition tests.** Expose source relations separately with no unweighted average. Distinguish `generated_drops` from `personally_acquired`; party personal-acquisition time is unavailable without an explicit allocation model.

- [ ] **Step 6: Write RED URL tests.** Round-trip:

```text
item=<stable-item-id>
farmQty=<positive-int>
farmKph=<positive-number>
farmTimeBase=active_hunt|hunt_wall|trip_wall
farmTask=<stable-task-id>
farmCreature=<stable-creature-id>
farmKills=<positive-int>
farmView=auto|heatmap|clusters|spawns
```

Reject malformed, non-finite, over-limit and contradictory combinations.

- [ ] **Step 7: Write RED task-initialization tests.** A delivery task returns separate `authoritativeRequirement.quantity` and editable `estimateTarget.quantity`; a kill/weekly task returns separate factual and editable kill counts. Free item/custom kill mode defaults to `100` only when no authoritative task owns the requirement.

- [ ] **Step 8: Run RED.** Run:

```bash
node --test tests/farm-intelligence.mjs tests/farm-state.mjs tests/farm-lod.mjs
```

Expected: module-not-found or missing-export failure.

- [ ] **Step 9: Implement exact bounded calculations.** Use a numerically stable bounded binomial tail/quantile method and deterministic PMF DP plus hitting-time recurrence only for supported IID models. Document numeric domain/error bounds; never use naive factorials or random simulation as the deterministic oracle.

- [ ] **Step 10: Implement state and LOD.** URL parsing preserves existing FullWorld camera/floor/animation state. `AUTO` chooses heatmap -> clusters -> placements monotonically based on zoom/density/count; manual modes override only presentation. Exact thresholds are finalized from Task 6 measured visual/performance evidence.

- [ ] **Step 11: Run GREEN and commit.** Run new tests plus existing relevant viewport/creature tests and `git diff --check`.

---

### Task 4: FullWorld Explorer UI and farm overlay

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `web/fullworld-farm-explorer.mjs`
- Modify: `web/fullworld.html`
- Modify: `web/fullworld.css`
- Modify only if needed: `web/fullworld-search.mjs`
- Modify only for a small shared presentation seam: `web/fullworld-creatures.mjs`
- Create: `tests/farm-gui-contract.mjs`

**Interfaces:**
- Consumes: verified farm products, current `__OTERYN_ATLAS_VIEW__` / `oteryn-atlas-view`, current floor/camera/zoom state, existing animation/creature presentation and #113/#115 canonical geometry when available.
- Produces: one `#farm-analysis-overlay`, one Explorer controller and bounded read-only diagnostics `globalThis.__OTERYN_ATLAS_FARM__`.

- [ ] **Step 1: Enforce #113/#115 dependency gate, then write RED GUI contract.** If required canonical interaction/presentation seams are not merged or explicitly stable, mark dependent FullWorld UI `DEPENDENCY_BLOCKED` and continue only disjoint work. Do not invent competing seams.

- [ ] **Step 2: Add shell and loading.** Add `Item & Task Explorer` to existing controls/mobile drawer model; add separate `VERIFIED FACTS` and `ESTIMATE` inspector blocks. Verify manifest/root/digest before showing farm data. Farm failure must not disable base Atlas.

- [ ] **Step 3: Add `Monster drop sources` rows.** Until a complete acquisition graph exists, do not use generic `Sources` copy implying completeness. Show source creature, exact per-source probability/quantity semantics and verified placement count with no global average.

- [ ] **Step 4: Add task target behavior.** Authoritative task requirement remains visibly factual while estimate target can be edited. Weekly label appears only when Game proves weekly semantics. Otherwise use `Kill target` / `Custom kill target`.

- [ ] **Step 5: Add estimator UI.** Item mode shows `Expected`, `P50`, `P80`, `P95` qualifying kills and `Expected drops generated`. Personal acquisition in party play is unavailable without an explicit allocation model. Times require visible KPH scope + time base. Future `MEASURED` KPH reuses Hunt Intelligence semantics.

- [ ] **Step 6: Add far LOD with metric identity.** Default metric is current-floor `verified_placement_density`; every heatmap/cluster exposes deterministic `metric_id`, unit and visible legend. Do not merge different floors into one spatial heatmap; all-floor summary belongs in panel metadata.

- [ ] **Step 7: Add medium LOD.** Draw deterministic clusters with placement count and source composition. Rankings are named by metric: `Most verified placements`, `Highest expected items per static clear`, or another documented static metric.

- [ ] **Step 8: Add near LOD.** Reuse existing verified creature presentation and animation. Do not add a second sprite decoder, animation clock, creature hit-test registry or selection/deep-link system.

- [ ] **Step 9: Reuse #113/#115 only.** Consume their canonical presentation bounds/hit-testing/selection when available. If a required seam remains unavailable, leave dependent near-detail interaction `DEPENDENCY_BLOCKED`; do not implement a substitute.

- [ ] **Step 10: Add history/mobile behavior.** Explorer state survives reload/back/forward and coexists with normal FullWorld state. Reuse current mobile drawers and accessibility behavior.

- [ ] **Step 11: Run GREEN and commit.** Run `node --test tests/farm-gui-contract.mjs` plus farm pure tests and all touched creature/search/mobile regressions.

---

### Task 5: Global search and truthful static ranking

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Modify: `web/fullworld-search.mjs`
- Modify only if current architecture requires it: `src/browser/semantic-search.mjs`
- Create: `tests/farm-search.mjs`

**Interfaces:**
- Consumes: stable item/task search records and Explorer state actions.
- Produces: non-spatial item/task results that open Explorer state, plus deterministic static ranking helpers.

- [ ] **Step 1: Write RED item/task search tests.** Selecting an item sets/focuses stable item state without changing camera coordinates. Selecting an authoritative task initializes its factual target.

- [ ] **Step 2: Write RED no-fake-coordinate test.** Item/task results without factual positions remain non-spatial; consumer must not synthesize `(0,0,0)` or assign a source creature position to the item.

- [ ] **Step 3: Write RED ranking-copy test.** Generic `Best place to farm` is forbidden before a measured #117 metric exists. A card must name its exact static metric. Generated mock-up place names must not be hard-coded.

- [ ] **Step 4: Implement minimal search adapters and static ranking.** Reuse current search keyboard/ranking behavior where possible. Static rankings may use placement count, exact static-clear expected yield or documented spatial spread; none is called observed farm speed.

- [ ] **Step 5: Run GREEN and commit.** Run farm search/state/GUI tests and existing semantic-search tests.

---

### Task 6: Real-browser geometry, visual, failure and performance qualification

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `e2e/tests/farm-explorer-desktop.spec.mjs`
- Create: `e2e/tests/farm-explorer-mobile.spec.mjs`
- Create: `e2e/tests/farm-explorer-geometry.spec.mjs`
- Create: `e2e/tests/farm-explorer-failure.spec.mjs`
- Create: `e2e/tests/farm-explorer-performance.spec.mjs`
- Extend only as necessary: `e2e/support/geometry-oracle.mjs`, `e2e/support/performance.mjs`, `e2e/support/artifacts.mjs`

**Interfaces:**
- Consumes: real FullWorld runtime and exact tested farm publication.
- Produces: revision-qualified Chromium evidence for user journeys, transform synchronization, failure isolation, dense/sparse boundedness and readable LOD.

- [ ] **Step 1: Write desktop journey.** Exercise item search -> source selection -> far heatmap -> medium clusters -> near placements -> target edit -> KPH edit -> P50/P80/P95 -> reload/back/forward. Assert FACT/ESTIMATE separation and absence of average drop chance.

- [ ] **Step 2: Write task journey.** If current Game export supports a real authoritative task, assert factual required count initializes but remains separate from editable estimate target. If task capability is unsupported, assert truthful unavailable state plus working custom kill target; never create a fake task for acceptance.

- [ ] **Step 3: Write mobile journey.** Verify drawer reachability, readable item/source/task controls, target/KPH editing, LOD control, inspector facts/estimates and no horizontal overflow/critical occlusion.

- [ ] **Step 4: Write geometry oracle.** Compare farm-overlay world anchors with base-map projection before/after pan, zoom, resize, floor and mode transitions using the repository's justified geometry tolerance. Add stale-floor/source-selection regressions.

- [ ] **Step 5: Write failure cases.** Corrupt manifest/root, missing optional detail shard, unknown contract version, unresolved creature join, unsupported quantity model and invalid KPH. Explorer fails closed by capability; unrelated Atlas layers remain usable.

- [ ] **Step 6: Measure sparse and dense cases.** Record visible aggregate/cluster/placement counts, draw/update duration, cache/shard counts, request/byte evidence where measurable and pan/zoom frame behavior. Derive any blocking budget from measured evidence instead of inventing a threshold.

- [ ] **Step 7: Review user-facing screenshots/artifacts.** Far/medium/near desktop and mobile must be visibly readable and avoid the reference product's equal-size-sprite clutter. Use #111 rules; do not commit unauthorized world/sprite raster baselines.

- [ ] **Step 8: Verify mock-up data did not leak.** Search final changed product/fixture files for illustrative mock-up numbers and place names; any occurrence must be removed or explicitly synthetic and unable to be mistaken for current Game facts.

- [ ] **Step 9: Run targeted specs twice with retries `0`, then full exact-head Docker Playwright on Molehill-PC.** Publish the exact tested head status required by current CI. Do not move heavy PR verification to Synology.

- [ ] **Step 10: Commit acceptance coverage after stable GREEN runs.**

---

### Task 7: Atlas integration, protected merge and closeout

**Repository:** `Oteryn/Oteryn-Atlas`

**Read-only evidence source:** `Oteryn/Oteryn-Game`

**Files:**
- No new feature scope; update Atlas lifecycle/evidence only.

**Interfaces:**
- Consumes: final Atlas implementation head plus exact read-only upstream compatibility/publication evidence.
- Produces: exact-head verified protected Atlas merge and merged-main live acceptance.

- [ ] **Step 1: Reconfirm upstream evidence.** Verify exact read-only Game SHA/publication identities and compatibility tuple. If absent/stale/incompatible, keep affected capability blocked; do not mutate Game or close Game #75.
- [ ] **Step 2: Run full applicable Atlas deterministic suite** plus `git diff --check`.
- [ ] **Step 3: Run exact-head Molehill Docker Playwright** with retries `0`; review artifacts and publish exact-head local E2E status.
- [ ] **Step 4: Review complete final diff.** Confirm no external authority, mock-up facts, naive average chance, live-spawn claim, mixed-generation farm bundle or duplicate #113/#115 geometry.
- [ ] **Step 5: Require exact-head `atlas-gate` and `provenance-gate` GREEN** and resolved applicable review threads.
- [ ] **Step 6: Squash-merge Atlas and clean branch.** Close #114 only when its DoD is satisfied; leave Game #75 and wider lifecycle issues untouched unless separately owned.
- [ ] **Step 7: Run merged-main live acceptance only** through the trusted Synology workflow.
- [ ] **Step 8: Record terminal evidence:** Atlas squash SHA, read-only Game evidence SHA, compatibility tuple, creature/farm bundle roots, capability census, estimator/process models, browser evidence and runtime impact.

## Plan self-review result

- All requirements from the design and normative review are assigned to executable tasks.
- No task depends on guessed Game facts or external website authority.
- No naive average-drop metric exists in the planned v1 API or UI.
- Placement/timer/live-state semantics remain separate.
- Fixed-drop and exact-PMF estimator models have independent deterministic tests; unsupported roll semantics disable exact probability math.
- P50/P80/P95, authoritative task defaults, manual-vs-future-measured KPH, #113/#115 reuse, named rankings and mock-up-data prohibition are explicitly tested.
- Execution order is read-only upstream capability gate -> Atlas publication/capability handling -> pure logic -> dependency-gated UI -> search/ranking -> browser qualification -> Atlas-only closeout. Synthetic fixtures prove logic only and never become runtime authority.

## Post-review execution deltas

The following deltas are mandatory and refine the tasks above after the final semantic review:

- **Task 1 / upstream gate:** consume exact loot models only when an accepted upstream publication binds content/ruleset/profile/modifier context and preserves richer grouped-task semantics; otherwise classify the capability blocked/incompatible.
- **Task 1 / upstream gate:** placement weight, alternatives, origin and conditional activation must already be authoritative before Atlas enables yield/capacity; this alias records blockers rather than repairing Game.
- **Task 2 / spatial index:** do not manufacture spawn-group identity by deduplicating equal `spawn_area` center/radius values. Carry a Game-owned stable group identity only if one is published.
- **Task 3 / item time:** scalar manual KPH is `qualifying source-creature kills/hour` for the selected loot relation. A mixed-source item estimate needs an explicit per-source KPH/mixture model; otherwise time remains per selected source creature.
- **Task 3 / kill task:** scalar KPH means `credited target kills/hour` when Game publishes task-credit semantics. Raw total hunt/team kills are not silently substituted.
- **Task 3 / exact PMF:** compute expected kills as a bounded absorbing hitting-time recurrence, not `target / expected quantity`, and return explicit unreachable state for `p0=1`; cover `p=0` and `p=1` fixed-drop edges.
- **Task 4 / copy:** distinguish `Base drop chance` / `Published drop model` from live/current chance unless an authoritative live modifier source exists. Percentage formatting is presentation only; calculations retain normalized exact probability.
- **Task 5 / ranking:** `expected items per static clear` is disabled unless concurrent/activation semantics for the included placements are proven; otherwise use placement-count/spatial metrics only.
- **Task 6 / acceptance:** add explicit tests for KPH scope, mixed-source refusal, modifier context, weighted placement gating, group-identity non-inference, PMF hitting-time edges, richer-task non-flattening and probability display-rounding isolation.

### Merged Hunt Intelligence base integration

Hunt Intelligence was hardened by merged PR #123; this refresh is based on Atlas `main@42d268aa98a7d48e8a7a9ed2e95e4a9c14753909`. Refresh main again before implementation. Before Task 3/4 interface work, read:
- `docs/agents/tasks/active/ATLAS-HUNT-INTELLIGENCE-PROJECT.md`;
- `docs/agents/prompts/ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION.md`.

The future measured-KPH provider must reuse the Hunt Intelligence/Game Intelligence aggregate semantics and trust classes, including revision/cohort/time-base/sample/quality/privacy context. Do not create a second measured analytics contract in Farm Explorer.

Task 3 tests must prove manual KPH remains an explicit assumption and an incompatible measured cohort is not silently substituted. Task 4 copy must distinguish `VERIFIED`, `MEASURED`, `ESTIMATE` and `UNAVAILABLE` consistently with the merged Hunt Intelligence project.


## Final architecture hardening — mandatory

- Atlas-only execution: Game/#75 is read-only; missing upstream capability is `UPSTREAM_BLOCKED`.
- Preserve placement origin/activation; conditional/event/quest/world-change/unknown origins do not enter default farm ranking/yield without authoritative activation.
- Join loot/task facts to spatial facts only under a compatible world/profile, content/ruleset revision, modifier context, identity scheme, coordinate profile and exact source roots.
- Browser consumes one atomic farm bundle manifest pinning farm-intelligence + farm-spatial + creature roots; mixed generations fail closed.
- P50/P80/P95 requires stationary IID per qualifying kill or an exact richer process; pity/stateful/sequence-dependent semantics are not approximated.
- Probability math has a documented verified numeric envelope/error bound and independent extreme-value oracle tests.
- Default item estimator reports generated drops; personal acquisition requires an explicit allocation model.
- KPH always carries progress scope and time base; incompatible time bases are not silently compared.
- Heatmap/cluster always carries `metric_id`, unit, legend and current-floor scope; all-floor summary is separate.
- UI says `Monster drop sources` until a complete acquisition graph exists.
- #113/#115 are hard dependency gates for their owned FullWorld interaction/presentation seams; no fallback competing geometry is allowed.


## Final hardening deltas — mandatory

- **Task 2 / atomic publication:** add `tools/build-farm-bundle.py` + `tests/farm-bundle.py`. Pin farm-intelligence/spatial roots, upstream Game SHA/digests, world/profile/content/ruleset/modifier context, coordinate profile and creature identity scheme. Browser activation is all-or-nothing.
- **Task 2 / activation/origin:** preserve placement origin/activation. Default ranking excludes conditional/event/quest/world-change/unknown origins unless accepted context activates them.
- **Task 2 / floors:** aggregate cells are floor-scoped. All-floor information is summary/list only, never one heatmap plane.
- **Task 3 / process semantics:** binomial/PMF thresholds require stationary IID per-qualifying-kill semantics or another exact supported process. Pity/stateful/first-kill/unknown dependence -> `UNAVAILABLE` for IID thresholds.
- **Task 3 / numeric stability:** use bounded stable recurrence/log-space/equivalent probability math, validated against an independent high-precision oracle over tiny `p`, `p≈1`, large targets and threshold monotonicity.
- **Task 3 / loot scope:** estimator returns generated-drop scope. Personal-acquisition time requires an explicit allocation model; party allocation is never implicit.
- **Task 3 / KPH:** persist both progress scope and time base (`active_hunt`, `hunt_wall`, `trip_wall` or accepted equivalent). Threshold times are conditional on that fixed assumption.
- **Task 4 / trust/copy:** use `VERIFIED|MEASURED|ESTIMATE|UNAVAILABLE`; if only creature loot is covered, label `Monster drop sources`.
- **Task 4/5 / metrics:** every heatmap/cluster has `metric_id`, unit and legend. Default is current-floor `verified_placement_density`.
- **Task 4 / dependency gate:** if #113/#115 owner seams are not merged/stable, finish only disjoint work and leave dependent interaction/presentation blocked.
- **Task 6 / regressions:** cover compatibility mismatch, mixed-root rejection, origin exclusion, floor separation, export-scoped identity, IID refusal, numeric extremes, generated-vs-personal loot, KPH time-base, acquisition completeness and dependency gating.
