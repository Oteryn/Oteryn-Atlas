# ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION

ALIAS:
`ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION`

MODE:
Autonomous verification-platform implementation + benchmark + staged integration + protected-branch closeout.

DO NOT STOP AT AUDIT, DESIGN, BENCHMARK PREPARATION, OR A PARTIAL MIGRATION.
DO NOT ASK FOR CONFIRMATION FOR NORMAL SAFE/REVERSIBLE IMPLEMENTATION DECISIONS.
FINISH THE PROGRAMME THROUGH VERIFIED STAGED PRs AND TERMINAL CLOSEOUT, SUBJECT ONLY TO REAL EXTERNAL BLOCKERS OR SECURITY/AUTHORITY BOUNDARIES.

Repository:
- `Oteryn/Oteryn-Atlas`

Audit lifecycle:
- Issue `#174`
- PR `#175`

Authoritative design inputs, all mandatory:
- `AGENTS.md`
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`
- `docs/testing/ATLAS-E2E-EXECUTION-OPTIMIZATION-HANDOFF.md`
- `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-REVIEW.md`
- `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-SECOND-PASS.md`

The second-pass document takes precedence where it corrects or tightens the first review or the older handoff.

## Mission

Implement the audited target verification architecture so Atlas runs the minimum complete verification justified by the exact change risk while preserving or improving regression-detection quality, exact-revision evidence, branch protection and fail-closed behavior.

The target is:

`exact PR head -> trusted impact classification -> versioned verification plan -> hosted cheap verification -> resource-aware Molehill execution -> deterministic Docker browser proof -> optional native hardware truth -> exact plan-bound evidence -> protected merge -> exact merged-main release artifact built once off Synology -> verify/promote same release artifact -> Synology integrity/revision + bounded live smoke -> complete periodic full/depth safety net`

Optimization is valid only when measured throughput/latency improves without weakening retries, assertions, tolerances, coverage, visual review, provenance or authority boundaries.

## Mandatory GitHub-first preflight

Before any implementation mutation:

1. resolve fresh protected `main` and required checks from GitHub;
2. read all mandatory documents listed above from current `main`;
3. inspect active Issues/PRs/branches touching verification, E2E, runners, workflows, Docker, deployment and release construction;
4. explicitly inspect current state and full diffs of at least PRs `#169`, `#141`, `#163`, `#170` and any newer overlapping work;
5. inspect current `.github/workflows/**`, `tests/verification/**`, `e2e/**`, classifier/publisher/reporter/catalog files and any nearer `AGENTS.md`;
6. inspect the actual Molehill-PC runner/Docker/hardware state read-only before selecting any benchmark assumptions;
7. create or claim a new substantial implementation lifecycle Issue; do not reuse audit Issue #174 as the implementation authority;
8. record immutable `admission_main_sha` and current task branch/head;
9. use dedicated implementation branches/PRs; do not push ordinary work directly to `main`.

If `main` advances later, treat that as `UPSTREAM_ADVANCED`, not automatic task invalidation. Recompute final impact/evidence against the new integration base and renew only evidence whose required inputs were materially invalidated.

## Non-negotiable safety constraints

1. **Synology must not run heavy E2E, stress, soak, performance, broad visual/render matrices or expensive reproducible product construction in the target state.** It owns release deployment, digest/integrity/revision verification, rollback boundaries and bounded live smoke.
2. Small/unrelated changes must not require unrelated heavy E2E after selective cutover.
3. `UNKNOWN_RUNTIME_IMPACT` must fail closed to `broad` or `full`.
4. Playwright deterministic acceptance retries remain zero.
5. Do not relax assertions, tolerances, geometry oracles, budgets or coverage to gain speed.
6. Do not select Playwright worker count by core count or intuition. Benchmark `2/4/6/8` on the real Molehill-PC and keep a 1-worker baseline.
7. Preserve the existing strong stack unless measurement proves a component should change. Keep `node:test`, Playwright, deterministic Docker qualification and current independent oracles.
8. Preserve exact-SHA evidence, `atlas-gate`, `provenance-gate` and protected-branch semantics.
9. Heavy proof unavailable on Molehill means `BLOCKED`; never fall back to Synology or stale/copied evidence.
10. No task-branch live deployment.
11. Do not expose raw/restricted Game-derived raster/publication artifacts publicly merely because execution moves into GitHub Actions.
12. Untrusted fork/candidate code must not automatically execute on the trusted Molehill Windows/LAN host.

## Trust boundary for self-hosted runners

Moving normal heavy qualification into GitHub Actions is required, but execution must be gated by an explicit trust policy.

Implement and test at minimum:

- fork PR heads are never automatically executed on Molehill;
- same-repository branches are admitted only under the repository's authorized actor/contributor policy;
- dependency/bot PRs are not implicitly trusted merely because they are same-repository;
- native Windows/GPU jobs require at least the same trust level as Docker heavy jobs;
- self-hosted jobs receive least-privilege GitHub permissions and no unrelated secrets;
- never use `pull_request_target` to check out and execute an untrusted PR head;
- candidate code is not given unnecessary credentials or broad LAN authority;
- where practical, native execution uses a dedicated low-privilege Windows identity and bounded local/network access.

Preserve fail-closed behavior for untrusted candidates that require physical heavy proof.

## Required verification model

### Risk profiles

Implement versioned profiles:

- `none` — proven non-runtime docs/prompts/evidence-only surfaces;
- `focused` — isolated pure logic/parser/schema/tooling/generator changes with no browser runtime impact;
- `targeted` — bounded user-facing feature/surface with known dependencies;
- `broad` — shared map/runtime/state/render/load/input or similarly wide surfaces;
- `full` — verification/governance changes, cross-cutting runtime, major FullWorld changes, ambiguous/unknown runtime impact and any required bootstrap escalation.

Cheap deterministic checks may remain broad if their cost is negligible. Selectivity matters most for expensive browser/render/visual/stress/performance/soak/build work.

### Split policy into two versioned contracts

Implement separate concepts:

1. **Impact manifest** — maps changed repository surfaces/dependencies to impact domains, minimum profile, required group IDs and build/hardware/exclusivity requirements.
2. **Verification catalog** — maps stable group IDs to exact tests/specs/projects, resource class, sequential/parallel eligibility, visual groups, full-safety-net membership and expected evidence.

Reference the existing `e2e/user-visual-scenarios.json` rather than duplicating visual-scenario truth.

### Trusted bootstrap / anti-self-certification

A PR must not modify the selector and then use its modified selector to reduce its own requirements.

Implement a trusted-base lower bound:

`required plan = max/union(trusted protected-base policy, candidate policy)`

Candidate policy may widen verification but may not narrow below the trusted lower bound where verification/governance surfaces changed.

Mandatory bootstrap escalation to `full` must cover changes to, as applicable:

- impact manifest;
- plan generator/validator;
- verification catalog/group resolver;
- Playwright config/shared selection fixtures;
- E2E scheduler/admission/runner code;
- reporter/evidence aggregation;
- visual-review/publisher policy;
- protected-gate workflow logic.

Use strict schema validation and allowlisted group IDs. Candidate values are data, never arbitrary shell fragments/commands.

### Multi-path classification

Never use first-match-wins.

For every PR:

- include current and previous rename paths;
- union all impact domains and required groups;
- choose the maximum minimum-risk profile;
- apply explicit cross-domain escalation when combinations are riskier than individual paths;
- malformed, incomplete or empty changed-file evidence fails closed;
- unmatched runtime-impacting paths fail closed.

## Verification plan and evidence identity

Generate a deterministic machine-readable plan for each exact candidate.

The plan must bind at least:

- schema version;
- repository;
- exact task/head SHA;
- integration/base SHA;
- merge-base/diff identity;
- changed-path digest including rename sources;
- impact-policy digest;
- verification-catalog digest;
- selected profile and impact domains;
- exact required group IDs;
- exact stable test IDs/specs/projects;
- required visual scenario IDs/groups;
- execution/resource class;
- worker-policy ID;
- retry policy;
- required evidence outputs;
- native-hardware requirement;
- performance/soak exclusivity;
- product/publication input digests where applicable.

### Stable suite identity

Do not use a magic scenario count as correctness identity.

A count such as 64/70/71 is diagnostic only. Compare the exact required stable test-ID set to the exact executed test-ID set so missing/duplicated tests cannot cancel each other numerically.

Use a stable Playwright identity equivalent to:

`project + normalized spec path + title path`

Extend `e2e/summary-reporter.mjs` as necessary to emit the path/stable test ID and the metadata needed by exact catalog validation and duration history.

Do not infer resource exclusivity only from filenames; catalog/explicit annotations own resource semantics.

## Main advancement / late integration

A task-head SHA alone is not enough to keep a plan valid forever.

Before merge readiness:

1. resolve current protected `main` again;
2. recompute impact against the late integration base;
3. compare old/new plan requirements;
4. preserve already-passed exact-head group evidence only when the group's inputs/contracts are demonstrably unchanged;
5. rerun newly required/materially invalidated groups;
6. issue a new final plan/evidence aggregate bound to the current integration base;
7. refuse merge readiness if the final plan references a stale base.

Bind group/shard evidence to input digests so moving `main` does not force unrelated work to restart from scratch.

## Molehill execution architecture

Normal heavy PR qualification must become first-class GitHub self-hosted workflow execution, not an externally/manual Desktop Commander status-production path.

Desktop Commander/Desktop Manager remains only:

- control/repair/recovery plane;
- interactive reproduction/debug plane;
- benchmark diagnostics plane;
- artifact/visual inspection plane.

It must not be required to produce routine PR acceptance.

### Reconcile PR #169

Do not duplicate #169 blindly.

Inspect/rebase/reuse or intentionally supersede its useful pieces, including where still correct:

- unique Compose project identity;
- per-slot/lease evidence;
- duplicate-project fencing;
- migration fencing;
- isolated artifact namespaces;
- concurrency/exhaustion/reuse self-tests.

Generic 1..3 slots are migration groundwork, not the final scheduler abstraction. Evolve toward resource-class-aware admission.

### Resource classes

Support explicit classes such as:

- `cpu-light`;
- `browser-targeted`;
- `browser-broad`;
- `browser-full`;
- `render-geometry`;
- `native-gpu`;
- `performance`;
- `soak`;
- `artifact-build`;
- `deployment-live`.

Resource classes must have shared host admission rather than being only runner labels.

### Shared host budget

Admission must account for at least:

- CPU;
- host RAM;
- Docker/WSL memory;
- browser shared memory;
- disk free-space reserve;
- disk/build I/O pressure;
- GPU ownership;
- exclusive-host requirements for calibrated performance/soak.

Do not hard-code limits from the audit snapshot. Select safety reserves from measurements.

### Queue/fairness/backpressure

Implement explicit queue semantics:

- superseded PR heads stop consuming heavy capacity;
- per-PR concurrency keys cancel obsolete work safely;
- cancellation never becomes success evidence;
- independent PRs get fair access and targeted plans cannot be indefinitely starved by full plans;
- performance/soak/native-exclusive work queues behind conflicting heavy jobs;
- nightly has lower/off-peak priority and cannot cancel deployment;
- scheduler/admission records why a job is running, queued, blocked or rejected.

Optimize both useful verified plans/hour and bounded queue/tail latency.

### Runner lifecycle

Define and verify:

- runner instance startup after reboot/logoff conditions relevant to Molehill;
- separate runner names and work directories;
- health/identity verification;
- supported runner version/update policy with version in evidence;
- no shared mutable checkout across instances;
- crash-safe cleanup of only strongly identified stale Atlas resources;
- no routine broad `docker system prune`;
- bounded operator recovery through Desktop Commander.

## Parallel isolation / shared memory

Current `e2e/compose.yml` historically used `ipc: host`; `compose.selfhosted.yml` used per-container `shm_size`.

Before authoritative concurrent slots/jobs:

1. measure current main again;
2. benchmark per-container shared-memory isolation;
3. measure `/dev/shm` pressure for worker counts 2/4/6/8;
4. select per-profile shared-memory budget from evidence;
5. remove host IPC from the normal parallel path if isolated mode is proven stable;
6. reject worker/job combinations causing Chromium OOM/crash/shared-memory instability;
7. do not guess that the nightly `shm_size` value is sufficient for all profiles.

Unique Compose names/artifact paths/ports are necessary but not sufficient isolation.

## Mandatory worker benchmark

Do not change authoritative worker defaults before this benchmark is complete.

### Candidates

Run:

- baseline: 1 worker;
- candidate: 2 workers;
- candidate: 4 workers;
- candidate: 6 workers;
- candidate: 8 workers.

### Workloads

Use at least:

1. the canonical current full required functional suite on one exact SHA;
2. a representative targeted/broad workload including geometry/render/user-journey work.

Do not choose policy from a synthetic microbenchmark.

### Repetitions and order

- minimum 3 clean repetitions per candidate;
- use 5 when variance is high;
- warm dependencies/image cache after one separately measured cold run;
- counterbalance/randomize candidate order between repetitions so thermal/cache drift is not confused with worker effect;
- if the baseline workload itself is unstable, fix it before choosing worker policy.

### Telemetry

Do not rely solely on `Win32_Processor.LoadPercentage`; the audit observed it returning blank on Molehill.

Use verified telemetry, cross-checking where practical:

- Windows performance counters for CPU/disk;
- Docker stats for active containers;
- host and Docker/WSL memory;
- OOM/container/browser crash evidence;
- shared-memory pressure;
- build/cache timings;
- disk I/O;
- GPU/driver data only for native lanes.

Capture benchmark environment fingerprint:

- exact Atlas SHA;
- publication/product input digest;
- Windows build;
- runner version;
- Docker Desktop/engine version;
- WSL/backend/kernel identity where relevant;
- Playwright/browser image digest/version;
- profile/worker count;
- relevant power/thermal metadata for performance experiments;
- GPU/driver identity for native lanes.

### Measurements

Record at least:

- total wall time;
- browser test time;
- build time;
- server/container startup;
- report/evidence generation;
- median/p95 scenario duration;
- first-run failures;
- retries (must remain zero);
- browser/container crash/OOM;
- variance;
- CPU/RAM/Docker/WSL/shared-memory/disk pressure.

### Worker-selection rule

Choose the highest useful worker count that materially improves throughput without increasing deterministic failure rate, instability, variance or resource pressure enough to harm concurrent jobs.

The optimum may differ for `targeted`, `broad` and `full`. Version worker policy by profile/resource class rather than forcing one universal value.

## Multi-job concurrency benchmark

After worker calibration, benchmark host throughput with at least:

- one targeted job;
- two targeted jobs;
- targeted + broad;
- two broad only if admission predicts safe execution;
- one full alone;
- two full only as an experiment, never assumed default;
- performance with conflicting heavy work correctly queued/rejected;
- native GPU with conflicting hardware work correctly queued/rejected.

Primary optimization metric is useful verified plans/hour at stable zero-retry acceptance plus bounded queue latency, not raw Chromium process count.

## Docker optimization

Keep Docker as canonical deterministic correctness environment for functional E2E, deterministic render/geometry, deterministic race/fault and reproducible visual acceptance.

Measure and improve:

- harness image reuse keyed by Dockerfile + lockfile + Playwright/browser inputs;
- BuildKit layer reuse;
- image/tag proliferation;
- unnecessary rebuilds;
- cold vs warm build cost;
- cache hit/miss behavior;
- Windows bind-mount vs Linux/WSL-native staging/volume I/O;
- build context size;
- per-job artifact isolation.

Do not prune all cache after each run. Use bounded threshold/age/disk-pressure hygiene only after evidence.

Do not assume bind mounts are the bottleneck until measured.

## Remove heavy PR dependency on Synology publication capacity

Current checkout-overlay historically proxies publication/product data from `ATLAS_PUBLICATION_ORIGIN`.

Target heavy PR verification should, where feasible, use an immutable local/staged exact publication/product bundle on Molehill so:

- parallel PRs do not load Synology;
- worker benchmarks measure Molehill rather than NAS/network contention;
- product/input digests are directly bound to the plan;
- qualification remains reproducible when the live NAS/network is unavailable.

During migration, any remaining remote publication dependency must be explicit plan evidence and concurrency must be bounded so Synology is never accidentally load-tested.

## Native Windows / GPU lane

Do not move all functional E2E native.

Use a bounded native Chrome/Edge hardware lane only for facts Docker cannot prove, such as:

- real hardware WebGL acceleration;
- RX 9070 XT/driver compatibility;
- hardware frame pacing;
- GPU/browser crash/device-loss behavior;
- calibrated performance;
- selected native soak/leak behavior when production-like hardware truth is the purpose.

Capture exact revision, OS, browser, GPU, driver, acceleration state and plan digest.

Native hardware/performance execution is exclusive unless measurement proves otherwise.

Keep cross-browser Firefox/WebKit compatibility depth conceptually separate from the native Windows/RX 9070 XT hardware-truth lane.

## Duration-aware balancing

First ensure stable test IDs and collect reliable duration history.

Do **not** build a custom sharder merely because duration data exists. Compare Playwright's existing scheduling/worker behavior under real multi-job load first.

Only implement custom duration-aware sharding if measured imbalance remains material. If justified:

- use robust rolling medians/p95 as scheduling metadata only;
- preserve stateful/sequential specs intact;
- respect resource/exclusivity metadata;
- use deterministic fallback when history is missing/stale;
- bind shard membership to the plan/evidence;
- prefer a simple deterministic LPT-style planner over unnecessary scheduler complexity.

## Selective visual evidence

Replace all-or-nothing full visual review with plan-scoped visual groups without weakening the review contract.

- `none/focused`: no visual review unless explicitly required by impact;
- `targeted`: feature-relevant desktop/mobile evidence plus shared-layout smoke;
- `broad`: wider composition/geometry/layout evidence;
- `full`: complete current visual contract.

Required guarantees remain:

- exact revision;
- exact plan/summary/screenshot digest binding;
- reviewer identity;
- actual opening/review of every required frame;
- no auto-approval;
- no tolerance weakening;
- no unauthorized routine publication/upload of restricted full-frame Game-derived evidence.

Failure diagnostics/traces/screenshots/videos remain rich; optimize passing artifact volume only where policy allows.

## Shadow selective rollout and escape hatch

Do not switch immediately from binary full-heavy behavior to selective skipping.

Before selective policy can save work:

1. run new classification/plan generation in shadow mode while legacy heavy behavior remains authoritative;
2. compare predicted `none/focused/targeted/broad/full` plans to actual full-suite outcomes across a meaningful set of real PRs/changes;
3. record classifier misses/over-selection;
4. promote every classifier escape into a permanent manifest/catalog regression test;
5. verify complete current-main full safety net is active;
6. only then enable selective skip/execution behavior.

Provide an auditable `force-full` escape hatch for uncertainty/incidents. It must widen verification only; it cannot be used to reduce required verification.

## Nightly/current-main safety net

Selective PR testing is not complete until periodic/current-main verification explicitly runs the complete full functional regression safety net.

Target periodic coverage includes, on appropriate cadence:

- complete full deterministic suite;
- complete full required Docker functional E2E;
- required visual campaign under the repository's actual-review model;
- repeated geometry/render probes;
- fixed replayable stress seed bank;
- race/fault depth;
- accessibility depth;
- bounded cross-browser critical paths where supported;
- calibrated performance trend lane;
- bounded soak on a separate cadence when appropriate.

Nightly/depth work must not cancel deployment jobs. Reproducible nightly defects become permanent deterministic regressions.

## Correct artifact lifecycle under squash-only merge

Do not claim a PR-head artifact is the exact merged-main release artifact when squash merge creates a different SHA.

Use two lifecycles.

### PR candidate lifecycle

`PR head -> candidate plan -> candidate product/code artifact if needed -> exact-head required verification -> merge gate`

### Merged-main release lifecycle

`exact merged-main SHA -> build release artifact once on Molehill/appropriate compute -> verify that exact release artifact -> transfer/promote same immutable artifact -> Synology verifies digest/revision -> deploy -> bounded live smoke`

Synology must not rebuild the release product.

If PR payload and merged-main payload equivalence is proven deterministically, record it as additional evidence; never relabel a PR artifact with the merged SHA.

Artifact transport/storage must respect rights/provenance restrictions. Do not assume public registry/storage is allowed for all raw product bytes.

## Implementation programme

Do not land the entire programme as one unreviewable mega-PR. The same autonomous agent may carry all phases sequentially, but each phase must be independently reviewable, tested and merged before moving to the next where appropriate.

Recommended sequence, adjusted to current repository state at execution time:

### Phase A — measurement and contracts

- create implementation lifecycle Issue;
- fresh Molehill/environment inventory;
- benchmark harness hardening;
- stable test IDs in reporter;
- impact-manifest schema;
- verification-catalog schema;
- deterministic verification-plan schema/generator tests;
- shadow-only plan output;
- benchmark workers 1/2/4/6/8 without changing authoritative policy.

### Phase B — classifier/trusted bootstrap

- implement `none/focused/targeted/broad/full` plan generation;
- implement protected-base lower bound and full bootstrap escalations;
- exhaustive rename/multi-path/unknown/failure tests;
- keep legacy full-heavy execution as authoritative while shadow validation continues.

### Phase C — plan-aware evidence

- publisher validates exact stable required test-ID set and plan digest;
- remove generic magic count and generic workers=1 assumptions while preserving the explicit current full-plan requirements until worker policy is measured;
- implement plan-scoped visual review;
- stale-plan/base-refresh tests.

### Phase D — Molehill orchestration / #169 reconciliation

- rebase/reuse/supersede #169 deliberately;
- first-class self-hosted workflow execution;
- trust admission;
- runner lifecycle/health;
- isolated workspaces/projects/artifacts/ports;
- per-container shared-memory isolation backed by benchmark;
- shared host resource admission, queue fairness and cleanup.

### Phase E — measured concurrency and Docker efficiency

- run worker + multi-job benchmarks;
- select versioned per-profile worker/resource policy;
- optimize cache/image/build/I/O only where measurements prove benefit;
- remove heavy PR dependence on Synology publication capacity where technically feasible.

### Phase F — selective cutover

- finish shadow calibration;
- activate selective execution only after safety criteria pass;
- retain force-full widening path;
- prove small/unrelated PRs no longer pay full heavy cost while shared/unknown changes remain broad/full.

### Phase G — native hardware truth

- add bounded native Windows/GPU lane with strict trust and exclusivity;
- preserve Docker as deterministic functional authority.

### Phase H — exact merged-main artifact promotion

- build release artifact once off Synology;
- test exact artifact;
- transfer/promote immutable artifact with digest/provenance;
- reduce Synology workflow to verify/deploy/rollback/bounded smoke;
- preserve all exact live revision/integrity checks.

### Phase I — full safety net and closeout

- make current-main/nightly an explicit complete full safety net;
- prove classifier escape handling;
- verify queue/scheduler/resource behavior under real concurrent load;
- produce measured before/after throughput and latency results;
- close implementation lifecycle only after all acceptance criteria pass.

## TDD / negative proofs

For each new gate/policy/scheduler component, write executable negative tests before trusting it.

Required negative classes include at least:

- unknown runtime path selects broad/full;
- verification-policy change cannot self-narrow;
- missing/duplicate stable test ID rejects evidence even if counts match;
- stale integration-base plan rejects final readiness;
- malformed rename/change evidence fails closed;
- untrusted fork cannot reach Molehill heavy/native runner;
- conflicting performance/soak/native work cannot acquire resource admission;
- superseded/cancelled heavy job cannot satisfy success evidence;
- duplicate Compose/project/artifact identity is rejected;
- shared-memory/resource exhaustion rejects or fails explicitly, never becomes flaky green;
- Synology runner label cannot accept heavy resource classes;
- stale/copied visual review/summary cannot satisfy plan-bound publication;
- release deploy refuses artifact whose digest/revision does not match exact merged-main release evidence.

Do not accept a new gate because only its happy path works.

## Acceptance criteria

The programme is complete only when objective evidence proves all of the following:

1. `none/focused/targeted/broad/full` plans are deterministic and versioned.
2. Safe unrelated changes avoid unrelated heavy browser E2E.
3. Pure isolated logic/tooling changes can remain focused.
4. Bounded features select targeted desktop/mobile/common-smoke plus relevant visual/a11y coverage.
5. Shared map/runtime/render/load/input changes select broad/full.
6. Unknown runtime impact fails closed.
7. Candidate verification-policy changes cannot self-narrow below trusted protected-base policy.
8. Plans bind exact head, integration base, diff identity and policy/catalog/resource digests.
9. Main advancement causes plan recomputation without restarting unaffected implementation/evidence from scratch.
10. Stable exact test-ID sets replace magic scenario counts as correctness identity.
11. Retries remain zero and no assertion/tolerance/coverage/provenance weakening occurred.
12. Authoritative worker policy is backed by real 2/4/6/8 Molehill measurements plus 1-worker baseline.
13. Profile-specific worker choices and multi-job capacity are evidence-based.
14. Benchmark telemetry is valid and environment fingerprinted.
15. Two independent safe jobs can run concurrently without checkout, Compose, IPC/shared-memory, port, artifact or publication contamination.
16. Aggregate CPU/RAM/Docker/WSL/shared-memory/disk/GPU resources cannot be oversubscribed beyond configured measured budgets.
17. Performance/soak/native-exclusive jobs cannot compete with conflicting heavy load.
18. Queue fairness/backpressure prevents obsolete work and pathological starvation.
19. Runner lifecycle survives reboot/recovery conditions required by normal operation.
20. Docker cache/image/build/I/O behavior is measurably improved or deliberately retained when no safe gain exists.
21. Heavy PR E2E no longer depends on Synology capacity in the target state, unless a precisely documented unavoidable dependency remains and is bounded.
22. Native GPU lane proves real Windows/browser/GPU facts separately from Docker correctness.
23. Desktop Commander is not required for routine PR heavy qualification.
24. Selective visual evidence remains exact, genuinely reviewed and rights-safe.
25. Shadow calibration demonstrated selective classifier safety before cutover.
26. Force-full widening escape hatch exists and is tested.
27. Complete current-main full functional safety net runs after selective PR testing is enabled.
28. Reproducible classifier escapes/nightly defects can be promoted into permanent regression coverage.
29. Synology runs no heavy E2E/stress/soak/performance/broad visual matrices or expensive reproducible product construction in final state.
30. Exact merged-main release artifact is built once off Synology, verified, transferred unchanged by digest, and deployed unchanged.
31. Synology still proves exact revision, artifact/product integrity, live label/header identity, rollback boundary and bounded desktop/mobile smoke.
32. `atlas-gate` and `provenance-gate` remain protected required checks and exact-head/final-plan fail closed.
33. Median developer PR verification latency and Molehill useful-plan throughput show measured improvement without increased deterministic failure/flake rate or weaker detection.

## Merge and branch lifecycle

For every implementation phase PR:

1. refresh protected `main` before final readiness;
2. reconcile upstream movement normally without discarding valid task history;
3. inspect the complete changed-file set and full diff;
4. run exact applicable deterministic/browser/negative/benchmark verification;
5. require exact-head protected checks and all current required gates;
6. resolve review findings and renew only invalidated evidence after changes;
7. squash merge using expected-head fencing;
8. verify the resulting merged-main SHA and post-merge checks;
9. delete terminal branches unless they have a documented continuing provenance role;
10. continue autonomously to the next programme phase until the implementation lifecycle is truly complete.

Never force push published task history merely because `main` moved. A lost merge race returns the task to integration/reconciliation, not implementation from scratch.

## Final report

At terminal completion report FACT / INFERENCE / UNKNOWN separately and include:

- implementation lifecycle Issue(s);
- every implementation PR and merged SHA;
- admission/integration/task-head lineage for major phases;
- final impact manifest/catalog/plan schema versions and digests;
- worker benchmark 1/2/4/6/8 results and selected per-profile policy;
- multi-job concurrency/queue/resource benchmark results;
- Docker cache/build/I/O before/after measurements;
- runner instances/lifecycle/resource admission state;
- stable test-ID/evidence/publisher migration result;
- shadow selective-testing calibration result and cutover evidence;
- native hardware lane result;
- exact merged-main artifact build/promotion/deployment digest chain;
- Synology final role and bounded live acceptance result;
- nightly/full safety-net evidence;
- exact protected-gate results;
- measured before/after PR latency and useful-plan throughput;
- any remaining external blocker precisely identified.

Do not claim completion from design, partial rollout, successful benchmark alone, or a green subset of tests. Completion requires the implemented end-state and objective exact-revision evidence.