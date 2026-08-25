# Atlas E2E execution optimization handoff

Status: analysis/handoff only; no runtime, workflow, runner, deployment, or test-behaviour mutation is authorized by this document.

Snapshot authority used for this handoff:

- repository: `Oteryn/Oteryn-Atlas`
- base branch: `main`
- audited base SHA: `ee7c8a53e6b5ac46c7620065bcf5e03694e24c5b`
- lifecycle Issue for this docs-only handoff: `NOT_APPLICABLE`
- governing repository policy: `AGENTS.md`
- verification architecture: `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`

The next implementation agent MUST refresh `main`, `AGENTS.md`, active issues/PRs, runner state, and actual hardware measurements before changing anything. This document intentionally records recommendations and observed constraints rather than silently changing the current verification contract.

## 1. Goal

Evolve Atlas verification so that it preserves or improves regression-detection quality while using substantially less developer time and making materially better use of Molehill-PC.

The target is not "run fewer tests at any cost". The target is:

> Run the minimum complete verification set justified by the actual change risk, execute it with resource-aware parallelism, preserve deterministic exact-SHA evidence, and retain an independent periodic full safety net.

This handoff combines the following requirements raised during review:

1. E2E must not run for unrelated changes.
2. Large/heavy E2E must not run after every small change.
3. More than one useful verification activity must be able to use Molehill-PC concurrently when resource-safe.
4. Heavy test workloads must never be moved to Synology because it is not the heavy-compute runner.
5. The test suite itself should be optimized to use Molehill CPU/RAM/GPU/cache efficiently.
6. Docker vs native execution should be selected by verification purpose rather than ideology.
7. Desktop Commander/Desktop Manager should not be the canonical execution engine for normal PR verification.

## 2. Current test stack is fundamentally sound

Do not replace the current stack merely to optimize throughput. The existing layers are strong and should normally be retained:

- deterministic `node:test` and Python tests for logic/contracts/tooling;
- property/invariant tests;
- Playwright `1.62.0` for browser E2E;
- pinned Playwright container image;
- Docker Compose for deterministic browser qualification;
- desktop and mobile/touch browser projects;
- geometry oracles;
- WebGL/render probes;
- race-condition tests;
- resilience/fault-injection tests;
- visual verification and user-facing evidence;
- accessibility checks;
- deterministic/replayable user journeys;
- seeded stress;
- performance and soak/depth suites;
- exact-SHA evidence and provenance gates.

The main problem identified in this audit is orchestration, execution placement, resource use, and selection granularity, not lack of test technology.

## 3. Current concrete constraints that cause unnecessary cost

### 3.1 PR change classification is effectively binary

`tools/verification/classify-pr-changes.mjs` currently exempts only safe lowercase Markdown under `docs/**`. Everything else is treated as requiring heavy E2E.

That means a small isolated change can require the same heavy browser qualification as a broad shared-runtime change.

The current regression contract in `tests/verification/docs-only-e2e-gating.test.mjs` intentionally pins that behaviour, so implementation requires changing both classifier semantics and tests.

### 3.2 Local heavy E2E is globally serialized

`e2e/run.ps1` currently uses a machine-wide exclusive lock (`oteryn-atlas-heavy-e2e.lock`). This prevents independent heavy/targeted jobs from sharing Molehill even when they would be safe to execute concurrently.

The lock is appropriate as protection against uncontrolled contention, but a single global mutex is too coarse for the desired future model.

### 3.3 Exact-head status publication assumes one fixed full suite

`e2e/publish-local-e2e-status.ps1` currently requires, among other things:

- `workers=1`;
- exactly 64 scenarios;
- all scenarios passed;
- zero retries;
- full required visual review bound to the exact summary.

This prevents safe adoption of targeted/broad profiles and prevents publishing valid exact-head evidence produced with multiple workers.

The zero-retry and exact-SHA requirements should remain strong. The fixed worker count and fixed 64-scenario census should be replaced by a verification-plan contract.

### 3.4 CI is selective only in limited places

Some workflows already use good path filtering (for example creature overlay and Docker harness workflows), but the primary CI fan-out still runs several deterministic/browser jobs for every PR regardless of impact.

Optimization should not focus only on Playwright. Cheap tests can remain broad when their cost is negligible, but expensive jobs should become impact-aware.

### 3.5 Synology live workflow currently performs more work than the desired role split

Repository policy already says Synology owns merged-main deployment/live acceptance only and must not be used as a substitute heavy verification runner.

The long-term target should move expensive reproducible product building/qualification away from Synology where practical, leaving Synology with deployment, integrity verification, revision identity, rollback boundaries, and bounded live smoke.

## 4. Recommended verification-selection architecture

Introduce a central versioned impact model rather than a single `requires_e2e` boolean.

Conceptual flow:

`changed paths -> impact/dependency classification -> risk profile -> verification plan -> execution placement -> exact-SHA evidence`

Recommended risk profiles:

| Profile | Typical change | Expected verification |
| --- | --- | --- |
| `none` | docs/prompts/evidence-only | no browser E2E |
| `focused` | isolated pure logic/parser/tooling | relevant unit/contract/property only |
| `targeted` | one user feature/panel | feature E2E + small common smoke + relevant accessibility/visual |
| `broad` | shared map/runtime/renderer/state/load path | wider geometry/render/race/user-journey/failure coverage |
| `full` | cross-cutting FullWorld/runtime/test-harness/publication change | complete required browser regression matrix |

Example impact mapping to validate, not copy blindly:

- farm explorer module -> farm contracts + farm desktop/mobile + common smoke;
- creature interaction/card -> creature interaction + creature geometry + targeted visual/accessibility;
- semantic search -> search + degraded/no-result + history/reload journey fragments;
- panel-local CSS -> responsive/accessibility/targeted visual for that surface;
- shared viewport transform -> property + geometry + render + race + stress + user journey;
- renderer/WebGL/shared FullWorld runtime -> broad or full;
- E2E harness/config/publisher/classifier -> full verification of the verification system itself.

### 4.1 Fail closed for unknown impact

A new or unknown runtime path must not silently skip verification.

Recommended rule:

`UNKNOWN_RUNTIME_IMPACT -> broad/full`

The impact manifest itself should have executable regression tests proving that known critical paths map to the required classes and that unknown runtime paths fail closed.

### 4.2 Avoid over-optimizing cheap tests

Do not spend significant complexity to save seconds of inexpensive deterministic checks.

Broad execution is acceptable for cheap unit/contract/property tests. Selectivity matters most for:

- Docker browser E2E;
- WebGL/geometry depth;
- visual evidence;
- user-journey matrices;
- race/fault depth;
- stress;
- performance;
- soak;
- expensive artifact/product generation.

## 5. Replace fixed "64 scenarios" with a verification-plan contract

The exact-head status publisher should validate the plan that was required for the specific PR, not one magic scenario count.

A future machine-readable plan should bind at least:

- exact Atlas revision;
- base revision used to compute impact;
- changed path digest or equivalent immutable change identity;
- selected risk profile;
- required test groups/specs/projects;
- required visual scenarios, if any;
- worker count/profile;
- retry policy (`0` should remain the normal requirement);
- expected execution class (`docker-deterministic`, `native-hardware`, etc.);
- final result and evidence digests.

`atlas-local-e2e=success` should mean "the exact required browser plan for this SHA passed", not "64 tests happened to pass".

Full 64-scenario evidence can remain the contract for the `full` profile until or unless the census changes intentionally.

## 6. Molehill should become the canonical heavy execution engine

Normal heavy PR verification should be executed by GitHub self-hosted runner(s), not orchestrated manually through Desktop Commander.

Recommended role split:

### GitHub-hosted CI

Own:

- deterministic Node/Python checks;
- contracts/properties;
- provenance/security/CodeQL;
- lightweight browser/WebGL contract checks;
- orchestration and final `atlas-gate` fan-in.

### Molehill-PC

Own:

- targeted/broad/full browser E2E;
- deterministic Docker browser correctness;
- nightly/depth browser work;
- real-hardware browser/render proof;
- stress/performance/soak where applicable.

### Synology

Own only:

- exact merged-main deployment;
- exact revision/container/header identity;
- publication/product integrity checks;
- bounded desktop/mobile live smoke;
- cutover and rollback proof.

Heavy E2E, stress, soak, large visual matrices, performance benchmarking, and broad geometry/render depth MUST NOT be moved to Synology as a capacity fallback.

If Molehill is unavailable, heavy physical proof should remain `BLOCKED`, not silently migrate to Synology.

### Desktop Commander/Desktop Manager

Keep as control/recovery/debug plane:

- inspect machine state;
- repair runner/Docker problems;
- reproduce failures interactively;
- inspect screenshots/artifacts;
- execute one-off diagnostic commands.

Do not use it as the canonical normal path for `PR -> build/test -> exact-SHA status` once runner-based execution is ready.

## 7. Runner-level concurrency on Molehill

The desired model needs two distinct levels of concurrency:

1. multiple independent runner jobs/PRs when resources allow;
2. multiple Playwright workers within one job.

A practical starting architecture is two independent Molehill runner instances with separate work directories and isolated checkout/Compose/artifact namespaces.

Example only:

- `molehill-atlas-1` -> targeted/normal browser work;
- `molehill-atlas-2` -> second concurrent targeted/normal browser job;
- optional exclusive lane/resource class for performance/soak/hardware-sensitive work.

Do not let each runner independently consume the whole machine. Use a shared resource budget.

## 8. Resource-aware scheduling instead of one global mutex

Replace the single machine-wide heavy-test lock with resource classes/semaphores.

Proposed classes:

- `cpu-light`: high concurrency;
- `browser-functional`: bounded shared slots;
- `render-geometry`: lower bounded concurrency;
- `hardware-gpu`: very low concurrency;
- `performance`: exclusive;
- `soak`: exclusive or near-exclusive;
- `deployment-live`: independent from Molehill compute and never cancelled by nightly browser concurrency.

A scheduler should prevent oversubscription when multiple GitHub runners and multiple Playwright workers are active simultaneously.

## 9. Optimize Playwright worker use empirically

Current Playwright config defaults to `ATLAS_E2E_WORKERS=2` and `fullyParallel=false`.

Do not switch `fullyParallel=true` globally without proof. Some Atlas scenarios intentionally model ordered state/history/render transitions.

Instead:

1. classify specs by independence/resource class;
2. split abnormally long files into safe independent units where useful;
3. retain sequential semantics where stateful journeys require them;
4. benchmark worker counts on the real machine;
5. choose per-profile worker values from measured throughput/stability.

Recommended benchmark sweep on the same exact SHA and same workload:

- workers `2`;
- workers `4`;
- workers `6`;
- workers `8`;
- at least three repeated runs per candidate;
- compare median wall time, variance, failures/flakes, CPU saturation, RAM pressure, Docker/WSL pressure, and browser crashes.

Do not hard-code `4`, `6`, or `8` purely from core count.

## 10. Observed Molehill snapshot (2026-08-25; re-measure before implementation)

A live read-only inspection during this analysis reported:

- CPU: AMD Ryzen 7 9800X3D;
- physical cores: 8;
- logical processors: 16;
- installed/visible system memory: about 64 GB;
- GPU: AMD Radeon RX 9070 XT plus integrated Radeon graphics;
- OS: Windows 11 Pro;
- Docker Desktop/WSL2 backend;
- Docker reports 16 CPUs available;
- Docker reported about 47 GB memory available at that moment.

This shows the machine has substantially more concurrency capacity than a forced `workers=1` gate uses, but it does not prove the optimal number of simultaneous Chromium processes.

## 11. Duration-aware balancing and sharding

`e2e/summary-reporter.mjs` already records `durationMs` per scenario. Use this data.

The future scheduler should keep rolling historical duration metadata and build duration-balanced groups/shards rather than simply splitting by number of files.

Reason: if one spec takes four minutes and twenty other specs take ten seconds each, adding workers will not help much unless long work is decomposed or balanced appropriately.

Potential scheduling metadata per test/spec:

- median duration;
- p95 duration;
- CPU class;
- memory class/peak if measurable cheaply;
- GPU/hardware requirement;
- exclusivity requirement;
- feature/impact tags;
- historical flake/failure signal.

Do not make historical timing a correctness oracle. It is only scheduling input.

## 12. Docker optimization

Docker should remain the canonical environment for deterministic browser correctness, but the harness should avoid unnecessary rebuild and image proliferation.

Observed on Molehill during this audit:

- many Atlas E2E-tagged images existed concurrently;
- Docker reported roughly 30.97 GB image data;
- Docker build cache was roughly 40.62 GB;
- about 20.39 GB of build cache was reclaimable at that moment.

These values are operational observations, not contractual thresholds.

Recommended direction:

1. keep a reusable/cached Playwright harness image keyed by inputs such as Dockerfile, lockfile, Playwright version, and harness dependencies;
2. avoid generating effectively identical multi-GB image tags for every Compose project when isolation can be achieved by project/container/artifact namespaces instead;
3. preserve BuildKit layer reuse;
4. do not blindly prune cache after every test, because that would make subsequent builds slower;
5. use bounded scheduled cache hygiene based on actual disk pressure and age;
6. benchmark host bind mounts vs staging the exact checkout into a Linux/WSL-native filesystem or volume before changing the model.

The existing Dockerfile already has a useful layer boundary: package metadata is copied and `npm ci` runs before test/support source is copied. Preserve or improve that caching behaviour.

## 13. Reporter/artifact optimization

Current config produces line, JSON, summary, and HTML reporters and retains failure traces/videos/screenshots appropriately.

Recommended future policy:

- focused/targeted passing runs: compact line + machine-readable summary may be enough;
- failure: retain full diagnostics, trace/screenshot/video and rich report;
- broad/full/visual: keep the stronger evidence set required by the contract;
- user visual evidence should be generated/reviewed only for changes/profiles whose plan actually requires it.

Do not weaken failure evidence merely for speed.

## 14. Docker vs native execution: use a hybrid model

Do not move all E2E out of Docker merely to chase speed.

### Docker should remain canonical for deterministic correctness

Use Docker for most:

- targeted functional E2E;
- full functional E2E;
- deterministic race/resilience tests;
- deterministic visual regression;
- deterministic geometry/render checks where hardware identity is not the subject;
- exact-SHA reproducibility.

### Native Windows/browser should provide real-hardware truth

Use a smaller native lane on Molehill for checks whose purpose is specifically the real Windows/browser/GPU stack:

- hardware-accelerated WebGL proof;
- GPU/driver compatibility;
- real frame pacing/FPS evidence;
- performance measurements;
- browser/GPU crash/device-loss behaviour where applicable;
- selected long-running native soak/leak checks if that is the intended production-like environment.

A useful mental model:

> Docker = canonical correctness. Native Windows = real hardware truth.

Do not require every functional E2E to consume the real RX 9070 XT.

## 15. Hardware GPU lane

The current Docker Compose path should not be assumed to represent the real RX 9070 XT/Windows driver stack.

Add a bounded native hardware-render lane rather than trying to make every Docker test a GPU benchmark.

Candidate native proof surface:

- WebGL initialization on hardware acceleration;
- framebuffer sanity;
- animation progression;
- pan/zoom/large-scene behaviour;
- frame pacing under a defined workload;
- no GPU/browser crash;
- exact browser/OS/GPU/driver metadata captured with the evidence.

Performance/hardware tests should normally run with exclusive resource ownership so concurrent jobs do not invalidate measurements.

## 16. Build once, test the same artifact, deploy the same artifact

Where product generation is expensive, move toward immutable artifact/image promotion:

`build exact SHA once -> verify exact immutable artifact -> deploy that exact artifact -> bounded live smoke`

Avoid a model where Molehill validates one build but Synology independently rebuilds another logically equivalent product before deployment.

The artifact should be bound to exact source revisions and content/provenance digests.

Synology should verify and deploy the tested artifact rather than reproduce heavy computation when feasible.

## 17. Nightly becomes the selective-testing safety net

Selective PR verification increases dependence on the correctness of the impact classifier. Therefore the periodic safety net must become stronger.

Recommended future nightly/main policy:

- execute the complete required functional regression matrix on current `main` at a controlled cadence;
- add geometry/render repeats;
- add fixed/replayable stress seeds;
- add additional viewport/DPR/browser differential depth where justified;
- include performance/visual/accessibility/race/soak categories according to stability and cost;
- keep retries at zero for deterministic acceptance;
- promote every reproducible nightly defect into a permanent regression test.

The current design intentionally treats nightly as additive rather than a duplicate of the full PR gate. If PRs become selective, that rule must be revisited intentionally because the full matrix is no longer guaranteed before every merge.

## 18. Browser coverage recommendations

Do not blindly run every test on every browser.

Keep Chromium as the main deterministic browser target unless product support says otherwise, but consider a small differential critical-path suite for Firefox/WebKit when supported targets or demonstrated differential value justify it.

Prefer a small high-value cross-browser matrix over tripling the entire 64-scenario suite.

Real-device coverage, if required, should likewise be narrow and high value (for example Android Chrome and iOS/Safari/WebKit critical journeys) rather than duplicating every desktop E2E.

## 19. User-behaviour depth

The newly added deterministic/replayable desktop/mobile user journeys are a strong base, but the next agent should evaluate broader model-based coverage without inflating every PR.

Candidate nightly/depth design:

- rotating deterministic seed bank;
- desktop and mobile;
- longer action sequences than the required PR journey;
- explicit state x action x transition coverage accounting;
- replay log and first-failing-action evidence;
- promotion of reproducible bugs to permanent deterministic regressions.

This belongs in depth/nightly unless the impacted feature specifically requires it for a PR.

## 20. Network/failure depth to evaluate

Existing fault and race coverage is good, but the previous audit did not find a clearly defined complete network-condition matrix for cases such as:

- high latency;
- throttled bandwidth;
- offline transition;
- reconnect;
- interrupted range transfer;
- very slow range completion.

The next agent should re-search current main before concluding these are absent. Add only scenarios that materially test Atlas behaviour and do not duplicate existing fault injection.

## 21. Accessibility depth to evaluate

Current accessibility checks cover meaningful accessible names, keyboard activation, Escape/focus-related behaviour, mobile reachability, and touch interactions.

Potential future additions:

- Axe or equivalent automated scan as an additional signal, not as proof of full WCAG compliance;
- complete keyboard-only critical user journey;
- periodic manual/real assistive-technology checks such as NVDA/VoiceOver if product requirements justify them.

Do not claim formal WCAG compliance solely from automated checks.

## 22. Performance verification policy

Current performance tooling intentionally treats timing/heap evidence as non-blocking baseline evidence while structural budgets are blocking.

Do not convert timing to a blocking SLO without calibration.

Recommended path:

1. establish stable hardware/browser lane;
2. collect repeated baseline distributions;
3. identify product-relevant metrics;
4. separate environmental noise from regressions;
5. define blocking thresholds only when evidence supports them;
6. keep performance jobs exclusive while measuring.

## 23. Mutation testing

The verification platform notes mutation testing as a useful technique for critical pure logic.

Evaluate targeted mutation testing for high-value deterministic logic, but do not put broad mutation testing on every small PR if it materially slows iteration. It is better suited to critical modules, scheduled depth, or classifier-driven execution.

## 24. Proposed implementation programme

The next agent should not implement all of this as one unreviewable mega-change. Suggested order:

### Phase A - measure and pin contracts

- refresh repository and runner state;
- benchmark current exact workload;
- capture current per-spec/scenario durations;
- benchmark workers 2/4/6/8;
- measure Docker build/start/I/O overhead;
- write failing regression contracts for desired runner placement and selective-plan semantics.

### Phase B - impact-driven verification

- add central impact manifest/classifier;
- add `none/focused/targeted/broad/full` plan generation;
- make unknown runtime changes fail closed;
- add exhaustive classifier regression tests;
- make CI jobs consume the plan where cost justifies it.

### Phase C - evidence/publisher refactor

- replace fixed scenario count/`workers=1` assumptions with plan validation;
- preserve exact SHA, zero retry, and required evidence guarantees;
- make targeted visual review possible when the plan requires only a subset.

### Phase D - Molehill scheduling

- configure multiple isolated runner instances if operationally appropriate;
- replace global mutex with resource classes/semaphores;
- introduce bounded shared worker slots;
- prevent oversubscription across runners;
- keep performance/soak exclusive.

### Phase E - harness efficiency

- reduce redundant Docker image rebuild/tag proliferation;
- preserve useful BuildKit cache;
- benchmark filesystem/staging options;
- introduce duration-aware balancing/sharding.

### Phase F - hardware truth lane

- add bounded native Windows Chrome/Edge hardware-render/performance lane;
- capture hardware/browser/driver identity;
- keep deterministic Docker correctness as the canonical functional gate.

### Phase G - artifact promotion and Synology reduction

- build immutable artifacts on the appropriate compute runner;
- test those artifacts;
- deploy the exact tested artifact to Synology;
- leave Synology with integrity, revision, cutover/rollback, and bounded smoke only.

### Phase H - safety net/depth

- make nightly/main cover the full functional safety net after selective PR testing is enabled;
- add longer seeded behaviour depth and other high-value depth categories;
- verify no heavy fallback can route to Synology.

## 25. Acceptance criteria for the eventual implementation

A future implementation should not be called complete until there is evidence that:

1. small unrelated changes no longer require unrelated heavy E2E;
2. shared/high-risk changes still select broad/full verification automatically;
3. unknown runtime paths fail closed;
4. exact-SHA evidence is preserved;
5. retries remain zero for deterministic acceptance;
6. targeted/full plans are machine-readable and testable;
7. multiple useful Molehill jobs can execute concurrently without cross-workspace contamination;
8. the scheduler cannot oversubscribe the machine beyond configured resource budgets;
9. performance/soak measurements run without competing heavy load;
10. heavy tests cannot be scheduled onto Synology;
11. Synology live acceptance remains bounded and deployment-focused;
12. Docker functional correctness remains deterministic/reproducible;
13. real hardware/browser/GPU truth is tested separately where material;
14. Docker cache/image behaviour is measurably improved rather than guessed;
15. worker-count choice is backed by benchmark evidence;
16. full periodic regression catches mistakes in selective classification;
17. no security/provenance/authority gate is weakened to gain speed;
18. visual evidence is still genuinely reviewed whenever required;
19. no stale/copy-pasted result can satisfy the exact-head gate;
20. post-change wall-clock time and machine utilization show a measurable improvement without increased flake rate.

## 26. Explicit non-goals / anti-patterns

Do not optimize by:

- globally increasing retries;
- increasing timeouts merely to hide contention;
- widening visual/geometry tolerances;
- skipping unknown tests by default;
- pushing heavy work to Synology;
- auto-approving visual evidence;
- replacing exact-head evidence with stale cached success;
- running every test in every browser;
- turning every test `fullyParallel` without independence proof;
- assigning every runner the maximum worker count;
- pruning all Docker cache after every run;
- converting noisy performance evidence into a blocking SLO without calibration;
- letting Desktop Commander become the implicit source of truth for PR test state.

## 27. Questions the next agent must answer with measurements

Before implementation, obtain concrete answers for at least:

1. Which specs dominate current 64-scenario wall time?
2. How does total time change at 2/4/6/8 workers on the same SHA?
3. At what concurrency do failure variance/browser crashes begin to increase?
4. How much time is build vs server startup vs browser execution vs evidence generation?
5. How much Docker I/O cost comes from Windows bind mounts?
6. Can the harness image be reused across isolated Compose projects without weakening exact-code verification?
7. What global functional-browser slot count maximizes throughput for two concurrent PRs?
8. Which tests truly require exclusivity?
9. Which current Synology steps are computationally heavy and safely movable to artifact build/promotion?
10. Which native hardware tests provide evidence Docker cannot provide?
11. What should the cadence of the full regression safety net be after selective PR gating?
12. Which browser/device differentials are actual supported-product requirements versus low-value duplication?

## 28. Final architectural recommendation

The recommended destination is:

`GitHub change -> impact plan -> cheap hosted verification -> resource-aware Molehill targeted/broad/full Docker E2E -> optional native hardware lane -> immutable exact-SHA evidence -> merge -> deploy exact tested artifact -> bounded Synology live smoke -> periodic full/depth safety net`

This should make Atlas verification faster because it removes unrelated work, and faster again because the remaining work uses the available machine intelligently. The quality target is unchanged: deep verification where risk requires it, with deterministic, replayable, exact-revision proof.