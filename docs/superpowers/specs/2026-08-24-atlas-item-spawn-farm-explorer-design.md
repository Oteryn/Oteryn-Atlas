# Atlas Item & Spawn Farm Explorer design

Alias: `ATLAS-ITEM-SPAWN-FARM-EXPLORER`

Lifecycle authorities:
- Atlas delivery: `Oteryn/Oteryn-Atlas#114`.
- Game producer dependency: `Oteryn/Oteryn-Game#75`.
- Full-world programme: `Oteryn/Oteryn-Atlas#11`.
- Verification policy: `Oteryn/Oteryn-Atlas#85`.

Design starting points observed on 2026-08-24:
- Atlas `main`: `db5de3938ef815fb467dd2ad911a1ed92b13dccf`.
- Game `main`: `a70318484b1ffdd328b53cdc70a4386a516d0109`.

These SHAs are evidence for this design only. Any implementation agent must refresh both repositories and re-resolve active work before mutation.

## 1. Product goal

Add a native FullWorld Atlas explorer that answers two user questions without copying TibiaRoute's UI or authority model:

1. **Item farming:** "I need N copies of this item. Which creatures drop it, where are their verified spawns, what is the exact published drop model, how many kills should I expect, and how long could it take under an explicit kills/hour assumption?"
2. **Kill task / weekly task:** "I need to kill N copies of this creature. Where are its verified spawns and how long could the target take under an explicit effective kills/hour assumption?"

The feature must combine authoritative Game facts with clearly labelled Atlas derivations. It must never present a derived estimate as a Game fact.

The first release is an **exploration and estimation system**, not a live bot, live-spawn tracker, combat simulator, route optimiser or character-performance oracle.

## 2. User-approved scope

### Item mode

For a selected item, Atlas should show where authoritative data exists:
- item display name and stable public identity;
- source creatures;
- exact drop probability/chance semantics;
- exact or bounded quantity semantics;
- relevant verified spawn placements and floors;
- source creature count and spawn count;
- expected kills for a target quantity;
- probability-aware kill thresholds for useful confidence levels when mathematically supported;
- estimated time after the user provides an effective kills/hour assumption;
- deterministic spawn-cluster ranking with an explicit metric.

The default target quantity may be `100`, but the value must remain editable and persisted in URL state.

### Kill / weekly-task mode

For a selected authoritative kill task, or a custom creature kill target:
- target creature;
- required kill count when the Game task contract publishes it;
- verified spawn placements and floors;
- estimated completion time from explicit effective kills/hour;
- cluster ranking by matching spawn count / static-clear capacity.

The default custom kill target may be `100`.

The UI may call a task "Weekly" only when the Game export explicitly proves weekly-task semantics. Otherwise it must say `Kill target` or `Custom kill target`.

## 3. Approaches considered

### A. Native explorer inside the existing FullWorld shell — **recommended**

Extend the current `web/fullworld.html` application with a new explorer section/controller and a dedicated analysis overlay while reusing the existing map, floor, viewport, creature, animation, inspector, mobile and deep-link infrastructure.

Advantages:
- one camera/floor/runtime authority;
- no duplicated FullWorld loader or map shell;
- existing creature rendering and animation can be reused;
- lowest risk of map/overlay drift;
- one URL/state model and one verification harness.

Trade-off: it requires a clean new module boundary so `fullworld-app.mjs` and `fullworld-creatures.mjs` do not become monoliths.

### B. Separate `/item-explorer.html` map application

Build a second page with the same publication and map data.

Advantages: quick isolation of UI work.

Rejected because it would duplicate map boot/state/geometry/mobile behavior and create long-term divergence.

### C. Whole Atlas navigation/UI rewrite around Explorer / Creatures / NPCs / Quests

This resembles the visual mock-up most closely.

Rejected for this task because it couples the requested farm intelligence capability to an unrelated application-shell redesign. The current feature should establish reusable data/runtime boundaries first. A future shell redesign can consume them.

## 4. Authority boundary

### FACT — Game owned

Only accepted Game exports may establish:
- item identity/name;
- creature identity/name;
- creature -> item loot relation;
- probability/chance semantics;
- quantity distribution/bounds;
- task identity/type/required count;
- weekly-task classification;
- respawn cadence if ever published;
- creature placement identity and coordinates through the existing accepted creature/spawn projection.

`Oteryn/Oteryn-Game` remains canonical World/Content authority.

### DERIVED / ESTIMATE — Atlas owned

Atlas may deterministically derive:
- item -> source-creature reverse index;
- joins from source creature entity IDs to verified spawn placements;
- spatial clusters/heatmap cells;
- static-clear expected yield;
- expected kill counts;
- completion probability thresholds;
- time estimates from explicit kills/hour;
- ranking by a named, reproducible derived metric.

These values must be labelled `ESTIMATE`, `DERIVED`, or an equivalent unambiguous UI marker.

### Forbidden authority shortcuts

Do not use TibiaRoute, wiki pages, fansites, browser-side legacy parsing, OTBM, Lua/XML, sprite similarity, filenames or names-only joins as runtime authority.

Legacy/reference content may be processed only inside an already accepted Game migration/import boundary and must retain explicit provenance.

## 5. Game -> Atlas farm intelligence contract

Game Issue #75 owns a new versioned public-safe producer contract. Recommended contract identity:

`oteryn-game-atlas-farm-intelligence-v1`

The exact name may change only if the implementation documents the replacement consistently in Game and Atlas.

### 5.1 Snapshot metadata

The Game snapshot must include at minimum:
- `contract_id`;
- `schema_version`;
- exact Game revision;
- source/profile identifiers and pinned digests where migration evidence is used;
- canonical semantic digest;
- capability/completeness states;
- hard record/byte bounds;
- record counts.

Capabilities must be explicit rather than inferred from empty arrays. Example capability families:
- `items`;
- `loot_relations`;
- `loot_probability`;
- `loot_quantity_model`;
- `item_delivery_tasks`;
- `kill_tasks`;
- `weekly_task_semantics`;
- `respawn_cadence`.

Each family must be truthfully `SUPPORTED`, `PARTIAL`, `UNSUPPORTED` or equivalent closed vocabulary.

### 5.2 Item records

Each item exposed to Atlas should have:
- stable producer-owned public item ID;
- display name;
- optional separately-authorized presentation reference;
- provenance/capability metadata where needed.

Atlas must never manufacture a stable item ID from display text.

### 5.3 Creature records and joins

Loot relations must refer to a stable creature entity identity that can be joined to the existing Game-owned static-creature/spawn export.

If the Game producer cannot prove the identity join for a creature, Atlas may show the loot relation as unresolved but must not join spawns by case-insensitive name or visual similarity.

### 5.4 Probability representation

Probability must be exported losslessly, preferably as an integer rational:

```json
{"numerator":14640,"denominator":100000}
```

The producer must prove the denominator and roll semantics from the accepted source/runtime contract before publishing exact probability. A legacy numeric `chance` field is not permission for Atlas to assume a denominator.

### 5.5 Quantity model

The contract must distinguish these cases instead of reducing all loot to `maxCount`:
- exact fixed quantity on successful roll;
- exact finite discrete quantity distribution;
- bounded quantity with unknown/unproven internal distribution;
- unsupported quantity semantics.

Atlas may calculate exact target-quantity probabilities only for proven exact models. For bounded/unsupported models it must show the factual chance/bounds while marking exact farm-time mathematics unavailable.

### 5.6 Task records

Where authoritative data exists, export:
- stable task ID;
- display label;
- task type;
- required item and quantity for delivery tasks;
- required creature and kill count for kill tasks;
- explicit weekly classification only if proven.

Missing task catalogues are a capability limitation, not permission to encode guessed tasks.

## 6. Atlas publication architecture

Do not make the browser scan every world creature placement to answer an item query.

Atlas should compile two derived, bounded products from accepted Game exports.

### 6.1 Farm intelligence product

Recommended root: `data/farm-intelligence/`.

It contains:
- a small manifest/trust record;
- item search records;
- item -> loot-source relations;
- task records;
- per-item detail shards if needed for bounded loading;
- exact source Game farm-intelligence semantic digest.

### 6.2 Creature spatial secondary index

Recommended root: `data/farm-spatial/`.

This is derived from the already accepted creature/spawn publication and keyed by stable creature entity ID. It contains only the information required to efficiently locate matching placements:
- entity ID;
- floor;
- bounded placement shard descriptors;
- optional deterministic multi-resolution aggregate cells;
- counts and roots/digests linking back to the source creature publication.

Aggregate cluster/cell records are non-authoritative presentation indexes and must declare or imply `identityAuthority=false`.

This creature-keyed structure is preferred over duplicating every spawn position once for every item that a monster can drop.

## 7. Browser module boundaries

Keep pure logic separate from DOM/rendering.

Recommended modules:

### `src/browser/farm-intelligence.mjs`
Owns:
- contract validation;
- item/source/task query functions;
- probability/quantity normalization;
- exact estimator math;
- input validation;
- no DOM.

### `src/browser/farm-state.mjs`
Owns:
- URL parsing/serialization;
- target quantity/kill count;
- selected item/task/creature;
- user-entered kills/hour;
- overlay mode;
- round-trip invariants.

### `src/browser/farm-lod.mjs`
Owns:
- deterministic LOD decision;
- aggregate cell selection;
- stable cluster merging/order;
- bounded visible-result rules;
- no DOM.

### `web/fullworld-farm-explorer.mjs`
Owns:
- loading the accepted Atlas farm products;
- search/result interaction;
- item/task panels;
- FACT vs ESTIMATE inspector presentation;
- dispatching/render refresh from current FullWorld view;
- desktop/mobile integration.

### Farm analysis overlay

Use a dedicated canvas for heatmap/cluster/highlight primitives, synchronized to the same current FullWorld view snapshot/transform.

For individual near-zoom creature pixels, reuse/refactor the existing verified creature presentation/animation path rather than duplicating sprite-decoding and animation rules. The Explorer overlay is its own user-visible layer and must not silently mutate the normal Monster/Spawn toggle.

If a small reusable creature-presentation helper must be extracted from `web/fullworld-creatures.mjs`, keep that refactor bounded to shared rendering concerns and cover it with existing creature/animation regressions.

## 8. Map LOD and clutter policy

The principal improvement over the reference product is readable scale-dependent presentation.

### Far/world scale

Show deterministic heatmap or aggregate cells. Do not draw hundreds of equal-size creature sprites.

Each aggregate cell should expose at least:
- matching spawn count;
- contributing source-creature count;
- floor scope;
- optional exact static-clear expected item yield when all required quantity models are exact.

### Medium scale

Show clusters with count badges and source-creature composition. Cluster ordering and membership must be deterministic.

### Near/detail scale

Show individual verified spawn/creature presentations and selection highlights. Existing animation behavior remains controlled by the separate verified animation contract.

### LOD selection

Use a pure, testable rule based on current FullWorld zoom/projected density and result count. Exact thresholds must be chosen from browser/visual qualification rather than invented in this design. The rule must be monotonic, bounded and persisted only if the user explicitly chooses a manual view override.

Manual view choices:
- `AUTO`;
- `HEATMAP`;
- `CLUSTERS`;
- `SPAWNS`.

`CREATURES` may be an alias/presentation option at near scale if it reuses the existing verified creature pixels cleanly.

## 9. Farm estimator mathematics

### 9.1 Simple Bernoulli / fixed-quantity drop

For a loot event with exact probability `p` and fixed quantity `q` per successful roll, the number of successful rolls required for target quantity `N` is:

`r = ceil(N / q)`

The mean kill count is:

`E[K] = r / p`

For `q=1`, this reduces to `N / p`.

The probability that the target has been reached after `k` kills is:

`P(target reached by k) = P(Binomial(k,p) >= r)`

Atlas should expose at least:
- expected kills;
- median or another clearly named central probability threshold;
- `80%` completion threshold;
- `95%` completion threshold.

Do not label probability thresholds as guaranteed completion.

### 9.2 Exact discrete quantity distribution

If Game publishes an exact finite quantity distribution, Atlas may use a bounded deterministic dynamic-programming/convolution method to calculate target completion probabilities. Hard caps are required for target quantity, state size and iteration count.

### 9.3 Bounded or unknown quantity distribution

If the Game contract only proves quantity bounds, Atlas must not fabricate an expected quantity distribution. Show the factual bounds and disable exact target-quantity probability estimates for that relation.

### 9.4 Time conversion

Time is derived only after an effective kills/hour value is available:

`time_hours = kills / effective_kills_per_hour`

The input source must be visible:
- `Manual assumption` in v1;
- later, a separately-authorized analytics source may provide an observed estimate with confidence/sample metadata.

Do not hard-code a universal kills/hour default that pretends to describe player performance.

### 9.5 Multiple source creatures

Do not combine unrelated drop probabilities into one global `average drop chance` unless a weighting model is explicit.

When the user selects one source creature, use that creature's exact model.

For a spatial cluster containing multiple source creatures, Atlas may calculate **expected item yield per static clear** as the sum of each matching placement's proven expected quantity per kill. This is a derived clear-yield metric, not items/hour and not a live respawn prediction.

## 10. Kill-task estimator mathematics

For target `N` kills and explicit effective kills/hour `kph`:

`time_hours = N / kph`

If Game later publishes authoritative respawn cadence, Atlas may additionally show a separately labelled theoretical spawn-supply ceiling. It still must not infer player DPS, travel efficiency or live occupancy from respawn alone.

No fixed solo/party multiplier belongs in this feature. Future analytics may provide empirically observed solo/party KPH distributions as a separate source.

## 11. Ranking semantics

V1 rankings must state their metric.

Allowed truthful examples:
- `Most matching spawns`;
- `Highest static-clear expected item yield`;
- `Most target kills per static clear`;
- `Shortest spatial spread` if calculated from positions using a documented metric.

Do not display an unlabeled generic `Best place` ranking as though it measures real farm speed.

When authenticated Area/Subarea records become available, cluster cards may use those names. Until then, identify clusters by floor and coordinate/bounds, not guessed region names.

A future analytics-backed phase may add `Best observed farm rate` using sampled player/session data with explicit cohort/profile/confidence metadata.

## 12. UX design inside current FullWorld shell

### Left rail

Add an `Item & Task Explorer` section that contains:
- item/creature/task search;
- selected target card;
- source-creature list;
- drop chance and quantity facts;
- spawn counts;
- target quantity or kill-count input;
- map-view mode control.

The existing global semantic search may also supplement results with `Item` and `Task` entries. Selecting one opens/focuses the Explorer state instead of pretending that an item has a world coordinate.

### Right inspector

Show two visually separate blocks:

**Verified facts**
- source Game contract/revision/digest;
- drop probability;
- quantity semantics;
- task requirement;
- source creatures;
- relevant spawn counts/floors.

**Estimate**
- target quantity / kill count;
- expected kills;
- completion probability thresholds;
- effective kills/hour assumption and source;
- estimated time;
- ranking metric.

### Mobile

Reuse the existing mobile controls/inspector drawer model. The Explorer must not introduce a second incompatible mobile navigation system.

## 13. URL/deep-link contract

Recommended public state parameters:
- `item=<stable-item-id>`;
- `farmQty=<positive-int>`;
- `farmKph=<positive-number>` only when user supplied;
- `farmTask=<stable-task-id>`;
- `farmCreature=<stable-creature-id>` for a custom kill target;
- `farmKills=<positive-int>`;
- `farmView=auto|heatmap|clusters|spawns`.

Normal FullWorld `floor`, camera, zoom, animation and creature-layer state remains owned by the existing view contracts.

Parsing must reject malformed, non-finite, negative, over-limit and contradictory combinations rather than silently coercing them into misleading estimates.

## 14. Failure / partial-data behavior

The feature must fail closed by capability.

Examples:
- item known but loot probability unsupported -> show source relation if factual, `Drop probability unavailable`, no probability estimate;
- loot relation known but creature identity cannot join to spawn export -> show `Map locations unresolved`, no name-based join;
- item and exact chance known but quantity model unknown -> show factual chance/bounds, disable exact target-quantity completion maths;
- task catalog unsupported -> generic custom kill target remains available but is not labelled weekly/authoritative;
- farm product digest/root mismatch -> disable Explorer data, preserve the base Atlas and unrelated layers;
- one optional item shard fails -> fail the affected item selection, not the full map, while exposing an explicit error.

No fallback to external/public web sources.

## 15. Performance and boundedness

The feature must remain usable for dense sources and whole-world views.

Required design properties:
- item selection loads only the selected item/task relations plus the necessary creature spatial shards;
- viewport work is bounded;
- far-scale work uses aggregate cells rather than one DOM/canvas object per spawn;
- cache sizes have explicit limits and eviction behavior;
- no per-spawn timers;
- no duplicate creature animation runtime;
- clusters/heatmap use canvas/WebGL-compatible batched drawing, not thousands of DOM markers;
- all expensive pure calculations have hard input/state limits.

Performance budgets must be evidence-backed during implementation, not invented here.

## 16. Future Oteryn analytics integration

V1 uses manual `effective kills/hour` because current Atlas must not pretend to know a player's combat/travel throughput.

The estimator boundary should accept a future optional profile source with fields such as:
- observed effective KPH;
- cohort/profile dimensions such as level/vocation/party size when lawful and non-sensitive;
- sample count;
- observation window;
- percentile/confidence information;
- source revision/model identity.

When such a source exists, Atlas can prefill or compare manual estimates against observed rates. It must never silently replace an explicit user assumption.

This future seam is also how solo versus party performance should be handled. Do not encode a fixed party multiplier in the static Atlas model.

## 17. Delivery DAG

### Phase A — Game farm-intelligence export
Owner: `Oteryn/Oteryn-Game#75`.

Deliver:
- contract;
- deterministic producer/validator;
- truthful capability census;
- exact probability/quantity/task semantics only where proven;
- tests and exact-head Game gates;
- squash merge.

Atlas may prepare pure estimator/URL/LOD modules against synthetic **schema fixtures** while Phase A is in progress, but it may not claim real item/drop/task facts before Phase A is accepted and pinned.

### Phase B — Atlas compiler/publication
Owner: `Oteryn/Oteryn-Atlas#114`.

Deliver:
- Game contract consumer;
- farm intelligence product;
- creature spatial secondary index;
- roots/digests/bounds/provenance;
- deterministic compiler tests.

### Phase C — Atlas runtime and UX
Deliver:
- Explorer UI;
- global-search supplement;
- heatmap/clusters/spawns LOD;
- near-zoom creature presentation reuse;
- estimator UI;
- FACT vs ESTIMATE inspector;
- mobile/deep-link behavior.

### Phase D — verification and closeout
Deliver all applicable exact-head verification under #85/#111 policy, then protected PR merge and merged-main live acceptance under the existing deployment authority.

## 18. Parallelisation

After Game contract shape is frozen, work may be split into three mostly independent Atlas lanes:

1. **Math/state lane** — estimator, URL state, validation/property tests.
2. **Publication/index lane** — Game consumer, farm product, creature spatial secondary index.
3. **Runtime/UX lane** — Explorer shell and overlay scaffolding using schema fixtures only until the real publication handoff is available.

A final integration owner must reconcile all three on one exact head and run the complete browser/geometry/visual/performance qualification.

Do not allow multiple agents to mutate the same shared FullWorld HTML/CSS/runtime files concurrently without isolated branches/worktrees and an explicit integration owner.

## 19. Verification contract

### Game producer

Test at minimum:
- deterministic canonical output/digest;
- exact probability rational validation;
- invalid denominator/numerator;
- quantity-model variants;
- duplicate/dangling item/creature/task references;
- unsupported/partial capabilities;
- provenance and hard byte/record bounds;
- source change invalidates digest;
- no legacy source path leakage in public output where prohibited.

### Atlas pure logic

Test at minimum:
- expected-kill formula independent oracle cases;
- completion probability thresholds against known small distributions;
- fixed quantity `q>1`;
- exact discrete quantity model where implemented;
- disabled exact maths for bounded-unknown distributions;
- kill-task time conversion;
- invalid/zero/non-finite KPH;
- URL round trips and contradictory state;
- deterministic cluster membership/order;
- LOD monotonicity/bounds.

### Browser / E2E

Real Playwright Chromium desktop/mobile must cover:
- item search -> selection -> source list -> map results;
- source creature selection;
- far heatmap, medium clusters, near spawn/creature detail;
- floor filtering and floor changes;
- pan/zoom/resize synchronization with the base world;
- target quantity edit;
- KPH edit and estimator update;
- kill-task/custom-kill flow;
- reload/back/forward/deep-link restoration;
- malformed/missing farm product fail-closed behavior;
- no console/page/network policy violations;
- accessible controls and mobile drawers;
- representative user-facing visual evidence.

Geometry tests must prove the farm overlay world anchors move exactly with the base map under pan/zoom/resize/floor transitions within the repository's justified tolerance.

### Performance

Qualify at least one sparse and one dense item/source case. Record bounded:
- visible aggregate/cluster/spawn counts;
- draw/update duration;
- cache/shard counts;
- request counts/bytes where measurable;
- frame/render evidence under pan/zoom.

No performance threshold may be invented merely to make the test green.

## 20. Non-goals for v1

Do not include in this task:
- live player tracking;
- live spawn occupancy;
- combat/DPS simulation;
- automated pathing or botting;
- a new Oteryn account/profile system;
- market pricing;
- full Atlas navigation redesign;
- guessed region names;
- generic "best place" claims without a named metric;
- fixed solo/party multipliers;
- external website scraping as authority.

Route optimisation and analytics-backed true farm-rate ranking are valid future consumers of this foundation.

## 21. Definition of done

The programme is complete only when all of the following are true:

- Game publishes one accepted, pinned, public-safe farm-intelligence contract with truthful capability states;
- Atlas can search an item and show factual source creatures plus verified relevant spawn locations without names-only guessing;
- exact drop probability and quantity facts are shown only when proven;
- target-quantity estimator returns mathematically correct expected/probability kill counts for supported models;
- time estimates require and visibly expose an effective KPH source;
- kill-task/custom kill target estimator works for a target such as 100 kills;
- far/medium/near map LOD prevents world-scale sprite clutter;
- derived cluster/ranking metrics are explicitly named;
- URL/deep links, history, desktop and mobile work;
- malformed/missing/unsupported data fails closed by capability;
- full applicable deterministic, geometry, renderer, visual, performance and real-browser tests pass on the exact final head with retries=0;
- Atlas `atlas-gate` and `provenance-gate` are green;
- Game required exact-head gates are green for its producer delivery;
- both cross-repository delivery branches are squash-merged and cleaned;
- live deployment/acceptance occurs only from merged Atlas `main` under existing policy.
