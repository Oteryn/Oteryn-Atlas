# ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION

ALIAS:
`ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`

MODE:
Autonomous cross-repository implementation + verification + integration + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement Oteryn Atlas Hunt Intelligence end to end, using Oteryn-Game as the authoritative world/content source and Oteryn Game Intelligence as the measured gameplay analytics source. The resulting Atlas feature must be materially better than a static hunting-place directory and must truthfully distinguish solo, party and area-level performance.

The authoritative technical design is:

`Oteryn/Oteryn-Atlas/docs/agents/tasks/active/ATLAS-HUNT-INTELLIGENCE-PROJECT.md`

Read it completely before implementation.

---

## REPOSITORIES

Canonical Game/World/Content/analytics authority:

`https://github.com/Oteryn/Oteryn-Game`

Atlas read model / browser product:

`https://github.com/Oteryn/Oteryn-Atlas`

Atlas lifecycle authority:

`https://github.com/Oteryn/Oteryn-Atlas/issues/117`

Parent FullWorld programme:

`https://github.com/Oteryn/Oteryn-Atlas/issues/11`

Verification platform:

`https://github.com/Oteryn/Oteryn-Atlas/issues/85`

Related Item & Spawn Explorer:

`https://github.com/Oteryn/Oteryn-Atlas/issues/114`

Starting baselines recorded when the design was authored:

- Atlas `db5de3938ef815fb467dd2ad911a1ed92b13dccf`;
- Game `1f69677b40851551953caf853c08b37ce7b29c68`.

These are provenance only. **Refresh both repositories and all lifecycle state from GitHub before any mutation. Do not blindly use these SHAs if `main` has advanced.**

---

## GLOBAL NON-NEGOTIABLE RULES

1. `Oteryn-Game` is the only Game product authority for world/content facts.
2. `Oteryn-Atlas` remains a derived semantic projection/read model.
3. Oteryn Game Intelligence remains observational/analytical and must not become gameplay authority.
4. Browser runtime must not parse OTBM, legacy files, TibiaRoute, wikis, Canary/Crystal data or community pages as fallback authority.
5. Never invent coordinates, floors, Hunt Area geometry, access requirements, spawn facts, creature/item relations, XP/profit measurements, boosted/event state or party semantics.
6. Missing authoritative data is `UNKNOWN`/`UNAVAILABLE`, not permission to guess.
7. Production Atlas must never contain synthetic measured analytics. Deterministic fixtures are allowed only in tests.
8. Never compare raw solo and party totals as though they represented the same unit of value.
9. Never derive player XP by dividing team XP by party size. Use actual server-awarded player XP.
10. Never label team loot or an assumed equal split as measured personal profit.
11. Every measured result must preserve relevant cohort, time-base, revision, sample and quality context.
12. Public Atlas analytics must be privacy-safe aggregates; do not ship raw player/session telemetry to the browser.
13. No automatic game-balance changes may be driven by this feature.
14. Do not weaken provenance, security, privacy, validation or tests to make the programme pass.
15. Every changed behavior must receive the applicable deep verification required by Atlas Issue #85 and repository `AGENTS.md`.

---

## REQUIRED PREFLIGHT

Before editing anything:

1. Resolve from GitHub:
   - current Atlas `main` SHA;
   - current Game `main` SHA;
   - Atlas Issue #117 state/comments;
   - related #114/#85/#11 state;
   - active PRs/branches that overlap hunt, creature, item/spawn, FullWorld, analytics or world schema work.
2. Read current root and nearer `AGENTS.md` files in every repository/path you may touch.
3. Read current Game architecture/contracts relevant to:
   - ADR-0005 native world/content/spatial model;
   - ADR-0006 Game Intelligence/analytics/audit;
   - current world-schema/content-registry/export contracts;
   - current analytics implementation/contracts/events;
   - privacy/retention/release policies if present.
4. Read current Atlas contracts and runtime for:
   - FullWorld map/camera/floor transforms;
   - creature/NPC overlays and search;
   - Item & Spawn Explorer implementation if #114 has advanced;
   - content-addressed publication/loaders;
   - URL/deep-link state;
   - verification platform.
5. Create or identify the required **Game lifecycle Issue** before substantial Game mutation. Link it to Atlas #117.
6. Use one independently mergeable Issue -> branch -> PR lifecycle per repository task. Do not push ordinary work directly to `main`.
7. Record exact base/head SHAs and cross-repository dependencies.

If there is overlapping active work, integrate with it; do not overwrite or fork a competing authority.

---

## PRODUCT OUTCOME

Implement a native **Hunt Intelligence** experience inside FullWorld Atlas with:

- Hunt Finder;
- authoritative Hunt Area geometry/floors/entrances/access;
- authoritative route/rotation rendering where Game publishes it;
- monsters/spawns integrated with the existing creature layer;
- item/loot links integrated with #114 rather than duplicated;
- player-scoped performance;
- party-scoped performance;
- Hunt-Area/spawn-utilization performance;
- compatible-cohort comparison;
- revision-aware historical comparison;
- `Best Hunt for Me` recommendation ranges;
- party-size/saturation intelligence when statistically supportable;
- desktop/mobile/deep-link support;
- explicit provenance/quality/uncertainty.

A user should be able to answer:

```text
Where can I hunt?
How do I get/use the hunt?
What does a player like me actually earn there?
What does my planned party actually earn there?
How much total throughput does the area sustain?
Which hunt is best for my selected objective?
How strong is the evidence behind that recommendation?
```

---

## TRUST CLASSES — REQUIRED IN DATA AND UI

Every user-visible datum must resolve to:

- `VERIFIED` — authoritative Game-owned fact / accepted factual export;
- `MEASURED` — Game Intelligence aggregate with sample/time/revision context;
- `ESTIMATE` — deterministic Atlas-derived estimate/prediction;
- `UNKNOWN` / `UNAVAILABLE` — absent, blocked, suppressed or insufficient evidence.

Do not use styling alone to encode the distinction. Include accessible semantic labels/tooltips/inspector provenance where appropriate.

---

## REQUIRED DOMAIN CONTRACTS

### 1. Hunt catalog

Implement/finalize a Game-owned hunt catalog concept that references, rather than replaces, the accepted ADR-0005 geography.

Use the repository's accepted naming after inspection. The logical model must support at least:

```text
stable hunt identity
localized display name
Area/Subarea/EncounterZone references as applicable
floor geometry references
entrance/access references
spawn-group references
creature references
requirement references
authored route references
content revision/provenance
```

Do not force `HuntArea` into the technical `Region -> Chunk` hierarchy. Spatial concepts remain composable through authoritative references/indexes.

### 2. Hunt routes

Implement a route contract capable of:

```text
route identity
route objective/type
ordered nodes/segments
floor transitions
optional authored pull/box/waypoint semantics
source/provenance
content revision compatibility
```

Atlas may only publish repository-provided route coordinates that have an accepted authority/provenance path. Do not create repo-owned Atlas coordinates masquerading as Game facts.

### 3. Hunt analytics cohort

The public-safe aggregate contract must preserve material dimensions, including where supported:

```text
hunt_id
content_revision
ruleset_revision
release/server-build compatibility bucket
time window
party size
party composition
shared-experience state
player vocation/class/role
player level band
party level distribution/band
equipment/power band
skill/power band
active authoritative modifiers/events
sessionization policy revision
valuation policy revision
privacy/quality policy revision
```

Cohort widening must be explicit, deterministic and quality-degrading. Never silently pool incompatible samples to increase counts.

---

## PLAYER / PARTY / HUNT AREA METRICS

### PLAYER

Implement truthful player-facing aggregates when source evidence exists:

- actual awarded player XP/hour;
- active-hunt and end-to-end rate variants where denominators exist;
- personal supply cost/hour;
- personal allocated/realized loot/profit only when authoritative allocation semantics exist;
- deaths per player-hour / risk metrics;
- optional pressure/efficiency metrics if product-relevant and public-safe.

### PARTY

Implement team aggregates separately:

- sum of actual awarded XP across included party members/hour;
- base creature XP defeated/hour as a separate spawn-throughput measure if useful;
- team gross loot value/hour;
- team supply cost/hour;
- team net value/profit under a named valuation policy;
- kills/hour and creature mix;
- party death/wipe/safety measures where defined;
- composition/shared-experience context.

### HUNT AREA

Implement area-level analytics where the Game Intelligence foundation supports them:

- occupancy/activity;
- spawn utilization;
- monster lifetime/kill rate;
- kill/team throughput by comparable cohort;
- per-player yield by comparable cohort;
- party-size throughput curves;
- objective-specific saturation/marginal gain;
- objective-specific optimal party-size recommendation when statistically publishable.

There is no context-free `optimal party size`.

---

## XP SEMANTICS — HARD REQUIREMENT

Where events/aggregates exist, distinguish:

```text
player_awarded_xp
party_awarded_xp_sum
base_creature_xp_defeated
shared_experience_state
party bonus/modifier identity
```

Required behavior:

- player ranking uses actual player-awarded XP distributions;
- party throughput uses party-scoped aggregates;
- base creature XP is never mislabeled as awarded XP;
- no `team XP / party size` shortcut;
- `XP/player-hour` may be an additional efficiency metric, never a replacement for player distribution.

Add permanent tests proving these distinctions.

---

## TIME SEMANTICS — HARD REQUIREMENT

Implement/retain distinct denominators where available:

```text
trip_wall_seconds
hunt_wall_seconds
active_hunt_seconds
combat_seconds
travel_seconds
refill_seconds
downtime_seconds
```

Sessionization/classification policy belongs to Game Intelligence and must be versioned. Atlas must not invent undocumented grace periods.

Expose clearly named rates such as:

- `Active hunt XP/h`;
- `End-to-end/session XP/h`.

Never show a combat-only rate as a complete-session rate.

---

## LOOT / PROFIT SEMANTICS — HARD REQUIREMENT

Every value metric must identify its valuation policy/revision.

Support truthful separation of:

```text
team_gross_loot_value
team_supply_cost
team_other_explicit_cost
team_net_value
player_supply_cost
player_realized_or_allocated_value    only when authoritative
player_net_profit                      only when authoritative
```

When allocation is unknown:

- show measured team value;
- show measured player costs if available;
- any equal-share or other split is `ESTIMATE`;
- do not claim measured personal profit.

Add regression tests for this exact failure mode.

---

## STATISTICAL QUALITY / PRIVACY

Measured cohorts must carry enough evidence to interpret them:

```text
sample_sessions
sample_player_hours
sample_team_hours
window_start/window_end
median
p25/p75
p10/p90 when publishable
quality_state
quality_policy_revision
privacy_policy_revision
suppression reason
revision scope
```

Requirements:

- use robust summaries; do not rely on mean-only headline metrics;
- do not invent arbitrary confidence thresholds in Atlas;
- implement/reuse a versioned Game Intelligence public-release policy;
- suppress small/private cells;
- do not expose character names, raw player GUIDs, item-instance IDs or session IDs in Atlas publications;
- do not expose unnecessary precise movement history;
- no public shard may allow reconstruction of an individual session;
- outlier filtering/winsorization, if used, must be policy-versioned and reproducible;
- a suppressed or insufficient cohort is `UNAVAILABLE`, not zero.

---

## REVISION AWARENESS

All measured performance must be tied to current/historical revision identity.

Default product behavior:

1. current `content_revision` + current `ruleset_revision` first;
2. no silent pooling across incompatible revisions;
3. historical data appears only in explicit history/comparison views;
4. show data freshness/time window;
5. support before/after balance/content comparison only when statistically valid.

Add tests proving that a prior-revision high-performance cohort cannot silently become the current recommendation source.

---

## RECOMMENDER — BEST HUNT FOR ME

Implement v1 as a deterministic, explainable cohort-matching/ranking system. Do not introduce opaque ML merely to call the feature intelligent.

Inputs should support the authoritative/measured dimensions that actually exist, including:

```text
vocation/class
level
solo/duo/party plan
party composition
equipment/power band when available
objective: EXP / PROFIT / BALANCED / BESTIARY / accepted alternatives
minimum profit/safety preference
location/access constraints
```

Algorithm requirements:

1. start from authoritative Hunt Areas compatible with known constraints;
2. use current-revision measured cohorts;
3. prefer exact player/party/composition matches;
4. widen cohorts only through a documented deterministic policy;
5. reduce confidence for material widening;
6. rank on the selected objective with explicit weights/version;
7. return a range + evidence basis + reasons;
8. return `UNAVAILABLE` when evidence is insufficient.

Example target presentation:

```text
Expected for your RP profile
XP/h: 6.1–6.7m
profit/h: 620–790k
risk: LOW–MEDIUM
quality: HIGH
basis: 1,842 comparable sessions, current revision
```

Do not fabricate precise percentages when the underlying evidence only supports broad bands.

---

## SATURATION / PARTY-SIZE INTELLIGENCE

Implement empirical v1 only after comparable cohorts are available.

Required method:

- group by compatible hunt/revision/composition/level/power dimensions;
- build team-throughput distributions by party size;
- build per-player-yield distributions by party size;
- compare adjacent compatible cohorts;
- publish marginal gains only when release quality permits;
- name the optimization objective.

A later statistical/ML model is allowed only with reproducible training/evaluation, revision-awareness, held-out validation and explainable uncertainty.

---

## ATLAS UI / UX

Integrate with FullWorld. Do not build a disconnected static directory unless a route/page is only a responsive entry surface into the same state model.

### Hunt Finder

Implement filters supported by real data, such as:

- level;
- vocation/class;
- solo/duo/party size;
- composition;
- EXP/profit target;
- risk;
- monster/content preference;
- access requirement state;
- location;
- objective.

Unavailable dimensions must remain unavailable rather than populated with guessed metadata.

### Result card

Keep PLAYER and PARTY numbers visibly separate. A card should show provenance/quality alongside values.

### Hunt detail

Implement coherent sections/tabs as applicable:

- Overview;
- Map;
- Monsters;
- Loot / Economy;
- Route;
- Requirements;
- Performance;
- History / Reports;
- provenance/quality.

### Map

Required behavior:

- selecting a hunt zooms to authoritative geometry;
- correct floor(s) are selected/indicated;
- routes are floor-aware;
- far zoom uses readable area/cluster/heat presentation;
- medium zoom shows useful route/entrance/spawn grouping;
- near zoom reuses verified creature/spawn presentations;
- overlays remain synchronized with the exact FullWorld transform during pan/zoom/floor/resize/mode changes.

### Compare Hunts

Compare only compatible scopes/cohorts/revisions/time bases. If two values are not comparable, explain the incompatibility instead of forcing a ranking.

### Deep links

Persist sufficient state for reproducible URLs/history/reload:

```text
hunt selection
profile/party mode
filters/objective
comparison selection
floor/view as appropriate
performance window/revision view as appropriate
```

Follow existing FullWorld URL conventions rather than inventing a parallel router.

---

## INTEGRATION WITH #114

Do not duplicate Item & Spawn Explorer infrastructure.

Reuse/integrate:

- creature identity/presentation;
- spawn positions/areas;
- item identity;
- loot-source relations;
- drop chance/quantity contracts where authoritative;
- map LOD/camera/floor transforms;
- inspector/deep-link conventions;
- provenance labels.

Provide cross-links:

```text
Hunt -> Monster -> Items/Sources
Item -> Source Creature -> Hunts containing that source
Creature -> Spawn -> Hunt Areas
```

If #114 is still in-flight, coordinate a shared primitive contract rather than creating competing loaders/schemas.

---

## DATA PIPELINE / BROWSER BOUNDS

Target logical pipeline:

```text
Oteryn runtime
   +-- Game world/content exporter ------------------+
   `-- Game Intelligence aggregate/release pipeline -+
                                                     v
                                         Atlas verifier/compiler
                                                     v
                                   bounded content-addressed shards
                                                     v
                                       FullWorld browser runtime
```

Requirements:

- no raw telemetry in browser;
- bounded summary index;
- lazy detail/performance shards;
- explicit max bytes/counts for geometry/routes/cohorts;
- schema/revision/digest validation;
- fail-closed malformed/oversized resources;
- analytics failure/unavailability must not disable verified Hunt Area navigation;
- performance panel and recommendation state fail independently from the base map;
- use existing Atlas publication/content-addressing conventions unless a measured requirement justifies change.

---

## IMPLEMENTATION ORDER

### PHASE 0 — Preflight

Complete all GitHub-first lifecycle and overlap checks above.

### PHASE 1 — Contract checkpoint

Before parallel implementation, freeze/review the minimum shared contracts:

- Game Hunt Catalog/HuntDefinition;
- route/access semantics;
- Game Intelligence cohort/metric aggregate;
- privacy/quality/suppression semantics;
- Atlas projection boundary;
- shared #114 creature/item/spawn references.

Do not let UI agents invent missing producer fields.

### PHASE 2 — Game world/content producer

Implement the canonical Hunt Area/catalog/route export required by the accepted contract, using project-owned native world/content models.

Add:

- schema validation;
- stable identity/reference tests;
- deterministic export tests;
- missing/conflicting reference negatives;
- bounds/size limits;
- provenance/revision metadata.

### PHASE 3 — Game Intelligence producer

Implement the required analytics path using the accepted ADR-0006 event foundation.

Where foundation components already exist, extend them. Where required capabilities are not yet implemented, implement the minimal first-class foundation rather than copying the deprecated Lua/MariaDB subsystem.

Required capabilities include:

- deterministic hunt sessionization policy;
- player/party/hunt-area aggregation;
- actual awarded XP semantics;
- supply/loot/value semantics consistent with authoritative events;
- cohort dimensions;
- revision-aware windows;
- privacy/quality suppression;
- deterministic aggregate/publication generation;
- replay/idempotency tests.

If production has not accumulated real samples yet, the producer/contract must still be complete and Atlas must truthfully show `UNAVAILABLE`. **Do not seed production with fake measurements.**

### PHASE 4 — Atlas projection/compiler

Implement validated consumption and bounded publication:

- hunt summary/search index;
- hunt detail shards;
- spatial/floor geometry refs;
- route refs;
- performance cohort shards;
- provenance/trust/quality metadata;
- #114 shared refs;
- fail-closed loaders.

### PHASE 5 — FullWorld Hunt UX

Implement Finder, result cards, hunt detail, map interaction, route/floor behavior, monsters/items integration and desktop/mobile/deep links.

### PHASE 6 — Measured performance

Implement PLAYER/PARTY/HUNT AREA views, distributions, freshness/revision context, compare compatibility and unavailable/suppressed states.

### PHASE 7 — Personalized recommendation

Implement deterministic profile matching, cohort widening, objective ranking and explicit range/confidence/reason output.

### PHASE 8 — Saturation intelligence

Implement objective-specific empirical saturation/marginal gain only for statistically eligible cohorts.

### PHASE 9 — Verification and integration

Run all required repository-selected checks and exact-head cross-repository qualification.

### PHASE 10 — Merge/deploy/closeout

- review complete changed-file sets/diffs;
- resolve all required reviews/checks;
- squash merge each independently mergeable PR in dependency order;
- verify post-merge heads;
- delete merged task branches per repository policy;
- update lifecycle Issues with exact merge evidence;
- deploy Atlas only from merged `main` if this delivery includes deployment authority;
- verify live revision/header/container identity and real-browser acceptance under Atlas policy.

Do not claim completion while an applicable required check, producer, integration or acceptance gate remains unresolved.

---

## PARALLEL AGENT STRATEGY

You may parallelize after the shared contract checkpoint.

Recommended disjoint workstreams:

1. `HUNT-GAME-WORLD-CONTENT` — Hunt catalog/route/world export.
2. `HUNT-GAME-INTELLIGENCE` — telemetry sessionization/cohort/public aggregate.
3. `HUNT-ATLAS-PROJECTION` — verifier/compiler/index/shards.
4. `HUNT-ATLAS-UX` — Finder/detail/map/compare/recommendation UI against frozen contracts.
5. `HUNT-VERIFICATION` — independent unit/contract/geometry/E2E/performance/visual acceptance.

Rules:

- no parallel implementation before common contract semantics are stable;
- assign disjoint path ownership;
- pin hand-offs to exact commits/contracts;
- do not let agents overwrite unrelated dirty work;
- integrate dependency branches in a controlled order;
- every repository branch remains tied to its own authoritative Issue/PR.

If parallel agents are unavailable, execute the same dependency graph sequentially without weakening scope.

---

## TDD / VERIFICATION REQUIREMENTS

For every behavior/fix:

1. create or identify a failing deterministic test/proof first where practical;
2. implement the minimum correct behavior;
3. run targeted tests;
4. run the complete applicable exact-head verification tier;
5. preserve permanent regression coverage.

### Required logic coverage

- player vs party rate semantics;
- no naive XP division;
- active vs end-to-end denominators;
- valuation policy compatibility;
- actual vs estimated player profit;
- cohort canonicalization;
- composition compatibility;
- cohort widening/confidence degradation;
- current vs historical revision selection;
- quality/suppression/unavailable state;
- percentile/range presentation;
- saturation/marginal gain calculations;
- recommendation ordering, ties and insufficient evidence;
- zero/invalid duration and numeric bounds.

### Required contract/provenance coverage

- Hunt Catalog schema;
- Hunt Performance schema;
- stable cross references;
- privacy suppression;
- malformed/missing/oversized/incompatible data;
- digest/root/revision checks;
- no external/legacy runtime fallback;
- no duplicate #114 authority.

### Required browser coverage

Desktop and mobile Chromium must cover:

- Hunt mode entry;
- filters/profile/party/objective;
- selecting hunt and map zoom;
- floor-aware route behavior;
- monster/item cross-linking;
- compare workflow;
- recommendation profile changes;
- measured/unavailable/suppressed states;
- revision history where implemented;
- URL/deep-link/history/reload;
- strict console/page/network failure handling.

### Required map/render coverage

Prove world-anchor synchronization under:

- pan;
- wheel/button/anchor zoom;
- resize/orientation/DPR;
- floor change;
- view-mode transition;
- route/spawn/creature layer toggles;
- mobile drawer transitions.

### Required performance coverage

Measure bounded behavior for:

- summary-index load/search/filter;
- hunt/detail/performance shard loading;
- route/area overlays;
- repeated hunt switching;
- cache growth/eviction;
- representative large catalog/cohort fixtures;
- seeded stress sequences under the #85 platform.

Use evidence-backed budgets; do not invent a threshold only to make CI pass.

---

## ACCEPTANCE CHECKLIST

Do not finish until the implemented subset promised by the lifecycle Issues satisfies all applicable statements:

- [ ] current Game and Atlas authority boundaries remain intact;
- [ ] Hunt catalog is Game-owned and revisioned;
- [ ] routes/coordinates have explicit authority/provenance;
- [ ] analytics is produced by Game Intelligence, not Atlas;
- [ ] PLAYER/PARTY/HUNT AREA are separate end to end;
- [ ] actual server-awarded player XP is preserved;
- [ ] team throughput is separate from player yield;
- [ ] profit distinguishes valuation, team value, personal cost and allocation/estimate status;
- [ ] active versus wall-clock denominators are explicit;
- [ ] measured cohorts carry sample/window/revision/quality;
- [ ] privacy/small-cohort suppression is enforced;
- [ ] no synthetic production analytics exists;
- [ ] current vs historical revisions cannot be silently mixed;
- [ ] Hunt Finder/detail/map/route function against real accepted catalog data;
- [ ] #114 creature/item/spawn infrastructure is reused;
- [ ] compare rejects/explains incompatible metrics;
- [ ] `Best Hunt for Me` returns explainable ranges or `UNAVAILABLE`;
- [ ] saturation claims are objective-specific and evidence-gated;
- [ ] desktop/mobile/deep-link flows are covered;
- [ ] geometry/render synchronization tests pass;
- [ ] performance/stress checks pass;
- [ ] Atlas `atlas-gate`/`provenance-gate` and required Game gates/reviews pass on exact final heads;
- [ ] final diffs are reviewed;
- [ ] PRs are squash-merged in dependency order;
- [ ] merged task branches are cleaned up;
- [ ] live Atlas, if deployed, serves the exact merged revision and passes real-browser acceptance.

---

## REQUIRED FINAL REPORT

Return a concise evidence-backed closeout containing:

```text
Atlas lifecycle Issue
Game lifecycle Issue(s)
Atlas PR(s) and merge SHA(s)
Game PR(s) and merge SHA(s)
final Game main SHA
final Atlas main SHA
implemented trust/data contracts
implemented PLAYER/PARTY/HUNT AREA metrics
analytics availability status (real measured data vs UNAVAILABLE)
verification commands/results
CI run/check status
browser/visual/performance evidence
live revision/acceptance if deployed
remaining explicit blockers, if any
```

Never report a planned change as completed implementation.

Execution alias:

`ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`
