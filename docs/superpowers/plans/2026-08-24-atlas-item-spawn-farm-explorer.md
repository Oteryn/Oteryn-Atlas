# Atlas Item & Spawn Farm Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a native FullWorld Item & Spawn Farm Explorer that joins Game-owned item/loot/task facts to verified creature placements, renders readable heatmap/cluster/detail LOD, and calculates truthfully labelled item-farm and kill-target estimates.

**Architecture:** Oteryn-Game publishes a versioned, public-safe farm-intelligence contract; Oteryn-Atlas compiles bounded farm-intelligence and creature-keyed spatial products, then consumes them through pure estimator/state/LOD modules and one FullWorld explorer controller. Game facts remain authoritative; Atlas calculations are derived/estimated and must never become a second source of Game semantics.

**Tech Stack:** Python 3 deterministic producers/validators, JavaScript ES modules, Node.js `node:test`, Canvas/WebGL-compatible FullWorld overlays, Playwright Chromium/Docker verification, existing GitHub `atlas-gate` / `provenance-gate` lifecycle.

**Spec:** `docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-design.md`

**Normative review:** `docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-review.md`

**Execution prompt:** `docs/agents/prompts/ATLAS-ITEM-SPAWN-FARM-EXPLORER.md`

## Global Constraints

- Atlas lifecycle authority: `Oteryn/Oteryn-Atlas#114`; parent FullWorld programme `#11`; verification `#85`; visual-user acceptance `#111`.
- Game producer lifecycle authority: `Oteryn/Oteryn-Game#75`.
- Related future measured KPH/hunt analytics authority: `Oteryn/Oteryn-Atlas#117`; Farm Explorer must not create a duplicate analytics/profile system.
- Related creature interaction/presentation geometry: `Oteryn/Oteryn-Atlas#113` and `#115`; reuse their canonical seams when present.
- Design-time Atlas main was `db5de3938ef815fb467dd2ad911a1ed92b13dccf`; design-time Game main has already advanced to at least `6945e962035bac83d1f19b00984df5b82719ebb9`. These are evidence only; refresh both repositories before every mutation phase.
- Oteryn-Game owns item, creature, loot, probability, quantity, task, weekly classification, placement and any accepted respawn facts. Atlas owns only validation, indexes, LOD aggregates and derived estimates.
- Never use TibiaRoute, wiki/fansites, browser-side OTBM/Lua/XML parsing, sprite similarity, filenames, guessed regions or names-only joins as runtime authority.
- The generated UI mock-up is illustrative only. No example number, place name, task count, drop chance, spawn count, respawn value or time from the mock-up may enter real fixtures or product claims.
- No unweighted/naive `average drop chance` across multiple source creatures.
- `monster_spawns` are factual exported placement records. Placement count is not live occupancy, simultaneous capacity or guaranteed kills per cycle.
- `spawn_time_seconds`, if projected, must remain provenance-bound to the accepted creature publication and is not by itself proof of the complete live respawn algorithm.
- V1 time estimates require an explicit `effective kills/hour` source. No universal KPH default and no fixed solo/party multiplier.
- Item estimator labels use mathematically defined `Expected`, `P50`, `P80`, `P95`; kill-target basic estimate is `N / KPH` with no invented uncertainty range.
- Authoritative task quantity/kill count initializes the estimator target while remaining separately visible as a Game fact; user edits are local estimate state only.
- Atlas runtime remains inside the existing FullWorld shell; no second map application and no unrelated global navigation rewrite.
- All discovered defects follow RED -> minimal fix -> GREEN -> full applicable exact-head verification. Playwright retries remain `0`.
- Game implementation must avoid active Wave-1 allocations `apps/game-server/src/domain/**` (PR #56) and `apps/game-server/src/content/**` (PR #58) unless the coordinator explicitly transfers ownership.
- Live Atlas deployment/acceptance occurs only from merged `main`; Synology is not the heavy PR verification runner.

---

### Task 1: Game farm-intelligence contract and deterministic producer

**Repository:** `Oteryn/Oteryn-Game`

**Files:**
- Create: `docs/contracts/OTERYN_GAME_ATLAS_FARM_INTELLIGENCE_V1.md`
- Create: `tools/game-atlas-farm-intelligence/export.py`
- Create: `tools/game-atlas-farm-intelligence/verify.py`
- Create: `tools/game-atlas-farm-intelligence/self_test.py`
- Create only if current accepted source data can be legally/provenly represented as a compact deterministic test input: `tools/game-atlas-farm-intelligence/fixtures/acceptance-source.json`
- Modify only if required for a dedicated non-overlapping producer workflow: `.github/workflows/game-atlas-farm-intelligence.yml`

**Interfaces:**
- Consumes: accepted Game-owned/reference-migration evidence already authorized by the Game->Atlas boundary; exact current creature entity identity semantics from `tools/game-atlas-creatures/export.py`.
- Produces: `oteryn-game-atlas-farm-intelligence-v1` snapshot with `contract_id`, `schema_version`, producer/source identity, semantic digest, capability states, bounded item records, loot relations, task records and explicit probability/quantity roll semantics.
- Stable loot relation shape must carry a producer-owned relation id, stable creature entity id, stable item id, probability model and quantity model. It must be possible to determine whether the relation normalizes to one exact per-kill quantity PMF.

- [ ] **Step 1: Refresh Game GitHub preflight and freeze the task boundary.** Resolve current `main`, Issue #75, root/nearer `AGENTS.md`, open PR #56/#58 heads and all producer-path overlap. Create/reuse one Game task branch from refreshed `main`; do not edit DOMAIN/CONTENT allocated paths.

- [ ] **Step 2: Write the contract before producer code.** Define exact closed capability states `SUPPORTED`, `PARTIAL`, `UNSUPPORTED`; stable ID rules; rational probability `{numerator, denominator}` validation; quantity variants `fixed`, `discrete_pmf`, `bounded_unknown`, `unsupported`; per-kill roll semantics; task types `delivery` and `kill`; explicit optional `weekly=true` only when proven; deterministic canonical ordering and hard bounds.

- [ ] **Step 3: Write RED producer tests in `self_test.py`.** Include fixture cases that assert:

```python
assert normalize_probability({"numerator": 1, "denominator": 4}) == (1, 4)
assert normalize_quantity({"kind": "fixed", "quantity": 2})["per_kill_pmf"] == [[0, 3], [2, 1]] or True  # replace only with the contract's exact normalized representation
```

The actual test must not use the illustrative `or True`; instead assert the exact representation chosen in the contract. Also add explicit failing cases for denominator `0`, numerator greater than denominator, duplicate item/relation/task IDs, dangling creature/item references, ambiguous chance scale, bounded-unknown quantity, unknown multi-roll semantics, capability `UNSUPPORTED`, deterministic reordering and source-digest changes.

- [ ] **Step 4: Run the self-test and verify RED for missing producer functions.** Run:

```bash
python tools/game-atlas-farm-intelligence/self_test.py
```

Expected: failure because the new contract implementation is not yet present.

- [ ] **Step 5: Implement the minimal deterministic producer.** Implement pure helpers such as:

```python
def canonical_bytes(value: object) -> bytes: ...
def normalize_probability(raw: object) -> dict[str, int]: ...
def normalize_quantity(raw: object) -> dict[str, object]: ...
def build_snapshot(source: dict[str, object], producer_sha: str) -> dict[str, object]: ...
```

Keep all semantic inference inside this Game-owned boundary. If accepted source evidence cannot prove an item/loot/task field, emit the truthful capability/unresolved state; do not guess.

- [ ] **Step 6: Normalize exact roll models to per-kill semantics.** If the accepted runtime proves one Bernoulli opportunity per kill, publish that explicitly. If it proves multiple independent rolls or another exact finite model, normalize it to an exact per-kill quantity PMF or publish enough exact roll-program semantics for a deterministic consumer normalization. If neither is provable, mark exact completion-probability support unavailable.

- [ ] **Step 7: Implement `verify.py` as an independent consumer-side producer validator.** Verify contract id/version, capabilities, IDs, probability rational bounds, PMF mass, quantity bounds, task references, creature identity shape, counts/byte limits, canonical digest and public-safe provenance. Reject unknown critical schema features.

- [ ] **Step 8: Produce truthful current-source census evidence.** Run the producer against the current accepted source boundary if it is available on the authorized execution host. Record supported/partial/unsupported capability counts; do not substitute website data when local authoritative inputs are unavailable.

- [ ] **Step 9: Run Game verification to GREEN.** At minimum:

```bash
python tools/game-atlas-farm-intelligence/self_test.py
python tools/game-atlas-farm-intelligence/verify.py <generated-snapshot-path>
python tools/agents/validate_governance.py
cargo +1.94.0 test --locked --workspace --all-targets
cargo +1.94.0 clippy --locked --workspace --all-targets -- -D warnings
git diff --check
```

If repository-selected commands differ at refreshed head, use the exact current contract and record the executed commands/results.

- [ ] **Step 10: Commit and deliver the Game producer through Issue #75.** Review the full changed-file set, push exact head, open/update one PR, require current Game gates/review policy, squash-merge, delete the branch where policy permits, and record the exact merged Game SHA + farm semantic digest. Atlas Task 2 must pin these exact identities.

---

### Task 2: Atlas farm publication and creature spatial secondary index

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `tools/build-farm-intelligence.py`
- Create: `tools/build-farm-spatial-index.py`
- Create: `tests/farm-intelligence-build.py`
- Create: `tests/farm-spatial-index.py`
- Generated/runtime product roots: `data/farm-intelligence/**`, `data/farm-spatial/**` according to the repository's current generated-publication policy; do not commit large generated artifacts unless current policy explicitly requires it.
- Modify only when needed to expose the selected generated product in existing publication/serve paths: current publication tooling discovered at execution time, without changing unrelated world roots.

**Interfaces:**
- Consumes: exact merged Game farm snapshot from Task 1; exact accepted creature publication currently consumed by `tools/build-creature-index.py`.
- Produces: bounded Atlas `farm-intelligence` manifest/detail/search shards and creature-keyed `farm-spatial` shards/aggregate cells, all root/digest linked to exact Game and creature source identities.
- `farm-spatial` key: stable `monster-entity:*` / accepted successor identity, never display name.

- [ ] **Step 1: Refresh Atlas main/Issue #114/open PR overlap after Task 1 merges.** Rebase/create the Atlas implementation branch from current `main`; read #113/#115 merge state before choosing interaction geometry seams.

- [ ] **Step 2: Write RED contract tests.** In `tests/farm-intelligence-build.py`, create a minimal synthetic schema fixture proving item -> source relation, fixed quantity, discrete PMF, unsupported quantity and task records. Assert exact source revision/digest binding, stable deterministic output and unsupported capability preservation.

- [ ] **Step 3: Write RED spatial-index tests.** In `tests/farm-spatial-index.py`, use synthetic accepted creature records with two entities/floors and assert that only exact entity IDs join. Include a same-name/different-id record and require no name fallback.

- [ ] **Step 4: Add a RED spawn-time provenance test.** When the refreshed accepted creature snapshot includes `spawn_time_seconds`, require the farm-spatial index to copy it only together with the exact source creature semantic/root identity. If refreshed semantics are not accepted for public analysis, assert the field is omitted and capability states say why.

- [ ] **Step 5: Run the tests and verify RED.** Run:

```bash
python tests/farm-intelligence-build.py
python tests/farm-spatial-index.py
```

Expected: failure because builders do not exist.

- [ ] **Step 6: Implement `build-farm-intelligence.py`.** Validate contract id/version/capabilities and source digest before writing any product. Build deterministic item search/detail and task shards with hard record/byte limits. Do not compute average drop chance. Preserve per-source exact models.

- [ ] **Step 7: Implement `build-farm-spatial-index.py`.** Read only the accepted creature publication, create a creature-entity keyed placement index, deterministic floor/cell aggregates and optional provenance-bound `spawn_time_seconds`. Aggregate cells must be presentation/derived data with `identityAuthority=false` or the repository's equivalent declaration.

- [ ] **Step 8: Assert terminology/count integrity.** Tests must prove that the product exposes `placement_count` separately from any optional `spawn_area_count`/timer facts and never emits fields named/semantically implying `live_count`, `occupied`, `available_now` or `simultaneous_capacity` without a separate accepted authority.

- [ ] **Step 9: Run builders twice and prove deterministic roots.** For identical input bytes, outputs and product roots/digests must match exactly. Change one source relation and require the appropriate root/digest to change.

- [ ] **Step 10: Commit the publication layer.** Commit producer consumer/tests together; do not include UI changes in this commit. Record pinned Game merge SHA/farm digest and creature publication root in the PR evidence.

---

### Task 3: Pure Atlas estimator, URL state and LOD logic

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `src/browser/farm-intelligence.mjs`
- Create: `src/browser/farm-state.mjs`
- Create: `src/browser/farm-lod.mjs`
- Create: `tests/farm-intelligence.mjs`
- Create: `tests/farm-state.mjs`
- Create: `tests/farm-lod.mjs`

**Interfaces:**
- `farm-intelligence.mjs` produces pure functions:

```js
export function expectedKillsFixed({ targetQuantity, probability, successQuantity }) {}
export function completionProbabilityFixed({ kills, targetQuantity, probability, successQuantity }) {}
export function completionThresholdFixed({ targetProbability, targetQuantity, probability, successQuantity, maxKills }) {}
export function completionProbabilityPmf({ kills, targetQuantity, perKillPmf, maxState }) {}
export function completionThresholdPmf({ targetProbability, targetQuantity, perKillPmf, maxKills, maxState }) {}
export function estimateTimeHours({ kills, effectiveKph }) {}
export function estimateKillTargetTimeHours({ targetKills, effectiveKph }) {}
```

- `farm-state.mjs` produces `parseFarmState(URLSearchParams)` and `serializeFarmState(state, URLSearchParams)` using stable IDs and validated bounded positive inputs.
- `farm-lod.mjs` produces `chooseFarmLod({ mode, zoom, projectedDensity, visiblePlacements })` and deterministic cluster/cell selection helpers; `AUTO` is monotonic and bounded.

- [ ] **Step 1: Write independent-oracle RED tests for fixed-quantity math.** Include exact small cases, for example `p=0.5`, target `2`, `q=1`: expected kills `4`; completion after 2 kills `0.25`; P50 threshold is the minimum integer `k` whose binomial tail is at least `0.5`.

- [ ] **Step 2: Write RED P50/P80/P95 threshold tests.** Verify minimality: threshold `k` passes the target probability and `k-1` does not. Include `q>1` with `r=ceil(N/q)`.

- [ ] **Step 3: Write RED exact PMF tests.** Use a tiny per-kill PMF such as `{0: 0.5, 1: 0.5}` and another with quantities `{0,1,2}`. Assert bounded DP results against hand-enumerated probabilities. Reject negative quantities, non-normalized probabilities, oversized target/state/kill bounds and unknown roll semantics.

- [ ] **Step 4: Write RED KPH tests.** `estimateTimeHours` must reject `0`, negative, `NaN`, `Infinity` and absent KPH. `estimateKillTargetTimeHours({targetKills:100,effectiveKph:200})` must equal `0.5` exactly. No `fast/typical/conservative` multipliers exist in the pure API.

- [ ] **Step 5: Write RED multiple-source tests.** Query normalization must expose per-source probabilities individually and must not return `averageDropChance` unless an explicit weighting provider is passed and named. V1 default path must omit it.

- [ ] **Step 6: Run and verify RED.** Run:

```bash
node --test tests/farm-intelligence.mjs tests/farm-state.mjs tests/farm-lod.mjs
```

Expected: module-not-found/function-not-defined failures.

- [ ] **Step 7: Implement minimal estimator functions.** Use stable numerics, bounded binomial/DP calculations and explicit iteration caps. Do not use simulation randomness where an exact bounded calculation is available.

- [ ] **Step 8: Implement URL state.** Supported public parameters:

```text
item=<stable-item-id>
farmQty=<positive-int>
farmKph=<positive-number>   # only when user supplied
farmTask=<stable-task-id>
farmCreature=<stable-creature-id>
farmKills=<positive-int>
farmView=auto|heatmap|clusters|spawns
```

Reject contradictory `farmTask` + incompatible custom item/creature combinations rather than silently merging them.

- [ ] **Step 9: Implement authoritative-task initialization helper.** A selected delivery task initializes estimate target from its factual required item quantity; a selected kill/weekly task initializes target from its factual kill count. Return separate `authoritativeRequirement` and `estimateTarget` fields so edits cannot rewrite the fact.

- [ ] **Step 10: Implement LOD logic.** `AUTO` chooses far heatmap, medium clusters and near placements from current zoom/density/count with monotonic boundaries. Exact thresholds must be constants justified by Task 6 visual/performance qualification and covered by tests; manual modes bypass auto selection without changing factual results.

- [ ] **Step 11: Re-run pure tests to GREEN and commit.** Run targeted Node tests plus existing relevant viewport/creature tests before committing.

---

### Task 4: FullWorld Explorer UI and map analysis overlay

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `web/fullworld-farm-explorer.mjs`
- Modify: `web/fullworld.html`
- Modify: `web/fullworld.css`
- Modify: `web/fullworld-search.mjs` only if item/task results are cleanly integrated with current semantic search
- Modify: `web/fullworld-creatures.mjs` only for a small shared presentation seam proven necessary by #113/#115 integration; do not duplicate the creature renderer
- Create: `tests/farm-gui-contract.mjs`

**Interfaces:**
- Consumes: verified `farm-intelligence` + `farm-spatial` products, `globalThis.__OTERYN_ATLAS_VIEW__` / `oteryn-atlas-view`, existing floor/camera/zoom state, animation runtime for near-detail creature presentation, and #113/#115 canonical geometry when available.
- Produces: one `#farm-analysis-overlay` canvas and one explorer state/controller; no DOM node per placement.
- Publishes bounded read-only diagnostics under `globalThis.__OTERYN_ATLAS_FARM__` containing status, source roots, selected IDs, active LOD, visible aggregate/cluster/placement counts, estimator input source and render generation; diagnostics never mutate product state.

- [ ] **Step 1: Write RED GUI contract tests.** Assert that FullWorld contains one explorer host and one farm overlay, no second map canvas/app shell, and module import paths are valid.

- [ ] **Step 2: Implement the minimal FullWorld shell.** Add `Item & Task Explorer` controls inside the current left rail/mobile drawer model and separate `VERIFIED FACTS` / `ESTIMATE` sections in the existing inspector flow. Add `#farm-analysis-overlay` to `#map-frame` with pointer behavior coordinated with existing creature interaction.

- [ ] **Step 3: Implement bounded product loading.** Validate manifest/root/digest before exposing results. Load only selected item/task relations and required creature spatial shards. A failed farm product disables Explorer only; base map/NPC/monster layers remain operational.

- [ ] **Step 4: Implement item source list semantics.** Each source row shows factual creature name, exact per-source probability, exact/bounded quantity semantics and verified placement count. Do not render a global average drop chance.

- [ ] **Step 5: Implement task semantics.** Authoritative delivery/kill/weekly task shows its factual requirement in `VERIFIED FACTS`; estimator target initializes from it. Custom kill mode is explicitly labelled `Custom kill target` and defaults to `100` only when no authoritative task owns the count.

- [ ] **Step 6: Implement estimator presentation.** Item mode shows `Expected`, `P50`, `P80`, `P95` kills and matching times only after KPH exists. Kill mode shows `N / effective KPH`. Display KPH source as `Manual assumption`; reserve a distinct future `Measured` provider contract for #117.

- [ ] **Step 7: Implement far heatmap.** Draw deterministic aggregate cells in one batched canvas pass using the exact committed FullWorld transform. Tooltip/selection copy must say `verified placements` and contributing source creatures, not live monsters.

- [ ] **Step 8: Implement medium clusters.** Draw deterministic cluster badges with placement count and source composition. Rank cards use named metrics only, e.g. `Most verified placements` or `Highest expected items per static clear` where exact models permit it.

- [ ] **Step 9: Implement near placement detail.** Reuse existing verified creature presentation/animation path and current selection geometry. Do not create a second sprite decoder, animation clock, click target registry or `creature=` selection system.

- [ ] **Step 10: Integrate #113/#115 if merged.** Consume their canonical presentation bounds/hit-testing/selected state. If not merged, keep the farm overlay interaction limited to farm clusters/highlights and expose a small shared bounds seam rather than inventing a competing creature interaction model.

- [ ] **Step 11: Implement URL/history synchronization.** Explorer state must round-trip through reload/back/forward without overwriting normal FullWorld floor/camera/zoom/animation state.

- [ ] **Step 12: Implement mobile behavior.** Reuse current controls/inspector drawers; no new parallel navigation. Verify inputs, lists, ranking cards and inspector facts/estimates remain readable at current supported mobile widths.

- [ ] **Step 13: Run GUI contract + pure tests to GREEN and commit.** Also run existing creature/animation/search/mobile tests that touch shared seams.

---

### Task 5: Search, selection and truthful ranking integration

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Modify: `web/fullworld-search.mjs`
- Modify: `src/browser/semantic-search.mjs` only if current search architecture requires a shared result-type seam
- Create: `tests/farm-search.mjs`
- Extend: `tests/farm-intelligence.mjs`

**Interfaces:**
- Consumes: stable item/task search records from Task 2 and Explorer state actions from Task 4.
- Produces: item/task result types that focus Explorer state rather than assigning fake coordinates; named ranking metrics only.

- [ ] **Step 1: Write RED item/task search tests.** Selecting an item result must dispatch/focus `item=<stable-id>` without changing camera position. Selecting a task result must set `farmTask=<stable-id>` and initialize estimator target from the authoritative requirement.

- [ ] **Step 2: Write RED no-fake-coordinate test.** Item/task search records without factual positions must remain non-spatial; consumer must not fabricate `(0,0,0)` or reuse a source creature's coordinates as the item's identity position.

- [ ] **Step 3: Write RED ranking label tests.** Before measured #117 analytics, reject/omit generic `Best place to farm` unless the card also names the exact deterministic metric. Ensure no mock-up place names are hard-coded.

- [ ] **Step 4: Implement minimal search integration.** Reuse current search ranking/keyboard behavior where possible; add item/task result adapters only.

- [ ] **Step 5: Implement deterministic ranking helpers.** Supported v1 metrics are explicit and reproducible from static facts, e.g. placement count, static-clear expected yield, spatial spread. Do not call them observed farm speed.

- [ ] **Step 6: Run search + state + GUI tests to GREEN and commit.**

---

### Task 6: Browser geometry, visual, failure and performance acceptance

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `e2e/tests/farm-explorer-desktop.spec.mjs`
- Create: `e2e/tests/farm-explorer-mobile.spec.mjs`
- Create: `e2e/tests/farm-explorer-geometry.spec.mjs`
- Create: `e2e/tests/farm-explorer-failure.spec.mjs`
- Create: `e2e/tests/farm-explorer-performance.spec.mjs`
- Extend visual acceptance evidence only through the current #111 framework; do not commit unauthorized Game/world raster baselines.
- Extend existing support helpers only when necessary: `e2e/support/geometry-oracle.mjs`, `e2e/support/performance.mjs`, `e2e/support/artifacts.mjs`.

**Interfaces:**
- Consumes: real FullWorld browser runtime, exact tested farm publication, existing geometry/performance/artifact oracles.
- Produces: revision-qualified real Chromium proof for user journey, transform synchronization, failure isolation, dense/sparse boundedness and readable LOD.

- [ ] **Step 1: Add desktop RED journey.** Exercise item search -> source creature -> far heatmap -> medium clusters -> near placements -> target edit -> KPH edit -> P50/P80/P95 -> reload/back/forward. Assert factual/estimate labels and no average drop chance.

- [ ] **Step 2: Add authoritative task RED journey.** Select a real exported delivery or kill task when available and assert factual required count initializes but remains separate from editable estimate target. If current Game capability is unsupported, assert truthful unavailable state plus working custom kill target instead of fabricating a task.

- [ ] **Step 3: Add mobile RED journey.** Verify drawer reachability, scroll/readability, target/KPH editing, map LOD control and inspector facts/estimates with no horizontal overflow or essential-control occlusion.

- [ ] **Step 4: Add geometry RED oracle.** Capture farm overlay world anchors and base map projection before/after pan, zoom, resize, floor changes and mode transitions. Require the same committed transform linkage and justified pixel tolerance used by current geometry policy.

- [ ] **Step 5: Add stale-floor and source-selection regressions.** After a floor/source change, no placement from the old committed selection/floor may paint in the new frame.

- [ ] **Step 6: Add failure RED cases.** Corrupt farm manifest/root, missing optional item shard, unknown contract version, unresolved creature join, unsupported quantity model and invalid KPH. Explorer must fail closed by capability while base Atlas remains usable.

- [ ] **Step 7: Add performance evidence.** Pick one sparse and one dense truthful exported case. Record visible aggregate/cluster/placement count, draw/update time, cache/shard count, request/byte evidence where available and pan/zoom frame behavior. Establish any blocking threshold from measured baseline evidence; do not invent one in advance.

- [ ] **Step 8: Perform real visual review.** Capture representative desktop/mobile screenshots/artifacts at far/medium/near LOD and verify that world-scale view is materially less cluttered than equal-size-sprite rendering. Review artifacts manually; DOM presence alone is not acceptance.

- [ ] **Step 9: Verify mock-up values are absent.** Search the product/test fixture diff for illustrative numbers/place names from the generated mock-up and require any occurrence to be either removed or explicitly synthetic/non-authoritative with no real-data claim.

- [ ] **Step 10: Run targeted specs twice with retries `0`, then complete exact-head Docker Playwright on Molehill-PC.** Publish the exact tested head as the repository-required local E2E status; do not move heavy verification to Synology.

- [ ] **Step 11: Commit E2E/acceptance coverage only after all targeted scenarios are stable without retries or arbitrary sleeps.**

---

### Task 7: Cross-repository integration, exact-head gates, merge and merged-main acceptance

**Repositories:** `Oteryn/Oteryn-Game`, `Oteryn/Oteryn-Atlas`

**Files:**
- No new feature scope. Update only lifecycle/evidence docs/issues/PR metadata required by current repository policy.

**Interfaces:**
- Consumes: merged Game farm contract and final Atlas implementation head.
- Produces: exact-head verified, protected squash merges and merged-main Atlas live acceptance.

- [ ] **Step 1: Reconfirm Game authority.** Verify the Game farm-intelligence producer is merged, exact merge SHA/digest match what Atlas pins, Issue #75 is terminal/accurate, and no later Game change invalidates the accepted artifact.

- [ ] **Step 2: Run full applicable Atlas deterministic suite.** Include new Python/Node tests plus existing creature/animation/search/geometry/verification contracts touched by shared seams. Run `git diff --check`.

- [ ] **Step 3: Run exact-head heavy browser qualification on Molehill-PC.** Complete Docker Playwright PR gate with retries `0`, publish exact head status, review failure/success artifacts and retain revision-qualified evidence.

- [ ] **Step 4: Review complete Atlas final diff.** Confirm no external-site runtime authority, no proprietary copied assets, no mock-up data masquerading as facts, no average drop chance without weighting, no live-spawn claims and no duplicate creature interaction/animation runtime.

- [ ] **Step 5: Push final Atlas head and require GitHub checks.** `atlas-gate` and `provenance-gate` must be green on the exact final head; resolve applicable review threads before merge.

- [ ] **Step 6: Squash-merge the Atlas PR and delete the completed branch.** Verify merged `main` contains the intended paths and exact squash SHA. Close #114 only when Definition of Done is actually met; leave #11/#85/#111/#117 according to their own wider lifecycle.

- [ ] **Step 7: Deploy/accept only merged main.** Use existing trusted merged-main Synology workflow. Verify served revision label/header, publication/product health, bounded desktop/mobile live smoke and rollback evidence according to `AGENTS.md`.

- [ ] **Step 8: Record terminal evidence.** Record exact Game merge SHA/farm digest, Atlas squash merge SHA, source creature publication root, farm publication roots, supported/partial/unsupported capability census, exact estimator models shipped, browser evidence identity and measured runtime impact.

## Plan self-review result

- Spec coverage: Game authority, Atlas publication, estimator math, task defaults, URL state, LOD, interaction geometry, partial-data behavior, mobile, search, failure isolation, performance, visual acceptance and closeout are each assigned to a task.
- Review addendum coverage: no average drop chance; placement/live distinction; spawn-time provenance; per-kill PMF semantics; P50/P80/P95 labels; authoritative task defaults; Hunt Intelligence provider seam; #113/#115 geometry reuse; named ranking metrics; partial capability behavior; mock-up-data prohibition are all represented in executable steps.
- No task depends on guessed Game facts. Current-source capability gaps are expected to fail closed rather than be filled from the web.
- Execution order is intentionally Game producer -> Atlas publication -> pure logic -> UI -> search/ranking -> browser qualification -> merge/acceptance. Pure Atlas math/state can be developed in parallel with the Game producer only against explicit synthetic schema fixtures and cannot claim real facts until Task 1 is merged/pinned.
