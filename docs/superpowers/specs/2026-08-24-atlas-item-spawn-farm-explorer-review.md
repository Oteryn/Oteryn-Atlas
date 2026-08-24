# Atlas Item & Spawn Farm Explorer — design review and corrections

Alias: `ATLAS-ITEM-SPAWN-FARM-EXPLORER`

Lifecycle authorities:
- Atlas implementation: `Oteryn/Oteryn-Atlas#114`.
- Read-only upstream requirement: `Oteryn/Oteryn-Game#75`; this execution must not mutate Game.
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

Final hardening refresh inspected Atlas `main@42d268aa98a7d48e8a7a9ed2e95e4a9c14753909` and Game read-only `main@55e30e23c3d5775ce760c6b210ea77f152b359ae`; these are also evidence only.

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

If the same item can be produced by multiple independent rolls in one kill, or the source runtime has another roll algorithm, the accepted upstream publication must expose enough semantics to normalize to an exact **per-kill quantity distribution**. Atlas must not force such a model into one Bernoulli relation.

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

That uncertainty does not block Atlas-side architecture. Atlas consumes capability/completeness states only when an accepted upstream publication supplies them; otherwise it records the exact affected capability as `UPSTREAM_BLOCKED` rather than mutating Game.

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

Proceed with the native FullWorld Item & Spawn Explorer architecture as an **Atlas-only execution**. This review addendum is normative wherever it tightens or overrides original cross-repository wording; Game #75 remains read-only upstream requirement/evidence.

## 13. Effective KPH must be scoped to qualifying/credited kills

A scalar `kills/hour` is meaningful only when its denominator matches the estimator model.

For item farming against one selected source creature, v1 `effective KPH` means **qualifying kills of that source creature per hour**, i.e. loot opportunities governed by the selected relation. It must not mean all monsters killed during the hunt.

For an authoritative kill task, the relevant value is **credited target kills/hour** under the exact Game task-credit semantics. Raw team kills or personal last-hits are not automatically equivalent to credited task progress.

If an item is farmed from several source creatures with different drop models, Atlas must not combine them with one total-hunt KPH unless the input supplies an explicit per-source KPH/mixture model. V1 may instead require the user to select one source creature for time estimation while still mapping all sources.

Future measured KPH from #117 must carry the same scope explicitly (`source creature`, `task-credit target`, or a fully specified mixed-hunt composition).

## 14. Drop probabilities need revision/modifier context

An exact probability is exact only for the Game ruleset/context that produced it.

The Game farm contract must bind loot semantics to applicable content/ruleset/profile identity and must state whether the probability is a base/static value or includes any active modifier class. Atlas must not silently present a base chance as a live/current chance when events, bonuses, boosted loot, difficulty profiles or other modifiers can change the roll.

Until a separate authoritative live modifier source exists, the UI should prefer wording such as `Base drop chance` / `Published drop model` when that is what the snapshot proves.

## 15. Placement weights/activation semantics gate static-clear yield

The current Game static-creature exporter can carry optional `weight` metadata on placement records. Therefore a placement record must not automatically be treated as one guaranteed simultaneous creature per clear/cycle.

`Highest expected items per static clear` is allowed only after the refreshed Game contract proves that the relevant placements are concurrently/independently active in the way assumed by the formula, including any `weight`, alternative-spawn or conditional activation semantics.

Without that proof, v1 ranking must fall back to semantics it actually owns, for example `Most verified placement records` or documented spatial spread. Placement density is a useful navigation metric, not a claim about guaranteed clear yield.

Likewise, Atlas must not deduplicate repeated `spawn_area` center/radius values into an authoritative spawn-group count. If group identity matters, Game must export a stable group identity or an equivalent exact semantic relation.

## 16. Exact PMF expected kills are a hitting-time problem

For an exact per-kill quantity PMF, `Expected kills to N` must not be approximated as `N / expected quantity per kill` when overshoot is possible.

Let `E(s)` be expected further kills required when `s > 0` items remain and let `p_y` be the probability of receiving quantity `y` in one kill. For a stationary exact PMF with `p_0 < 1`:

`E(0) = 0`

`E(s) = [1 + sum(y>0, p_y * E(max(0, s-y)))] / (1 - p_0)`

Use a bounded deterministic implementation. If `p_0 = 1` and the target is positive, the target is unreachable and the estimator must return an explicit unavailable/unreachable state rather than infinity formatted as a time.

The fixed-quantity Bernoulli case remains the simpler `ceil(N/q) / p` model. Calculations must also cover the exact edge cases `p=0` (unreachable) and `p=1` (deterministic).

## 17. Do not flatten multi-requirement or grouped tasks

The design's singular `required item` / `required creature` is a minimum v1 case, not permission to corrupt a richer authoritative task.

If an accepted upstream task publication proves multiple item requirements, eligible creatures, substitution rules, shared-credit rules or other progress semantics, Atlas must require that exact structure or classify that task form unsupported for v1. Atlas must not choose one member and present it as the whole task.

Weekly classification also does not prove reset schedule/time. Do not display a reset countdown unless Game publishes an explicit schedule contract.

## 18. Percentage formatting must not change the calculation

Game probability remains lossless rational authority. Atlas may render a human-friendly percentage, but rounding is presentation only and calculations must use the normalized underlying probability.

The inspector/provenance surface should retain enough exact information to explain the published model. Avoid decimal formatting that suggests more source precision than the contract proves.

## Review acceptance addendum

Also test:
- item KPH is scoped to qualifying source-creature loot opportunities, not all hunt kills;
- kill-task KPH is scoped to credited target progress when authoritative task-credit semantics exist;
- mixed-source item time is unavailable without an explicit source-mixture/KPH model;
- base/published drop chance cannot be labelled live/current without authoritative modifier context;
- weighted/conditional placements do not produce static-clear yield unless activation semantics are proven;
- spawn-area equality is not used as authoritative spawn-group identity;
- exact PMF expected-kill hitting time, including `p0=1`, `p=0` and `p=1` edge cases;
- richer task requirements are preserved or explicitly unsupported rather than flattened;
- percentage display rounding never changes estimator inputs.

## Final reviewed decision

Proceed with the native FullWorld Item & Spawn Farm Explorer architecture as an **Atlas-only execution**. The original design plus this complete review addendum and implementation plan form one contract; when they differ, the stricter reviewed/Atlas-only rule wins. Game #75 remains read-only upstream requirement/evidence.

## 19. Integrate the merged Hunt Intelligence contract (#119/#123)

Hunt Intelligence PR #119 established the shared measured-analytics contract and PR #123 hardened it on Atlas `main@42d268aa98a7d48e8a7a9ed2e95e4a9c14753909` to Atlas-only execution with strict #113/#114/#115 dependency gates, world/revision/modifier/privacy/completeness-aware analytics and no Game mutation.

Executors must read current `docs/agents/tasks/active/ATLAS-HUNT-INTELLIGENCE-PROJECT.md` and `docs/agents/prompts/ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION.md` from refreshed Atlas main before defining the measured-provider interface.

Farm Explorer future measured KPH must reuse that contract: relevant source/hunt scope, world/profile, content/ruleset/modifier revisions, party/cohort dimensions, time base, observation window, sample/quality/privacy state and `MEASURED` trust class. V1 manual KPH remains a user assumption; Atlas keeps `VERIFIED`, `MEASURED`, `ESTIMATE` and `UNAVAILABLE` distinct and never substitutes an incomparable cohort.

## 20. Atlas-only execution boundary
The implementation alias has no write authority in Game. Inspect Game main/contracts/publications read-only. Missing data is recorded only in Atlas as `UPSTREAM_REQUIREMENT` / `UPSTREAM_BLOCKED`; do not create/update/close Game issues, branches, files, commits, PRs, comments, reviews, contracts or workflows.

## 21. Placement origin/activation is first-class
Preserve static-creature origins such as `base-map`, `conditional-custom-map`, `runtime-world-change`, `annual-event-map`, `quest-map` and `UNKNOWN`. Default farm density/ranking does not treat conditional/event/quest/world-change/unknown placements as ordinary always-active supply.

## 22. Farm/spatial compatibility is atomic
Join farm facts to spatial facts only when world/profile, content/ruleset revision, modifier context, creature identity scheme/revision and source/publication digests are compatible. Migration-derived `monster-entity:*` identities are export-scheme identities unless Game guarantees cross-revision continuity. Publish one atomic content-addressed farm bundle manifest pinning compatible roots.

## 23. IID/stationarity and numeric envelope
Binomial/PMF thresholds require stationary IID per-qualifying-kill semantics or another exact supported process. Pity/stateful/first-kill/player-dependent/unknown dependence disables IID thresholds. Use numerically stable bounded methods verified against an independent high-precision oracle for extreme probabilities/targets.


## 24. Generated drops are not automatically personal loot
Static farm math estimates items generated by qualifying loot opportunities. `Time to personally acquire N` requires an explicit allocation model such as solo/all-loot-to-me. Party loot division is never assumed.

## 25. KPH needs progress scope and time base
Manual KPH stores what is counted and the time base. Item mode counts qualifying selected-source kills; task mode credited progress. Require `active_hunt`, `hunt_wall`, `trip_wall` or accepted equivalent. P50/P80/P95 time is conditional on that fixed KPH, not a variable-speed distribution.

## 26. Heatmap/floor semantics
Every heatmap/cluster exposes `metric_id`, unit and legend. Default is current-floor verified placement density. All-floor information is summary/list only. Yield/capacity remains unavailable if origin/weight/activation/group semantics are insufficient.

## 27. Acquisition-source completeness wording
If upstream covers monster loot only, call the list `Monster drop sources`. Do not imply NPC/quest/container/crafting/reward/other acquisition paths do not exist unless a complete acquisition graph proves that.

## 28. Hard dependency gate for #113/#115
If canonical creature interaction/hit-testing or presentation-bounds seams are not merged/stable, Farm Explorer must not duplicate them. Continue only disjoint compiler/index/math/state/failure work until owner seams exist.

## 29. Additional acceptance requirements
Test conditional-origin exclusion/activation, compatibility mismatch, export-scoped identity, atomic mixed-root rejection, floor isolation, explicit heatmap metric, IID refusal, extreme numeric cases against an independent oracle, generated-vs-personal scope, KPH time-base round-trip, acquisition-completeness copy and dependency-gate behavior.
