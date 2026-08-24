# Atlas Item & Spawn Farm Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a native FullWorld Item & Spawn Farm Explorer that joins Game-owned item/loot/task facts to verified creature placements, renders readable heatmap/cluster/detail LOD, and calculates truthfully labelled item-farm and kill-target estimates.

**Architecture:** Oteryn-Game publishes a versioned, public-safe farm-intelligence contract. Oteryn-Atlas compiles bounded farm-intelligence and creature-keyed spatial products, then consumes them through pure estimator/state/LOD modules and one FullWorld explorer controller. Game facts remain authoritative; Atlas calculations remain derived/estimated.

**Tech Stack:** Python 3 deterministic producers/validators, JavaScript ES modules, Node.js `node:test`, Canvas/WebGL-compatible FullWorld overlays, Playwright Chromium/Docker, existing GitHub `atlas-gate` / `provenance-gate` lifecycle.

**Spec:** `docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-design.md`

**Normative review:** `docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-review.md`

**Execution prompt:** `docs/agents/prompts/ATLAS-ITEM-SPAWN-FARM-EXPLORER.md`

## Global Constraints

- Atlas lifecycle authority: `Oteryn/Oteryn-Atlas#114`; parent `#11`; verification `#85`; visual-user acceptance `#111`.
- Game producer lifecycle authority: `Oteryn/Oteryn-Game#75`.
- Future measured KPH/hunt analytics authority: `Oteryn/Oteryn-Atlas#117`; Farm Explorer must not create a duplicate analytics/profile system.
- Creature interaction/presentation geometry: `Oteryn/Oteryn-Atlas#113` and `#115`; reuse their canonical seams when present.
- Design-time Atlas `main` was `db5de3938ef815fb467dd2ad911a1ed92b13dccf`; Game `main` subsequently advanced to `6945e962035bac83d1f19b00984df5b82719ebb9`. These are evidence only; refresh both repositories before every mutation phase.
- Oteryn-Game owns item, creature, loot, probability, quantity, task, weekly classification, placement and accepted respawn facts. Atlas owns validation, indexes, LOD aggregates and derived estimates.
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
- Game implementation must avoid active Wave-1 allocations `apps/game-server/src/domain/**` (PR #56) and `apps/game-server/src/content/**` (PR #58) unless ownership is explicitly transferred.
- Live Atlas acceptance occurs only from merged `main`; Molehill-PC owns heavy PR browser qualification, Synology merged-main live acceptance.

---

### Task 1: Game farm-intelligence contract and producer

**Repository:** `Oteryn/Oteryn-Game`

**Files:**
- Create: `docs/contracts/OTERYN_GAME_ATLAS_FARM_INTELLIGENCE_V1.md`
- Create: `tools/game-atlas-farm-intelligence/export.py`
- Create: `tools/game-atlas-farm-intelligence/verify.py`
- Create: `tools/game-atlas-farm-intelligence/self_test.py`
- Optional only when current accepted evidence can be committed as a small public-safe fixture: `tools/game-atlas-farm-intelligence/fixtures/acceptance-source.json`
- Optional workflow only if current CI requires a dedicated producer job: `.github/workflows/game-atlas-farm-intelligence.yml`

**Interfaces:**
- Consumes: accepted Game/reference-migration evidence and current stable creature entity identity from `tools/game-atlas-creatures/export.py`.
- Produces: `oteryn-game-atlas-farm-intelligence-v1` with producer/source identity, semantic digest, capability states, item records, creature->item relations, task records, exact probability representation and explicit quantity/roll semantics.

- [ ] **Step 1: Refresh preflight.** Resolve current Game `main`, Issue #75, repository instructions, PR #56/#58 heads and overlapping producer work. Create/reuse one dedicated Game task branch from refreshed `main`.

- [ ] **Step 2: Write the contract first.** Define closed capability states `SUPPORTED|PARTIAL|UNSUPPORTED`, stable IDs, rational probabilities `{numerator, denominator}`, quantity kinds `fixed|discrete_pmf|bounded_unknown|unsupported`, task kinds `delivery|kill`, explicit weekly classification, canonical order and hard bounds.

- [ ] **Step 3: Write RED probability and quantity tests.** The first exact cases must include:

```python
assert normalize_probability({"numerator": 1, "denominator": 4}) == {
    "numerator": 1,
    "denominator": 4,
}
assert normalize_quantity({"kind": "fixed", "quantity": 2}) == {
    "kind": "fixed",
    "quantity": 2,
}
```

Add failures for denominator `0`, negative numerator, numerator greater than denominator, non-integers, ambiguous chance scale, non-positive fixed quantity, malformed PMF, PMF probability mass not equal to 1, and bounded ranges with `min > max`.

- [ ] **Step 4: Write RED graph/capability tests.** Require rejection of duplicate item/relation/task IDs and dangling item/creature/task references. Require deterministic output under input reordering and a changed semantic digest when one authoritative source relation changes. Require explicit `UNSUPPORTED` rather than an empty-array inference.

- [ ] **Step 5: Run RED.** Run:

```bash
python tools/game-atlas-farm-intelligence/self_test.py
```

Expected: import/function failure because producer helpers do not exist yet.

- [ ] **Step 6: Implement the deterministic producer.** Implement concrete helpers with these signatures:

```python
def canonical_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def normalize_probability(raw: dict[str, object]) -> dict[str, int]:
    numerator = raw.get("numerator")
    denominator = raw.get("denominator")
    if not isinstance(numerator, int) or isinstance(numerator, bool):
        raise ExportError("probability numerator must be an integer")
    if not isinstance(denominator, int) or isinstance(denominator, bool):
        raise ExportError("probability denominator must be an integer")
    if denominator <= 0 or numerator < 0 or numerator > denominator:
        raise ExportError("invalid probability rational")
    return {"numerator": numerator, "denominator": denominator}
```

Implement `normalize_quantity(...)` and `build_snapshot(...)` with the contract's exact schema. Missing or ambiguous source semantics must become capability/unresolved state, never guessed values.

- [ ] **Step 7: Prove roll semantics.** For one Bernoulli loot opportunity per kill, publish that explicitly. For multiple independent rolls or another exact finite mechanism, normalize to an exact **per-kill quantity PMF** or publish an exact roll program that deterministically normalizes to one. If neither can be proven, mark exact completion-probability capability unsupported for that relation.

- [ ] **Step 8: Implement an independent validator.** `verify.py` must check contract/version, capabilities, IDs, probability bounds, PMF mass, quantity bounds, task references, creature identity format, canonical digest, counts/bytes and public-safe provenance. Reject unknown critical schema features.

- [ ] **Step 9: Produce truthful current-source evidence.** If the accepted source boundary is available on the authorized execution host, generate `target/game-atlas-farm-intelligence/acceptance.json` and a capability census. If not, record the exact blocker and ship truthful capability metadata; do not substitute web data.

- [ ] **Step 10: Run Game GREEN verification.** Use:

```bash
python tools/game-atlas-farm-intelligence/self_test.py
python tools/game-atlas-farm-intelligence/verify.py target/game-atlas-farm-intelligence/acceptance.json
python tools/agents/validate_governance.py
cargo +1.94.0 test --locked --workspace --all-targets
cargo +1.94.0 clippy --locked --workspace --all-targets -- -D warnings
git diff --check
```

If a current repository-selected command supersedes one of these, run the current command and record it in PR evidence.

- [ ] **Step 11: Deliver Game first.** Review full diff, push exact head, open/update one PR under #75, require current gates/review policy, squash-merge, delete branch where policy allows, and record exact merged Game SHA + farm semantic digest for Task 2.

---

### Task 2: Atlas farm publication and creature-keyed spatial index

**Repository:** `Oteryn/Oteryn-Atlas`

**Files:**
- Create: `tools/build-farm-intelligence.py`
- Create: `tools/build-farm-spatial-index.py`
- Create: `tests/farm-intelligence-build.py`
- Create: `tests/farm-spatial-index.py`
- Generated products: `data/farm-intelligence/**`, `data/farm-spatial/**` according to the current publication policy; do not commit large generated artifacts unless current repository policy requires them.

**Interfaces:**
- Consumes: exact merged Game farm snapshot/digest from Task 1 and exact accepted creature publication used by `tools/build-creature-index.py`.
- Produces: bounded farm item/task search/detail products and stable-creature-ID keyed placement/aggregate shards. No name-only join.

- [ ] **Step 1: Refresh Atlas preflight after Game merge.** Resolve current `main`, #114, PR overlap, #113/#115 status and current publication rules; create/rebase the Atlas implementation branch from current `main`.

- [ ] **Step 2: Write RED farm-product tests.** Use a synthetic schema fixture containing one fixed-quantity relation, one exact PMF relation, one bounded-unknown relation and one task. Assert exact Game revision/digest binding, capability preservation, canonical ordering and deterministic output.

- [ ] **Step 3: Write RED spatial tests.** Use two stable creature IDs with intentionally identical display names. Assert only exact entity ID joins and that a name match never repairs an unresolved identity.

- [ ] **Step 4: Write RED placement/timer provenance tests.** Assert `placement_count` is distinct from live occupancy/capacity. If refreshed creature source publishes accepted `spawn_time_seconds`, require any projected timer to carry exact source-root binding. If timer semantics are not accepted for farm analysis, assert it is absent with explicit capability state.

- [ ] **Step 5: Run RED.** Run:

```bash
python tests/farm-intelligence-build.py
python tests/farm-spatial-index.py
```

Expected: failure because builders do not exist.

- [ ] **Step 6: Implement `build-farm-intelligence.py`.** Validate Game contract/version/digest before writing any output. Preserve probability/quantity per source creature. Build bounded item/task search and detail shards. Do not emit `averageDropChance`.

- [ ] **Step 7: Implement `build-farm-spatial-index.py`.** Read only accepted creature projection data, key by stable creature entity ID, emit floor/placement shards and deterministic multi-resolution cells. Mark aggregate/cell identity as non-authoritative. Preserve optional accepted timer data without promoting it to live-state semantics.

- [ ] **Step 8: Prove deterministic roots.** Build twice from identical bytes and require identical product roots. Change one source relation and require farm root change; change one creature placement and require spatial root change.

- [ ] **Step 9: Run GREEN and commit.** Run both tests, relevant existing creature-index tests and `git diff --check`; commit publication layer without UI scope.

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

- [ ] **Step 2: Write RED P50/P80/P95 tests.** Each threshold is the minimum integer `k` where completion probability is at least `0.50`, `0.80` or `0.95`; assert `k` passes and `k-1` fails.

- [ ] **Step 3: Write RED PMF tests.** Hand-enumerate tiny distributions such as `{0:0.5,1:0.5}` and `{0:0.5,1:0.25,2:0.25}`. Reject malformed/non-normalized PMFs, oversized target/state/kill bounds and unknown roll semantics.

- [ ] **Step 4: Write RED KPH tests.** Reject absent, `0`, negative, `NaN` and `Infinity`. Require `100 / 200 = 0.5h` for a custom kill target. There are no `fast/typical/conservative` multipliers in v1.

- [ ] **Step 5: Write RED multiple-source tests.** Default query output exposes each source relation separately and contains no unweighted average drop chance.

- [ ] **Step 6: Write RED URL tests.** Round-trip:

```text
item=<stable-item-id>
farmQty=<positive-int>
farmKph=<positive-number>
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

- [ ] **Step 9: Implement exact bounded calculations.** Use exact binomial-tail calculation for the one-Bernoulli fixed-quantity model and bounded deterministic DP/convolution for exact per-kill PMFs. Use explicit caps for kills, target quantity and PMF state size; no random simulation in the deterministic oracle path.

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

- [ ] **Step 1: Write RED GUI contract.** Assert exactly one Explorer host and one farm overlay inside the current FullWorld shell; no second app/map shell and no DOM node per placement.

- [ ] **Step 2: Add shell and loading.** Add `Item & Task Explorer` to existing controls/mobile drawer model; add separate `VERIFIED FACTS` and `ESTIMATE` inspector blocks. Verify manifest/root/digest before showing farm data. Farm failure must not disable base Atlas.

- [ ] **Step 3: Add item source rows.** Show source creature, exact per-source probability, exact/bounded quantity semantics and verified placement count. Never show a global average drop chance in the default path.

- [ ] **Step 4: Add task target behavior.** Authoritative task requirement remains visibly factual while estimate target can be edited. Weekly label appears only when Game proves weekly semantics. Otherwise use `Kill target` / `Custom kill target`.

- [ ] **Step 5: Add estimator UI.** Item mode shows `Expected`, `P50`, `P80`, `P95` kills; matching times appear only after effective KPH exists. Kill mode shows target/KPH time. KPH source is `Manual assumption` in v1; reserve a distinct future `Measured` source for #117.

- [ ] **Step 6: Add far LOD.** Draw deterministic heatmap/aggregate cells in a batched Canvas/WebGL-compatible pass using the same committed FullWorld transform. Copy says `verified placements`, never `monsters available now`.

- [ ] **Step 7: Add medium LOD.** Draw deterministic clusters with placement count and source composition. Rankings are named by metric: `Most verified placements`, `Highest expected items per static clear`, or another documented static metric.

- [ ] **Step 8: Add near LOD.** Reuse existing verified creature presentation and animation. Do not add a second sprite decoder, animation clock, creature hit-test registry or selection/deep-link system.

- [ ] **Step 9: Reconcile #113/#115.** If merged, consume canonical presentation bounds/hit-testing/selection. If still unmerged, keep farm interaction limited to farm cells/clusters/highlights and expose one reusable geometry seam for later reconciliation.

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

### Task 7: Cross-repository closeout

**Repositories:** `Oteryn/Oteryn-Game`, `Oteryn/Oteryn-Atlas`

**Files:**
- No new feature scope; update lifecycle/evidence records required by current repository policy only.

**Interfaces:**
- Consumes: merged Game farm contract and final Atlas implementation head.
- Produces: exact-head verified protected merges and merged-main live acceptance.

- [ ] **Step 1: Reconfirm Game pin.** Verify Game farm producer is merged, exact merge SHA/digest match Atlas pin and no later accepted Game change invalidates the artifact.

- [ ] **Step 2: Run full applicable Atlas deterministic suite.** Include new Python/Node tests and all touched creature/animation/search/geometry/verification contracts; run `git diff --check`.

- [ ] **Step 3: Run exact-head heavy browser gate.** Molehill-PC completes Docker Playwright with retries `0`; review artifacts and publish exact-head local E2E status.

- [ ] **Step 4: Review complete final diff.** Confirm no external-site runtime authority, no proprietary copied assets, no mock-up values as facts, no unweighted average chance, no live-spawn claim and no duplicate interaction/animation runtime.

- [ ] **Step 5: Require exact-head GitHub checks.** `atlas-gate` and `provenance-gate` are green on the exact final head and applicable review threads are resolved.

- [ ] **Step 6: Squash-merge Atlas and clean branch.** Verify merged `main` contains intended files and exact squash SHA. Close #114 only when its Definition of Done is actually satisfied; do not close wider #11/#85/#111/#117 prematurely.

- [ ] **Step 7: Run merged-main live acceptance only.** Existing trusted Synology workflow verifies served revision label/header, publication/product health, bounded desktop/mobile smoke and rollback evidence.

- [ ] **Step 8: Record terminal evidence.** Persist exact Game merge SHA/farm digest, Atlas squash SHA, creature publication root, farm product roots, capability census, estimator models shipped, browser evidence identity and measured runtime impact.

## Plan self-review result

- All requirements from the design and normative review are assigned to executable tasks.
- No task depends on guessed Game facts or external website authority.
- No naive average-drop metric exists in the planned v1 API or UI.
- Placement/timer/live-state semantics remain separate.
- Fixed-drop and exact-PMF estimator models have independent deterministic tests; unsupported roll semantics disable exact probability math.
- P50/P80/P95, authoritative task defaults, manual-vs-future-measured KPH, #113/#115 reuse, named rankings and mock-up-data prohibition are explicitly tested.
- Execution order is Game producer -> Atlas publication -> pure logic -> UI -> search/ranking -> browser qualification -> closeout. Pure Atlas math/state may proceed in parallel only against clearly synthetic schema fixtures and cannot claim real item/drop/task facts before the Game producer is accepted and pinned.

## Post-review execution deltas

The following deltas are mandatory and refine the tasks above after the final semantic review:

- **Task 1 / Game contract:** bind every exact loot model to content/ruleset/profile context and state whether it is a base/static model or includes a modifier class. Preserve richer multi-requirement/grouped task semantics or mark that task form unsupported; never flatten it.
- **Task 1 / Game contract:** if placement `weight`, alternative-spawn or conditional activation semantics are needed for yield/capacity, publish/prove them explicitly. Do not let Atlas infer them from placement count.
- **Task 2 / spatial index:** do not manufacture spawn-group identity by deduplicating equal `spawn_area` center/radius values. Carry a Game-owned stable group identity only if one is published.
- **Task 3 / item time:** scalar manual KPH is `qualifying source-creature kills/hour` for the selected loot relation. A mixed-source item estimate needs an explicit per-source KPH/mixture model; otherwise time remains per selected source creature.
- **Task 3 / kill task:** scalar KPH means `credited target kills/hour` when Game publishes task-credit semantics. Raw total hunt/team kills are not silently substituted.
- **Task 3 / exact PMF:** compute expected kills as a bounded absorbing hitting-time recurrence, not `target / expected quantity`, and return explicit unreachable state for `p0=1`; cover `p=0` and `p=1` fixed-drop edges.
- **Task 4 / copy:** distinguish `Base drop chance` / `Published drop model` from live/current chance unless an authoritative live modifier source exists. Percentage formatting is presentation only; calculations retain normalized exact probability.
- **Task 5 / ranking:** `expected items per static clear` is disabled unless concurrent/activation semantics for the included placements are proven; otherwise use placement-count/spatial metrics only.
- **Task 6 / acceptance:** add explicit tests for KPH scope, mixed-source refusal, modifier context, weighted placement gating, group-identity non-inference, PMF hitting-time edges, richer-task non-flattening and probability display-rounding isolation.
