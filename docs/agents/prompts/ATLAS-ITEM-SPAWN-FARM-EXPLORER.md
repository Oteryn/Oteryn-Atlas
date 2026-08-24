# Oteryn Atlas — Item & Spawn Farm Explorer

Alias: `ATLAS-ITEM-SPAWN-FARM-EXPLORER`

MODE: Autonomous **Atlas-only** implementation + verification + integration + protected merge + merged-main live acceptance + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement the complete Atlas side of the Item & Spawn Farm Explorer programme to the maximum truthful extent supported by already accepted upstream Game data. `Oteryn/Oteryn-Game` is read-only for this execution; missing upstream capability is `UPSTREAM_REQUIREMENT` / `UPSTREAM_BLOCKED`, never permission to mutate Game.

## Mandatory source documents

Read these before changing any file:

1. `Oteryn/Oteryn-Atlas/docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-design.md`
2. `Oteryn/Oteryn-Atlas/docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-review.md`
3. `Oteryn/Oteryn-Atlas/docs/superpowers/plans/2026-08-24-atlas-item-spawn-farm-explorer.md`
4. `Oteryn/Oteryn-Atlas#114`
5. `Oteryn/Oteryn-Game#75` â€” read-only upstream requirement; do not mutate it
6. related Atlas `#113`, `#115`, `#117`, `#85`, `#111`, `#11`
7. Atlas root and every applicable nearer `AGENTS.md`; Game instructions/contracts may be inspected read-only.

The review addendum is normative wherever it tightens or clarifies the original design. The implementation plan is the task-by-task execution contract.

## Repositories

### Writable repository
`https://github.com/Oteryn/Oteryn-Atlas`

### Read-only upstream authority
`https://github.com/Oteryn/Oteryn-Game`

Game remains canonical World/Content authority, but this alias has **NO WRITE AUTHORITY** in Game. Do not create/update/close Game issues, branches, files, commits, PRs, comments, reviews, contracts or workflows. Do not push local Game changes. `Oteryn/Oteryn-Game#75` is an upstream requirement reference only.

Design-time SHAs are historical evidence only. Refresh GitHub before every Atlas mutation phase and refresh Game read-only evidence before consuming any upstream publication.

## Product outcome

Deliver one native FullWorld Atlas capability that lets a user:

- search/select an item;
- see truthful Game-owned source creatures and exact published drop/quantity semantics;
- see all matching verified creature/spawn **placements** on the existing FullWorld map;
- use world-scale heatmap, medium clusters and near verified placement/creature detail instead of an unreadable wall of equal-size sprites;
- choose an item target such as 100 and see mathematically correct `Expected`, `P50`, `P80`, `P95` kill counts where exact roll semantics support them;
- convert those kill counts to time only from an explicit effective KPH source;
- select an authoritative delivery/kill/weekly task where Game publishes it, using its published requirement as the initial estimate target;
- use a clearly labelled custom kill target when authoritative task semantics are unavailable;
- always distinguish `VERIFIED FACTS` from `DERIVED/ESTIMATE` data.

## Hard authority boundary

`Oteryn-Game` owns facts. `Oteryn-Atlas` owns projections and estimates.

Game-owned facts include only accepted exported data such as:
- stable item identity/name;
- stable creature identity/name;
- creature -> item loot relation;
- exact probability/roll semantics;
- exact or bounded quantity semantics;
- task identity/type/required count;
- weekly classification;
- verified creature/spawn placement coordinates/floor/area;
- accepted respawn/timer semantics if explicitly proven.

Atlas may derive:
- reverse item -> source-creature indexes;
- creature-ID -> placement indexes;
- heatmap/cluster aggregates;
- static-clear expected yield;
- expected kills;
- P50/P80/P95 completion thresholds;
- time from explicit KPH;
- rankings by a clearly named static metric.

NEVER use as runtime authority:
- TibiaRoute;
- wiki/fansites;
- browser-side OTBM/Lua/XML parsing;
- image/sprite similarity;
- filenames;
- display-name-only entity joins;
- generated mock-up values;
- guessed region names;
- guessed DPS, respawn occupancy, player throughput or party multiplier.

Legacy/reference inputs may be interpreted only inside an already accepted Game migration/import boundary with explicit provenance.

## Mandatory corrections from design review

These are non-negotiable:

1. **No naive average drop chance.** Multiple source creatures keep separate exact drop models unless an explicit evidence-backed weighting model exists.
2. **Placement != live spawn.** Use `verified placements` / `spawn placements`; never imply live occupancy, simultaneous capacity or monsters available now.
3. **Activation/origin policy.** Ordinary default farm supply may include only placement origins whose activation semantics are proven for the selected context. Conditional/event/quest/world-change/unknown origins are not ranked as normal always-active supply.
4. **Timer provenance.** `spawn_time_seconds`, if consumed, stays bound to the exact accepted creature publication and does not by itself prove the complete live respawn algorithm.
5. **Compatibility tuple before joins.** Loot/task and spatial facts join only when world/profile, content/ruleset revision, creature identity scheme, modifier context and source/publication digests are compatible. Mismatch -> `INCOMPATIBLE`, never a name repair.
6. **Export-scoped identity truthfulness.** Current migration-derived `monster-entity:*` identity is export-scheme identity unless Game explicitly guarantees canonical continuity across revisions.
7. **Atomic farm bundle.** Browser publication consumes one content-addressed manifest pinning compatible farm-intelligence + farm-spatial roots and their upstream identities. Mixed-generation roots fail closed.
8. **Exact stochastic process required.** Probability-aware target math requires a stationary IID per-qualifying-kill model or another exact published process. Pity/stateful/first-kill/player-dependent/unknown dependence disables IID thresholds.
9. **Numerically stable math.** Extreme probabilities/targets use a bounded stable algorithm verified against an independent high-precision oracle. No naive factorials or silent underflow/overflow.
10. **Use `Expected`, `P50`, `P80`, `P95`.** P50/P80/P95 times are conditional on the displayed fixed KPH assumption.
11. **Generated vs personally acquired loot.** Static loot math estimates drops generated by qualifying kills. Personal acquisition requires solo/all-loot-to-me or an explicit allocation model; party ownership is never assumed.
12. **Task requirement is a fact.** Authoritative task structure initializes estimator state but remains separately displayed; richer grouped/substitution/credit semantics are preserved or unsupported.
13. **KPH scope + time base.** Item KPH = qualifying selected-source kills/hour; task KPH = credited target progress/hour. The assumption also names its time base (`active_hunt`, `hunt_wall`, `trip_wall` or accepted equivalent). Mixed-source time needs an explicit per-source model.
14. **Published/base chance != live chance.** Drop probability is revision/profile/modifier-context bound; do not call it current/live without authoritative live modifier data.
15. **Weighted/conditional placements gate yield.** Weight/alternatives/conditional activation/unknown origin disable static-clear yield/capacity unless proven. Equal `spawn_area` geometry is not group identity.
16. **Metric-aware heatmap.** Every heatmap/cluster has an explicit `metric_id`, unit and legend. Default is current-floor verified placement density; all-floor summary is separate.
17. **Acquisition-source completeness.** Until a complete acquisition graph exists, label the surface `Monster drop sources` rather than implying every acquisition route is known.
18. **Manual KPH in v1.** Future measured KPH reuses merged Hunt Intelligence/Game Intelligence trust/cohort/revision/time-base/quality/privacy semantics; no duplicate analytics or fixed party multiplier.
19. **Hard dependency gate for #113/#115.** If canonical interaction/presentation seams are not merged/stable, continue only disjoint data/math/index work; do not create competing selection, hit testing, bounds or labels.
20. **Mock-up is not data.** Concept-art values never become runtime facts. Partial support remains explicit `AVAILABLE|UPSTREAM_BLOCKED|MALFORMED|STALE|INCOMPATIBLE|UNAVAILABLE`.

## Execution order

Follow the implementation plan exactly unless refreshed repository state makes a step unsafe. If state changed, adapt minimally and document the verified reason.

### Phase A — Read-only upstream capability preflight

Inspect `Oteryn/Oteryn-Game` **read-only**. Do not execute Game #75 and do not mutate Game.

Resolve current Game `main`, accepted Game -> Atlas publications and exact static-creature publication. Classify item catalogue, monster-drop relations, probability/process semantics, quantity model, task/weekly/credit semantics, creature identity, placement origin/activation and timer semantics as `AVAILABLE`, `UPSTREAM_BLOCKED`, `MALFORMED`, `STALE` or `INCOMPATIBLE`.

Record a compatibility tuple covering world/profile, content revision, ruleset revision, modifier context, creature identity scheme/revision and semantic/publication digests. If no accepted farm-intelligence publication exists, continue only with Atlas code that can be truthfully implemented using synthetic **test-only schema fixtures** and fail-closed production states. Never scrape or repair missing Game facts.

### Phase B — Atlas publication

If Phase A classifies an already accepted upstream farm product `AVAILABLE`, pin its exact Game revision/digest and compatibility tuple. Otherwise keep real farm facts disabled and expose the exact upstream blocker.

Implement bounded derived products:
- `data/farm-intelligence/**` via `tools/build-farm-intelligence.py`;
- `data/farm-spatial/**` via `tools/build-farm-spatial-index.py`.

Farm-spatial must be keyed by the accepted creature export identity and derived only from the accepted creature/spawn publication. Preserve origin/activation classification. Do not duplicate every placement once per item and never use a name fallback. Publish one atomic farm bundle manifest pinning farm-intelligence, farm-spatial and creature roots plus the compatibility tuple; reject mixed generations.

Preserve factual placement counts distinctly from any area/timer data. Any aggregate cell/cluster is presentation-only derived data with no identity authority.

### Phase C — Pure Atlas logic

Implement and TDD:
- `src/browser/farm-intelligence.mjs`;
- `src/browser/farm-state.mjs`;
- `src/browser/farm-lod.mjs`.

Required estimator behavior:

For one Bernoulli drop opportunity with exact probability `p`, fixed successful quantity `q`, target `N`:

```text
r = ceil(N / q)
Expected kills = r / p
P(completed by k) = P(Binomial(k,p) >= r)
```

P50/P80/P95 are the smallest `k` satisfying the requested completion probability.

For an exact finite per-kill quantity PMF, use bounded deterministic DP/convolution. Unknown/bounded-only distribution disables exact target probability math.

Time:

```text
time_hours = kills / effective_kills_per_hour
```

Kill target:

```text
time_hours = target_kills / effective_kills_per_hour
```

Reject zero/negative/non-finite/over-limit inputs. No default KPH that pretends to describe a player.

### Phase D — FullWorld runtime/UX

Implement inside current `web/fullworld.html`. Do not create a second Atlas map application.

Preferred controller:
`web/fullworld-farm-explorer.mjs`

Add one farm analysis overlay for heatmap/cluster/highlight primitives synchronized to the exact current FullWorld transform.

Required UX:
- Item & Task Explorer in existing controls/mobile system;
- source-creature list with per-source chance/quantity facts;
- factual verified placement counts/floors;
- target quantity/kill target inputs;
- explicit KPH input/source;
- `AUTO|HEATMAP|CLUSTERS|SPAWNS` presentation;
- separate `VERIFIED FACTS` and `ESTIMATE` inspector sections;
- global item/task search integration without fake coordinates;
- URL/history/reload/deep-link persistence;
- desktop and mobile support.

LOD:
- far/world scale -> heatmap/aggregate cells;
- medium -> deterministic clusters/count badges/source composition;
- near -> verified individual placement/creature presentation using existing creature/animation runtime.

Do not silently mutate the normal Monster/Spawn or Animation layer semantics.

### Phase E — Verification

Follow Atlas `AGENTS.md`, #85 and #111.

Required deterministic tests include:
- Game contract/digest/capability validation;
- exact identity joins and no name fallback;
- placement/live-state distinction;
- timer provenance if exposed;
- fixed-drop expected/P50/P80/P95 oracle cases;
- exact PMF bounded calculations;
- unsupported roll model disables exact math;
- no unweighted average drop chance;
- task requirement initialization/separation;
- manual KPH vs future measured provider distinction;
- URL round trips and malformed/contradictory input;
- LOD monotonicity and deterministic cluster order;
- #113/#115 geometry reuse when available;
- no mock-up example values as real data.

Required real Chromium acceptance includes:
- item search/source selection;
- far/medium/near LOD;
- floor/pan/zoom/resize synchronization;
- target/KPH estimator editing;
- authoritative task or truthful unsupported state + custom kill fallback;
- reload/back/forward/deep link;
- malformed/missing farm data fail-closed behavior;
- desktop/mobile readability/accessibility;
- dense and sparse performance evidence;
- real visual artifact review;
- zero retries.

Heavy exact-head Docker Playwright belongs on Molehill-PC. Synology is merged-main live acceptance only.

## Integration and closeout

Do not claim completion until all relevant Atlas evidence exists.

1. Reconfirm read-only upstream capability/compatibility and exact Game evidence SHA/publication roots; do not mutate or close Game #75.
2. Atlas pins only accepted compatible upstream identities, or truthfully ships the affected capability as `UPSTREAM_BLOCKED`/`UNAVAILABLE`.
3. Atlas deterministic and full exact-head Molehill browser verification passes.
4. Review the entire Atlas diff and all review threads.
5. Require exact-head `atlas-gate` and `provenance-gate` GREEN.
6. Squash-merge Atlas through protected lifecycle and delete the completed branch where policy permits.
7. Deploy/accept only merged Atlas `main` through the trusted Synology merged-main workflow.
8. Record Atlas squash SHA, read-only Game evidence SHA, compatibility tuple, creature/farm roots, capability census, estimator/process models and measured runtime evidence.
9. Close #114 only when its Definition of Done is satisfied. Do not mutate/close Game #75 from this alias and do not prematurely close wider #11/#85/#111/#117.

## Final report

Return a compact evidence-backed closeout containing read-only Game evidence/publication identity or exact upstream blockers; Atlas PR + merge SHA; delivered files/modules; capability census; estimator/process models; exact-head test/CI/Molehill evidence; merged-main live acceptance; remaining limitations; and branch cleanup state.

No invented success claims. Unsupported upstream facts stay unavailable; Atlas-side completion does not imply Game #75 completion.

## Final semantic review additions

The normative review file contains these additional hard requirements and they must be implemented even if an earlier section is less specific:

- item KPH means qualifying loot-opportunity kills/hour for the selected source model; do not use total hunt kills/hour;
- authoritative kill-task KPH means credited target progress/hour under published task-credit semantics;
- one scalar KPH cannot combine multiple source creatures with different drop models unless an explicit source-mixture/KPH model is supplied;
- exact loot chance is revision/context bound; call it base/published chance unless an authoritative live modifier source proves current modifiers;
- placement `weight`/conditional activation prevents static-clear yield/capacity claims until those semantics are proven;
- equal spawn-area geometry is not authoritative spawn-group identity;
- for exact per-kill PMFs, expected kills is an absorbing hitting-time calculation, not target divided by mean quantity; handle unreachable `p0=1` and fixed `p=0|1` explicitly;
- preserve richer task requirement/credit structures or mark them unsupported; never flatten them to one item/creature;
- percentage rounding is display-only and must never alter estimator inputs.

Re-read the complete review addendum immediately before the read-only upstream preflight and again before final diff review.

## Merged Hunt Intelligence coordination

Hunt Intelligence was hardened by merged PR #123; this prompt refresh is based on Atlas `main@42d268aa98a7d48e8a7a9ed2e95e4a9c14753909`. Refresh `main` again at execution time. Before defining the future measured-KPH/provider interface, additionally read:
- `docs/agents/tasks/active/ATLAS-HUNT-INTELLIGENCE-PROJECT.md`;
- `docs/agents/prompts/ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION.md`.

That merged contract makes Oteryn Game Intelligence authoritative for privacy-safe measured gameplay aggregates and defines `VERIFIED`, `MEASURED`, `ESTIMATE`, `UNAVAILABLE` trust classes plus revision/cohort/time-base/sample/quality/privacy semantics.

Farm Explorer must expose a compatible seam and must not create a duplicate measured analytics schema. Manual KPH remains explicit user assumption until a comparable accepted measured cohort is available; never silently substitute an incompatible cohort.


## Final architecture hardening — mandatory

- Atlas-only ownership: Game/#75 is read-only and missing capability is `UPSTREAM_BLOCKED`.
- Preserve origin/activation; event/quest/world-change/conditional/unknown placements are not default farm supply until authoritative activation semantics prove eligibility.
- Require a compatible world/profile, content/ruleset revision, modifier context, creature identity scheme, coordinate profile and exact source roots before farm/spatial joins.
- Browser consumes one atomic farm bundle manifest pinning farm-intelligence + farm-spatial + creature roots; mixed generations fail closed while the base map stays usable.
- P50/P80/P95 requires stationary IID per qualifying kill or an exact richer published process; pity/stateful/sequence-dependent loot is not approximated.
- Probability math has a documented verified numeric domain/error bound with independent extreme-value oracle tests.
- Default item estimator reports generated drops; personal acquisition requires an explicit allocation model.
- KPH always declares progress scope and time base; incompatible time bases are not silently compared.
- Every heatmap/cluster has `metric_id`, unit, legend and current-floor scope; all-floor summaries are separate metadata.
- UI says `Monster drop sources` until a complete acquisition graph exists.
- #113/#115 are hard dependency gates for their owned FullWorld interaction/presentation seams; never create fallback competing geometry.
