# ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION

ALIAS:
`ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION`

MODE:
Autonomous verification-platform correction + test-suite audit/refactor + measured GitHub-hosted execution architecture + selective execution + benchmark + staged integration + protected-branch closeout.

DO NOT STOP AT AUDIT, DESIGN, BENCHMARK PREPARATION, PROTOTYPE, OR PARTIAL MIGRATION.
DO NOT ASK FOR CONFIRMATION FOR NORMAL SAFE/REVERSIBLE IMPLEMENTATION DECISIONS.
FINISH THROUGH VERIFIED STAGED PRs AND TERMINAL CLOSEOUT, SUBJECT ONLY TO REAL EXTERNAL BLOCKERS OR SECURITY/AUTHORITY BOUNDARIES.

Repository:
- `Oteryn/Oteryn-Atlas`

Implementation lifecycle:
- Issue `#179`

Audit/design history:
- Issue `#174`
- PR `#175`

Known stacked work at the time of this revision:
- PR `#190` — Molehill admission/orchestration
- PR `#195` — worker/resource calibration
- PR `#200` — selective execution cutover

These identifiers are discovery hints only. Resolve current state, heads, bases, diffs, checks, successors and overlapping work from GitHub before acting.

## Corrective authority

This prompt is the current #179 execution authority where older audit/handoff/platform text conflicts with it.

The target architecture is:

1. **GitHub-hosted-first for ordinary E2E.** Normal smoke/targeted/broad/full functional Playwright, deterministic geometry/render where equivalent, race/fault, rights-safe visual checks and the routine full safety net run on GitHub-hosted infrastructure.
2. **Molehill-PC is specialist-only.** It is reserved for facts that cannot be equivalently proven hosted: restricted/private visual review, native Windows/browser/GPU/driver truth, LAN-only smoke, hardware-specific reproduction and explicitly justified specialist benchmarks.
3. **Synology is deployment-only.** It receives/promotes already-built exact merged-main artifacts, verifies digest/revision/integrity, deploys, exposes health/readiness and rollback. It must not execute ordinary/full Playwright, stress, scale, soak, performance, broad visual matrices or reproducible product builds.
4. **Agents do not run full E2E after every small edit.** Inner-loop verification is the narrowest affected deterministic/regression proof; browser/full verification is plan/checkpoint driven.
5. **Selective verification must be granular and fail closed.** Use `none/focused/targeted/broad/full`, trusted-base anti-self-certification and exact stable test-ID evidence.
6. **The test suite itself must be audited.** Preserve unique independent oracles; split mega-tests, narrow triggers, merge duplicate assertions, move depth workloads out of routine PR gating and add missing material coverage.
7. **GitHub execution must be optimized as a system, not by blindly adding shards.** Runner startup, image extraction, cache, candidate build, preview startup, artifact transfer, queueing, workers, shards and duplicate workflow work must be measured together.
8. **Optimization must be reversible.** `force-full` only widens; a selector escape or unsound hosted policy must restore full-safe behavior automatically/auditably.

The desired end-to-end path is:

`exact PR head -> trusted diff classification -> granular versioned plan -> cheap deterministic preflight -> measured execution-shape selection -> self-contained GitHub-hosted browser groups -> exceptional specialist proof only when required -> stable-ID/evidence fan-in -> atlas/provenance gate -> protected merge -> exact merged-main artifact built once off Synology -> immutable promotion -> deployment/integrity/revision/rollback -> bounded external live smoke when needed -> periodic full/depth safety net -> selector feedback loop`

## Mandatory authoritative inputs

Read fresh from protected `main` before substantial mutation:

- `AGENTS.md`
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`
- `docs/testing/ATLAS-E2E-EXECUTION-OPTIMIZATION-HANDOFF.md`
- `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-REVIEW.md`
- `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-SECOND-PASS.md`
- `docs/testing/ATLAS-GITHUB-HOSTED-E2E-EXECUTION-ARCHITECTURE-AUDIT.md`
- this prompt
- current `tools/verification/impact-manifest.json`
- current `tools/verification/verification-catalog.json`
- current plan generator/schema/reporter/evidence validator
- relevant `.github/workflows/**`
- complete current `tests/**` and `e2e/**` inventory for the phase.

The GitHub-hosted execution audit document is mandatory design authority for hosted performance/packing/sharding decisions. Re-measure its baseline when runtime/runner/image inputs materially change.

One of the first #179 implementation mutations must reconcile `AGENTS.md`, `ATLAS-VERIFICATION-PLATFORM.md`, Issue #179 and active stacked PR descriptions so no current instruction still treats Molehill/full-71 as the default ordinary PR policy.

## GitHub-first preflight

Before every substantial phase:

1. resolve fresh protected `main`, rules and required checks;
2. resolve #179 and all overlapping verification/E2E/runner/deployment PRs;
3. inspect full diffs for #190/#195/#200 or successors, not summaries only;
4. inspect current workflow runner placement, `needs`, path filters, concurrency and cancellation;
5. inspect current test catalog/manifest/plan/reporter/publisher state;
6. inspect current E2E stable-ID census; do not assume the historical 71 count is still current;
7. record `admission_main_sha`, `task_head_sha`, `integration_main_sha` separately;
8. use dedicated task branches/PRs; never push ordinary work directly to protected `main`;
9. use repository-native GitHub operations first; Remote Desktop/Desktop Commander is exception-only;
10. inspect Molehill/Synology physically only when a specialist/deployment fact is actually needed.

If `main` advances, classify `UPSTREAM_ADVANCED`; reconcile only materially invalidated contracts/evidence and preserve unaffected work.

## Non-negotiable safety constraints

- preserve `atlas-gate`, `provenance-gate`, protected-branch semantics and exact revision identity;
- deterministic Playwright acceptance retries remain zero;
- do not enlarge tolerances, add arbitrary sleeps, broad allowlists or unconditional skips for green results;
- preserve independent geometry/render/state/fault/data oracles;
- `UNKNOWN_RUNTIME_IMPACT`, malformed/incomplete diff evidence, unmatched runtime paths and verification-governance mutation fail closed to `broad/full`;
- candidate verification policy may widen but cannot narrow below trusted protected-base requirements;
- no task-branch live deployment;
- no automatic fallback from GitHub-hosted E2E to Synology/Molehill;
- untrusted candidate/fork code never executes automatically on trusted LAN/hardware runners;
- do not expose restricted/raw Game-derived pixels/publication bytes in public artifacts or reusable images;
- scenario counts are telemetry only; exact stable test IDs are correctness identity;
- do not delete a test because it is slow; retirement requires coverage/contract proof;
- caches are acceleration only, never correctness evidence;
- do not introduce complex scheduler/cache/sharding infrastructure unless measurements prove a material benefit;
- selective execution must have a tested full-safe rollback/fallback path.

## Execution placement

### Tier 1 — GitHub-hosted default

Owns by default:

- Node/Python/contracts/property/governance tests;
- browser semantic/lightweight Chrome/WebGL checks;
- ordinary Playwright smoke/targeted/broad/full functional E2E;
- deterministic geometry/render/browser probes equivalent under pinned hosted environment;
- race/fault/resilience;
- accessibility;
- rights-safe Atlas-owned visual snapshots;
- routine full current-main safety net;
- nightly stress/scale/performance/soak where hardware-specific physical truth is not the purpose;
- reproducible candidate/release build work allowed by rights/provenance.

Ordinary PR qualification must not depend on manually produced `atlas-local-e2e` once migration is complete.

### Tier 2 — Molehill specialist exception

Allowed only with explicit catalog reason/capability, such as:

- restricted/private full-frame visual review;
- native Windows/browser compatibility not equivalent hosted;
- real hardware GPU/WebGL/driver/device-loss/frame-pacing proof;
- private-LAN post-deploy smoke;
- physical-machine-specific defect reproduction;
- benchmark of a specialist Molehill-only lane.

`old pipeline used it`, `test is heavy`, `PC is faster per core`, or `GitHub job is queued` are not valid capability reasons.

Every specialist result binds exact revision/plan/environment identity and uses least privilege.

### Tier 3 — Synology deployment target

Owns only:

- receiving/promoting immutable exact merged-main artifact;
- digest/revision/integrity verification;
- container/service deployment;
- local health/readiness;
- rollback boundary/operation;
- exposure to a bounded externally executed private-LAN smoke when required.

No ordinary/full E2E, stress, scale, soak, performance, broad visual matrices or reproducible product rebuilds on Synology.

## Mandatory agent inner-loop policy

Mirror this into repository agent instructions during implementation.

During coding:

1. run the narrowest unit/contract/regression that proves the edited behavior;
2. batch logically related edits before browser verification;
3. run targeted E2E at meaningful integration checkpoints or when lower layers cannot prove behavior;
4. do not manually run complete Playwright `for safety` unless plan=`full`, force-full incident, verification bootstrap/governance change or explicit full-safety benchmark requires it;
5. after fixing a failing test, rerun the regression and directly dependent group first; broaden only when evidence inputs were invalidated;
6. do not rerun unaffected expensive evidence just because `main` moved when digest/dependency logic proves inputs unchanged;
7. never use PC/Synology to avoid waiting for normal hosted CI;
8. cancel/supersede obsolete expensive heads.

Final authoritative qualification remains exact-head and plan-driven.

## Verification profiles

Implement versioned:

- `none` — proven non-runtime docs/prompt/evidence-only surfaces; cheap governance/syntax only;
- `focused` — isolated pure logic/parser/schema/tool/generator fully covered by deterministic tests;
- `targeted` — bounded user-facing/feature surface with known dependencies and small browser group set;
- `broad` — shared runtime/render/state/load/input/UI shell with multiple domains;
- `full` — verification/governance, cross-cutting runtime, major FullWorld changes, unknown/ambiguous impact, force-full and bootstrap escalations.

Cheap deterministic tests may stay broad when negligible. Selectivity matters most for browser/render/visual/stress/performance/build work.

## Granular verification catalog

The catalog must be independently selectable at least at these logical boundaries (exact stable names may evolve with schema migration):

- deterministic core;
- desktop/mobile smoke;
- state/navigation;
- search and degraded-search;
- desktop/mobile geometry-render;
- framebuffer/render probe;
- race/fault/resilience;
- creature state/search;
- creature interaction desktop/mobile;
- creature presentation layout;
- creature presentation LOD/modes;
- creature animation;
- Farm desktop/mobile;
- responsive mobile;
- accessibility desktop/mobile;
- rights-safe visual shell desktop/mobile;
- creature visual evidence;
- fixed desktop/mobile journeys;
- seeded journey depth;
- stress;
- scale;
- performance;
- soak.

Every group declares:

- stable ID/version and exact stable test IDs/specs/projects;
- protected behavior/impact domains and primary oracle;
- blocking/informational semantics;
- eligible profiles/triggers;
- `fullSafetyNet` membership;
- hosted compatibility;
- exceptional host requirement + allowlisted reason code when any;
- visual/evidence rights classification;
- sequential/parallel/exclusive affinity;
- expected evidence/artifacts;
- timeout class;
- duration-history key.

Filenames alone must not own resource/impact semantics.

## Test-suite audit mandate

Before selective execution is production-ready, classify every browser test/group:

- `KEEP`
- `MOVE`
- `NARROW`
- `SPLIT`
- `MERGE`
- `DELETE`
- `ADD`.

Verify current suite before applying these starting hypotheses.

### Preserve high-value independent oracles

At minimum protect the unique behavior of:

- `geometry-desktop.spec.mjs`
- `geometry-mobile.spec.mjs`
- `render-probes-desktop.spec.mjs`
- `state-desktop.spec.mjs`
- `workflows-desktop.spec.mjs`
- `race-desktop.spec.mjs`
- `resilience-desktop.spec.mjs`
- `degraded-search-desktop.spec.mjs`.

Narrow triggers; repeated depth runs may move nightly, but do not weaken their geometry/framebuffer/state/history/fault/fail-closed proof.

### Keep but feature-scope

Accessibility, responsive mobile, Farm Explorer, API/search browser contracts and creature feature tests must not run for unrelated domains simply because they live under `e2e/tests`.

### Split mega-tests

Review/decompose at minimum:

- `creature-presentation-desktop.spec.mjs` into independently selectable layout/badge, LOD/mode, edge/occupancy, selection/lifetime and animation/visual responsibilities where feasible;
- `creatures-desktop.spec.mjs` into state/search/filter persistence versus render/repaint;
- `creature-interaction-desktop/mobile` into interaction/card/inspector versus geometry/lifetime where useful;
- `audit-desktop/mobile` by moving unique assertions into canonical mode/navigation/responsive/visual groups and retiring standalone duplication only after proof.

### Move depth out of universal PR gating

Default to nightly/conditional for:

- seeded exploratory journeys;
- stress;
- scale;
- timing/performance depth;
- soak.

Fixed realistic cross-feature journeys remain valuable broad/full integration proof, not default targeted work.

### Reduce duplicate assertions, not behavior coverage

Audit repeated drawer, search/navigation, control-presence, responsive, visual and feature-workflow assertions. Keep canonical proof at the cheapest correct layer; higher-level tests remain only for unique integration/oracle value.

### Required-group skip semantics

If a plan requires a group, missing required fixture/publication/prerequisite is failure/BLOCKED, not a success-producing `test.skip`. Optional absence may skip only when the plan does not require that proof. Required stable-ID fan-in must detect missing skipped tests.

## Impact manifest and trusted planning

For all changed paths including rename source/destination:

- union domains/groups; never first-match-wins;
- choose maximum minimum profile;
- apply cross-domain escalation;
- account for producer/consumer fan-out;
- map feature modules narrowly where known;
- map shared shell/runtime/renderer/state broadly;
- strict docs-only classification;
- malformed/empty/incomplete evidence fails closed;
- unmatched runtime path fails closed;
- verification selector/catalog/workflow gate changes bootstrap to full.

Anti-self-certification:

`required plan = max/union(trusted protected-base policy, candidate policy)`

Candidate policy may widen only.

Bootstrap-to-full includes changes to classifier/diff enumeration, manifest/catalog/schema/resolver, plan generator/validator, Playwright selection/config/shared fixtures, hosted execution/sharding policy, evidence reporter/validator/publisher, visual-review policy, worker/packing policy, required-gate workflow and selective enable/rollback switch.

Use strict schema validation and allowlisted IDs; plan values are data, never shell commands.

## Plan/evidence identity

The deterministic plan binds at least:

- schema/repository;
- exact head and integration/base SHA;
- merge-base/diff/changed-path digest including renames;
- trusted/candidate policy digests;
- catalog digest;
- profile/domains;
- exact required groups and stable test IDs/projects;
- visual scenario IDs;
- execution tier/resource class;
- hosted execution-shape/worker/shard policy ID;
- retry policy;
- exceptional host reason if any;
- product/publication input digests;
- rights/evidence class.

Stable Playwright identity is equivalent to:

`project + normalized spec path + title path`

Counts like `71/71` are telemetry only. Fan-in rejects missing/duplicate/unexpected IDs according to policy even when counts happen to match.

When `main` moves, recompute against current integration base and invalidate only materially affected group evidence by declared input/dependency digests. Final aggregate must bind current exact head/base; stale/copied success is forbidden.

# GitHub-hosted execution architecture — mandatory measured audit

Do not treat migration as `replace runs-on and add matrix`.

Before ordinary hosted E2E becomes authoritative, complete the architecture audit in `docs/testing/ATLAS-GITHUB-HOSTED-E2E-EXECUTION-ARCHITECTURE-AUDIT.md` and update it with current measurements.

## Audit the whole Actions DAG

For every PR workflow/job capture:

- trigger/path filters;
- `needs`/critical-path placement;
- runner image/class;
- queue/provisioning;
- checkout/fetch;
- dependency restore/install;
- Docker pull/build/extract;
- product/publication construction;
- preview/service startup;
- browser execution;
- report/fan-in;
- artifact upload/download bytes/time;
- total job wall-clock;
- duplicate command/test/build elsewhere;
- cancellation behavior;
- unique evidence value.

Cover representative `none/focused/targeted/broad/full/nightly`, not a single favorable run.

## Preserve current measured warning

The existing hosted Docker harness has already demonstrated a material fixed cost: one observed exact-head run spent about 25 seconds materializing the pinned Playwright base and about 38 seconds total while merely validating/enumerating the 71-test suite, not executing it.

Re-measure this on current inputs, but treat it as a warning against blind over-sharding: four/eight short shards can replicate setup more than they save browser time.

## Plan before allocating browser compute

Trusted classification/plan generation must decide whether browser work is needed before launching expensive jobs.

But do not serialize E2E behind every unrelated cheap/security job. Determine the minimal safe preflight frontier (plan/schema/syntax/build/input prerequisites) and let independent checks run in parallel into final gates.

Benchmark eager versus over-serialized start. Choose the lowest end-to-end PR verdict latency at acceptable wasted compute.

## Adaptive execution-shape selector

The plan must select one of measured shapes such as:

- no browser job;
- one packed hosted job;
- two hosted shards;
- four hosted shards for sufficiently large broad/full work;
- specialist job only if explicit capability required.

No fixed shard count for every PR.

Packing considers:

- fixed setup cost;
- predicted selected-test duration;
- number/affinity of specs;
- sequential/stateful constraints;
- browser/project/viewport affinity;
- duration p50/p95;
- artifact transfer;
- queue pressure;
- infrastructure variance;
- total job-minute/setup amplification.

Derive/version thresholds from benchmark data. Do not invent constants before measurement.

A small targeted plan should normally stay packed if extra VMs mostly duplicate setup. A long full plan may scale out when wall-clock gain materially exceeds setup/queue amplification.

## Workers versus shards

Treat in-job Playwright workers and GitHub job shards separately.

Benchmark targeted/broad/full with at least:

- 1 shard × 1 worker;
- 1 shard × 2 workers;
- 1 shard × 4 workers where runner resources support it;
- 2 shards using best safe per-shard worker count;
- 4 shards for sufficiently large work.

Do not maximize both axes blindly. Record simultaneous browser process count and reject combinations that increase OOM/crash/variance/setup/job-minutes without material wall-clock benefit.

Policy may differ by profile/group and must be versioned.

## Build-once versus per-shard recomputation

For expensive shared immutable candidate input compare:

1. build independently in every shard;
2. build once, content-address, upload and fan out;
3. trust-safe cache keyed by all correctness inputs;
4. immutable base/runtime plus thin candidate layer/mount.

Choose by measured total wall-clock, bytes, failure isolation and reproducibility.

Do not introduce a build artifact job when recomputation is cheaper. Reused artifacts bind producer inputs/digest into evidence.

## Playwright/container image strategy

Compare on real hosted runner:

- current custom image built per job;
- protected-main rights-safe immutable harness base by digest plus candidate code separately;
- BuildKit/GitHub cache for stable layers;
- official pinned Playwright image directly with thin candidate install/mount;
- native hosted execution only if it preserves deterministic pinned browser/runtime contract more efficiently.

Measure cold and cache-restored paths. Warm-cache-only wins are insufficient.

Reusable image/cache must never contain restricted Game-derived product bytes.

## Preview/service amortization

Within one job, start the exact candidate preview once and run all compatible groups against it. Do not rebuild/restart per spec unless isolation/fault oracle requires it or measurements show contamination.

Across shards use immutable local/content-addressed candidate inputs; do not load Synology/private LAN.

## Duration-aware balancing

Only after stable IDs and reliable duration history.

If static groups materially imbalance shards, use deterministic explainable packing (e.g. longest predicted duration first) with whole-spec/sequential affinity. Duration metadata affects scheduling only, never correctness selection.

Stale/missing history gets deterministic safe fallback and never drops required tests.

## Prevent matrix explosion

Never blind Cartesian-product:

`browser × viewport × DPR × feature × shard × seed × visual mode`.

Catalog declares only semantically required dimensions.

Ordinary PR:

- canonical Chromium path unless product support contract says otherwise;
- only relevant responsive DPR/viewport profiles;
- no seeded stress multiplication of targeted functional work;
- plan-scoped visuals;
- bounded supported cross-browser smoke;
- combinatorial depth nightly/manual only when it proves an actual contract.

Expose matrix cardinality in plan/evidence and add regression tests for accidental explosion.

## Cache architecture

Cache keys include all correctness-relevant immutable inputs such as browser/base digest, Dockerfile, lockfile, toolchain and generated-product builder inputs/schema.

Caches are not provenance. Validate digests after restore for qualified inputs.

Measure restore/save bytes/time. Remove caches whose transfer cost exceeds saved work.

Do not allow a broad mutable candidate cache key to silently contaminate trusted/protected builds.

## Artifact architecture

Passing functional shards should emit minimal exact evidence:

- compact summary;
- stable executed-ID set;
- plan/shard/input digests;
- required small rights-safe reports.

Rich trace/screenshot/video/log evidence is primarily failure-only or explicitly required visual proof.

Fan-in should retrieve summaries, not all large artifacts from green shards. Restricted visuals remain private.

## Cancellation and stale heads

Use per-PR/purpose concurrency and `cancel-in-progress` for expensive ordinary hosted lanes.

When a new head supersedes old:

- queued old work cancels;
- running obsolete heavy work stops promptly where safe;
- cancelled evidence cannot satisfy new head;
- artifact names/fan-in are exact head+plan+shard bound.

Measure `superseded-work waste` and reduce it materially.

## Failure propagation

Do not blindly choose matrix `fail-fast` true/false.

- plan/input/build/preview failure invalidates all shards -> stop siblings;
- assertion failure blocks PR but finishing short siblings may reveal independent defects;
- long depth siblings may be cancelled when additional information value is low.

Document measured sibling policy; cancellation never counts as complete evidence.

## Workflow dedup and job granularity

Audit `ci.yml`, semantic/creature/mobile/other feature workflows and hosted E2E together.

Possible actions:

- fan one authoritative deterministic result into multiple consumers instead of rerunning identical commands;
- retain feature job when it adds unique real-source/build/environment proof;
- combine tiny jobs when runner startup dominates and permission/failure-isolation boundaries allow;
- keep longer independent checks parallel when combination lengthens critical path;
- avoid dedicated millisecond jobs absent a trust/permission reason.

Do not optimize YAML job count aesthetically. Measure critical path and useful work.

## Hosted benchmark set

Use exact SHAs/stable IDs and at least 3 clean repetitions for material candidates; more when variance is high.

Benchmark:

### Targeted

Real bounded feature plan. Compare packed one-job against proposed shards. Extra VM must produce real authoritative wall-clock gain.

### Broad

Shared runtime/render/state plan. Compare workers and 2 shards; 4 only if warranted.

### Full

Complete current functional stable-ID set. Compare 1-job, 2-shard and 4-shard shapes with best safe workers, cold and restored-cache paths.

### Concurrent development

Multiple independent PR plans + one superseded head. Measure queue, cancellation, isolation and useful plans/hour.

### Nightly depth

Full functional + depth scheduling without blocking ordinary PR verdicts or deployment.

## Hosted metrics

At minimum report:

- PR verdict wall-clock p50/p95 by profile;
- queue/provisioning p50/p95;
- fixed setup seconds/job;
- useful browser seconds/job;
- **setup amplification ratio** = summed repeated setup across shards / useful browser work;
- build-once fan-out upload/download cost;
- cache hit/miss restore/save cost;
- shard imbalance (slowest/median and spread);
- total job-minutes/plan;
- artifact bytes;
- first-run assertion failure rate;
- infra failure rate;
- OOM/browser/container crash rate;
- superseded-work waste;
- duplicate command/test invocations;
- exact stable-ID completeness;
- useful verified plans/hour.

Selected design must materially accelerate broad/full **without making targeted plans slower through setup amplification**.

If a complex sharder/cache/build-fanout does not materially beat a simpler packed design, use the simpler design.

## Explicit hosted anti-patterns

Forbidden absent measured exceptional proof:

- one GitHub job per Playwright test;
- fixed 4/8 shards for every PR;
- high worker count inside every high shard count;
- full E2E before trusted plan classification;
- repeated expensive product build in every shard when measured fan-out is better;
- mandatory build-artifact fan-out when recomputation is cheaper;
- all videos/traces/screenshots uploaded on every green test;
- Synology used as hosted CI cache/build server;
- Molehill kept in ordinary critical path because it is faster locally;
- unbounded browser/viewport/DPR/seed Cartesian matrices;
- caches without correctness-complete keys/digest validation;
- E2E waiting for unrelated long jobs due to workflow structure only;
- duplicate deterministic commands across workflows without independent-environment reason;
- claiming speedup from browser duration while ignoring queue/setup/build/artifacts.

## Visual policy

### Hosted rights-safe

Atlas-owned controls/drawers/inspector/layout crops, deterministic metrics and rights-safe screenshots may run hosted.

### Private/restricted

Full-frame evidence containing restricted Game-derived raster stays in approved specialist/private review lane and runs only when plan impact can change that visual surface.

Preserve exact plan/summary/screenshot digest, reviewer identity, actual opening/review, no auto-approval, no tolerance weakening, rights-safe retention.

## Accessibility

Keep behavioral keyboard/focus/ARIA/inert/touch tests, triggered only for relevant UI/DOM/CSS/shared-control or broad/full plans.

Audit missing automatic standards-rule coverage. If material gap exists, add a pinned deterministic rules engine/repository equivalent for selected Atlas-owned surfaces, complementary to behavioral tests.

## Cross-browser

Do not automatically multiply full suite by Chromium/Firefox/WebKit.

Resolve declared browser support contract.

- Chromium-only contract -> Chromium canonical, no invented requirement.
- Firefox/Safari/WebKit officially supported -> bounded compatibility smoke/critical paths, deeper only for browser-specific regressions.

Cross-browser and native Windows/GPU are separate lanes.

## Nightly/full safety net

Selective PR testing is incomplete until current-main periodic verification runs complete functional stable-ID safety coverage on GitHub-hosted by default, plus appropriate:

- repeated geometry/render;
- race/fault depth;
- fixed stress seeds;
- seeded exploratory journeys;
- scale/search depth;
- accessibility depth;
- performance trend;
- soak on separate cadence;
- rights-safe complete visual contract;
- bounded supported cross-browser critical paths.

Only private/native specialist subsets use Molehill. Nightly does not depend on Synology and cannot cancel deployment.

A reproducible nightly defect becomes deterministic regression where feasible.

## Selector shadow/backtest and safety fallback

Before work-saving cutover:

1. shadow new plan while legacy/full-safe remains authoritative;
2. replay representative historical PR diffs/known regressions across docs, logic, targeted feature, shared runtime, renderer, UI, verification-governance and cross-domain changes;
3. use at least 20 suitable historical change sets when available, otherwise all suitable and document shortfall;
4. every known regression's detecting group must be selected or covered by stricter superset;
5. compare shadow plans to full-suite outcomes on representative exact SHAs where feasible;
6. record false negatives, over-selection and unknown escalation;
7. every selector miss becomes permanent policy regression;
8. no unexplained false-negative before cutover;
9. full current-main safety net must already be operational.

After cutover, if full/nightly finds a reproducible regression the originating selective plan should have caught:

- classify `SELECTOR_ESCAPE`;
- enable repository full-safe/force-full behavior as needed;
- preserve failing evidence;
- add selector/manifest/catalog regression;
- backtest corrected policy;
- re-enable savings only after escape is closed and full safety is green.

Fallback may widen only and must be tested/auditable.

## Test value/flakiness/retirement telemetry

Track per stable test/group where practical:

- durations/distribution;
- frequency;
- first-run failures;
- infra failures;
- deterministic/replayable defects detected;
- flakes;
- selected domains;
- overlap map;
- artifact/output cost.

Metrics identify audit candidates but never auto-delete/auto-skip a test.

Retire/merge only when behavior/invariant is documented, cheaper/better oracle or explicit product retirement exists, known-regression protection is retained, full/affected suites are green and catalog/impact mapping updates together.

## Performance/soak semantics

Deterministic structural budgets may block relevant PRs.

Hardware-sensitive timing/heap/frame-rate trends normally belong nightly/trend unless declared calibrated SLO exists. Physical performance claims belong specialist calibrated lane. Soak/leak depth must not block unrelated small PRs.

## Exact artifact lifecycle

PR:

`exact PR head -> plan -> candidate artifact/input if needed -> selected exact-head verification -> gate`

Merged main:

`exact merged-main SHA -> build release artifact once on GitHub-hosted/approved off-Synology builder -> verify/digest -> transfer/promote same bytes -> Synology verifies -> deploy -> bounded external live smoke if needed`

Synology never rebuilds release product. Do not relabel PR artifact as merged-main; equivalence may be extra evidence only. Respect rights/provenance in transport/storage.

## Active stack reconciliation

Do not mechanically continue old architecture.

### #190 / successor

Preserve useful trust, supersession and isolation pieces only for specialist self-hosted lanes where needed. Remove assumption ordinary browser-full evidence comes from Molehill. Routine candidate E2E should be normal `pull_request` GitHub-hosted; never use `pull_request_target` to execute untrusted candidate code.

### #195 / successor

Repurpose normal calibration around hosted backend, execution packing, workers, shards, cache/build strategy and Actions critical-path metrics. Keep separate Molehill calibration only for actual specialist workloads. Old Molehill 1/2/4/6/8 benchmark must not gate ordinary hosted cutover.

### #200 / successor

Preserve fail-closed selective planning, plan-scoped groups, force-full widening, shadow evidence and full-safety precondition. Change normal execution backend to hosted. Selective execution must not mean selective `atlas-local-e2e` production from physical PC.

Close/supersede obsolete draft cleanly if safer than preserving its numbering; preserve useful provenance/commits, not architectural debt.

# Implementation programme

Ship reviewable phases; adjust branch/PR boundaries to fresh repository state without weakening dependency order.

## Phase 0 — authority alignment/freeze

- resolve fresh main/#179/#190/#195/#200;
- reconcile AGENTS/platform/Issue/PR descriptions with GitHub-hosted-first;
- keep current full-safe authority while new path is built;
- stop further investment in Molehill-as-default architecture.

## Phase A — test/workflow inventory and audit

- stable test IDs/exact set validation;
- complete KEEP/MOVE/NARROW/SPLIT/MERGE/DELETE/ADD ledger;
- granular catalog/impact domains;
- workflow duplicate-work inventory;
- required-skip semantics tests;
- no destructive retirement before replacement proof.

## Phase B — GitHub-hosted execution architecture audit

This phase is mandatory **before choosing final hosted workers/shards/cache design**.

- update `ATLAS-GITHUB-HOSTED-E2E-EXECUTION-ARCHITECTURE-AUDIT.md` with fresh DAG/timing evidence;
- benchmark fixed runner/image/preview/artifact overhead;
- compare Playwright image strategies;
- compare build-once versus per-shard recomputation;
- benchmark targeted/broad/full packed jobs versus workers and 2/4 shards;
- audit critical-path `needs` structure/eager-vs-gated start;
- audit cache hit/miss economics;
- audit cancellation/superseded waste;
- select deterministic adaptive packing policy;
- record rejected alternatives and rollback path.

Do not implement a complicated sharder simply because parallelism is available.

## Phase C — hosted self-contained E2E implementation

- execute selected groups on hosted exact candidate inputs;
- remove ordinary PR dependency on Molehill/local status/live LAN;
- implement selected image/cache/build/packing design from Phase B;
- exact plan-bound summary/artifact/fan-in;
- cancellation/head isolation;
- minimal passing artifacts/rich failures.

## Phase D — test decomposition/workflow dedup

- split mega-tests;
- merge duplicate assertions at cheapest correct layer;
- retain unique integration proofs;
- move seeded/stress/scale/performance/soak depth;
- remove duplicate workflow invocations without losing real-source/environment proof;
- add missing a11y/precondition coverage where justified.

## Phase E — planner/evidence hardening

- finish deterministic risk plans;
- trusted-base lower bound;
- rename/multi-path/fan-out/unknown negative tests;
- exact stable-ID/shard union validation;
- visual/a11y/specialist requirements;
- moving-main input-digest invalidation.

## Phase F — shadow historical calibration

- historical backtest;
- live shadow versus full-safe;
- permanent regression for every selector miss;
- measure over-selection;
- prove complete current-main safety net;
- no work-saving selective cutover yet.

## Phase G — selective cutover

- enable selective execution only after Phase F criteria;
- prove none/focused/targeted avoid unrelated browser work;
- prove broad/full/unknown/governance widen correctly;
- prove force-full and selector-escape fallback;
- prove agents no longer reflexively run full suite;
- verify adaptive hosted packing does not make small plans slower.

## Phase H — specialist/release/Synology reduction

- retain only justified private visual/native Windows/GPU/LAN Molehill groups;
- calibrate only those actual workloads;
- build exact merged-main artifact off Synology;
- promote unchanged by digest;
- remove browser/depth/build work from Synology;
- preserve deployment/revision/integrity/rollback and bounded external live smoke.

## Phase I — closeout

- full current safety net;
- realistic concurrent PR + supersession load;
- selector feedback fallback proof;
- before/after latency/setup amplification/job-minute/cancellation measurements;
- verify no coverage/provenance/rights weakening;
- close #179 only after merged end-state is proven.

## Required negative proofs

At minimum prove:

- unknown path -> broad/full;
- rename/multi-path union cannot under-select;
- policy mutation cannot self-narrow;
- missing/duplicate stable ID rejects evidence even if counts match;
- required group missing prerequisite cannot pass via skip;
- stale plan/base cannot satisfy readiness;
- cancelled/superseded work cannot satisfy new head;
- untrusted candidate cannot reach specialist host;
- ordinary plan cannot request Molehill without allowlisted capability reason;
- Synology cannot accept ordinary browser-full/stress/scale/soak/performance classes;
- ordinary E2E cannot depend on private LAN;
- stale/copied visual review cannot satisfy plan;
- selector escape forces safe widening;
- force-full cannot narrow;
- shard union exactly equals required stable IDs;
- duplicates cannot hide missing IDs;
- accidental matrix cardinality explosion is rejected;
- incompatible cache input/digest is rejected/recomputed;
- wrong artifact digest/revision blocks deploy;
- release cannot rebuild on Synology;
- restricted visual bytes cannot use public artifact path;
- workflow dedup cannot remove unique integration proof.

## Acceptance criteria

#179 is complete only when objective evidence proves all of the following:

1. repository authorities agree on hosted-first normal E2E;
2. routine PR Playwright no longer requires Molehill/manual `atlas-local-e2e`;
3. Molehill is specialist capability-only;
4. Synology executes no ordinary/full browser/depth/performance/broad visual suite;
5. Synology does not rebuild release artifact;
6. deterministic versioned `none/focused/targeted/broad/full` planning is fail closed;
7. all changed paths/renames/dependency fan-out are unioned;
8. candidate policy cannot self-narrow;
9. stable exact test IDs replace magic counts;
10. required tests cannot vanish through skip/prerequisite behavior;
11. catalog independently selects major state/search/geometry/creature/farm/a11y/visual/depth domains;
12. every current E2E group has an audited disposition;
13. no unique oracle is removed without replacement/retirement proof;
14. mega-tests are decomposed enough for useful selectivity;
15. seeded/stress/scale/performance/soak are not universal PR gates;
16. fixed cross-feature journeys are broad/full, not routine targeted;
17. high-value geometry/render/state/fault/resilience remain blocking when impacted;
18. accessibility behavioral coverage remains and automatic-rule gap is resolved explicitly;
19. browser matrix matches declared support contract;
20. a current hosted execution architecture audit exists with raw timing/DAG evidence;
21. hosted fixed setup/image/build/preview/artifact costs are measured, not guessed;
22. targeted/broad/full worker-vs-shard candidates are benchmarked on real hosted runner environment;
23. final shard/worker/packing policy is adaptive and versioned;
24. small targeted plans are not slowed by needless shard setup;
25. broad/full show material wall-clock gain versus selected baseline;
26. setup amplification/job-minute/cancellation costs are reported and bounded by measured policy;
27. image/cache strategy is chosen from cold + cache-restored evidence;
28. build-once fan-out is used only where it beats per-shard recomputation or materially improves exact shared input identity;
29. matrix explosion is structurally prevented/tested;
30. one preview/build environment is amortized across compatible groups within a job;
31. ordinary E2E is self-contained and does not load Synology/private LAN;
32. superseded heads cancel obsolete expensive work promptly;
33. sibling-shard failure/cancellation policy is explicit and cannot fabricate complete evidence;
34. passing artifact volume is minimal; rich failures remain diagnostic; restricted visual rights preserved;
35. duplicate workflow execution is audited and unnecessary duplication removed without losing unique proof;
36. shadow/historical calibration has no unexplained false-negative before cutover;
37. complete current-main safety net is active before selective savings;
38. tested selector-escape mechanism restores full-safe behavior;
39. retries remain zero and assertions/tolerances/oracles/provenance are not weakened;
40. exact plan/evidence binds head/base/diff/policy/catalog/execution-shape/product identities;
41. moving main invalidates only materially affected proof while final readiness remains exact;
42. exact merged-main artifact is built once off Synology and promoted unchanged by digest;
43. deployment preserves exact revision/integrity/rollback;
44. private-LAN smoke, if needed, is bounded/external and not Synology E2E compute;
45. agent instructions forbid reflexive full E2E and Remote Desktop routine polling;
46. `atlas-gate` and `provenance-gate` remain required/protected;
47. full safety-net stable-ID membership did not accidentally shrink;
48. before/after p50/p95 ordinary PR latency improves materially;
49. dependence on user's physical PC for normal PRs reaches zero unless explicit specialist group;
50. documented rollback can restore full verification if hosted/selective architecture is unsound.

## Success metrics

Report before/after at minimum:

- PR verdict p50/p95 by profile;
- targeted/full suite wall-clock;
- queue/provisioning;
- fixed setup/job;
- useful browser time/job;
- setup amplification ratio;
- worker/shard policy and shard imbalance;
- build/cache cold/warm costs and hit/miss economics;
- total job-minutes/plan;
- artifact bytes;
- superseded-work waste;
- duplicate commands/test invocations;
- Molehill jobs per normal PR (target zero unless specialist);
- Synology browser/depth jobs (target zero);
- full-suite executions per small PR (target zero unless plan/full-safe rule);
- first-run product failure rate;
- infrastructure/flake/OOM/crash rate;
- selector false-negative escapes (zero at cutover; later escape triggers fallback);
- over-selection rate;
- useful verified plans/hour under realistic concurrent development.

Do not improve one speed metric by worsening correctness or hiding compute/setup elsewhere.

## Merge lifecycle

For every phase PR:

1. refresh protected `main`;
2. reconcile upstream movement without discarding valid history;
3. inspect complete changed-file set/diff;
4. run exact phase plan plus bootstrap/full proof when verification-governance changed;
5. require exact-head protected checks/reviews;
6. renew only invalidated evidence;
7. squash merge with expected-head fencing;
8. verify merged-main SHA/post-merge checks;
9. delete terminal branch unless documented provenance role;
10. continue autonomously through #179 until actual target state is merged/proven.

Never force-push published history merely because `main` moved. Lost merge race returns to integration/reconciliation, not implementation restart.

## Final report

Separate FACT / INFERENCE / UNKNOWN and include:

- #179 and every implementation/supersession PR;
- final protected main SHA;
- final group execution-placement matrix;
- final manifest/catalog/plan/execution-policy versions/digests;
- complete test audit ledger;
- current full safety-net stable-ID census;
- GitHub workflow DAG audit and duplicate-work result;
- hosted setup/image/cache/build/preview/artifact baseline;
- targeted/broad/full workers-versus-shards benchmark;
- selected adaptive packing policy and rejected alternatives;
- setup amplification/job-minute/queue/cancellation before/after;
- selector shadow/backtest and escape fallback proof;
- accessibility/cross-browser decisions;
- Molehill final specialist role/usage;
- Synology final deployment-only proof;
- exact release artifact digest/promotion/deploy chain;
- bounded live smoke evidence where applicable;
- protected gate results;
- before/after PR latency and useful-plans/hour;
- any real external blocker precisely classified.

Do not claim completion from a design, one fast benchmark, partial hosted migration, green subset or selective planner alone. Completion requires the merged end-state, complete safety-net proof, and measured evidence that ordinary Atlas development no longer pays for unrelated full E2E or wasteful GitHub/PC/Synology execution.

# Current continuation checkpoint — 2026-08-27

This section is additive current execution guidance. It does not weaken any earlier requirement or either amendment.

For continuation after the current implementation wave, first read:
- `docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-OPTIMIZATION-FINAL-HANDOFF.md`
- `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-FINAL-CLOSEOUT-COORDINATOR.md`

The remaining work MAY be parallelized only through these isolated lanes:
- `ATLAS-E2E-OPT-LANE-A-PROTECTED-HOSTED-CONTROL-PLANE`
- `ATLAS-E2E-OPT-LANE-B-HOSTED-QUALIFICATION-BROWSER`
- `ATLAS-E2E-OPT-LANE-C-PHASE-E-HOSTED-BENCHMARK-HARNESS`
- `ATLAS-E2E-OPT-LANE-D-PHASE-F-SHADOW-BACKTEST`

One coordinator owns all merge/retarget/cutover decisions. Lane agents must use isolated branches/worktrees and may not merge protected shared branches, publish transitional local statuses, mutate branch protection or enable selective execution.

The sequential invariant remains:
`#208 protected bootstrap -> #209 protected policy v2 -> final protected hosted Phase D -> measured Phase E -> disabled shadow/full-safety Phase F -> selective cutover -> final administrative/full-safety closeout -> #179 close`.

At checkpoint creation #208 had an exact 77/77 zero-retry local physical PASS on head `9564aa6724da19ba32781c1a3ebefc53996bb851`, but that evidence still required actual visual review, exact review binding, status publication and same-SHA CI rerun before merge. Resolve all SHAs fresh before acting.

A dedicated preservation branch `handoff/issue-179-ancillary-hosted-q` contains then-unintegrated neutral ancillary qualification products and hosted fixture namespace wiring transplanted onto then-current #213. Treat it as a review/cherry-pick source, not authority; compare against current #213 before reuse.

Do not create another broad handoff. The next coordinator is expected to execute through terminal closeout, using parallel lanes only to shorten independent preparation/implementation work.
