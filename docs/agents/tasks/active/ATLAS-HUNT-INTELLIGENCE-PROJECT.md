# Oteryn Atlas — Hunt Intelligence implementation project

Status: DESIGN / EXECUTION CONTRACT

Lifecycle authority: `Oteryn/Oteryn-Atlas#117`

Parent programme: `Oteryn/Oteryn-Atlas#11`

Verification policy: `Oteryn/Oteryn-Atlas#85`

Related capability: `Oteryn/Oteryn-Atlas#114` (`ATLAS-ITEM-SPAWN-FARM-EXPLORER`)

Execution alias: `ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`

Design baseline inspected on 2026-08-24:

- Atlas `main`: `db5de3938ef815fb467dd2ad911a1ed92b13dccf`;
- Game `main`: `1f69677b40851551953caf853c08b37ce7b29c68`;
- Game world/content authority: `docs/architecture/ADR-0005-native-world-format-and-oteryn-studio.md`;
- Game Intelligence authority: `docs/architecture/ADR-0006-game-intelligence-analytics-and-audit.md`;
- Atlas authority/testing rules: root `AGENTS.md` and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`.

Issue #117 is the mutable lifecycle/status authority. This document is the technical design and execution contract and must not become a second task-status database.

---

## 1. Product decision

Oteryn Atlas will implement **Hunt Intelligence** as a first-class FullWorld capability rather than a static list of hunting places.

The product must answer four progressively richer questions:

1. **Where can I hunt?** — authoritative world/content facts and Hunt Area geometry.
2. **How do I use this hunt?** — entrances, floors, monsters/spawns, requirements and authoritative route guides where published by Game.
3. **How does this hunt actually perform?** — privacy-safe measured aggregates from Oteryn Game Intelligence.
4. **How is it likely to perform for me or my party?** — Atlas-derived recommendations/ranges based only on comparable measured cohorts, with explicit uncertainty.

The central rule is that there is no single universal `EXP/h` or `profit/h` number for a hunt. Solo, duo and party play generate materially different outcomes. Hunt Intelligence therefore models **PLAYER**, **PARTY** and **HUNT AREA** performance separately and preserves the cohort context required to compare them truthfully.

---

## 2. Authority boundary

### 2.1 Oteryn-Game owns world/content facts

`Oteryn/Oteryn-Game` is the only authority for Game-owned facts, including where implemented:

- Hunt Area identity and authored metadata;
- world geometry, coordinates, floors and transitions;
- Area/Subarea/Zone/EncounterZone relations;
- entrances and access anchors;
- spawn definitions and creature identity;
- items, loot definitions, NPC value and content relationships;
- quests/access requirements;
- official/authored hunt route nodes and floor transitions;
- `content_revision`, ruleset identifiers and other Game revisions.

Atlas must not invent or repair missing Game-owned coordinates, floor geometry, creature placement, access requirements or content semantics.

### 2.2 Oteryn Game Intelligence owns measured analytics

The analytics source is the accepted Oteryn Game Intelligence architecture from ADR-0006. It remains observational and must not become gameplay authority.

Game Intelligence owns the production and aggregation semantics for measured facts such as:

- experience actually awarded;
- monster kills and kill attribution;
- damage/healing/deaths where relevant;
- consumable/supply use;
- loot/value/economy measurements;
- party composition/shared-experience context;
- Area/Subarea/EncounterZone activity and spawn utilization;
- revision-aware statistical aggregates;
- quality/privacy release policy for public-safe aggregates.

Atlas must not consume raw private telemetry when a privacy-safe aggregate can answer the product question.

### 2.3 Oteryn-Atlas owns projection, presentation and labelled estimates

Atlas may:

- validate and project accepted Game exports;
- build deterministic search/spatial indexes;
- render hunt geometry/routes/creature and item relations;
- compare compatible measured cohorts;
- derive explicitly labelled estimates or recommendation scores from accepted inputs;
- expose provenance, quality and uncertainty.

Atlas may not transform an estimate into a fact by presentation.

---

## 3. User-facing trust classes

Every hunt datum shown to a user must resolve to one of these classes:

| Class | Meaning | Example |
| --- | --- | --- |
| `VERIFIED` | Authoritative Game-owned fact or accepted factual Game export | geometry, entrance, creature/spawn relation, access requirement |
| `MEASURED` | Aggregate observed by Game Intelligence | median player XP/h for a defined cohort |
| `ESTIMATE` | Atlas-derived calculation from verified/measured inputs | expected range for the user's profile, equal-share loot scenario |
| `UNKNOWN` / `UNAVAILABLE` | Insufficient, absent, blocked or incompatible evidence | no current-revision cohort with enough publishable data |

`MEASURED` values must always carry enough context to prevent false precision: cohort, time base, sample evidence, revision scope, time window and quality/confidence state.

---

## 4. Domain model

### 4.1 Hunt Area

Hunt Intelligence requires an explicit Game-owned hunt catalog concept. The implementation may name the source object `HuntArea`, `HuntDefinition` or another accepted schema name, but it must not redefine the existing spatial hierarchy from ADR-0005.

A hunt object references authoritative spatial/content primitives rather than replacing them:

```text
World
  Area / Subarea / EncounterZone / Zone
        ^
        | referenced by
        |
  HuntDefinition
        +-- floor geometry refs
        +-- entrance/access refs
        +-- spawn-group refs
        +-- creature refs
        +-- requirement refs
        `-- authored route refs

World
  Region -> Chunk              (technical partitioning)
```

The first accepted contract should support at least:

```text
hunt_id                 stable namespaced identity
name / localization key
area_refs
subarea_refs
encounter_zone_refs     optional
floor_geometry_refs
entrance_refs
spawn_group_refs
creature_refs
requirement_refs
route_refs              optional
content_revision
publication/provenance metadata
```

A hunt may span multiple floors and may intersect multiple technical chunks.

### 4.2 Route guides

Route coordinates are Game-owned coordinates. Repository-published route geometry must therefore come from an accepted Game export or another explicitly accepted source contract; Atlas must not silently author world coordinates as if they were Game facts.

A route should support:

- stable route identity;
- objective/type (`rotation`, `access`, `refill`, or another accepted vocabulary);
- ordered nodes/segments;
- explicit floor transition edges;
- optional pull/box/waypoint semantics only when authored;
- source/provenance class;
- content revision compatibility.

User-local routes can be a later feature, but must remain user annotations rather than Game truth.

### 4.3 Hunt cohort

A measured result is meaningful only inside a sufficiently specific cohort. The analytics contract must preserve at least the dimensions that materially affect outcome when available:

```text
hunt_id
content_revision
ruleset_revision
server_build or compatible release bucket
window_start / window_end
party_size
party_composition
shared_experience_state
player_vocation_or_class
player_role where distinct
player_level_band
party_level_distribution/band
equipment_power_band where privacy/quality permit
skill/power band where privacy/quality permit
active modifiers/bonuses/events when authoritative
sessionization_policy_revision
valuation_policy_revision
quality_policy_revision
```

Do not collapse dimensions merely to make the UI populated. Cohort widening is allowed only through an explicit, reproducible fallback policy and must reduce the displayed confidence/quality.

### 4.4 Three performance scopes

#### PLAYER

Answers: *what does a participant actually receive, spend and risk?*

Candidate measures:

- player awarded XP/hour;
- personal supply cost/hour;
- personal realized/allocated loot value/hour when attribution is authoritative;
- personal net profit/hour when the allocation semantics are proven;
- deaths per player-hour;
- damage/healing/consumable pressure where product-relevant.

#### PARTY

Answers: *how much does the whole team produce and consume?*

Candidate measures:

- sum of XP actually awarded to party members/hour;
- base creature XP defeated/hour when separately useful for spawn throughput;
- team gross loot value/hour;
- team supply cost/hour;
- team net value/profit/hour under a named valuation policy;
- kills/hour and creature mix;
- wipe/team-death metrics;
- party composition and shared-experience state.

#### HUNT AREA

Answers: *how is the spawn being utilized and where does additional party size stop helping?*

Candidate measures:

- kill throughput by comparable party cohort;
- spawn utilization and monster lifetime/kill rate where Game Intelligence exposes them;
- area occupancy/load distribution;
- team throughput curve by party size/composition;
- per-player yield curve by party size/composition;
- objective-specific saturation/marginal-gain estimates;
- objective-specific optimal party-size recommendation when statistically supportable.

There is no context-free `optimal party size`. The objective must be named, for example `max player XP/h`, `max player profit/h`, or `max team throughput`.

---

## 5. Time-base semantics

Time-base ambiguity can distort hunt comparisons as much as party size. The analytics contract should retain distinct durations where deterministically available:

```text
trip_wall_seconds       end-to-end outing including travel/refill where defined
hunt_wall_seconds       wall-clock interval attributed to the Hunt Area
active_hunt_seconds     qualifying active hunting time
combat_seconds          time classified as combat by a versioned policy
travel_seconds          attributable travel time where defined
refill_seconds          attributable refill time where defined
downtime_seconds        remaining classified idle/down time where defined
```

The exact sessionization rules belong to Game Intelligence and must be versioned (`sessionization_policy_revision`). Do not hard-code undocumented grace periods in Atlas.

Atlas should prefer two clearly named rates when both exist:

- **Active hunt rate** — output divided by `active_hunt_seconds`;
- **End-to-end/session rate** — output divided by a broader wall-clock denominator.

A user must not be shown a combat-only rate as if it represented the complete session.

---

## 6. Experience semantics: solo versus party

Party experience must never be normalized by blindly dividing one team number by player count.

The authoritative event/aggregate model should distinguish, where available:

```text
player_awarded_xp
party_awarded_xp_sum
base_creature_xp_defeated
shared_experience_state
party_bonus/modifier identity
```

Rules:

1. **Player XP/h** uses XP actually awarded by the authoritative server to that player.
2. **Party awarded XP/h** is the sum of actual awarded XP for included members over the same defined denominator.
3. **Base creature XP defeated/h** is a separate spawn-throughput measure and must not be labelled as awarded player/team XP.
4. Shared-experience bonuses remain part of the actual server-award path; Atlas must not reverse-engineer them by division.
5. Cross-mode ranking should compare the user's relevant player metric against compatible player cohorts, not raw team throughput.
6. `XP/player-hour` may be published as an efficiency aggregate when analytically useful, but it is not a substitute for the actual per-player distribution.

Example interpretation:

```text
Solo RP cohort:
  median player XP/h = 6.0m

Four-player cohort:
  median party awarded XP/h = 30.0m
  median RP player XP/h = 7.4m
```

The fact that `30.0m > 6.0m` is not a valid reason by itself to rank the party mode as five times better for one player.

---

## 7. Loot, supply cost and profit semantics

Profit is only meaningful when valuation and allocation semantics are explicit.

### 7.1 Valuation

Every value-bearing aggregate must identify a valuation policy/revision, for example:

- NPC sell value;
- trusted market value;
- accepted mixed policy.

Atlas must not silently mix valuation policies across cohorts.

### 7.2 Team value

When authoritative inputs exist:

```text
team_gross_loot_value
team_supply_cost
team_other_explicit_cost
team_net_value = team_gross_loot_value - team_supply_cost - team_other_explicit_cost
```

### 7.3 Player value

`player_net_profit` is `MEASURED` only when Game/analytics can establish the player's actual allocated/realized share with sufficient semantics.

If only team loot is known, Atlas may show:

- verified/measured `team_net_value`;
- an **ESTIMATE** such as an equal-share scenario;
- personal supply cost when measured.

It must not label an assumed equal split as measured personal profit.

---

## 8. Statistical publication contract

A headline metric is a distribution summary, not one cherry-picked session.

For every publishable measured cohort, the aggregate should carry where applicable:

```text
sample_sessions
sample_player_hours
sample_team_hours
window_start
window_end
median
p25 / p75
p10 / p90 when quality permits
quality_state
quality_policy_revision
suppression_reason when unavailable
revision scope
```

Recommended presentation:

```text
6.2–6.8m XP/h expected observed range
median 6.5m
1,842 sessions
RP 450–550 · solo
current content/ruleset revision
last 30 days
quality HIGH
```

The exact release thresholds for `LOW/MEDIUM/HIGH`, minimum cell size, minimum player-hours and outlier handling must be owned by a versioned Game Intelligence/publication policy. This design intentionally does **not** invent arbitrary thresholds.

### 8.1 Required statistical safeguards

- default to robust summaries such as median/IQR instead of mean-only reporting;
- retain sample size and exposure time;
- retain current revision scope;
- avoid combining incompatible party compositions;
- prevent duplicate counting of the same hunt session/member observation;
- document any winsorization/outlier filtering in a policy revision;
- small/private cells must be suppressed rather than exposed;
- no recommendation should imply more precision than the input cohort supports.

---

## 9. Revision and freshness model

Measured results must be revision-aware because a balance/content change can invalidate historical comparability.

Default Atlas behavior:

1. current `content_revision` + current `ruleset_revision` first;
2. do not mix historical revisions into the headline current metric by default;
3. preserve historical cohorts for explicit `before / after` analysis;
4. show the data window and freshness;
5. if intentional cross-revision pooling is ever supported, disclose it and use an accepted compatibility policy.

This enables truthful views such as:

```text
Revision 147 -> 148
player XP/h      +11.8%
player profit/h   -4.1%
deaths/100h      +23.0%
```

Only statistically supportable deltas should be published.

---

## 10. Spawn saturation and party-size analysis

Hunt Intelligence should eventually measure the point at which adding players stops producing proportional benefit.

The first implementation should remain empirical and explainable:

1. form comparable cohorts by hunt/revision/composition/level/power dimensions;
2. calculate team throughput distributions by party size;
3. calculate per-player yield distributions by party size;
4. compare adjacent, sufficiently compatible cohorts;
5. expose marginal gain only when quality policy allows publication.

Example output:

```text
Team throughput (comparable cohort)
1 player   6.0m awarded XP/h
2 players 13.0m
3 players 19.0m
4 players 20.0m

4th-member marginal team gain: ~5% (MEASURED/DERIVED, quality HIGH)
```

Do not infer that the fourth member is globally useless: profit, safety, task completion or a different composition may have a different optimum.

A more advanced regression/model may be introduced later only with reproducible training/evaluation, revision-awareness and explainable uncertainty. It is not required for the first version.

---

## 11. “Best Hunt for Me” recommendation model

### 11.1 Inputs

Initial user inputs can be manual and local:

```text
vocation/class
level
solo/duo/party plan
party composition when known
equipment/power band when available
objective: EXP / PROFIT / BALANCED / BESTIARY / another accepted objective
minimum profit or safety preference
location/access constraints
```

Future account-linked values may come from an explicit authorized Game/Platform contract. Atlas must not guess private character state.

### 11.2 Candidate selection

The recommender must:

1. filter to authoritative Hunt Areas compatible with access/content constraints;
2. select measured cohorts matching current revisions;
3. prefer exact party size/composition and player role/vocation;
4. apply deterministic cohort widening only when exact data is insufficient;
5. reduce confidence for every material widening step;
6. return `UNAVAILABLE` rather than fabricate a precise estimate when evidence is inadequate.

### 11.3 Output

Prefer ranges and explanations over a fake-precise score:

```text
Expected for your RP profile
XP/h: 6.1–6.7m
profit/h: 620–790k
risk: LOW–MEDIUM
quality: HIGH
basis: 1,842 comparable sessions, current revision
```

A ranking/match score may be shown, but it must be deterministic, versioned, explainable and subordinate to the underlying metrics/uncertainty.

---

## 12. Privacy and public-release rules

Atlas receives public-safe aggregates, not a player-tracking feed.

Mandatory rules:

- no character names, raw player GUIDs, item-instance IDs or session identifiers in browser publications;
- no unnecessary precise movement history;
- use aggregate Area/Subarea/HuntArea geography by default;
- suppress small cohorts under the accepted privacy-release policy;
- ensure a single player's session cannot be reconstructed from public shards;
- separate operational observability from player-linked analytics as required by ADR-0006;
- public analytics output must be reproducible from a versioned aggregate/release pipeline and carry privacy/quality policy identity.

Security/investigation telemetry is not an Atlas data source.

---

## 13. Proposed cross-repository contracts

Names below are design candidates. The implementing agent must reconcile them with current repository conventions before freezing schemas.

### 13.1 Game -> Atlas Hunt Catalog

Logical capability: `hunt-catalog-v1`.

Illustrative shape:

```json
{
  "schema": "oteryn-game-atlas-hunt-catalog-v1",
  "content_revision": "...",
  "hunts": [
    {
      "hunt_id": "oteryn:hunt.example",
      "name_key": "hunt.example.name",
      "area_refs": ["..."],
      "subarea_refs": ["..."],
      "floor_geometry_refs": ["..."],
      "entrance_refs": ["..."],
      "spawn_group_refs": ["..."],
      "creature_refs": ["..."],
      "requirement_refs": ["..."],
      "route_refs": ["..."]
    }
  ]
}
```

Do not duplicate creature/item/spawn facts already owned by a shared projection contract. Prefer stable references.

### 13.2 Game Intelligence -> Atlas Hunt Performance

Logical capability: `hunt-performance-v1`.

Illustrative shape:

```json
{
  "schema": "oteryn-game-atlas-hunt-performance-v1",
  "generated_at": "...",
  "quality_policy_revision": "...",
  "privacy_policy_revision": "...",
  "cohorts": [
    {
      "hunt_id": "oteryn:hunt.example",
      "content_revision": "...",
      "ruleset_revision": "...",
      "window": {"start": "...", "end": "..."},
      "cohort": {
        "party_size": 4,
        "party_composition": ["..."],
        "player_vocation": "...",
        "player_level_band": "...",
        "shared_experience_state": "..."
      },
      "sample": {
        "sessions": 0,
        "player_hours": 0,
        "team_hours": 0,
        "quality_state": "INSUFFICIENT"
      },
      "player_metrics": {},
      "party_metrics": {},
      "area_metrics": {}
    }
  ]
}
```

The producer must omit/suppress private or insufficient cells rather than publish zeros that can be mistaken for measured performance.

### 13.3 Atlas publication

Atlas should compile accepted upstream data into bounded, integrity-checked browser publications such as:

```text
data/hunts/index.json
  -> summary/search index
  -> per-hunt detail shards
  -> spatial/floor geometry refs
  -> route refs
  -> performance summary shards
```

Exact paths/formats remain an implementation decision. Follow current Atlas content-addressing, size bounds, hash/digest and fail-closed loader conventions.

---

## 14. Integration with Item & Spawn Explorer (#114)

Hunt Intelligence must reuse shared primitives rather than create a second creature/item/spawn stack.

Shared concerns should include:

- creature identity and presentations;
- spawn positions/areas and map LOD;
- item identity and loot-source relations;
- drop probability/quantity contracts where authoritative;
- map camera/floor transforms;
- inspector/deep-link conventions;
- provenance/trust labels.

#114 answers *what drops this and where are its sources?* Hunt Intelligence answers *how does a defined hunt perform for this player/party and how should it be navigated?*

The two features should deep-link to one another.

---

## 15. Atlas UX design

### 15.1 Entry point

Add a first-class `Hunts` / `Hunt Intelligence` mode integrated with FullWorld rather than a disconnected static page.

### 15.2 Hunt Finder

Filter dimensions should be backed by authoritative or measured data and may include:

- level/profile band;
- vocation/class;
- solo / duo / party size;
- party composition;
- EXP target;
- profit target;
- risk preference;
- monster/content preference;
- access requirement state when known;
- location/region;
- objective (`EXP`, `PROFIT`, `BALANCED`, `BESTIARY`, etc.).

Unavailable dimensions remain disabled/omitted instead of guessed.

### 15.3 Result card

A compact card should separate scopes visually:

```text
HUNT NAME
Area · floors · access

For your profile     6.1–6.7m XP/h   ESTIMATE · HIGH
Measured cohort      median 6.5m      1,842 sessions
Profit/player        620–790k/h       ESTIMATE/MEASURED as applicable
Party throughput     29–32m/h         MEASURED
Risk                 deaths/100 player-hours + qualitative band
```

Do not put team loot next to a per-player XP number without scope labels.

### 15.4 Hunt detail

Recommended tabs/sections:

- **Overview** — suitability, profile match, summary metrics and provenance;
- **Map** — authoritative geometry, entrances, floors and route;
- **Monsters** — shared creature/spawn details;
- **Loot / Economy** — valuation policy, team/player scope and #114 links;
- **Route** — floor-aware ordered route/rotation if authoritative;
- **Requirements** — access/quest/item requirements;
- **Performance** — cohort distributions, player/party/area scopes, revision/time window;
- **History / Reports** — before/after revision comparisons when available.

### 15.5 Map behavior

- selecting a hunt zooms to authoritative geometry;
- floor-aware route nodes switch/indicate floors predictably;
- far zoom uses area/heat/cluster presentation rather than hundreds of equal-size sprites;
- medium zoom may show route/entrance/spawn clusters;
- near zoom reuses verified creature/spawn presentations;
- all overlays share the exact FullWorld camera/floor transform;
- pan/zoom/floor/resize/history interactions must not drift.

### 15.6 Compare Hunts

Comparison must compare compatible scope/cohort/time/revision semantics. If two cards are not directly comparable, Atlas must say why.

Candidate rows:

```text
player XP/h
player profit/h
team throughput
team net value
risk/deaths
travel/refill overhead
sample quality
freshness
```

---

## 16. Runtime and performance architecture

Do not ship raw telemetry to the browser.

Preferred pipeline:

```text
Oteryn authoritative runtime
        |
        +--> Game world/content exporter -------------------+
        |                                                   |
        `--> Game Intelligence aggregate/release pipeline --+
                                                            |
                                                            v
                                              Atlas verifier/compiler
                                                            |
                                     content-addressed bounded shards
                                                            |
                                                            v
                                               FullWorld browser runtime
```

Requirements:

- summary index remains bounded and lazy;
- detail/performance data loads by selected hunt/cohort/window;
- spatial data uses existing floor/chunk/viewport indexing where possible;
- route/geometry payloads have explicit count/byte bounds;
- all upstream publications have schema/revision/digest validation;
- malformed, incompatible or oversized resources fail closed;
- unavailable analytics must not disable authoritative Hunt Area navigation;
- performance-panel failure must degrade independently from the base map and creature/item layers.

---

## 17. Implementation phases

### Phase 0 — live preflight and contract reconciliation

- refresh Atlas and Game `main` from GitHub;
- read root/near-path `AGENTS.md`;
- inspect Issue #117, #114, #85 and material open PRs;
- inspect current world/content and analytics implementation status;
- create/update the required Game lifecycle Issue if Game mutations are needed;
- freeze exact base SHAs before mutation.

### Phase 1 — source contracts

- define/finalize Game-owned Hunt Area/catalog model without duplicating ADR-0005 geography;
- define authoritative route/access references;
- define Game Intelligence public-safe cohort/metric contract;
- define privacy/quality/suppression/revision semantics;
- add schema/contract fixtures and negative cases.

Checkpoint: no Atlas UI implementation may assume fields that the accepted producer contract does not publish.

### Phase 2 — Game producers

- implement canonical Hunt Area/content export where missing;
- implement public-safe analytics aggregate release where the Game Intelligence foundation supports it;
- emit explicit `UNAVAILABLE`/absence rather than synthetic measured data before sufficient telemetry exists;
- make output deterministic, versioned, bounded and testable.

### Phase 3 — Atlas compiler/projection

- validate Game publications;
- create summary/search/spatial/detail/performance indexes;
- reuse #114 creature/item/spawn primitives;
- preserve provenance, revision, sample and trust class;
- add corruption/incompatibility/suppression tests.

### Phase 4 — Hunt Finder and map UX

- implement Hunt mode/search/filtering;
- hunt result cards and detail inspector;
- authoritative map geometry/entrances/floors/routes;
- monster/item/spawn cross-links;
- URL/deep-link/history/reload/mobile behavior.

### Phase 5 — measured performance UI

- player/party/area scoped metrics;
- robust distributions and quality context;
- current vs historical revision views;
- compare compatible cohorts;
- independent fail-closed unavailable state.

### Phase 6 — personalized recommendation

- deterministic cohort matching and widening policy;
- `Best Hunt for Me` ranges and reason/explanation surface;
- objective-based ranking;
- explicit confidence downgrade and `UNAVAILABLE` path;
- no ML requirement for v1.

### Phase 7 — saturation intelligence

- empirical comparable-cohort curves;
- marginal gain and objective-specific optimum only when quality permits;
- no global party-size claim from incompatible samples.

### Phase 8 — verification, integration and closeout

- applicable unit/contract/property tests;
- Game -> Atlas integration tests;
- real Chromium desktop/mobile E2E;
- geometry/transform/render synchronization verification;
- malformed/missing/partial/suppressed-data cases;
- URL/history/reload cases;
- performance/stress limits;
- targeted visual/accessibility acceptance;
- exact-head protected gates;
- full diff review;
- squash merge and branch cleanup;
- live deployment/acceptance only from merged Atlas `main` under existing policy.

---

## 18. Parallel execution model

The programme may use parallel agents **only after the shared source/data contract checkpoint is stable**.

Safe post-contract workstreams:

1. **Game World/Content** — Hunt Area/catalog/route producer.
2. **Game Intelligence** — session/cohort/aggregate/public-release producer.
3. **Atlas Projection** — validation/compiler/index/shards.
4. **Atlas UX** — Finder/detail/map/compare/recommendation UI against frozen fixtures/contracts.
5. **Verification** — independent contract/geometry/E2E/performance/visual depth.

Each repository mutation still follows its own Issue -> branch -> PR lifecycle. Cross-repository coordination may not collapse two authorities into one branch or one mutable task packet.

---

## 19. Verification matrix

### Logic / unit

Must cover at least:

- player versus party rate calculations;
- no naive XP division path;
- active versus wall-clock denominators;
- profit/value policies and missing allocation semantics;
- cohort identity/canonicalization;
- cohort compatibility/widening;
- revision compatibility;
- robust range/percentile presentation logic;
- saturation marginal-gain calculations;
- recommendation scoring/ordering/ties;
- `INSUFFICIENT`/suppressed/missing data;
- invalid/zero/negative duration and numeric bounds.

### Contract / provenance

Must cover:

- Game Hunt Catalog schema and stable references;
- Game Intelligence performance schema;
- privacy-suppressed cells;
- digest/root/revision validation;
- corrupt, missing, oversized and incompatible resources;
- no TibiaRoute/wiki/legacy runtime fallback;
- no duplicate creature/item/spawn authority relative to #114.

### Browser / E2E

Must cover desktop and mobile workflows for:

- entering Hunt mode;
- filtering by profile/party/objective;
- selecting a hunt and zooming to geometry;
- floor-aware route navigation;
- opening monsters/items/shared inspector data;
- comparing hunts;
- changing recommendation profile;
- unavailable/suppressed analytics;
- revision-history view where implemented;
- URL/deep-link/history/reload persistence;
- strict console/page/network error handling.

### Geometry / renderer

Must prove map overlays remain world-anchored under:

- pan;
- zoom/button/wheel/anchor zoom;
- resize and DPR changes;
- floor switches;
- view-mode transitions;
- route and creature/spawn layer toggles;
- mobile drawer transitions.

### Performance / stability

Measure and bound:

- hunt summary index size/load;
- detail/performance shard size/load;
- filter/search latency under representative catalog size;
- route/area overlay render cost;
- cache growth/eviction;
- repeated hunt switching;
- stress sequences integrated with #85 infrastructure.

---

## 20. Explicit non-goals

- no runtime scraping of TibiaRoute, wikis or community sites;
- no copying another site's static hunting-place database as product authority;
- no inference of XP/profit from map pixels or geometry;
- no raw player telemetry in Atlas browser publications;
- no automatic game-balance mutation from analytics;
- no pretending team loot is personal profit;
- no pretending raw team XP is player XP;
- no mixing incompatible solo/duo/party cohorts to improve sample size silently;
- no cross-revision headline metric without an explicit compatibility policy;
- no fabricated live occupancy, boosted creature, event or spawn state;
- no model/AI recommendation whose training/evaluation/provenance cannot be reproduced.

---

## 21. Definition of Done

The implementation programme is complete only when all applicable items are true:

- Game owns and publishes the required Hunt Area/content facts through an accepted contract;
- analytics ownership and public-safe aggregate release are explicit and revision-aware;
- Atlas consumes only accepted derived publications;
- PLAYER/PARTY/HUNT AREA scopes are separate in contracts, calculations and UI;
- solo/duo/party comparisons use compatible cohorts and actual server-awarded XP semantics;
- profit semantics distinguish team value, personal cost and actual versus estimated allocation;
- measured values carry sample, time, revision and quality context;
- small/unsafe cohorts are suppressed;
- Hunt Finder, map, detail, route, compare and recommendation workflows function on desktop/mobile for the data that actually exists;
- #114 primitives are reused rather than duplicated;
- missing analytics degrades to `UNAVAILABLE` without breaking verified hunt navigation;
- all shipped behavior has the deep applicable verification required by #85 and `AGENTS.md`;
- exact final heads are reviewed and protected gates pass;
- merged branches are cleaned up;
- live Atlas acceptance, if part of the implementation delivery, is performed only from the exact merged `main` revision.

---

## 22. Execution alias

Run the implementation prompt stored at:

`docs/agents/prompts/ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION.md`

Alias:

`ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`
