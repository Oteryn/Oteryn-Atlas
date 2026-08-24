# Oteryn Atlas — Item & Spawn Farm Explorer

Alias: `ATLAS-ITEM-SPAWN-FARM-EXPLORER`

MODE: Autonomous cross-repository implementation + verification + integration + merge + merged-main live acceptance + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Implement the complete user-approved Item & Spawn Farm Explorer programme defined by:

- design: `Oteryn/Oteryn-Atlas/docs/superpowers/specs/2026-08-24-atlas-item-spawn-farm-explorer-design.md`;
- Atlas lifecycle: `Oteryn/Oteryn-Atlas#114`;
- Game producer lifecycle: `Oteryn/Oteryn-Game#75`;
- Atlas FullWorld programme: `Oteryn/Oteryn-Atlas#11`;
- Atlas verification policy: `Oteryn/Oteryn-Atlas#85`.

The intended product is a native FullWorld Atlas capability that lets a user:

1. select an item and see verified creatures that drop it, exact published drop chance/quantity semantics, verified spawn locations and scale-aware map presentation;
2. set a target quantity such as `100` and see mathematically correct expected/probability kill counts plus an estimated time after an explicit effective kills/hour input;
3. select an authoritative kill/weekly task where available, or a custom creature kill target such as `100`, and see verified spawns plus estimated completion time from explicit effective kills/hour;
4. use world-scale heatmap/cluster LOD instead of the unreadable wall of creature sprites seen in the reference site;
5. distinguish verified Game facts from Atlas-derived estimates at all times.

==================================================
REPOSITORIES
==================================================

Canonical Game/World/Content authority:
`https://github.com/Oteryn/Oteryn-Game`

Atlas consumer/runtime:
`https://github.com/Oteryn/Oteryn-Atlas`

Design-time observed heads, for historical orientation only:
- Atlas `main`: `db5de3938ef815fb467dd2ad911a1ed92b13dccf`;
- Game `main`: `a70318484b1ffdd328b53cdc70a4386a516d0109`.

DO NOT blindly trust these SHAs. Refresh GitHub before every mutation phase.

==================================================
MANDATORY PREFLIGHT
==================================================

Before changing any file:

1. Resolve current GitHub `main` for both repositories.
2. Read root `AGENTS.md` in both repositories and every nearer instruction file for touched paths.
3. Read Atlas Issue #114, Game Issue #75, parent Atlas #11 and verification #85.
4. Inspect all open PRs/issues that overlap touched paths.
5. In particular, re-resolve any current successor of:
   - Atlas creature/animation verification work around PR #112;
   - Game Wave-1 DOMAIN/CONTENT work around PR #56/#58.
6. Do not overwrite or silently absorb unrelated work.
7. Use one dedicated task branch/PR per independently mergeable repository delivery.
8. Verify local worktree remote, branch, exact HEAD and cleanliness against GitHub before local edits.
9. Preserve unrelated dirty work; use isolated worktrees/clones where needed.

GitHub is lifecycle authority. Local clones, Docker, Molehill-PC and Synology are execution planes only.

==================================================
HARD AUTHORITY RULES
==================================================

`Oteryn-Game` owns facts. `Oteryn-Atlas` owns derived projections and estimates.

Game facts include only data proven through an accepted Game export:
- item identity/name;
- creature identity/name;
- creature -> item loot relation;
- exact probability/chance semantics;
- exact or bounded quantity semantics;
- task identity/type/count;
- weekly classification;
- respawn cadence if ever proven;
- existing creature/spawn placement facts.

Atlas may derive:
- reverse indexes;
- creature-entity -> spawn spatial indexes;
- heatmap/cluster aggregates;
- static-clear expected yield;
- expected kill counts;
- completion probability thresholds;
- time from explicit KPH;
- rankings by a clearly named deterministic metric.

NEVER use as runtime authority:
- TibiaRoute;
- wiki/fansites;
- browser-side OTBM/Lua/XML parsing;
- sprite/image similarity;
- filenames;
- names-only creature joins;
- guessed region names;
- guessed respawn, DPS or live occupancy.

Legacy/reference inputs may only be read inside the already-accepted Game migration/import boundary and must remain explicit provenance.

==================================================
PHASE A — GAME FARM-INTELLIGENCE EXPORT
==================================================

Owner: `Oteryn/Oteryn-Game#75`.

Implement a versioned public-safe Game -> Atlas contract with identity:

`oteryn-game-atlas-farm-intelligence-v1`

unless an existing repository naming rule requires a different exact spelling. If changed, update all producer/consumer/tests/docs consistently and record the reason.

Preferred paths:
- `docs/contracts/OTERYN_GAME_ATLAS_FARM_INTELLIGENCE_V1.md`;
- `tools/game-atlas-farm-intelligence/**`.

Do not mutate active Wave-1 allocated `apps/game-server/src/domain/**` or `apps/game-server/src/content/**` merely to implement this export.

The export must provide truthful capability/completeness states, not ambiguous empty arrays.

Required capability families:
- items;
- loot relations;
- loot probability;
- loot quantity model;
- item delivery tasks;
- kill tasks;
- weekly task semantics;
- respawn cadence.

Use a closed status vocabulary such as `SUPPORTED`, `PARTIAL`, `UNSUPPORTED`.

### Game item records

Provide a stable producer-owned public item ID and display name. Optional presentation refs are allowed only if separately authorized.

### Game creature joins

Loot relations must refer to stable creature entity IDs that can be joined to the existing accepted static-creature/spawn publication.

If the identity join cannot be proven, export the relation as unresolved/unsupported. Do not repair it by name matching in Atlas.

### Probability semantics

Export exact probability losslessly as an integer rational, for example:

`{"numerator":14640,"denominator":100000}`

BUT only after proving the denominator and roll semantics from the accepted source/runtime. A legacy `chance=14640` field alone is not sufficient evidence for denominator semantics.

Reject:
- denominator <= 0;
- numerator < 0;
- numerator > denominator;
- non-integers;
- ambiguous chance scale.

### Quantity semantics

Distinguish:
- exact fixed quantity;
- exact finite discrete distribution;
- bounded quantity with unknown distribution;
- unsupported quantity semantics.

Do not convert a source `maxCount` into an invented uniform distribution unless the accepted runtime algorithm proves that exact distribution.

### Task semantics

Where proven, export:
- stable task ID;
- label;
- delivery/kill type;
- required item + quantity;
- required creature + kill count;
- weekly classification only when explicit.

If authoritative weekly/task content is incomplete, publish the capability limitation and continue. Atlas must still support a clearly labelled custom kill target.

### Game producer TDD

Write failing tests before implementation for at least:
- canonical deterministic output/digest;
- probability rational validation;
- probability source semantics;
- quantity model variants;
- duplicate IDs;
- dangling item/creature/task references;
- unsupported/partial capability states;
- provenance and source digest changes;
- record/byte hard limits;
- public-output source-path leakage where prohibited.

Produce a truthful current-source snapshot/fixture if the accepted source is available. Otherwise ship explicit capability metadata and record the exact blocker; do not fabricate data.

Run all repository-selected exact-head Game checks/governance/semantic audit required for the touched paths.

Open/continue the Game PR, review the full diff, satisfy required review policy, squash-merge, delete the branch, and record the exact merge SHA before Atlas pins the contract.

==================================================
PHASE B — ATLAS COMPILER / PUBLICATION
==================================================

Owner: `Oteryn/Oteryn-Atlas#114`.

After the Game contract is accepted and merged, pin the exact Game producer revision/digest.

Implement two bounded derived products.

### 1. Farm intelligence product

Recommended root:
`data/farm-intelligence/`

Contain:
- trust/manifest metadata;
- source Game revision + farm semantic digest;
- item search records;
- item -> source-creature relations;
- task records;
- per-item/task detail shards if needed;
- exact counts/digests/byte bounds.

### 2. Creature spatial secondary index

Recommended root:
`data/farm-spatial/`

Derive this only from the accepted existing creature/spawn publication.

Key by stable creature entity ID and provide bounded:
- floors;
- placement shard descriptors;
- placement counts;
- multi-resolution aggregate cells if useful;
- source creature-publication roots/digests.

Do not duplicate every spawn once per dropped item. Keep spatial data creature-keyed and combine source creatures at query time.

Aggregate cells/clusters are non-authoritative presentation indexes (`identityAuthority=false` or equivalent).

### Atlas compiler tests

Cover:
- Game contract version/digest binding;
- unsupported capability handling;
- stable item/source/task IDs;
- exact creature identity join;
- unresolved join stays unresolved;
- no name-only fallback;
- deterministic spatial index;
- deterministic cluster/aggregate cells;
- bounds/byte limits;
- corrupt/missing shard/root failure;
- source creature root linkage.

==================================================
PHASE C — PURE BROWSER LOGIC
==================================================

Keep pure logic out of DOM modules.

Recommended modules:

`src/browser/farm-intelligence.mjs`
- validate farm contracts;
- query item/source/task data;
- normalize probability/quantity models;
- calculate estimator results.

`src/browser/farm-state.mjs`
- parse/serialize deep-link state;
- selected item/task/creature;
- target quantity/kill count;
- manual KPH;
- view mode.

`src/browser/farm-lod.mjs`
- deterministic LOD selection;
- stable aggregate/cluster ordering;
- bounded visible-result policy.

Use repository-owned deterministic logic and independent test oracles.

==================================================
ESTIMATOR REQUIREMENTS
==================================================

Default editable item target: `100`.
Default editable custom kill target: `100`.

Do not hard-code a universal kills/hour default.

If KPH is absent, show kill-count mathematics but display time as unavailable until the user supplies an assumption.

### Fixed quantity drop

For exact drop probability `p`, fixed successful quantity `q`, and target `N`:

`r = ceil(N / q)`

`expected_kills = r / p`

Completion after `k` kills:

`P = P(Binomial(k,p) >= r)`

Expose clearly named:
- expected kills;
- 50% completion threshold;
- 80% completion threshold;
- 95% completion threshold.

Never call a percentile a guarantee.

### Exact finite quantity distribution

If Game proves an exact discrete distribution, implement a bounded deterministic DP/convolution solution with explicit target/state/iteration limits.

### Bounded/unknown quantity distribution

Show factual chance and quantity bounds, but disable exact target completion probability/time maths for that relation.

### Time

`time_hours = kills / effective_kills_per_hour`

The UI must show KPH source:
- `Manual assumption` for v1;
- a future separately-authorized analytics source may be added later with sample/confidence metadata.

### Multiple source creatures

Do not invent a global average drop chance.

Allow source-creature selection.

For a spatial cluster, an allowed derived metric is:
`expected item yield per static clear = sum(proven expected quantity per kill for every matching placement)`.

Label it exactly as a static-clear metric, not items/hour.

### Kill task/custom target

For target kills `N` and KPH:

`time_hours = N / KPH`

Do not simulate DPS, travel efficiency, party bonus, respawn occupancy or server load.

No fixed solo/party multiplier. A later analytics provider may supply observed solo/party KPH distributions.

==================================================
PHASE D — FULLWORLD UX / MAP LOD
==================================================

Implement inside the current `web/fullworld.html` shell. Do NOT create a second duplicated map application and do NOT redesign the entire Atlas navigation as part of this task.

Recommended controller:
`web/fullworld-farm-explorer.mjs`

### Left controls

Add `Item & Task Explorer` with:
- search;
- selected item/task/creature card;
- source-creature list;
- factual drop chance/quantity;
- spawn counts;
- target quantity / kill target;
- KPH assumption;
- map display mode.

Supplement global search with `Item` and `Task` results if cleanly supported. Selecting an item opens Explorer state; an item must not be given a fake world coordinate.

### Right inspector

Separate visually and semantically:

`VERIFIED FACTS`
- Game source/contract/revision/digest;
- item/creature/task identity;
- drop probability;
- quantity semantics;
- task requirement;
- factual spawn counts/floors.

`ESTIMATE`
- target quantity/kills;
- expected kills;
- 50/80/95% thresholds;
- KPH + KPH source;
- time estimate;
- ranking metric.

### Map presentation

Add one dedicated farm analysis overlay for heatmap/cluster/highlight primitives, using the exact same current FullWorld view/camera/floor transform as the base map.

Far/world scale:
- heatmap/aggregate cells;
- no hundreds of equal-size creature sprites.

Medium scale:
- deterministic clusters;
- count badges;
- source composition.

Near scale:
- individual factual spawn/creature presentations;
- selection highlights.

Reuse/refactor the verified existing creature presentation/animation path for near-zoom creature pixels. Do not create a second sprite-decoder or animation authority.

The Farm Explorer overlay is its own visible layer and must not silently change the ordinary Monster/Spawn toggle.

Manual farm views:
- AUTO;
- HEATMAP;
- CLUSTERS;
- SPAWNS.

Choose exact AUTO thresholds from browser/visual evidence. Keep the LOD function pure, monotonic and testable.

### Ranking

V1 may rank by explicit metrics such as:
- Most matching spawns;
- Highest static-clear expected item yield;
- Most target kills per static clear;
- Shortest spatial spread with documented formula.

Do not display an unlabeled generic `Best place` as though it measures real-world farm speed.

Use authenticated Area/Subarea names only when an accepted dataset publishes them. Otherwise show floor + coordinate/bounds.

==================================================
DEEPLINK / URL STATE
==================================================

Implement and test public state equivalent to:

- `item=<stable-item-id>`;
- `farmQty=<positive-int>`;
- `farmKph=<positive-number>` only when explicitly supplied;
- `farmTask=<stable-task-id>`;
- `farmCreature=<stable-creature-id>`;
- `farmKills=<positive-int>`;
- `farmView=auto|heatmap|clusters|spawns`.

Preserve existing FullWorld camera/floor/zoom/mode/animation/layer state contracts.

Reject malformed, non-finite, negative, excessive or contradictory farm state. Do not silently coerce it into a misleading estimate.

==================================================
FAIL-CLOSED / PARTIAL DATA
==================================================

Required examples:

- item known, probability unsupported -> show relation, no probability estimate;
- probability exact, quantity model unknown -> show chance/bounds, disable exact target-quantity maths;
- creature relation known, entity->spawn join unresolved -> show source relation, `Map locations unresolved`, no names-only fallback;
- authoritative weekly tasks unavailable -> generic custom kill target remains available and is not labelled weekly;
- farm product/root mismatch -> disable Explorer data while preserving unrelated Atlas base map/layers;
- optional selected item shard fails -> fail the affected item selection, not the entire FullWorld runtime.

Never fetch a web/wiki fallback in the browser.

==================================================
PERFORMANCE / BOUNDEDNESS
==================================================

- load only selected item/task relations and necessary creature spatial shards;
- viewport work must be bounded;
- far-scale rendering must use aggregate cells;
- explicit cache caps + eviction;
- no per-spawn timers;
- no per-spawn DOM marker flood;
- reuse existing animation runtime;
- batch canvas/WebGL-compatible analysis draws;
- hard-limit probability/distribution calculations;
- qualify dense and sparse source cases.

Record evidence before choosing blocking performance thresholds. Do not invent arbitrary budgets.

==================================================
TESTING — MANDATORY
==================================================

Follow Atlas #85 and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`.

TDD applies: create a failing executable proof before implementation for new pure behavior and every reproduced defect.

### Pure/unit/contract

At minimum test:
- expected-kill formula against independent known cases;
- 50/80/95% thresholds against small independent binomial cases;
- q > 1 fixed quantity;
- discrete quantity DP if implemented;
- bounded-unknown disables exact maths;
- zero/negative/non-finite KPH rejection;
- kill target time;
- URL round-trip/invariants;
- contradictory URL state;
- deterministic cluster membership/order;
- LOD monotonicity and hard bounds;
- malformed/missing farm data;
- Game->Atlas provenance/digest linkage.

### Real Playwright Chromium

Desktop + mobile complete journeys:
- search item;
- select item;
- inspect sources/chance/quantity;
- choose source creature;
- heatmap -> clusters -> near spawns;
- floor change;
- pan/zoom/button zoom/wheel zoom;
- resize;
- edit target quantity;
- edit KPH;
- verify estimate updates;
- authoritative task path where available;
- custom 100-kill path;
- history/back/forward;
- reload/deep link;
- malformed/missing product failure;
- no page/console/network-policy errors;
- mobile controls/inspector/accessibility.

### Geometry

P0: prove farm world anchors remain synchronized with the base map under:
- horizontal/vertical/diagonal pan;
- wheel/button zoom;
- pan->zoom and zoom->pan;
- resize/DPR profile;
- floor changes;
- mode transitions where applicable;
- overlay enable/disable while camera work is in flight;
- reload/deep-link restoration.

Use an independent geometry/render oracle, not only shared-state equality.

### Visual user acceptance

Produce exact-head representative screenshots/evidence for:
- world-scale heatmap;
- medium cluster mode;
- near-spawn mode;
- item fact/estimate inspector;
- desktop and mobile.

Actually inspect the artifacts before merge.

### Performance/stability

Record on a dense and sparse case:
- visible aggregate/cluster/spawn counts;
- draw/update durations;
- request/shard/cache counts;
- browser/render diagnostics;
- repeated pan/zoom stability.

No retries, broad tolerances, sleeps, skips or allowlists may be added to hide a real first failure.

==================================================
PARALLEL EXECUTION
==================================================

After the Game contract shape is frozen, Atlas work may be split into isolated worktrees/branches:

1. `math-state` — estimator + URL state + pure tests;
2. `publication-index` — Game consumer + farm product + creature spatial secondary index;
3. `runtime-ux` — Explorer/overlay/mobile scaffolding against schema fixtures.

These lanes must have non-overlapping owned paths where possible.

One integration owner must reconcile them on the current task branch, rebase/refresh from current `main`, review the complete combined diff and run exact-final-head qualification.

Do not allow independent agents to concurrently edit shared `web/fullworld.html`, `web/fullworld.css`, `web/fullworld-app.mjs`, `web/fullworld-creatures.mjs` or common verification files without explicit integration sequencing.

==================================================
MERGE / DEPLOYMENT / CLOSEOUT
==================================================

GAME:
1. exact-head tests/governance/semantic/review requirements green;
2. full diff reviewed;
3. squash merge Game PR;
4. verify exact Game merge SHA;
5. delete completed Game branch;
6. update Game Issue #75 terminally.

ATLAS:
1. pin accepted merged Game producer revision/digest;
2. exact-head deterministic tests green;
3. Molehill-PC full applicable Docker Playwright qualification on the exact Atlas PR head, workers/retries per repository policy and retries=0;
4. exact-head `atlas-gate` + `provenance-gate` green;
5. review complete diff and all review threads;
6. squash merge Atlas PR;
7. delete completed Atlas branch;
8. live deploy ONLY from exact merged Atlas `main` through the authorized workflow;
9. verify live revision/container/header identity and bounded desktop/mobile real-browser acceptance;
10. update Atlas Issue #114 terminally.

Do not deploy a task branch or dirty worktree.

If Synology is unavailable, merged-main live acceptance remains BLOCKED; do not substitute an untrusted direct host mutation.

==================================================
DEFINITION OF DONE
==================================================

Do not claim completion until all applicable items are directly verified:

- Game farm-intelligence contract exists and is merged;
- capability/completeness states are truthful;
- exact probability semantics are proven rather than assumed;
- Atlas item search returns real Game-derived items where available;
- item -> creature -> spawn joins use stable identities;
- selected item shows factual drop chance/quantity semantics;
- target 100 item estimator works for supported models;
- 50/80/95% kill thresholds are mathematically verified;
- KPH must be explicit and estimate source visible;
- custom/authoritative target 100 kill estimator works;
- weekly label appears only when proven;
- world-scale heatmap/cluster LOD removes sprite clutter;
- near zoom uses verified factual creature presentation without duplicate animation authority;
- rankings state their exact metric;
- URL/history/reload/mobile behavior is verified;
- partial/malformed data fails closed;
- geometry/render synchronization is proven;
- dense/sparse performance evidence is recorded;
- user-facing visual artifacts are reviewed;
- exact-head required CI passes;
- both PRs are squash-merged and branches cleaned;
- merged-main live Atlas acceptance passes or is reported as a precise external blocker.

==================================================
FINAL REPORT FORMAT
==================================================

Report compactly with explicit categories:

FACT
- exact Game base/head/merge SHA;
- Game Issue/PR and exact required check runs/results;
- exact farm contract ID/version/digest/capability counts;
- exact Atlas base/head/merge SHA;
- Atlas Issue/PR and exact required check runs/results;
- exact changed paths;
- deterministic test counts/results;
- Docker Playwright exact-head result;
- visual/performance evidence paths/artifacts;
- live deployed revision/header/container identity if accepted.

INFERENCE
- only conclusions derived from verified evidence, labelled as such.

UNKNOWN / BLOCKED
- any missing authoritative data, unavailable runner/live target, unresolved identity join or incomplete capability and exactly how it affects the product.

Do not invent completion, run IDs, performance numbers, drop chances, task rules, spawn facts or deployment status.
