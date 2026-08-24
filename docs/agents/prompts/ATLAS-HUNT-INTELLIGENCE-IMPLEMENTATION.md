# ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION

ALIAS:
`ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`

MODE:
Autonomous **Atlas-only** implementation + verification + integration + closeout.

DO NOT STOP AT AUDIT OR PLANNING WHEN ATLAS-SIDE WORK CAN SAFELY PROCEED.

DO NOT MUTATE `Oteryn/Oteryn-Game`.

Your task is to implement the Atlas side of Oteryn Hunt Intelligence to the maximum truthful extent supported by **already accepted upstream data**, while leaving every unsupported Game/Game Intelligence capability fail-closed and explicitly classified.

Authoritative technical design:

`Oteryn/Oteryn-Atlas/docs/agents/tasks/active/ATLAS-HUNT-INTELLIGENCE-PROJECT.md`

Read it completely before any mutation.

---

## REPOSITORIES

### Writable repository

`https://github.com/Oteryn/Oteryn-Atlas`

Lifecycle authority:

`https://github.com/Oteryn/Oteryn-Atlas/issues/117`

Parent programme:

`https://github.com/Oteryn/Oteryn-Atlas/issues/11`

Verification policy:

`https://github.com/Oteryn/Oteryn-Atlas/issues/85`

Shared capability dependencies:

- `https://github.com/Oteryn/Oteryn-Atlas/issues/113`
- `https://github.com/Oteryn/Oteryn-Atlas/issues/114`
- `https://github.com/Oteryn/Oteryn-Atlas/issues/115`

### Read-only upstream repository

`https://github.com/Oteryn/Oteryn-Game`

Game is canonical World/Content authority and the architectural source for Game Intelligence, but this execution has **NO WRITE AUTHORITY** there.

---

## OWNER RESTRICTION — ABSOLUTE

For this execution, `Oteryn/Oteryn-Game` is read-only.

You MAY:

- fetch/read Game `main`;
- inspect ADRs/contracts/source/publications;
- inspect existing accepted Game -> Atlas outputs;
- inspect existing Game Intelligence implementation/status/publications;
- cite exact upstream revisions in Atlas evidence.

You MUST NOT, under any circumstance during this task:

- create/update/close a Game Issue;
- create/update/delete a Game branch/tag;
- create/update/delete a Game file;
- create a Game commit;
- create/update/merge a Game PR;
- add a Game comment/review/reaction;
- push local Game changes;
- modify Game schema/code/docs/workflows/contracts;
- allocate/activate `OTV2-IMPL-ANALYTICS` or any other Game lane;
- use a write-capable GitHub action/tool against `Oteryn/Oteryn-Game`.

If a Game-side capability is missing, record the requirement **only in Atlas** as `UPSTREAM_REQUIREMENT` / `UPSTREAM_BLOCKED`.

Any attempted Game mutation is a task failure.

---

## STARTING PROVENANCE

The design revision that hardened this prompt was authored after Atlas `main@3618bf5614c31b91e6846083066be8d77385eea2`.

This SHA is provenance only.

Before any Atlas mutation, refresh:

- current Atlas `main`;
- Issue #117;
- #113/#114/#115/#85/#11;
- all overlapping open Atlas PRs;
- Game `main` **read-only**;
- relevant upstream publications and current Game implementation status **read-only**.

Never blindly implement against stale SHAs.

---

## GLOBAL NON-NEGOTIABLE RULES

1. `Oteryn-Game` remains canonical for Game/world/content facts.
2. Atlas is a derived semantic projection/read model.
3. Atlas may consume measured analytics only from an accepted public-safe upstream publication.
4. Missing upstream data is not permission to invent it.
5. Production Atlas must not contain synthetic measured analytics.
6. Deterministic fixtures are allowed only under tests/evidence paths and must never become runtime authority.
7. Never compare raw solo and party totals as the same unit of value.
8. Never derive player XP by `team XP / party size`.
9. Never label team loot or an assumed split as measured personal profit.
10. Never silently mix incompatible worlds, profiles, revisions, modifiers, time bases or valuation policies.
11. Never show historical occupancy as live availability.
12. Recommender output is observational prediction, not a causal guarantee.
13. Public analytics must be privacy-safe and differencing-aware.
14. No client-side arbitrary analytics cube over raw/high-dimensional cohorts.
15. Every changed behavior requires the deep applicable verification from Issue #85 and current `AGENTS.md`.
16. No production/live deployment from an unmerged branch.

---

## REQUIRED PREFLIGHT

Before editing Atlas:

1. Resolve GitHub authority:
   - current Atlas `main` SHA;
   - Issue #117 state/comments;
   - open PRs overlapping Hunt, Item/Spawn, creature interaction/presentation, FullWorld, search, inspector, URL state or verification;
   - exact #113/#114/#115 state and merged/in-flight contracts.
2. Read current Atlas root/near-path `AGENTS.md`.
3. Read current Hunt project contract completely.
4. Inspect current FullWorld:
   - camera/floor transforms;
   - creature render/selection/diagnostics;
   - item/spawn primitives;
   - inspector state;
   - search and URL/deep-link state;
   - publication/content-addressing;
   - verification platform.
5. Inspect Game **read-only** for:
   - current `main`;
   - ADR-0005 world/content model;
   - ADR-0006 Game Intelligence;
   - current accepted public-safe Game -> Atlas exports;
   - any existing Hunt Catalog / area / route publication;
   - any existing public-safe Hunt Performance analytics publication;
   - current implementation-allocation/status records.
6. Classify upstream capabilities individually:
   - `AVAILABLE`;
   - `UPSTREAM_BLOCKED`;
   - `MALFORMED`;
   - `STALE`;
   - `INCOMPATIBLE`.
7. Create one Atlas task branch/PR tied to #117 unless current lifecycle requires a more granular independent PR split.
8. Record exact Atlas base and read-only Game evidence SHAs.

If an overlap is active, integrate with it. Do not overwrite or create a competing authority.

---

## SHARED PRIMITIVE DEPENDENCY GATE

Before touching user interaction/presentation surfaces, resolve live #113/#114/#115.

### #115

Reuse canonical creature presentation bounds, DPR geometry and committed-transform linkage when available.

Do not implement a second bounds calculation.

### #113

Reuse hit testing, hover/selection, `creature=` identity, contextual cards and inspector synchronization when available.

Do not implement independent creature click/selection logic.

### #114

Reuse item identity, creature/item/drop-source relations, spawn identity/LOD, static farm math and deep-link conventions when available.

Measured KPH/performance remains #117 scope.

### If a seam is not merged

- continue only on disjoint data/contract/index work;
- do not duplicate the missing seam;
- delay dependent UI work until the owner seam exists or a stable shared contract is available.

---

## PRODUCT OUTCOME

Implement a FullWorld-native Hunt Intelligence experience to the truthful extent supported by real upstream capability:

- Hunt Finder;
- Hunt detail;
- authoritative geometry/floors/entrances/access;
- authoritative routes when published;
- shared creature/spawn/item integration;
- PLAYER / PARTY / HUNT AREA performance when measured publication exists;
- compare compatible hunts/cohorts;
- revision/history context;
- observational `Best Hunt for Me` when sufficient measured data exists;
- saturation/party-size intelligence only when sufficient evidence exists;
- desktop/mobile/deep-link behavior;
- explicit provenance, quality, completeness, freshness and uncertainty.

If upstream Hunt Catalog is absent, do not fabricate a production hunt list.

If measured analytics is absent, do not fabricate EXP/profit/KPH/recommendations.

---

## TRUST + AVAILABILITY MODEL

Every user-visible datum must carry or inherit:

### Trust

- `VERIFIED`
- `MEASURED`
- `ESTIMATE`
- `UNKNOWN`

### Availability

- `AVAILABLE`
- `UPSTREAM_BLOCKED`
- `INSUFFICIENT`
- `SUPPRESSED`
- `INCOMPATIBLE`
- `MALFORMED`
- `STALE`

`0` is never used as an unavailable sentinel.

Do not encode trust only by color.

---

## HUNT DOMAIN CONSUMER REQUIREMENTS

Atlas must be prepared to consume an accepted Hunt Catalog with stable identity and references for, where published:

```text
hunt_id
world/profile compatibility
localized name identity
Area/Subarea/EncounterZone refs
floor geometry refs
entrance/access refs
spawn-group refs
creature refs
requirement refs
route refs
content revision
provenance/digests
```

Atlas must not invent production `hunt_id`, route coordinates, areas or access rules.

If upstream catalog capability does not exist:

- loader/parser/test readiness may exist in Atlas;
- runtime feature is `UPSTREAM_BLOCKED`;
- fixtures stay test-only.

---

## WORLD / PROFILE / CHANNEL / INSTANCE SEMANTICS

Every measured/valued result must preserve compatibility identity when applicable:

```text
world_id
world_profile_revision/profile_family
content_revision
ruleset_revision
channel_aggregation_scope
instance_scope/instance_kind
server/release compatibility bucket
```

Hard rules:

- do not pool incompatible profile families;
- channel aggregation requires explicit policy;
- instanced/non-instanced variants require explicit compatibility;
- market valuation is world-scoped when the market is world-scoped;
- current view never silently falls back to prior revision.

---

## HUNT ATTRIBUTION + EXPOSURE SEGMENTATION

Atlas does not derive hunt sessions from raw movement.

When measured upstream data exists, require provenance for:

`hunt_attribution_policy_revision`

and sufficient semantics to distinguish stable exposure segments.

Conceptual material segment boundaries include changes in:

- Hunt Area;
- party membership/size/composition;
- shared-experience state;
- world/channel/instance;
- content/ruleset revision;
- temporary modifier bucket;
- material profile bucket changes when policy requires.

A 90-minute outing with party joins/leaves is not automatically one homogeneous cohort sample.

Public browser shards must not expose raw segment/session identity.

---

## COHORT IDENTITY

Compatible measured cohorts should preserve a versioned canonical signature over material dimensions such as:

```text
hunt/world/profile/revisions
window
party size/composition
shared XP
player vocation/class/role
level/party-level band
equipment/skill/power bands when safe
modifier bucket
channel/instance scope
hunt-attribution policy
sessionization policy
aggregation policy
valuation policy
quality/privacy policy
```

Cohort widening:

- explicit;
- deterministic;
- versioned;
- ordered;
- confidence-degrading;
- forbidden across hard incompatibilities.

---

## TIME SEMANTICS

When available, distinguish:

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

Expose truthful rate labels:

- Active hunt rate;
- End-to-end/session rate;
- Exposure-weighted pooled rate where relevant.

Never present combat-only output as session output.

---

## XP SEMANTICS

Where measured publication supports them, distinguish:

```text
player_awarded_xp
party_awarded_xp_sum
base_creature_xp_defeated
shared_experience_state
xp_modifier_bucket
party bonus/modifier identity
```

Required tests must prove:

- actual player-awarded XP is used for player metrics;
- no team/party-size division shortcut exists;
- base-creature XP is never labelled awarded XP;
- modifier/event samples do not contaminate the normal baseline silently.

---

## MODIFIER / EVENT SEGREGATION

Treat temporary performance modifiers as first-class cohort context.

Do not silently pool normal baseline with:

- global XP event;
- personal XP boost;
- creature-specific modifier;
- loot event;
- party/shared-XP modifier;
- other material accepted temporary rules.

Default view uses the normal/current compatible modifier bucket.

Unknown modifier provenance degrades or blocks comparison.

---

## LOOT / VALUE / PROFIT SEMANTICS

Every value metric needs valuation identity:

```text
valuation_policy_revision
valuation_type
world_id when market-scoped
price_window
price_as_of/generated_at
price_quality
liquidity_quality where available
```

Do not mix NPC and market value silently.

### Team

```text
team_gross_loot_value
team_supply_cost
team_other_explicit_cost
team_net_value
```

### Player

`player_net_profit` is `MEASURED` only when actual allocation/realization semantics are accepted.

Unknown allocation:

- team value may be MEASURED;
- player cost may be MEASURED;
- equal-share split is ESTIMATE;
- personal measured profit remains unavailable.

### Rare loot

Keep separate:

- realized profit distribution;
- median/IQR/percentiles;
- expected long-run loot value from a proven #114 drop model;
- rare-drop contribution when safe/defined.

Never imply realized median and expected long-run value are identical.

---

## STATISTICAL ESTIMATORS

Preserve two different evidentiary views when data supports them.

### Session/segment distribution

- median rate;
- P25/P75;
- P10/P90 when publishable;
- sample sessions/segments.

### Exposure-weighted pooled rate

```text
sum(output) / sum(exposure_time)
```

with player/team exposure hours.

Do not let a ten-minute session and a three-hour session become indistinguishable evidence without explicit estimator semantics.

Exact minimum-duration/outlier policies belong upstream; Atlas must not invent them.

---

## COMPLETENESS / WATERMARKS

Large samples with incomplete telemetry are not high-quality evidence.

When measured publication exists, consume quality inputs such as:

```text
complete_through
generated_at
ingestion_lag
coverage_state
event_loss/drop state
replay/reconciliation state
aggregation_policy_revision
```

Atlas must not present `HIGH` quality if completeness is unknown/unacceptable under the supplied policy.

Analytics degradation must not break VERIFIED map navigation.

---

## STATISTICAL PUBLICATION FIELDS

When present, retain:

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

No hidden duplicate counting or cross-revision pooling.

---

## PRIVACY / DIFFERENCING RESISTANCE

Do not ship raw player/session telemetry or an arbitrary high-dimensional query cube.

Public Atlas must use bounded/pre-approved aggregate buckets from an accepted release surface.

Consumer expectations include:

- no names/raw player IDs;
- no item-instance IDs;
- no raw session/segment IDs;
- no unnecessary movement trails;
- versioned buckets;
- contribution limits when supplied by policy;
- suppression across unsafe overlapping slices;
- forbidden unsafe dimension combinations;
- no browser query pattern that can trivially isolate one session by differencing.

Do not invent differential privacy parameters without a separately accepted policy.

---

## CURRENT / HISTORY / FRESHNESS

Current headline data must prefer:

- current world/profile;
- current content/ruleset;
- compatible modifier bucket;
- accepted fresh window;
- compatible valuation policy/time.

Historical data belongs in explicit history/before-after views.

Never silently use a stale historical high-performing cohort as current recommendation evidence.

---

## RECOMMENDER — OBSERVATIONAL ONLY

V1 semantic class:

`OBSERVATIONAL_PREDICTION_FROM_COMPARABLE_COHORTS`

It is deterministic and explainable, not causal and not a guarantee.

### Inputs

Use only real supported dimensions, for example:

```text
world/profile
vocation/class/role
level
solo/duo/party plan
party composition
equipment/power band
objective
risk/min-profit preference
location/access constraints
modifier context
```

### Algorithm

1. start from VERIFIED compatible Hunts;
2. require current compatible measured cohorts;
3. require compatible time/valuation semantics for chosen objective;
4. prefer exact party/composition/role/modifier match;
5. widen only by a versioned deterministic policy;
6. degrade confidence for widening/staleness/completeness weakness;
7. rank using explicit objective-policy revision;
8. return a range, basis and reasons;
9. return unavailable when evidence is insufficient.

Preferred copy:

> Estimated from comparable observed cohorts

Avoid copy implying guaranteed outcome.

No opaque ML requirement for v1.

---

## SATURATION / PARTY SIZE

Publish only from compatible evidence and name the objective.

Potential measures:

- team awarded-XP throughput;
- kill/base-XP throughput;
- per-player XP yield;
- team/player value;
- safety/death exposure.

No context-free `optimal party size`.

No marginal-gain calculation across incompatible composition/revision/modifier cohorts.

---

## HISTORICAL CONTENTION VS LIVE OCCUPANCY

Historical privacy-safe occupancy/contention can be a future MEASURED aggregate.

Live occupancy is a separate future capability and is forbidden unless an explicit authoritative privacy-safe source exists.

Never render historical popularity as current availability.

---

## ATLAS RUNTIME ARCHITECTURE

Only accepted upstream publications feed production:

```text
read-only accepted upstream
        |
        v
Atlas verifier/compiler
        |
        v
bounded content-addressed shards
        |
        v
FullWorld browser
```

Requirements:

- bounded summary index;
- lazy detail/performance shards;
- schema/capability/revision/digest checks;
- explicit count/byte limits;
- bounded cache/eviction;
- fail-closed malformed/missing/oversized inputs;
- independent degradation of Hunt analytics versus base map;
- no raw telemetry in browser;
- no production test fixtures as measured data.

---

## ATLAS UX

### Hunt Finder

Only expose filters backed by accepted data.

### Hunt card

Always separate PLAYER / PARTY / AREA scopes and trust classes.

### Hunt detail

Use coherent sections:

- Overview;
- Map;
- Monsters;
- Loot/Economy;
- Route;
- Requirements;
- Performance;
- History/Reports;
- Provenance/quality.

### Map

- accepted authoritative geometry only;
- floor-aware routes only when published;
- far/medium/near LOD;
- reuse #113/#115 interaction/presentation geometry;
- reuse #114 item/spawn LOD;
- exact camera/floor synchronization.

### Compare

Reject/explain incompatible:

- scope;
- world/profile/revision;
- time base;
- valuation;
- modifier;
- cohort semantics.

### Deep links

Persist only supported stable state using existing FullWorld conventions:

- Hunt selection;
- profile/party/objective filters;
- comparison selection;
- floor/view;
- current/history window where applicable.

---

## IMPLEMENTATION ORDER

### PHASE 0 — Preflight

Perform all GitHub-first checks and classify upstream capability.

### PHASE 1 — Shared primitive freeze

Resolve #113/#114/#115 exact seams.

Do not duplicate missing primitives.

### PHASE 2 — Atlas Hunt consumer contracts

Implement bounded Atlas-side interfaces/loaders/state models and deterministic test fixtures.

No Game write.

No fake production data.

### PHASE 3 — VERIFIED Hunt integration

If a real accepted Hunt Catalog exists, integrate it.

If not, classify `UPSTREAM_BLOCKED` and keep production Hunt facts unavailable.

### PHASE 4 — FullWorld VERIFIED UX

Implement only supported factual UI using shared primitives.

### PHASE 5 — Analytics readiness check

Inspect read-only whether an accepted public-safe Hunt Performance publication exists.

If absent:

- record `UPSTREAM_REQUIREMENT` in Atlas #117/evidence;
- MEASURED/recommender/saturation remain unavailable;
- do not create Game work;
- continue other safe Atlas-only tasks.

### PHASE 6 — MEASURED consumer

Only if real accepted upstream measured data exists.

Enforce all world/revision/time/valuation/modifier/completeness/privacy semantics.

### PHASE 7 — Recommender

Only if sufficient compatible measured evidence exists.

### PHASE 8 — Saturation/history

Only if statistically publishable.

### PHASE 9 — Verification + integration

Run complete applicable Atlas verification.

### PHASE 10 — Merge/closeout

- review full diff;
- verify exact remote head;
- require `atlas-local-e2e=success` if current policy requires it;
- require `atlas-gate` and `provenance-gate` on exact head;
- squash merge;
- delete completed branch;
- update #117 with exact evidence and precise upstream availability matrix.

Do not close #117 merely because consumer scaffolding exists if promised supported Atlas behavior remains unfinished.

---

## PARALLEL AGENT STRATEGY

After shared contracts are stable, Atlas-only agents may work in parallel with disjoint ownership:

1. `HUNT-ATLAS-CONTRACTS`
2. `HUNT-ATLAS-PROJECTION`
3. `HUNT-ATLAS-UX`
4. `HUNT-ATLAS-ANALYTICS-CONSUMER` — only when real upstream publication exists
5. `HUNT-VERIFICATION`

No subagent may mutate Game.

No subagent may create a competing #113/#114/#115 seam.

---

## TDD / REQUIRED TESTS

For every behavior/fix:

1. create/identify deterministic failing proof where practical;
2. implement minimum correct behavior;
3. run targeted tests;
4. run full applicable exact-head verification;
5. retain regression coverage.

### Ownership/safety tests

- production runtime has no legacy/community/Game-write fallback;
- test fixtures cannot be loaded as measured production authority;
- Atlas docs/prompt do not instruct Game mutation;
- no duplicate shared primitives.

### Contract tests

- Hunt/world/profile/revision identity;
- route/floor refs;
- malformed/missing/oversized/digest mismatch;
- availability state taxonomy;
- zero vs unavailable;
- current vs historical compatibility.

### Analytics semantics

- party join/leave requires distinct compatible segment semantics;
- shared-XP change breaks homogeneous cohort;
- modifier change prevents baseline pooling;
- actual player-awarded XP;
- no team division shortcut;
- active/end-to-end/exposure-weighted rates differ correctly;
- session distribution and pooled exposure estimator differ correctly;
- telemetry completeness can block HIGH quality;
- world/time valuation compatibility;
- rare-loot realized vs expected-value distinction.

### Privacy tests

- no raw actor/session IDs in public outputs;
- arbitrary differencing-prone dynamic cube unavailable;
- suppression is not zero;
- unsafe dimensions are rejected/omitted under supplied policy.

### Recommender tests

- deterministic matching/widening;
- confidence degradation;
- stale/incomplete/incompatible rejection;
- objective policy revision;
- observational wording/state;
- insufficient evidence path.

### Browser tests

Desktop/mobile real Chromium for supported features:

- Hunt mode entry;
- filters/select/deep-link/history/reload;
- map/floor/route when authoritative data exists;
- shared creature/item interactions;
- unavailable analytics without map failure;
- compare incompatibility explanation;
- responsive/DPR behavior;
- strict console/page/network failure handling.

### Geometry tests

Prove shared transform under:

- pan;
- wheel/button/anchor zoom;
- resize/orientation/DPR;
- floor changes;
- view-mode transitions;
- Hunt/route/spawn/creature toggles;
- mobile drawers.

### Performance/stress

Measure/bound:

- index/filter/search;
- detail/performance shard load;
- route/area overlays;
- cache growth/eviction;
- repeated Hunt switching;
- large deterministic fixture corpus;
- seeded interaction stress under #85.

Do not invent arbitrary thresholds to pass CI.

---

## ACCEPTANCE CHECKLIST

- [ ] no mutation of `Oteryn/Oteryn-Game` occurred;
- [ ] exact upstream read-only provenance recorded;
- [ ] #113/#114/#115 seams reused or dependent work withheld;
- [ ] Hunt facts come only from accepted upstream data;
- [ ] world/profile/channel/instance scope explicit;
- [ ] hunt attribution/exposure segmentation requirements explicit;
- [ ] PLAYER/PARTY/HUNT AREA distinct end to end;
- [ ] actual awarded player XP preserved where measured;
- [ ] no team-XP division;
- [ ] time bases + exposure-weighted estimator explicit;
- [ ] temporary modifiers cannot contaminate baseline silently;
- [ ] valuation is world/time/policy aware;
- [ ] personal measured profit requires real allocation semantics;
- [ ] rare-loot realized vs long-run expected value distinct;
- [ ] completeness/watermarks gate quality;
- [ ] privacy surface is bounded/differencing-aware;
- [ ] current/historical revisions not silently pooled;
- [ ] recommender is observational, deterministic and evidence-gated;
- [ ] historical contention is not live occupancy;
- [ ] unsupported upstream capability is `UPSTREAM_BLOCKED`, not fabricated;
- [ ] supported desktop/mobile/deep-link flows are tested;
- [ ] geometry/render synchronization passes;
- [ ] performance/stress checks pass;
- [ ] exact-head `atlas-local-e2e`/`atlas-gate`/`provenance-gate` pass as required;
- [ ] final diff reviewed;
- [ ] PR squash-merged and branch cleaned.

---

## REQUIRED FINAL REPORT

Return an evidence-backed closeout with:

```text
Atlas Issue #117
Atlas PR(s) and merge SHA(s)
final Atlas main SHA
read-only Game revision inspected
Game mutation count: MUST BE 0
#113/#114/#115 integration state
Hunt Catalog upstream state
Hunt Performance upstream state
implemented VERIFIED surfaces
implemented MEASURED surfaces, if any
implemented ESTIMATE/recommender surfaces, if any
upstream-blocked capabilities
PLAYER/PARTY/HUNT AREA semantics
world/revision/modifier/valuation compatibility
privacy/completeness behavior
verification commands/results
CI statuses
browser/geometry/performance evidence
remaining explicit blockers
```

Never report test fixtures as production data.

Never report a planned upstream Game capability as implemented.

Never report full measured Hunt Intelligence complete if the measured producer is absent.

Execution alias:

`ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION`
