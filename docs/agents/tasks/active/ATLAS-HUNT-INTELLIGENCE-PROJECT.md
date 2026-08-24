# Oteryn Atlas — Hunt Intelligence implementation project

Status: DESIGN / EXECUTION CONTRACT v2 — HARDENED ATLAS-ONLY PROGRAMME

Lifecycle authority: `Oteryn/Oteryn-Atlas#117`

Parent programme: `Oteryn/Oteryn-Atlas#11`

Verification policy: `Oteryn/Oteryn-Atlas#85`

Related capabilities:

- `Oteryn/Oteryn-Atlas#113` — creature click/tap, hit testing, selection and contextual cards;
- `Oteryn/Oteryn-Atlas#114` — Item & Spawn Explorer / farm estimates;
- `Oteryn/Oteryn-Atlas#115` — canonical creature presentation bounds, labels and NPC badges.

Execution alias: `ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`

Hardened design baseline: Atlas `main@3618bf5614c31b91e6846083066be8d77385eea2`.

`Oteryn-Game` remains canonical World/Content authority and the architectural source for Game Intelligence. For this programme it is **READ-ONLY**. This document may describe required future upstream semantics, but it does not authorize any mutation of `Oteryn/Oteryn-Game`.

Issue #117 is the mutable lifecycle/status authority. This document is the technical design and execution contract and must not become a second mutable status database.

---

## 1. Product decision

Oteryn Atlas will implement **Hunt Intelligence** as a first-class FullWorld capability rather than a static hunting-place directory.

The target answers four questions:

1. **Where can I hunt?** — authoritative Hunt Areas, floors, entrances, requirements and creature/spawn relations when Game publishes them.
2. **How do I use the hunt?** — authoritative route/access guidance, shared FullWorld creature/item/spawn primitives and floor-aware navigation.
3. **How does the hunt actually perform?** — privacy-safe measured aggregates only when an accepted Game Intelligence publication exists.
4. **How is it likely to perform for my selected profile/party?** — deterministic Atlas estimates based on compatible measured cohorts, with explicit uncertainty.

There is no single universal `EXP/h`, `profit/h`, `best party size` or `best hunt` fact. The product models three scopes independently:

- **PLAYER** — what one participant actually receives, spends and risks;
- **PARTY** — what the team collectively produces and consumes;
- **HUNT AREA** — how the area/spawn is utilized and where additional load stops producing proportional benefit.

The feature must remain useful before measured analytics exists: VERIFIED hunt navigation may ship independently, while MEASURED / ESTIMATE panels remain `UNAVAILABLE` until the required accepted upstream evidence exists.

---

## 2. Owner restriction: no Oteryn-Game mutation

This is a hard programme rule.

### Allowed against `Oteryn/Oteryn-Game`

- read repository metadata, current `main`, ADRs, contracts and source;
- inspect existing accepted public-safe Game -> Atlas exports;
- inspect existing Game Intelligence architecture/status/publications;
- cite exact Game revisions as provenance;
- record an **Atlas-side** `UPSTREAM_REQUIREMENT` or `UPSTREAM_BLOCKED` note describing what Atlas needs in the future.

### Forbidden against `Oteryn/Oteryn-Game`

- create/update/close Issue;
- create/update/delete branch or tag;
- create/update file;
- create commit;
- create/update/merge PR;
- add a comment/review/reaction;
- alter workflow, contract, code, schema or docs;
- push local changes;
- activate or allocate `OTV2-IMPL-ANALYTICS` or any other Game lane.

If the required upstream capability does not exist, Atlas must remain fail-closed for that capability. The implementation must not invent a Game contract merely to populate UI.

The only durable notes created by this programme belong in `Oteryn/Oteryn-Atlas`.

---

## 3. Authority and trust boundaries

### 3.1 Oteryn-Game — external read-only authority

Game is the only authority for Game-owned facts, including where published:

- stable world/content identities;
- world/profile/revision identity;
- coordinates, floors, transitions and geometry;
- Area/Subarea/Zone/EncounterZone semantics;
- spawn definitions and creature identity;
- items, loot definitions and NPC value;
- access/quest requirements;
- authored route nodes/segments;
- gameplay event semantics;
- server-awarded XP and authoritative economy mutations.

Atlas cannot repair missing upstream facts.

### 3.2 Oteryn Game Intelligence — future/optional measured source

Game Intelligence is observational/analytical and must not become gameplay authority. Atlas may consume its public-safe aggregates only when an accepted producer/publication exists.

This Atlas design records the **consumer requirements** for such a publication. These requirements are not themselves a Game contract.

### 3.3 Oteryn-Atlas — projection, presentation and estimates

Atlas may:

- validate accepted upstream publications;
- build deterministic search/spatial indexes;
- render Hunt Areas/routes using accepted coordinates;
- reuse creature/item/spawn primitives;
- compare semantically compatible measured cohorts;
- derive labelled estimates/recommendations;
- expose provenance, statistical quality, freshness and uncertainty.

Atlas may not transform `ESTIMATE`, test fixtures or illustrative values into a factual Game or measured claim.

---

## 4. User-facing state vocabulary

Every user-visible field must resolve to both a **trust class** and an **availability state**.

### Trust class

| Class | Meaning |
| --- | --- |
| `VERIFIED` | accepted Game-owned fact / accepted factual Game export |
| `MEASURED` | accepted Game Intelligence aggregate with sample/time/revision/quality context |
| `ESTIMATE` | deterministic Atlas-derived calculation from accepted inputs |
| `UNKNOWN` | semantic truth is not known |

### Availability state

| State | Meaning |
| --- | --- |
| `AVAILABLE` | usable for the requested presentation |
| `UPSTREAM_BLOCKED` | required Game/Game Intelligence publication does not exist or is not accepted |
| `INSUFFICIENT` | data exists but statistical evidence is insufficient |
| `SUPPRESSED` | privacy/release policy forbids publication |
| `INCOMPATIBLE` | revisions/cohorts/valuation/time bases cannot be compared truthfully |
| `MALFORMED` | publication exists but fails schema/integrity bounds |
| `STALE` | publication is outside the accepted freshness policy |

`0` is a numeric value, never a substitute for any unavailable state.

---

## 5. Shared Atlas primitive ownership

Hunt Intelligence must not fork or duplicate existing FullWorld interaction/presentation infrastructure.

### #115 owns canonical creature presentation geometry

When available, Hunt Intelligence reuses:

- canonical CSS-pixel creature presentation bounds;
- committed transform linkage;
- DPR-correct geometry;
- label/badge layout diagnostics.

It must not create a second creature-bounds calculation.

### #113 owns interaction and selection

When available, Hunt Intelligence reuses:

- creature hit testing;
- hover/selection state;
- `creature=` URL identity;
- contextual creature card anchoring;
- overlap resolution;
- inspector synchronization.

Hunt Intelligence must not create a second creature selection model or independent click handlers.

### #114 owns Item & Spawn Explorer primitives

Hunt Intelligence reuses:

- item identity;
- creature -> item/drop-source relations;
- spawn position/area identity;
- drop probability/quantity semantics where authoritative;
- map LOD/cluster primitives;
- item/spawn inspector/deep-link conventions;
- static farm-estimator semantics.

Measured KPH / player-party-hunt performance belongs to #117 and must not be copied back into #114 as a competing analytics stack.

### Dependency gate

Before Hunt UI work touches shared surfaces, the implementation must resolve live #113/#114/#115 status and exact merged seams.

If a required seam is still in-flight:

- continue only on disjoint Hunt data/contract/index work;
- do not duplicate the missing seam;
- integrate after the owning capability is merged or after an explicit shared contract is available.

---

## 6. Hunt domain consumer model

Hunt Intelligence requires a stable Game-owned hunt identity when Game eventually publishes it. Atlas must not invent production Hunt Areas from pixels, arbitrary polygons or community pages.

A consumer-visible hunt record should be capable of referencing:

```text
hunt_id
name/localization identity
world/profile compatibility
area_refs
subarea_refs
encounter_zone_refs       optional
floor_geometry_refs
entrance/access_refs
spawn_group_refs
creature_refs
requirement_refs
route_refs                 optional
content_revision
source/provenance
```

A hunt can span multiple floors/chunks. It must not be forced into the technical `Region -> Chunk` hierarchy.

If no accepted upstream Hunt Catalog exists, production Atlas must classify the catalog `UPSTREAM_BLOCKED`; deterministic fixtures may exercise loaders/UI only in tests.

---

## 7. World, profile, channel and instance scope

Analytics and valuation must never silently pool incompatible worlds.

Every measured performance identity must preserve, as applicable:

```text
world_id
world_profile_revision / profile_family
content_revision
ruleset_revision
channel_aggregation_scope
instance_scope / instance_kind
server_build_or_compatibility_bucket
```

Rules:

1. reference/evolved or otherwise incompatible profile families never share headline cohorts;
2. multiple channels of the same logical world may be aggregated only under an explicit channel aggregation policy;
3. instanced and non-instanced hunts are not pooled unless an accepted compatibility policy says they are equivalent;
4. valuation is world-scoped when market prices are world-scoped;
5. historical revision data is never silently substituted for current revision evidence.

---

## 8. Hunt attribution and exposure segmentation

A full login/session is not automatically one hunt sample.

### 8.1 Hunt attribution policy

Game Intelligence, when implemented by its owning programme, must have a versioned policy that determines when gameplay exposure belongs to a Hunt Area. Atlas consumes only the resulting aggregate identity.

The policy may consider authoritative facts such as:

- Hunt Area membership;
- dwell/exposure time;
- monster kills/attribution;
- combat activity;
- floor/geometry membership;
- transitions between hunts.

Atlas must not invent fixed grace periods or classify raw movement itself.

Required aggregate provenance field:

`hunt_attribution_policy_revision`

### 8.2 HuntExposureSegment concept

One outing can contain multiple analytically distinct segments. A future upstream aggregate should be able to split exposure when a material cohort dimension changes, including:

- hunt identity;
- party membership/size/composition;
- shared-experience state;
- world/channel/instance scope;
- content/ruleset revision;
- material temporary modifiers;
- player role/vocation where mutable;
- level/power bucket when a bucket boundary is crossed and policy requires it.

Conceptual consumer identity:

```text
exposure_segment_id       never public raw identity
cohort_signature
segment_start/end
segment_duration
segment policy revision
```

Raw segment/session IDs do not reach the public browser publication.

---

## 9. Cohort identity

A measured result is meaningful only inside a sufficiently specific cohort.

Conceptual material dimensions:

```text
hunt_id
world_id
world_profile_revision
content_revision
ruleset_revision
server/release compatibility bucket
window_start/window_end
party_size
party_composition
shared_experience_state
player_vocation/class/role
player_level_band
party_level_distribution/band
equipment_power_band          if privacy/quality permit
skill/power_band              if privacy/quality permit
modifier_bucket
channel_aggregation_scope
instance_scope
hunt_attribution_policy_revision
sessionization_policy_revision
aggregation_policy_revision
valuation_policy_revision
quality_policy_revision
privacy_policy_revision
```

Use a versioned canonical `cohort_signature`/identity over accepted dimensions so equal cohorts are deterministic.

Cohort widening is allowed only through an explicit ordered policy. Every widening step must be recorded and reduce recommendation confidence/quality. Incompatible dimensions may never be widened.

---

## 10. Time semantics

Preserve distinct denominators where the accepted upstream aggregate provides them:

```text
trip_wall_seconds
hunt_wall_seconds
active_hunt_seconds
combat_seconds
travel_seconds
refill_seconds
downtime_seconds
player_exposure_seconds
team_exposure_seconds
```

Atlas should distinguish at least:

- **Active hunt rate** — output / qualifying active hunt time;
- **End-to-end rate** — output / broader trip/session wall time;
- **Exposure-weighted rate** — pooled output / pooled exposure over a cohort.

A combat-only rate must never be labelled as a full-session rate.

---

## 11. XP semantics

Future accepted aggregates should distinguish where available:

```text
player_awarded_xp
party_awarded_xp_sum
base_creature_xp_defeated
shared_experience_state
xp_modifier_bucket
party_bonus/modifier identity
```

Hard rules:

1. player XP uses XP actually awarded by the authoritative server;
2. team XP uses a separately defined team aggregate;
3. base creature XP is spawn throughput, not awarded XP;
4. never derive player XP by dividing team XP by party size;
5. `XP/player-hour` is an additional efficiency measure, not a replacement for player distributions;
6. baseline results do not silently include temporary XP events/boosts.

---

## 12. Temporary modifiers and event segregation

Time-limited effects can materially bias observed performance and therefore are first-class cohort dimensions.

Examples include accepted future equivalents of:

- global XP event;
- personal XP boost;
- creature-specific modifier;
- party/shared-experience modifier;
- temporary loot modifier;
- ruleset/event state.

Default headline behavior:

- use the normal/current baseline modifier bucket;
- never allow past boosted/event samples to inflate normal future recommendations;
- when the user's selected/current context includes an authoritative modifier, prefer a compatible modifier cohort;
- missing modifier provenance degrades or blocks comparability.

---

## 13. Loot, value and profit semantics

### 13.1 Valuation scope

Every value metric must preserve:

```text
valuation_policy_revision
valuation_type               NPC / MARKET / MIXED / other accepted
world_id                      when market-scoped
price_window
price_as_of / generated_at
price_quality_state
liquidity_quality             when available
```

Do not silently mix NPC and market valuation.

### 13.2 Team values

When accepted evidence exists:

```text
team_gross_loot_value
team_supply_cost
team_other_explicit_cost
team_net_value
```

### 13.3 Player values

`player_net_profit` is `MEASURED` only when the actual allocation/realization semantics are accepted and attributable.

If only team loot is measured:

- show team measured value;
- show measured personal costs if available;
- equal-share or another split scenario is `ESTIMATE`;
- never label the split as measured personal profit.

### 13.4 Rare-loot heavy tails

Profit must distinguish short-run realized outcomes from long-run modeled value.

Useful separate concepts:

- `realized_profit_distribution`;
- median/IQR/P10-P90 realized profit where publishable;
- `expected_long_run_loot_value` only when a proven drop model exists (shared with #114);
- `rare_drop_contribution` where a policy can publish it safely.

Atlas should be able to present both:

```text
Measured realized median
Expected long-run value
```

without implying they are the same statistic.

---

## 14. Statistical estimators and weighting

One ten-minute session and one three-hour session must not necessarily carry identical analytical weight.

Where accepted upstream data permits, preserve both:

### Session/segment distribution

```text
median(rate_per_segment_or_session)
p25/p75
p10/p90 when publishable
sample_segments
sample_sessions
```

### Exposure-weighted evidence

```text
pooled_player_rate = sum(player_output) / sum(player_exposure_time)
pooled_team_rate   = sum(team_output) / sum(team_exposure_time)
sample_player_hours
sample_team_hours
```

The UI should not hide which estimator is being shown.

Quality policy should be able to reject trivially short/noisy segments rather than letting them dominate the distribution; exact thresholds belong to the future upstream policy, not Atlas invention.

---

## 15. Telemetry completeness and publication watermarks

Large sample size does not imply high quality if telemetry is incomplete.

A future accepted measured publication should be able to carry quality inputs such as:

```text
complete_through
aggregation_generated_at
ingestion_lag
coverage_state
event_loss_or_drop_state
replay/reconciliation_state
aggregation_policy_revision
```

Hard rule: Atlas must not display `HIGH` quality if completeness is unknown or outside the accepted policy.

A temporarily unhealthy analytics pipeline must degrade measured panels independently from VERIFIED map navigation.

---

## 16. Statistical publication contract

A publishable cohort should carry where applicable:

```text
sample_sessions
sample_segments
sample_player_hours
sample_team_hours
window_start/window_end
median
p25/p75
p10/p90
exposure_weighted_rate
quality_state
quality_policy_revision
privacy_policy_revision
suppression_reason
freshness_state
complete_through
revision scope
```

Requirements:

- robust summaries before mean-only headlines;
- no hidden cross-revision pooling;
- no duplicate counting of the same exposure;
- outlier handling/winsorization only under a versioned reproducible policy;
- small/private cells are suppressed, not zeroed;
- a recommendation may not imply more precision than the cohort supports.

---

## 17. Privacy and differencing resistance

Small-cell suppression alone is insufficient.

The public browser must not receive an arbitrary high-dimensional analytics cube that permits repeated differencing to isolate individuals.

A future Game Intelligence public-release surface should provide only pre-approved/bounded cohort buckets under an accepted policy.

Atlas consumer requirements include:

- no character names or raw player GUIDs;
- no item-instance or raw session/segment IDs;
- no unnecessary precise movement trails;
- fixed/versioned bucket definitions;
- per-actor/per-session contribution limits where required by policy;
- suppression rules that consider neighboring/overlapping slices;
- forbidden unsafe dimension combinations;
- release policy identity;
- public shards that do not permit reconstruction of a single session.

Differential privacy or another formal privacy mechanism can be considered later; v1 does not invent one without a dedicated accepted policy.

---

## 18. Revision and freshness

Default current view:

1. current `world/profile/content/ruleset` compatibility first;
2. current baseline modifier bucket first;
3. accepted fresh time window first;
4. no silent historical backfill;
5. no silent stale price/valuation reuse.

Historical data belongs in explicit history/before-after views and must state revision/time boundaries.

---

## 19. Hunt Area saturation and party-size intelligence

Saturation is empirical and objective-specific.

Only compare compatible cohorts and publish when quality policy permits.

Candidate curves:

- team awarded XP throughput by party size;
- base creature XP / kills throughput by party size;
- per-player XP yield by party size;
- team/personal value outcomes by party size;
- safety/death exposure by party size.

`optimal party size` is invalid without naming the optimization objective.

Marginal gains must not be computed across incompatible composition/modifier/revision cohorts.

---

## 20. Recommender: observational, explainable, deterministic

`Best Hunt for Me` v1 is not a causal engine and not a guarantee.

Its semantic class is:

`OBSERVATIONAL_PREDICTION_FROM_COMPARABLE_COHORTS`

### Inputs

When available/selected:

```text
world/profile
vocation/class/role
level
solo/duo/party plan
party composition
equipment/power band
objective: EXP / PROFIT / BALANCED / BESTIARY / accepted alternatives
risk preference
minimum profit preference
location/access constraints
current modifier context
```

### Candidate algorithm

1. start from VERIFIED hunts compatible with authoritative constraints;
2. select current-revision/current-world measured cohorts;
3. require compatible time base and valuation policy for the objective;
4. prefer exact party/composition/role/modifier matches;
5. widen only through a versioned deterministic policy;
6. reduce confidence for widening, stale data or weaker completeness;
7. rank using an explicit objective-policy revision;
8. return range + evidence basis + reasons;
9. return `INSUFFICIENT`/`UPSTREAM_BLOCKED` instead of fake precision.

### Language

Prefer:

> Estimated from comparable observed cohorts

rather than language implying causal certainty or guaranteed player outcome.

A numerical match score may be secondary only if deterministic, versioned and explainable.

---

## 21. Historical contention versus live occupancy

These are distinct products.

### Historical contention

A privacy-safe future aggregate may describe that a Hunt Area is historically more/less occupied for a coarse time bucket.

### Live occupancy

Live presence/availability is forbidden unless a future explicit authoritative and privacy-safe contract is accepted.

Historical occupancy may never be rendered as "free now" / "occupied now".

---

## 22. Atlas-side expected input interfaces

The names below are **Atlas consumer candidates**, not Game contracts.

### 22.1 Hunt catalog capability

Logical candidate: `hunt-catalog-v1`.

Atlas should validate a future accepted publication for:

- schema/capability identity;
- world/profile/content revision;
- stable Hunt IDs;
- spatial/content references;
- bounds/counts/byte limits;
- provenance/digests;
- deterministic cross references.

If the producer does not exist, classification is `UPSTREAM_BLOCKED`.

### 22.2 Hunt performance capability

Logical candidate: `hunt-performance-v1`.

A future accepted publication should be sufficient to express:

```text
world/profile/revisions
hunt/cohort signature
time window + time base
party/player dimensions
modifier bucket
sample exposures
PLAYER metrics
PARTY metrics
HUNT AREA metrics
valuation identity
quality/privacy policy
completeness/watermark
suppression/incompatibility state
```

Atlas may implement bounded parsing/validation interfaces and test fixtures, but must not treat those fixtures as proof that Game publishes the capability.

---

## 23. Runtime publication architecture

No raw telemetry reaches the browser.

Preferred logical path:

```text
existing accepted Game / Game Intelligence publications (read-only)
                         |
                         v
              Atlas verifier/compiler
                         |
           bounded content-addressed shards
                         |
                         v
              FullWorld browser runtime
```

Requirements:

- bounded summary/search index;
- lazy per-hunt/per-performance shards;
- schema/capability/revision/digest validation;
- route/geometry count and byte bounds;
- bounded cache/eviction;
- malformed/oversized resources fail closed;
- analytics failure never disables VERIFIED map navigation;
- test fixtures are test-only and never copied into production publication paths as measured data.

---

## 24. Atlas UX

### Hunt Finder

Filters appear only when backed by real accepted data.

Candidate filters:

- level/profile band;
- vocation/class/role;
- solo/duo/party;
- composition;
- EXP/profit/risk objective;
- monster/content preference;
- access state;
- location/world;
- modifier context.

### Hunt card

Keep scopes and statistics explicit:

```text
HUNT NAME
world / area / floors / access

For selected profile       ESTIMATE or UNAVAILABLE
Observed comparable cohort MEASURED + sample + freshness
Party throughput           MEASURED (PARTY)
Player profit               MEASURED or ESTIMATE, explicitly labelled
Risk                        exposure-based metric + qualitative band
```

### Hunt detail

Recommended sections:

- Overview;
- Map;
- Monsters;
- Loot / Economy;
- Route;
- Requirements;
- Performance;
- History / Reports;
- Provenance / quality.

### Map

- authoritative geometry only;
- floor-aware routes only when upstream publishes them;
- far LOD: area/cluster/heat presentation;
- medium LOD: route/entrance/spawn grouping;
- near LOD: shared creature/spawn presentation;
- exact FullWorld transform synchronization;
- reuse #113/#115 hit/geometry seams;
- reuse #114 item/spawn LOD where applicable.

### Compare

Compare only compatible:

- trust/scope;
- world/profile/revision;
- time base;
- valuation policy;
- modifier bucket;
- cohort semantics.

If incompatible, explain the reason instead of forcing a ranking.

---

## 25. Implementation order — Atlas-only and dependency-safe

### Phase 0 — GitHub-first preflight

- refresh Atlas `main` and Issue #117;
- inspect #113/#114/#115/#85/#11 and overlapping PRs;
- inspect Game `main` and relevant architecture/publications **read-only**;
- record exact read-only upstream provenance;
- classify each upstream capability `AVAILABLE` or `UPSTREAM_BLOCKED`.

### Phase 1 — shared primitive checkpoint

Resolve the actual merged seams from #113/#114/#115.

Do not duplicate unmerged interaction/presentation/item-spawn infrastructure.

### Phase 2 — Atlas Hunt consumer contracts

Implement/test Atlas-side bounded schemas/parsers/state models for data that already exists or for explicit future capability readiness.

No Game mutation.

No production fake data.

### Phase 3 — VERIFIED Hunt catalog integration

Only if an accepted upstream Hunt Catalog exists:

- compile/index it;
- publish Hunt Finder/search/detail/map/route surfaces supported by real data.

If absent:

- keep product capability `UPSTREAM_BLOCKED`;
- retain test-only contract/UX fixtures;
- do not ship invented hunts.

### Phase 4 — static FullWorld Hunt UX

Implement only the VERIFIED subset actually supported, reusing shared primitives and deep links.

### Phase 5 — analytics readiness

Inspect whether an accepted public-safe Hunt Performance publication exists.

If absent:

- MEASURED panels remain unavailable;
- recommender/saturation remain unavailable;
- record the upstream requirement in Atlas #117/evidence only;
- do not create Game work.

### Phase 6 — MEASURED integration

Only when an accepted upstream publication exists:

- integrate PLAYER/PARTY/HUNT AREA metrics;
- enforce world/revision/time/valuation/modifier compatibility;
- expose completeness/quality/privacy state.

### Phase 7 — recommender

Only when sufficient current comparable measured cohorts exist.

### Phase 8 — saturation/history

Only when sufficient compatible evidence exists.

### Phase 9 — verification and closeout

- exact final diff review;
- unit/contract/property tests;
- real Chromium desktop/mobile;
- geometry/render synchronization;
- malformed/missing/suppressed/incompatible/stale cases;
- performance/stress;
- `atlas-local-e2e`, `atlas-gate`, `provenance-gate`;
- squash merge / branch cleanup.

Atlas deployment remains merged-main-only under existing policy.

---

## 26. Parallel execution model

Parallelize only after the shared primitive/consumer contract checkpoint.

Safe Atlas-only workstreams:

1. **HUNT-ATLAS-CONTRACTS** — schemas/loaders/provenance/failure states;
2. **HUNT-ATLAS-PROJECTION** — compiler/index/shards for real accepted inputs;
3. **HUNT-ATLAS-UX** — Finder/detail/map against frozen interfaces and shared #113/#114/#115 seams;
4. **HUNT-ATLAS-ANALYTICS-CONSUMER** — only if a real accepted measured publication exists;
5. **HUNT-VERIFICATION** — independent logic/geometry/browser/performance/privacy-surface checks.

No workstream may mutate `Oteryn-Game`.

---

## 27. Verification matrix

### Ownership/safety

- any attempted Game write is a programme failure;
- no production test fixture masquerades as Game/measured data;
- no duplicate #113/#114/#115 authority.

### Domain/contract

- world/profile/revision compatibility;
- stable Hunt/cohort identity;
- malformed/missing/oversized/digest mismatch;
- unavailable vs zero;
- suppression vs insufficient vs incompatible;
- route/floor reference validity.

### Exposure/analytics semantics

- party join/leave splits cohort exposure conceptually;
- shared-XP state change splits cohort compatibility;
- modifier change prevents baseline pooling;
- no naive team-XP division;
- active vs end-to-end denominator distinction;
- session-distribution vs exposure-weighted estimator distinction;
- incomplete telemetry cannot qualify as HIGH;
- current vs historical revision selection;
- world-aware market valuation;
- rare-loot realized vs expected-value distinction.

### Privacy

- no raw actor/session IDs in public shards;
- bounded pre-approved cohort dimensions only;
- suppressed cells do not become zeros;
- unsafe adjacent/differencing-prone slices are not exposed by arbitrary client queries.

### Recommender

- observational language/state;
- deterministic widening order;
- confidence degrades with widening/staleness/completeness;
- incompatible cohorts rejected;
- insufficient evidence returns unavailable;
- objective policy/version visible in diagnostics/evidence.

### Browser/E2E

- Hunt entry/filter/select/deep-link/history/reload;
- floor-aware map/route when real data exists;
- creature/item cross links via shared seams;
- unavailable analytics state without breaking map;
- compare incompatibility explanation;
- desktop/mobile/DPR;
- no console/page/network errors beyond narrow expected failure cases.

### Geometry/performance

- pan/zoom/floor/resize/mode synchronization;
- route/area/creature overlay alignment;
- bounded index/shard/cache sizes;
- repeated Hunt switching;
- seeded stress integration with #85.

---

## 28. Explicit non-goals

- no `Oteryn-Game` mutation under this programme;
- no activation/allocation of Game analytics;
- no runtime scraping of TibiaRoute/wiki/community sites;
- no invented Hunt Areas or routes;
- no raw telemetry in browser;
- no inferred live occupancy;
- no automatic balance changes;
- no team-loot-as-player-profit claim;
- no team-XP-as-player-XP claim;
- no silent cross-world/profile/revision/modifier pooling;
- no causal claim from observational recommendations;
- no arbitrary client-side analytics cube;
- no opaque ML requirement for v1.

---

## 29. Definition of Done

The Atlas-side programme is complete only to the extent supported by real accepted upstream capabilities.

Required terminal truths:

- no Game mutation occurred;
- current #113/#114/#115 seams were reused rather than duplicated;
- Atlas consumer contracts distinguish VERIFIED / MEASURED / ESTIMATE and all availability states;
- world/profile/channel/instance scope is explicit;
- exposure segmentation / hunt attribution requirements are explicit;
- PLAYER/PARTY/HUNT AREA remain separate;
- time bases and estimator weighting are explicit;
- modifiers cannot contaminate baseline cohorts silently;
- valuation is world/time/policy-aware;
- rare-loot realized versus long-run expected value is distinct;
- telemetry completeness can gate quality;
- privacy surface is differencing-aware and bounded;
- recommender is explicitly observational and evidence-gated;
- unavailable upstream capability remains `UPSTREAM_BLOCKED`, never fabricated;
- supported Hunt UX passes deep exact-head verification;
- final Atlas PR is squash-merged and branch-cleaned.

A terminal Atlas report must list upstream capabilities individually as `AVAILABLE`, `UPSTREAM_BLOCKED`, `INSUFFICIENT`, `SUPPRESSED`, `INCOMPATIBLE`, `STALE` or `MALFORMED`. It must not claim full measured Hunt Intelligence if the required producer is absent.

---

## 30. Atlas-side upstream requirements note

The following are **suggestions/consumer requirements only**, recorded here so a future separately authorized Game programme can evaluate them without this Atlas task modifying Game:

- accepted Hunt Catalog / route/access publication;
- public-safe Hunt Performance aggregate;
- `world_id`/profile/revision scoping;
- hunt attribution policy revision;
- exposure segmentation/cohort signature;
- awarded-player XP versus team/base throughput separation;
- time-base and exposure semantics;
- modifier/event segregation;
- world/time-aware valuation identity;
- completeness/watermark quality inputs;
- privacy-safe pre-approved cohorts with differencing resistance.

No item in this section is authority for Oteryn-Game until separately accepted by its own lifecycle.

---

## 31. Execution alias

Prompt:

`docs/agents/prompts/ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION.md`

Alias:

`ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`
