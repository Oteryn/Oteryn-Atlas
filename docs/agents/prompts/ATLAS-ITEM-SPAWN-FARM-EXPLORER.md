# Oteryn Atlas — Item & Spawn Farm Explorer

Alias: `ATLAS-ITEM-SPAWN-FARM-EXPLORER`

MODE: Autonomous cross-repository implementation + verification + integration + protected merge + merged-main live acceptance + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement the complete Item & Spawn Farm Explorer programme across Oteryn-Game and Oteryn-Atlas, following the reviewed design and executable plan.

## Mandatory source documents

Read these before changing any file:

1. `Oteryn/Oteryn-Atlas/docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-design.md`
2. `Oteryn/Oteryn-Atlas/docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-review.md`
3. `Oteryn/Oteryn-Atlas/docs/superpowers/plans/2026-08-24-atlas-item-spawn-farm-explorer.md`
4. `Oteryn/Oteryn-Atlas#114`
5. `Oteryn/Oteryn-Game#75`
6. related Atlas `#113`, `#115`, `#117`, `#85`, `#111`, `#11`
7. root and every applicable nearer `AGENTS.md` in both repositories.

The review addendum is normative wherever it tightens or clarifies the original design. The implementation plan is the task-by-task execution contract.

## Repositories

Canonical Game/World/Content authority:
`https://github.com/Oteryn/Oteryn-Game`

Atlas consumer/runtime:
`https://github.com/Oteryn/Oteryn-Atlas`

Design-time SHAs are historical evidence only. Refresh GitHub before every mutation phase. Do not blindly reuse recorded heads.

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
3. **Timer provenance.** Existing Game creature source may expose `spawn_time_seconds`; revalidate its semantics and, if used, keep it source-root bound in farm-spatial. Timer presence alone is not a complete live respawn model.
4. **Exact roll model required for exact probability math.** One-Bernoulli fixed quantity uses negative-binomial/binomial-tail math. Multiple exact rolls must normalize to an exact per-kill quantity PMF or equivalent exact contract. Unknown semantics disable exact completion probability.
5. **Use `Expected`, `P50`, `P80`, `P95`.** Do not invent `Fast/Typical/Conservative` bands.
6. **Task requirement is a fact.** Authoritative task quantity/kill count initializes estimator state but remains separately displayed even after user edits.
7. **Manual KPH in v1.** Future measured KPH belongs to Hunt Intelligence `#117`; do not build a duplicate analytics/profile system or fixed solo/party multiplier.
8. **Reuse creature interaction geometry.** If `#113/#115` have landed, consume their canonical presentation bounds/hit-testing/selection rather than creating another system.
9. **Name ranking metrics.** Before measured Hunt Intelligence exists, use labels such as `Most verified placements` or `Highest expected items per static clear`, not a generic unqualified `Best place to farm`.
10. **Mock-up is not data.** No number/place/drop/timer/task/time from generated concept art may become factual runtime or acceptance data.
11. **Partial support is valid.** Missing Game loot/task/weekly/quantity semantics must remain explicit `PARTIAL/UNSUPPORTED/UNKNOWN`, never fabricated.

## Execution order

Follow the implementation plan exactly unless refreshed repository state makes a step unsafe. If state changed, adapt minimally and document the verified reason.

### Phase A — Game producer (`Oteryn/Oteryn-Game#75`)

Implement and merge the Game-owned farm-intelligence export before Atlas claims real item/drop/task data.

Preferred boundary:
- `docs/contracts/OTERYN_GAME_ATLAS_FARM_INTELLIGENCE_V1.md`
- `tools/game-atlas-farm-intelligence/**`

Do not mutate active Wave-1 DOMAIN/CONTENT paths owned by PR #56/#58 unless their coordinator explicitly transfers ownership.

Required Game output:
- versioned contract;
- stable item/source/task identities;
- explicit capability states;
- rational probability representation;
- exact quantity/roll semantics where proven;
- unresolved/unsupported states where not proven;
- deterministic digest/provenance/bounds;
- exact stable creature identity suitable for joining existing creature placements.

Write RED tests first, then minimal implementation, then full current Game validation. Open/update one Game PR, review full diff, require current exact-head gates/review policy, squash-merge and record exact merge SHA + semantic digest.

### Phase B — Atlas publication

After Phase A merges, pin the exact accepted Game revision/digest.

Implement bounded derived products:
- `data/farm-intelligence/**` via `tools/build-farm-intelligence.py`;
- `data/farm-spatial/**` via `tools/build-farm-spatial-index.py`.

Farm-spatial must be keyed by stable creature entity identity and derived only from the accepted creature/spawn publication. Do not duplicate every placement once per item. No name fallback.

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

Do not claim completion until all relevant evidence exists.

1. Game producer is exact-head verified and squash-merged first.
2. Atlas pins exact merged Game SHA/digest.
3. Atlas deterministic and full exact-head Molehill browser verification passes.
4. Review the entire Atlas diff and all review threads.
5. Require exact-head `atlas-gate` and `provenance-gate` GREEN.
6. Squash-merge Atlas through protected lifecycle and delete completed branch where policy permits.
7. Deploy/accept only merged Atlas `main` through the trusted Synology merged-main workflow.
8. Record terminal Game/Atlas SHAs, farm and creature roots/digests, capability census, estimator models shipped and measured runtime evidence.
9. Close #114/#75 only when their actual Definitions of Done are satisfied. Do not prematurely close wider #11/#85/#111/#117.

## Final report

Return a compact evidence-backed closeout containing:
- Game PR + exact merge SHA + farm semantic digest;
- Atlas PR + exact merge SHA;
- exact files/modules delivered;
- supported/partial/unsupported farm capability census;
- exact estimator models supported;
- exact-head test/CI/Molehill evidence;
- merged-main live acceptance evidence;
- any remaining truthful limitations;
- branch cleanup state.

No invented success claims. If an external authority/capability remains unavailable, record the exact blocker and leave only that affected claim incomplete.
