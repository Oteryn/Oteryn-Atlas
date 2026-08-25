# Atlas E2E verification optimization review

Status: independent architecture audit and implementation plan only. This document does **not** authorize or implement runtime, CI, runner, deployment, or test-behaviour mutations.

Lifecycle authority: `Oteryn/Oteryn-Atlas#174`

Audit base: `main@3ec4037c6304d164447ad46d029ac8ad40a9ae0d`

Prior handoff reviewed: `docs/testing/ATLAS-E2E-EXECUTION-OPTIMIZATION-HANDOFF.md` merged by PR #173.

Governing contracts reviewed:

- `AGENTS.md`
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`
- `.github/workflows/ci.yml`
- `.github/workflows/verification-depth.yml`
- `.github/workflows/synology-live-acceptance.yml`
- `tools/verification/classify-pr-changes.mjs`
- `e2e/playwright.config.mjs`
- `e2e/run.ps1`
- `e2e/publish-local-e2e-status.ps1`

Live Molehill-PC was also inspected read-only during this audit.

## 1. Executive assessment

The existing Atlas verification stack is technically strong. The primary weakness is not test technology but orchestration, impact selection, evidence-plan modeling, resource scheduling, and build/deployment placement.

The handoff from PR #173 is directionally correct on the most important points:

- keep the existing deterministic + Playwright + Docker architecture;
- introduce risk/change-aware verification profiles;
- fail closed for unknown runtime impact;
- preserve exact-SHA evidence and zero retries;
- stop treating all non-doc changes as equivalent;
- benchmark Playwright workers rather than guessing;
- move normal heavy verification to GitHub self-hosted runners on Molehill;
- keep Synology out of heavy E2E/stress/soak/performance/broad visual work;
- use Docker for deterministic browser correctness and native Windows only where real GPU/driver truth is actually the subject;
- move toward build-once -> test-same-artifact -> deploy-same-artifact;
- use full scheduled regression as the safety net once PR verification becomes selective.

However, the handoff is incomplete in one important operational respect: an open draft PR #169 already implements a bounded heavy-E2E slot pool and a 1/2/3 concurrent full-gate benchmark harness. Any implementation programme that ignores #169 would duplicate or conflict with active work. The target architecture should absorb or supersede #169 intentionally after rebase/audit, not create a second parallel scheduling mechanism.

Overall current-state score: **7/10 for test quality, 4/10 for execution efficiency, 3/10 for resource-aware scheduling, 9/10 for fail-closed/exact-revision discipline.**

## 2. Verified current state

### 2.1 GitHub authority and protected gates

At audit time, protected `main` is `3ec4037c6304d164447ad46d029ac8ad40a9ae0d`. Required protected status checks are `atlas-gate` and `provenance-gate`.

This exact-head discipline is good and must remain intact.

### 2.2 Current PR change classification is binary

`tools/verification/classify-pr-changes.mjs` currently returns only:

- `docs_only=true/false`
- `requires_e2e=true/false`

Only lowercase Markdown under `docs/**` is exempt from heavy E2E. Mixed, malformed, empty, root-doc, workflow, runtime, test, package, data, or unknown changes all fail closed into heavy E2E.

That behavior is safe but too coarse.

### 2.3 CI still fans out broad cheap checks on every PR

`.github/workflows/ci.yml` runs repository, semantic, browser-semantic, browser-WebGL, project, and deterministic verification jobs broadly. That is acceptable for inexpensive deterministic checks, but the workflow does not yet produce or consume a machine-readable verification plan.

For heavy browser verification, GitHub-hosted CI does not execute the Molehill job directly. Instead, `verification-browser` checks whether exact-head `atlas-local-e2e=success` already exists.

This creates a split control path where normal PR CI waits for externally produced local evidence rather than scheduling the heavy runner as a first-class GitHub Actions job.

### 2.4 Heavy local E2E is globally serialized on current main

`e2e/run.ps1` currently owns a machine-wide exclusive lock:

`%TEMP%/oteryn-atlas-heavy-e2e.lock`

The current main branch therefore intentionally serializes heavy E2E. This protects stability but blocks safe concurrency.

### 2.5 An overlapping concurrency implementation already exists

Open draft PR #169 (`test/issue-168-parallel-e2e-slots`) introduces:

- `ATLAS_E2E_SLOT_COUNT` with range 1..3;
- optional exact slot selection;
- exclusive per-slot locks;
- duplicate Compose-project fencing;
- migration fencing against the legacy global lock;
- per-run slot lease evidence;
- a Windows self-test for slot concurrency/exhaustion/reuse;
- a 1/2/3 full-gate benchmark harness with workers fixed to 1.

This is useful groundwork but is not the complete destination. It models full-gate concurrency, not profile-aware resource classes, global CPU/RAM/GPU budgeting, or the required Playwright 2/4/6/8 worker sweep.

### 2.6 Playwright worker configuration is underused

`e2e/playwright.config.mjs` currently defaults to `ATLAS_E2E_WORKERS=2`, keeps `fullyParallel=false`, and keeps `retries=0`.

The exact-head publisher, however, refuses evidence unless `metadata.workers == 1`. Nightly browser depth also explicitly sets `ATLAS_E2E_WORKERS='1'`.

So the stack is configurable for >1 worker, but acceptance policy currently prevents using it for authoritative full PR evidence.

### 2.7 Exact-head status publication is coupled to one full census

`e2e/publish-local-e2e-status.ps1` currently requires:

- summary status `passed`;
- exact expected revision == Git HEAD;
- checkout-overlay mode;
- `workers=1`;
- exactly 64 scenarios;
- all 64 passed;
- zero retries;
- complete visual review bound to the exact summary and screenshot digests.

The exact revision, zero retries, visual-review binding, and dirty-tree/remote-head checks are strong and must remain. The fixed worker count and magic 64-scenario census are architecture debt once verification becomes selective.

### 2.8 Nightly is depth, not a complete future safety net

`.github/workflows/verification-depth.yml` currently:

- runs scheduled deterministic depth on GitHub-hosted Ubuntu;
- uses Molehill for read-only Docker browser depth;
- pins `ATLAS_E2E_WORKERS=1`;
- runs repeated geometry/render probes;
- runs four replayable stress seeds;
- runs extra DPR/tablet profiles;
- conditionally executes optional performance/visual/accessibility/race-fault/soak-leak specs if present.

This is additive depth. It is not yet the explicit complete full-regression safety net that will be required after selective PR verification is enabled.

### 2.9 Synology currently does heavy reproducible product construction

The live Synology workflow is correctly constrained to merged `main`, exact revision identity, runner identity, bounded deployment/live acceptance, and rollback boundaries. However, it also performs substantial reproducible build work, including:

- fetching exact Atlas/Game/legacy sources;
- downloading and hashing source assets;
- constructing appearance/spatial/animated creature products;
- building creature index and animation runtime products multiple times for determinism;
- performing product-integrity checks before live cutover.

That violates the desired end-state role split, even though it is currently within the historical workflow contract. Heavy reproducible product construction should move to an appropriate compute runner and Synology should consume an immutable tested artifact/product bundle.

This does **not** justify weakening Synology revision/integrity checks; those must remain after artifact promotion.

## 3. Molehill-PC live audit

Read-only inspection during this review established:

- host name: `Molehill-PC`;
- CPU: AMD Ryzen 7 9800X3D;
- 8 physical cores / 16 logical processors;
- GPU: AMD Radeon RX 9070 XT plus integrated Radeon graphics;
- Docker Desktop engine exposes 16 CPUs;
- Docker reports approximately 47 GiB available memory to the engine;
- the GitHub runner listener is active as `Runner.Listener.exe`;
- runner path: `C:\Users\barte\oteryn-actions-runner-atlas-local`;
- runner identity: `oteryn-molehill-atlas`;
- runner pool/group identity: `atlas-runners`;
- runner work folder: `_work`;
- Docker inventory at audit time: 327 images / ~30.97 GB image data, 673 build-cache entries / ~40.62 GB cache, with ~20.39 GB reported reclaimable build cache.

This confirms the machine has materially more capacity than authoritative `workers=1` consumes, but it does **not** prove that 4, 6, or 8 workers are optimal or that multiple full-gate jobs can safely saturate all logical CPUs simultaneously.

## 4. Concrete problems

### P0 - No versioned verification-plan contract

Today the gate answers only `requires_e2e` instead of answering **what exact verification is required for this exact change**.

Consequences:

- no stable `none/focused/targeted/broad/full` semantics;
- no machine-readable required test groups;
- no selective visual-evidence contract;
- no explicit resource class;
- no exact verification-plan digest tied to status publication;
- no clean path from PR impact to scheduler placement.

### P0 - Heavy PR verification is not first-class GitHub-runner orchestration

`verification-browser` checks an externally published status rather than scheduling the Molehill qualification job directly.

That makes Desktop Commander/manual orchestration too important in normal flow and weakens observability of queueing, concurrency, artifacts, and runner utilization.

### P0 - Global full-gate assumptions block selective testing

`workers=1`, exact 64-scenario census, and full visual census are hard-coded into authoritative publication.

These are safe only while every runtime PR requires the same full plan.

### P1 - Global heavy lock is too coarse

Current main serializes all heavy E2E even when two targeted browser plans could safely coexist.

PR #169 improves this with a slot pool, but fixed generic slots still do not encode distinct resource characteristics.

### P1 - No cross-runner resource budget

Two runner jobs can only be safe if the host has a shared machine budget. Per-job worker counts alone are insufficient.

A dangerous design would be:

- runner A: 8 Playwright workers;
- runner B: 8 Playwright workers;
- concurrent Docker builds;
- plus native GPU/performance work.

That can saturate CPU, memory, WSL2/Docker I/O, and invalidate performance evidence.

### P1 - Worker count is policy-constrained rather than benchmark-selected

Current authoritative acceptance fixes one worker. The handoff correctly proposes 2/4/6/8 benchmarking, but the implementation must benchmark each candidate repeatedly on the same exact SHA and same profile before changing defaults.

### P1 - Duration information exists but is not used for scheduling

The summary reporter already records scenario duration. There is no scheduler using rolling historical durations to balance shards.

### P1 - Docker build/cache model is operationally expensive

Molehill has significant image and BuildKit cache accumulation. The current stack benefits from cache, so unconditional pruning would be harmful. The real issue is unnecessary image/tag proliferation and avoidable rebuild work.

### P1 - Build/test/deploy artifact identity is not yet unified

Synology can reconstruct products independently after merge. That means the thing heavily verified before merge and the thing deployed may be logically equivalent but not the exact same immutable product artifact.

### P2 - Visual evidence is all-or-nothing

The current full required visual contract is appropriate for full gates but too expensive for a narrow targeted feature change.

Targeted changes need an explicit required-visual subset determined by the verification plan, while broad/full plans retain stronger visual coverage.

### P2 - Nightly policy must change once PR testing becomes selective

Current nightly is additive. After selective PR testing lands, nightly/main must own a complete full functional regression safety net.

### P2 - Native GPU truth is not a first-class lane

Docker/SwiftShader-style deterministic rendering is valuable, but it is not proof of the actual Windows/RX 9070 XT/driver stack. Real GPU evidence should be a separate bounded lane, not mixed into every functional test.

## 5. Corrected target architecture

Target flow:

`PR exact head -> impact graph/classifier -> verification plan -> hosted cheap gates -> Molehill scheduler -> Docker deterministic browser plan -> optional native hardware lane -> plan-bound exact-SHA evidence -> atlas-gate -> merge -> deploy exact tested artifact -> Synology integrity/revision + bounded live smoke -> nightly full/depth safety net`

### 5.1 Central impact manifest

Create one versioned machine-readable impact manifest that maps repository surfaces to:

- impact domain(s);
- minimum risk profile;
- required deterministic groups;
- required browser groups;
- required projects/devices;
- visual scenario groups;
- resource class;
- hardware requirement;
- exclusivity flag;
- artifact/build requirement.

The manifest must be tested as executable policy.

Unknown runtime paths must fail closed.

### 5.2 Required risk profiles

#### `none`

Use for changes proven not to affect executable behavior, for example safe docs/prompts/evidence-only paths.

Browser E2E: none.

Cheap repository/provenance checks may still run if effectively free or required by branch policy.

#### `focused`

Use for isolated pure logic, parser, schema, tooling, or deterministic generator changes where no browser-visible runtime is affected.

Required:

- relevant unit/contract/property tests;
- affected deterministic generation/integrity checks;
- no browser E2E unless the impact manifest maps the path to runtime consumption.

#### `targeted`

Use for one bounded user-facing feature or panel whose shared-runtime dependencies are understood.

Required:

- feature deterministic tests;
- feature desktop/mobile E2E;
- small shared smoke;
- relevant accessibility;
- relevant targeted visual scenarios;
- relevant geometry/render checks only when the feature intersects those systems.

#### `broad`

Use for shared map/runtime/state/render/load/input infrastructure.

Required:

- wide deterministic contracts;
- geometry/render/race/failure coverage;
- representative user journeys;
- broader visual/accessibility set;
- stress where the changed code participates in hot/shared paths.

#### `full`

Use for verification-harness changes, publication/evidence policy changes, cross-cutting shared runtime, major FullWorld architecture, classifier/manifest/publisher changes, and unknown runtime impact that cannot be safely narrowed.

Required:

- complete required functional browser matrix;
- full required visual-review contract;
- full deterministic set;
- exact plan-bound evidence.

### 5.3 Fail-closed rules

These cases must map to `broad` or `full`, never `none/focused`:

- unknown runtime path;
- changed classifier/impact manifest itself;
- changed E2E harness/config/reporter/publisher;
- changed shared viewport/camera/renderer/input/load state;
- malformed/empty change-set evidence;
- inability to resolve rename source path;
- changed files whose impact classification is ambiguous;
- dependency graph mismatch or unsupported manifest version.

### 5.4 Verification-plan artifact

Generate `verification-plan.json` for each exact PR head.

Minimum fields:

- schema version;
- repository;
- exact head SHA;
- exact base SHA;
- changed-path digest including rename sources;
- manifest version/digest;
- selected profile;
- matched impact domains;
- deterministic groups;
- browser groups/specs;
- Playwright projects;
- required visual scenario IDs/groups;
- execution class;
- resource class;
- worker-policy ID;
- retry policy;
- expected evidence outputs;
- whether native hardware proof is required;
- whether performance/soak must be exclusive.

The final exact-head status must bind to the plan digest.

### 5.5 Resource classes

Recommended classes:

- `cpu-light`: hosted or Molehill light work, non-exclusive;
- `browser-targeted`: shared bounded slots;
- `browser-broad`: heavier shared slot, lower concurrency;
- `browser-full`: largest deterministic Docker budget;
- `render-geometry`: bounded, optionally shared only after benchmark proof;
- `native-gpu`: one hardware lane at a time;
- `performance`: exclusive host ownership;
- `soak`: exclusive or explicitly reserved near-exclusive ownership;
- `artifact-build`: bounded CPU/RAM/I/O budget;
- `deployment-live`: Synology-only and independent from Molehill compute scheduling.

Do not encode resource class only as a GitHub runner label. The host needs a shared admission-control mechanism so multiple runner instances cannot independently overcommit the same CPU/RAM/GPU budget.

### 5.6 Molehill runner model

The desired operating model is multiple isolated GitHub self-hosted runner instances with independent work directories, plus shared machine resource admission.

A good initial target is two normal runner instances, not because two is proven optimal, but because it creates enough scheduling capacity to compare single-vs-dual job throughput without uncontrolled proliferation.

Final runner count and browser slot count must be benchmark-selected.

PR #169's slot-pool work should be reused where it remains correct, especially:

- unique Compose project identity;
- per-slot lease evidence;
- migration fencing;
- isolated artifact namespaces;
- explicit concurrency self-tests.

But generic slot count must evolve into resource-class-aware admission rather than becoming the final scheduler abstraction.

## 6. Playwright worker benchmark plan

No worker count should be promoted to authoritative policy from this audit alone.

### 6.1 Candidates

Benchmark exactly:

- 2 workers;
- 4 workers;
- 6 workers;
- 8 workers.

Retain a 1-worker baseline for comparison even though 1 is not one of the selection candidates.

### 6.2 Workloads

Run at least two workloads:

1. canonical full required functional suite on one exact SHA;
2. representative targeted/broad plan containing geometry/render/user-journey work.

Do not use a synthetic micro-benchmark as the primary worker-selection oracle.

### 6.3 Repetitions

At least 3 clean repeated runs per worker count; 5 is preferable if variance is high.

Run from a warmed Docker dependency/image-cache state after one separately recorded cold build.

### 6.4 Measurements

Capture:

- total wall time;
- Playwright test execution time;
- image build time;
- container/server startup time;
- evidence/report generation time;
- median scenario duration;
- p95 scenario duration;
- scenario count;
- first-run failures;
- retries (must remain zero);
- browser crashes;
- container exits/OOM;
- CPU utilization distribution;
- free/used RAM and Docker/WSL memory pressure;
- disk I/O and major Docker build I/O;
- GPU activity only for native GPU lane, not as a functional-Docker requirement;
- variance between repetitions.

### 6.5 Selection rule

Choose the highest worker count that produces a material throughput gain **without**:

- increased deterministic failure rate;
- materially worse variance;
- browser/container instability;
- memory pressure that risks concurrent jobs;
- starving the second runner/job lane;
- invalidating performance measurements.

The optimum for one full job may differ from the optimum per job when two jobs run concurrently. Therefore the implementation must benchmark both:

- one job at W workers;
- two concurrent jobs at selected per-job worker counts.

Do not simply select the fastest single-job number if it reduces total host throughput or causes cross-job instability.

## 7. Concurrency benchmark plan

Integrate with or supersede PR #169's 1/2/3 slot benchmark.

Required matrix after worker calibration:

- 1 concurrent targeted job;
- 2 concurrent targeted jobs;
- 1 targeted + 1 broad job;
- 2 broad jobs only if resource model predicts safe admission;
- 1 full job alone;
- 2 full jobs only as a measured experiment, not default policy;
- performance job with all heavy competitors rejected/queued;
- native-GPU job with conflicting native-GPU work rejected/queued.

Primary optimization metric: useful verified plans/hour at stable zero-retry acceptance, not raw Chromium-process count.

## 8. Duration-aware sharding

Use historical scenario/spec duration only as scheduling metadata, never as a correctness oracle.

Maintain rolling bounded timing history keyed by stable test identity and environment class.

For sharding:

- compute balanced bins using median or robust rolling duration;
- keep stateful/sequential specs intact;
- respect resource/exclusivity tags;
- avoid assigning all long geometry/render specs to one shard;
- record generated shard membership in the verification plan/evidence;
- fall back deterministically when timing history is absent or stale.

A simple longest-processing-time-first bin packing policy is sufficient initially; a sophisticated scheduler is unnecessary until measurements prove value.

## 9. Docker strategy

### Keep Docker for

- canonical deterministic functional browser E2E;
- targeted/broad/full correctness plans;
- deterministic visual regression;
- deterministic geometry/render probes when hardware identity is not under test;
- race/fault/replay cases intended to be reproducible;
- exact-SHA functional acceptance.

### Improve Docker by

- reusing a harness image keyed by Dockerfile + lockfile + Playwright version + harness dependency inputs;
- using unique Compose project names for isolation instead of rebuilding equivalent heavy images per project;
- preserving BuildKit cache;
- using scheduled/threshold-based cache hygiene instead of prune-after-test;
- measuring bind-mount I/O versus staged Linux/WSL-native checkout/volume before changing the filesystem model;
- separating dependency-image build from exact-source overlay where technically safe;
- recording build-cache hit/miss and image reuse evidence in benchmarks.

### Do not

- remove Docker purely for speed;
- prune all cache after each run;
- let concurrent Compose projects share mutable artifact paths or publication-forwarder ports;
- assume Windows bind mounts are the dominant bottleneck without measurement.

## 10. Native Windows / hardware GPU lane

Use native Windows Chrome/Edge only for evidence Docker cannot provide:

- hardware-accelerated WebGL initialization;
- actual RX 9070 XT / driver compatibility;
- GPU/browser crash or device-loss behavior;
- hardware frame pacing;
- calibrated performance metrics;
- selected native soak/leak behavior when production-like hardware truth matters.

Capture:

- exact Atlas revision;
- OS build;
- browser version;
- GPU adapter;
- driver version;
- hardware acceleration status;
- test-plan digest.

Native GPU/performance work should normally be exclusive because concurrent heavy Docker work can distort measurements.

## 11. Desktop Commander role

Desktop Commander/Desktop Manager should remain:

- control plane;
- repair/recovery plane;
- interactive debugging plane;
- artifact inspection plane;
- one-off benchmark/diagnostic launcher when explicitly needed.

It should not remain the canonical normal path for producing PR acceptance status once self-hosted runner orchestration is implemented.

## 12. Selective visual evidence

Replace the global all-or-nothing visual requirement with plan-scoped visual groups.

Rules:

- `none/focused`: no user visual review unless the actual impact manifest requires it;
- `targeted`: only feature-relevant desktop/mobile/user-visible scenarios plus shared-layout smoke;
- `broad`: broader composition/geometry/layout evidence;
- `full`: complete required visual scenario contract.

The strong review guarantees remain unchanged:

- evidence must be exact-revision;
- required frames must actually be opened/reviewed;
- review manifest must bind reviewer identity, plan digest, summary digest, and screenshot digests;
- no auto-approval;
- no weakened visual tolerances.

## 13. Nightly safety net

Once selective PR testing is enabled, scheduled/current-main verification must explicitly include the complete full functional regression matrix.

Recommended nightly order:

1. complete full deterministic suite;
2. full required Docker functional E2E;
3. complete required visual contract or a scheduled reviewed visual campaign where automated nightly human review is not practical;
4. repeated geometry/render probes;
5. fixed replayable stress seed bank;
6. selected race/fault depth;
7. calibrated accessibility depth;
8. optional cross-browser critical-path differential suite;
9. calibrated performance trend lane on stable hardware;
10. bounded soak on a separate cadence if runtime length is high.

Any reproducible defect discovered by nightly must become a permanent deterministic regression before the fix is accepted.

## 14. Build once -> test same artifact -> deploy same artifact

Target artifact pipeline:

`exact source SHA -> immutable product build -> digest/provenance manifest -> deterministic verification against that artifact -> merge/promotion -> Synology pulls/verifies exact artifact -> live cutover -> bounded live smoke`

The artifact manifest should bind:

- Atlas source SHA;
- Game/input authority SHAs/digests where applicable;
- product content digests;
- builder identity/version;
- build recipe version;
- verification-plan/evidence digests where appropriate.

Synology must still verify:

- deployed revision identity;
- container label/header identity;
- artifact digests/provenance;
- publication integrity;
- bounded desktop/mobile live smoke;
- rollback boundary.

Synology must **not** become the fallback for heavy E2E, stress, soak, performance, broad visual matrices, or expensive reproducible product construction.

## 15. Proposed implementation changes by file/workflow

This is a proposed target, not an instruction to mutate all files in one PR.

### Phase A - contracts and benchmarks

Add:

- `tools/verification/impact-manifest.json` or equivalent versioned policy file;
- `tools/verification/build-verification-plan.mjs`;
- `tests/verification/impact-manifest.test.mjs`;
- `tests/verification/verification-plan.test.mjs`;
- `e2e/benchmark-workers.ps1`;
- benchmark evidence schema under `docs/testing/evidence/` or generated artifacts only, depending repository evidence policy.

Modify only as needed:

- `tools/verification/classify-pr-changes.mjs` to become or delegate to plan generation;
- existing classifier regression tests.

### Phase B - plan-aware CI

Modify:

- `.github/workflows/ci.yml`

Add outputs for:

- profile;
- plan digest;
- heavy required boolean;
- resource class;
- native hardware requirement.

Prefer a first-class Molehill job/reusable workflow over an external manually produced status once migration is safe.

### Phase C - plan-aware publisher/evidence

Modify:

- `e2e/publish-local-e2e-status.ps1`;
- `e2e/summary-reporter.mjs` if additional plan metadata is required;
- visual-review tooling;
- publisher regression tests.

Remove fixed `workers=1` and fixed 64 count from generic publication while preserving them as explicit requirements of the `full-v1` plan until intentionally changed.

### Phase D - Molehill scheduler

Reconcile with PR #169 before implementation.

Potential files:

- `e2e/heavy-slot-pool.ps1` from #169;
- `e2e/run.ps1`;
- new `e2e/resource-admission.ps1`;
- scheduler/admission self-tests;
- runner bootstrap/operator documentation.

Use resource classes and shared admission, not an unbounded number of GitHub runner instances.

### Phase E - Docker/image/I/O efficiency

Review:

- `e2e/Dockerfile`;
- `e2e/compose.yml`;
- `e2e/compose.selfhosted.yml`;
- build contexts and bind mounts;
- image naming/tag policy.

Add benchmark evidence before changing the storage/mount model.

### Phase F - duration-aware sharding

Add a small deterministic shard planner and tests.

Potential files:

- `tools/verification/plan-shards.mjs`;
- `tests/verification/shard-planner.test.mjs`;
- bounded timing-history artifact/store contract.

### Phase G - native hardware lane

Add a separate self-hosted workflow/job for hardware truth.

Do not merge it into the deterministic Docker functional gate.

### Phase H - artifact promotion / Synology reduction

Modify:

- build workflow(s);
- `.github/workflows/synology-live-acceptance.yml`;
- deployment/integrity tests.

Move reproducible heavy construction off Synology and replace it with exact immutable artifact verification/promotion.

### Phase I - nightly full safety net

Modify:

- `.github/workflows/verification-depth.yml`

Ensure complete full functional regression is explicitly included after PR selection becomes selective.

## 16. Implementation staging

Do **not** ship all architecture changes in one mega-PR.

Recommended sequence:

1. **Measurement/contract PR** - benchmark tooling, impact manifest schema, plan schema, no behavioral selection change yet.
2. **Risk classifier PR** - generate `none/focused/targeted/broad/full`, fail closed, keep old heavy behavior as compatibility fallback initially.
3. **Plan-aware evidence PR** - publisher validates plan instead of magic global census.
4. **Runner orchestration PR** - reconcile/merge/supersede #169, move normal heavy flow to GitHub self-hosted runner jobs.
5. **Resource admission PR** - shared machine budget, multiple isolated runners/jobs, worker defaults based on benchmark.
6. **Docker efficiency PR** - only changes supported by measured build/cache/I/O evidence.
7. **Native GPU lane PR** - bounded hardware truth.
8. **Artifact promotion PR** - exact built/tested artifact promoted to Synology.
9. **Nightly safety-net PR** - full regression explicitly covers classifier escape risk.

At each phase, exact-head protected gates remain mandatory.

## 17. Risks and safety mechanisms

### Risk: classifier misses a dependency

Mitigation:

- unknown runtime paths -> broad/full;
- explicit critical-path regression tests;
- manifest versioning and code review;
- nightly complete full matrix;
- promotion of every classifier escape into a permanent manifest/test regression.

### Risk: resource oversubscription

Mitigation:

- shared host admission controller;
- bounded runner count;
- resource-class tokens;
- memory/CPU guardrails;
- performance/soak exclusive lanes;
- empirical concurrency benchmark.

### Risk: false speedup from warm cache

Mitigation:

- record cold and warm build separately;
- compare repeated warm-state runs for worker selection;
- record cache-hit evidence.

### Risk: flaky parallel stateful tests

Mitigation:

- keep `fullyParallel=false` globally unless individual independence is proven;
- tag/keep stateful journeys sequential;
- split only verified independent specs;
- zero retries remains acceptance policy.

### Risk: stale success satisfies a new plan

Mitigation:

- status evidence binds exact head SHA, base SHA, changed-path digest, plan digest, summary digest, and required visual digests.

### Risk: selective visuals hide layout regressions

Mitigation:

- targeted plans include shared-layout smoke;
- broad/full retain wider composition review;
- nightly complete visual/depth campaign catches classifier mistakes.

### Risk: Synology regains heavy work as fallback

Mitigation:

- explicit workflow/contract tests rejecting heavy classes on `oteryn-atlas` runner label;
- Molehill unavailable -> heavy proof is BLOCKED;
- no automatic runner-label fallback.

## 18. Acceptance criteria

The implementation programme is complete only when all of the following are proven with exact-head evidence:

1. Safe unrelated changes can select `none` without heavy browser E2E.
2. Isolated pure logic/tooling changes can select `focused`.
3. Bounded feature changes can select `targeted` with relevant desktop/mobile/visual/accessibility coverage.
4. Shared runtime/render/load/state changes select `broad` or `full`.
5. Unknown runtime impact fails closed.
6. Verification-plan generation is deterministic and machine-readable.
7. Plan digest is bound to exact head/base/change identity.
8. `atlas-gate` remains required and fail closed.
9. `provenance-gate` remains required and unchanged in authority.
10. Retries remain zero for deterministic acceptance.
11. Assertions, tolerances, geometry oracles, and coverage are not weakened for speed.
12. Fixed magic `64` is replaced by a plan-specific expected census; full profile remains complete.
13. Worker default is selected only after measured 2/4/6/8 benchmark evidence.
14. Benchmark repeats show no increased deterministic failure/flake rate.
15. Two independent safe Molehill jobs can run concurrently without workspace, Compose, port, artifact, or publication-forwarder contamination.
16. Shared host admission prevents aggregate CPU/RAM/GPU oversubscription.
17. Performance/soak cannot run with competing heavy load.
18. Duration-aware shards are measurably better balanced than naive splitting.
19. Docker image/build-cache reuse measurably reduces repeated build cost.
20. Cache hygiene does not destroy useful warm-cache performance.
21. Native GPU lane proves real Windows/browser/GPU facts separately from Docker correctness.
22. Desktop Commander is no longer required for routine heavy PR orchestration.
23. Synology executes no heavy E2E, stress, soak, performance, or broad visual/render matrix.
24. Heavy reproducible product build work is removed from Synology once exact artifact promotion is available.
25. Synology still verifies exact revision, artifact/product integrity, live identity, rollback boundary, and bounded live smoke.
26. Selective visual evidence remains cryptographically bound and genuinely reviewed.
27. Nightly/current-main runs a complete full functional safety net after selective PR testing is enabled.
28. A classifier escape discovered by nightly can be reproduced and promoted into a permanent regression.
29. Build-once/test-same-artifact/deploy-same-artifact is proven by immutable digest identity.
30. Measured median PR verification wall time and Molehill useful-plan throughput improve without higher variance or failure rate.

## 19. Conclusions about the PR #173 handoff

### Correct recommendations

The following should be retained:

- risk-based profiles;
- fail-closed unknown impact;
- plan-bound exact-SHA evidence;
- 2/4/6/8 worker benchmark;
- duration-aware scheduling;
- Docker correctness + native hardware truth split;
- self-hosted Molehill as heavy execution engine;
- Desktop Commander as control/debug plane only;
- selective visual evidence;
- nightly full safety net;
- build/test/deploy same artifact;
- no heavy Synology fallback.

### Recommendations needing correction or additional constraints

1. **Multiple runner instances are not sufficient by themselves.** They require shared machine admission control.
2. **Generic slots are not the final scheduler model.** PR #169 is useful migration groundwork but must evolve toward resource classes.
3. **The handoff did not account for active PR #169.** The implementation agent must reconcile it first.
4. **The current `verification-browser` status-check pattern should not remain the desired end state.** Heavy PR jobs should become first-class GitHub self-hosted workflow execution once migration is safe.
5. **Synology optimization is more substantial than merely moving "some expensive work".** Current live workflow performs major deterministic product construction; artifact promotion should explicitly remove that compute from Synology.
6. **Worker optimization and multi-job optimization are coupled.** The fastest workers-per-job value may be wrong for total host throughput when two PRs execute concurrently.
7. **Nightly must become a complete full regression, not only additive depth, before selective PR gating can be considered safe.**

## 20. Recommended implementation-agent alias

`ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION`

The implementation agent must begin from fresh `main`, read this review, Issue #174, PR #169, `AGENTS.md`, and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`, and must not select worker counts or concurrency defaults without fresh Molehill benchmark evidence.