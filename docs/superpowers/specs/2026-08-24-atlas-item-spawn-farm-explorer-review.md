# Atlas Item & Spawn Farm Explorer — design review and corrections

Alias: `ATLAS-ITEM-SPAWN-FARM-EXPLORER`

Lifecycle authorities:
- Atlas implementation: `Oteryn/Oteryn-Atlas#114`.
- Game producer: `Oteryn/Oteryn-Game#75`.
- Related Hunt Intelligence / measured KPH provider: `Oteryn/Oteryn-Atlas#117`.
- Related creature interaction geometry: `Oteryn/Oteryn-Atlas#113`.
- Related creature label/presentation geometry: `Oteryn/Oteryn-Atlas#115`.
- Verification policy: `Oteryn/Oteryn-Atlas#85` and user-facing visual acceptance `#111`.

This file is a normative review addendum to:
`docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-design.md`.

Observed during review on 2026-08-24:
- Atlas `main`: `db5de3938ef815fb467dd2ad911a1ed92b13dccf`.
- Item/Spawn design PR #120 head before this review: `f2a1e6eb4b2cec30a170f35bf4bd6b1cef02f0fc`.
- Game `main` advanced to `6945e962035bac83d1f19b00984df5b82719ebb9` while design work was in progress.

These SHAs are evidence only. Execution must refresh GitHub before mutation.

## Verdict

The product direction is sound: reuse the existing FullWorld runtime, keep Game authoritative for item/loot/task/spawn facts, keep Atlas responsible for projections/LOD/estimates, and use explicit KPH rather than inventing player performance.

The original design requires the refinements below before implementation so that the visual mock-up does not accidentally become a source of false semantics.

## 1. Mock-up numbers are illustrative only

The generated UI mock-up is a visual concept, not data authority.

Do **not** copy any example value from it into implementation, fixtures presented as real data, or acceptance claims. This includes, but is not limited to:
- `14.47%` average drop chance;
- `154` spawns;
- `~35s` respawn;
- example region names;
- example farm times;
- example kill counts;
- example task quantities;
- example rankings such as `Best places to farm`.

Every factual number must come from an accepted Game export. Every estimate must be derived from explicitly displayed assumptions.

## 2. Do not publish a naive average drop chance

When several creatures can drop one item, their probabilities are separate relations.

V1 must not calculate or headline an unweighted `Avg Drop Chance` across source creatures. That number has no useful farm meaning unless a weighting model is explicit and evidence-backed.

Allowed presentation:
- show the exact chance/quantity model per selected source creature;
- allow comparison of source creatures side by side;
- for a selected static cluster, derive a named static-clear yield only from exact per-kill models and factual placements.

Future Hunt Intelligence may provide measured source/hunt weighting. It remains a separate measured-data source.

## 3. Use precise spawn terminology

The accepted Game static-creature producer currently exports `monster_spawns` as individual **monster/spawn placement records**. Its README reports `87565` monster/spawn placements.

Therefore Atlas must distinguish:
- `placement count` — number of factual exported placement records matching the query;
- `spawn area` — factual group center/radius attached to a placement where published;
- `spawn timer` — published `spawn_time_seconds` field where accepted;
- `live occupancy` — **not available** from the static Atlas projection;
- `simultaneous capacity` / `kills per respawn cycle` — must not be inferred unless Game semantics explicitly prove it.

User-facing copy should prefer `verified placements` / `spawn placements` when a plain `spawns` label could be read as live count or capacity.

## 4. Existing spawn-time field needs semantic re-validation, not duplication

`Oteryn-Game/tools/game-atlas-creatures/export.py` currently exports `spawn_time_seconds` on monster and NPC placement records.

`Oteryn-Atlas/tools/build-creature-index.py` currently does **not** include that field in its public creature shards.

Implementation should therefore:
1. verify the accepted meaning and provenance of `spawn_time_seconds` at the refreshed Game head;
2. if suitable for public farm analysis, preserve it in the new creature-keyed `farm-spatial` secondary product instead of duplicating the same value into the item/loot contract;
3. keep its source root/digest linked to the exact accepted creature publication;
4. never treat the presence of a timer field alone as proof of the complete server respawn algorithm.

A derived theoretical timer-supply metric may be added only if the Game contract proves enough semantics to state its assumptions precisely. It is never live availability.

## 5. Strengthen loot roll semantics

The simple negative-binomial estimator is valid only when the Game contract proves one Bernoulli loot opportunity per kill with fixed successful quantity `q`.

For that model:
- required successful rolls: `r = ceil(N / q)`;
- `E[K] = r / p`;
- completion after `k` kills: `P(Binomial(k,p) >= r)`.

If the same item can be produced by multiple independent rolls in one kill, or the source runtime has another roll algorithm, the producer must expose enough semantics to normalize to an exact **per-kill quantity distribution**. Atlas must not force such a model into one Bernoulli relation.

For an exact per-kill discrete PMF, Atlas may use bounded deterministic DP/convolution. If an exact PMF cannot be proven, probability-aware target completion stays unavailable.

## 6. Use statistically named outputs, not vague speed labels

Replace UI concepts such as `Fast / Typical / Conservative` unless they are explicitly defined by an accepted statistical contract.

V1 item estimator should prefer:
- `Expected kills`;
- `P50 kills` — smallest kill count with at least 50% completion probability;
- `P80 kills`;
- `P95 kills`.

When KPH is supplied, display the matching time values with the same labels. Do not call P95 a guarantee.

For custom/weekly kill tasks there is no drop randomness in the basic formula, so show the deterministic `N / effective KPH` estimate. Any future uncertainty band must come from a measured KPH distribution, not invented UI multipliers.

## 7. Authoritative task requirements override the default target

`100` is only the default for free item/custom kill exploration.

Rules:
- item opened directly with no selected authoritative delivery task -> default editable target `100`;
- authoritative delivery task selected -> initialize target from the Game-published required item quantity;
- custom creature kill target -> default editable target `100`;
- authoritative kill/weekly task selected -> initialize target from the Game-published required kill count;
- user edits remain explicit local estimator state and do not mutate the authoritative task requirement shown in `VERIFIED FACTS`.

## 8. Integrate with Hunt Intelligence instead of duplicating analytics

Issue #117 owns Hunt Intelligence and future measured player/party/hunt-area analytics.

Farm Explorer v1 may use manual `effective KPH`. Its estimator boundary must permit a future provider with:
- measured KPH value or distribution;
- player/party/hunt-area scope;
- comparable cohort dimensions;
- sample size;
- observation window;
- content/ruleset revision;
- quality/confidence metadata.

Farm Explorer must not create its own independent analytics store, telemetry model, player profile authority, or fixed solo/party multiplier.

If measured KPH from #117 is available later, the UI must distinguish `MEASURED` KPH from a `Manual assumption`, and the user must be able to override or compare rather than silently replace their input.

## 9. Reuse canonical creature interaction/presentation geometry

Issue #113 owns click/tap/hit testing/contextual creature cards. Issue #115 owns canonical presentation bounds and label/badge layout.

If either lands before Farm Explorer runtime work:
- reuse their canonical presentation bounds, selection and hit-test seams;
- do not add a second creature click system;
- do not maintain independent world-to-screen geometry for near-zoom farm creatures;
- the farm analysis overlay owns only heatmap/cluster/highlight presentation and selection filtering.

If they remain unmerged, Farm Explorer should expose or consume one common geometry seam that can be reconciled later without duplicating factual placement state.

## 10. Ranking labels must match evidence

Before measured Hunt Intelligence exists, avoid a generic headline `Best places to farm`.

Prefer labels that state the metric, for example:
- `Most verified placements`;
- `Highest expected items per static clear`;
- `Smallest spatial spread`;
- `Most target-creature placements`.

Only an analytics-backed observed farm-rate metric may support a user-facing `Best observed farm rate` / `Best place for me` claim, with cohort/revision/sample/confidence metadata.

## 11. Fail-closed partial support is a valid v1 result

It is currently UNKNOWN whether refreshed Game sources can prove all loot probabilities, exact quantity distributions, delivery-task definitions and weekly-task semantics for the desired catalogue.

That uncertainty does not block the architecture. The Game producer must publish capability/completeness states and unresolved relations truthfully.

Atlas can ship a partially populated explorer only when:
- supported facts are explicitly marked factual;
- unsupported fields are unavailable rather than guessed;
- the UI does not imply catalogue completeness it cannot prove;
- tests cover partial/unsupported capability combinations.

## 12. Additional acceptance requirements from this review

Add deterministic tests for:
- no aggregate `average drop chance` without an explicit weighting model;
- placement count terminology/state distinct from live occupancy/capacity;
- `spawn_time_seconds` provenance binding if projected into `farm-spatial`;
- simple Bernoulli estimator rejected for multi-roll/unknown roll semantics;
- exact per-kill PMF bounded estimator where supported;
- P50/P80/P95 threshold definition as minimum `k` satisfying the requested probability;
- authoritative task count/quantity initializes estimator target while remaining separately displayed as a fact;
- manual KPH and future measured KPH remain distinguishable;
- #113/#115 geometry seam reuse when present;
- mock-up example values are never used as runtime/fixture authority.

## Final design decision

Proceed with the original native FullWorld Item & Spawn Explorer architecture, with this review addendum treated as normative where it tightens or clarifies the original design.
