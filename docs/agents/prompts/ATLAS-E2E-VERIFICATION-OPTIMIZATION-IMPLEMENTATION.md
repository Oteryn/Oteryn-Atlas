# ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION

ALIAS:
`ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION`

MODE:
Autonomous verification-platform correction + test-suite audit/refactor + GitHub-hosted migration + selective execution + benchmark + staged integration + protected-branch closeout.

DO NOT STOP AT AUDIT, DESIGN, BENCHMARK PREPARATION, OR A PARTIAL MIGRATION.
DO NOT ASK FOR CONFIRMATION FOR NORMAL SAFE/REVERSIBLE IMPLEMENTATION DECISIONS.
FINISH THE PROGRAMME THROUGH VERIFIED STAGED PRs AND TERMINAL CLOSEOUT, SUBJECT ONLY TO REAL EXTERNAL BLOCKERS OR SECURITY/AUTHORITY BOUNDARIES.

Repository:
- `Oteryn/Oteryn-Atlas`

Implementation lifecycle:
- Issue `#179`

Audit/design history:
- Issue `#174`
- PR `#175`

Known active stacked implementation work at the time of this corrective revision:
- PR `#190` — Molehill admission/orchestration
- PR `#195` — worker/resource calibration
- PR `#200` — selective execution cutover

These PR numbers are discovery hints, not immutable authority. Resolve their current state, heads, bases, diffs, checks and successors from GitHub before acting.

## Corrective authority of this revision

This prompt incorporates the 2026-08-26 execution-placement and test-suite audit and intentionally corrects the earlier design where it conflicts on these points:

1. **GitHub-hosted runners are the default execution plane for ordinary deterministic browser E2E, targeted/broad/full functional Playwright and the complete routine full safety net.**
2. **Molehill-PC is not the normal heavy PR execution plane.** It is an exception-only specialist plane for facts that cannot be proved equivalently on GitHub-hosted infrastructure: restricted/private visual review where rights require it, native Windows/browser/GPU truth, LAN-only live checks, specific hardware/driver reproduction, and explicitly justified diagnostics/benchmarks.
3. **Synology is a deployment target/control plane, not an E2E compute plane.** It must not execute the ordinary/full Playwright matrix, stress, scale, soak, performance, broad visual acceptance or reproducible product builds. If a private-LAN post-deploy browser smoke is required, run that smoke from the least-privilege external runner that can reach the deployment, normally the specialist LAN runner, not from Synology itself.
4. **Agents must not run the full E2E suite after every small change.** The inner development loop uses the narrowest affected deterministic/regression checks. Heavy/full verification is plan-driven and checkpoint-driven, not reflexive.
5. **Optimization includes an explicit audit of whether each current test is necessary and correctly layered.** Preserve unique oracles and regression detection, but split mega-tests, narrow triggers, merge redundant assertions, move depth/stress suites out of routine PR gating and add missing coverage where evidence shows a real gap.
6. **Worker/concurrency policy for normal PR E2E must be calibrated on the actual GitHub-hosted target environment and by GitHub-level sharding.** Molehill worker calibration is relevant only to the exceptional Molehill lanes and must not define the default PR policy.

For lifecycle #179, these corrections supersede older statements in audit/handoff/platform documents that make Molehill the routine full-browser executor, make a local `atlas-local-e2e` status the normal PR authority, or require full 71-scenario qualification for almost every non-documentation change.

One of the first implementation mutations must reconcile `AGENTS.md`, `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`, Issue #179 and any active stacked PR descriptions with this corrected architecture so agents cannot receive contradictory execution instructions.

## Authoritative design inputs

Read from fresh protected `main` before mutation:

- `AGENTS.md`
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`
- `docs/testing/ATLAS-E2E-EXECUTION-OPTIMIZATION-HANDOFF.md`
- `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-REVIEW.md`
- `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-SECOND-PASS.md`
- this prompt
- current `tools/verification/impact-manifest.json`
- current `tools/verification/verification-catalog.json`
- current verification-plan generator/schema/reporter/evidence validator
- current `.github/workflows/**` that execute, gate, deploy or schedule verification
- the complete current `tests/**` and `e2e/**` inventories relevant to the changed phase

Where older documents conflict with the corrective authority section above, this prompt owns the #179 target state until the older documents are reconciled and merged.

## Mission

Build a verification system that proves **everything necessary and nothing unrelated** for each exact Atlas change.

The target is:

`exact PR head -> trusted multi-path impact classification -> versioned granular verification plan -> cheap deterministic GitHub checks -> plan-selected self-contained GitHub-hosted Playwright groups -> optional exceptional specialist proof -> exact plan-bound evidence -> atlas/provenance gate -> protected merge -> exact merged-main artifact built once off Synology -> immutable promotion -> deployment -> digest/revision/integrity checks -> bounded external live smoke when needed -> periodic complete full/depth safety net -> planner feedback loop`

A successful optimization must improve developer/agent wall-clock latency and system throughput while preserving or improving regression-detection quality. It is not valid to gain speed by weakening retries, assertions, tolerances, independent oracles, evidence identity, visual review obligations, provenance, rights boundaries or branch protection.

## Mandatory GitHub-first preflight

Before every substantial implementation phase:

1. resolve fresh protected `main`, current required checks and rules from GitHub;
2. resolve lifecycle Issue #179 and all active/overlapping verification PRs/branches;
3. inspect complete diffs, not only PR summaries, for active stacked work including #190/#195/#200 or their successors;
4. inspect current workflow execution placement and exact job runner labels;
5. inspect current test catalog, impact manifest, plan schema/generator, summary reporter and evidence validator;
6. inspect current test inventory and recent additions/removals that may invalidate the earlier 71-scenario census;
7. record immutable `admission_main_sha`, current `task_head_sha` and later `integration_main_sha` separately;
8. use dedicated task branches/PRs; never push ordinary work directly to protected `main`;
9. use repository-native GitHub operations first; Remote Desktop/Desktop Commander is not routine repository/test execution infrastructure;
10. inspect physical Molehill/Synology state only when the phase genuinely requires exceptional host facts. Do not touch those hosts merely because older instructions mentioned them.

If `main` advances, classify it as `UPSTREAM_ADVANCED`, reconcile only materially affected evidence/contracts and preserve unaffected work.

## Non-negotiable safety constraints

1. Preserve `atlas-gate`, `provenance-gate`, exact revision binding and protected-branch semantics.
2. Playwright deterministic acceptance retries remain zero.
3. Never enlarge tolerances, add arbitrary sleeps, broad allowlists or unconditional skips to create green results.
4. Preserve independent oracles. Do not replace real geometry/render/fault/state proof with DOM-presence smoke.
5. `UNKNOWN_RUNTIME_IMPACT`, malformed diff evidence, unmatched runtime paths and verification-governance mutation fail closed to `broad` or `full` as appropriate.
6. Candidate verification policy may widen its own verification but may not narrow below a trusted protected-base lower bound.
7. No task-branch live deployment.
8. No automatic fallback from unavailable GitHub-hosted verification to Synology or Molehill. A special-host fallback must be an explicit, audited exceptional action and may never silently reduce required proof.
9. Untrusted fork/candidate code never executes automatically on trusted self-hosted LAN/hardware runners.
10. Do not expose restricted/raw Game-derived raster or publication bytes in public GitHub artifacts merely to move execution to Actions.
11. Full-suite scenario count is diagnostic only; correctness identity is the exact stable test-ID set.
12. Do not delete a test solely because it is slow. A removal/merge must prove its behavior and oracle remain covered or are intentionally retired by an explicit product contract change.
13. Do not introduce new heavyweight infrastructure merely to optimize theoretical performance. Measure first.
14. Synology must not become a hidden build/test fallback.
15. The optimization itself must be reversible: selective execution has a tested `force-full` widening path and a documented rollback to full-safe behavior.

## Execution-placement hierarchy

### Tier 1 — GitHub-hosted, default

Ordinary verification runs on repository-approved GitHub-hosted runners, normally Linux, with self-contained exact-head inputs.

This tier owns by default:

- deterministic Node/Python/contracts/properties/governance tests;
- browser-semantic and lightweight real-browser checks;
- ordinary Playwright smoke/targeted/broad/full functional E2E;
- deterministic geometry/render/browser probes that are equivalent under the pinned container/browser environment;
- race/fault E2E;
- Atlas-owned stable component visual snapshots that are rights-safe;
- accessibility checks;
- shardable full regression safety net;
- nightly stress/scale/performance evidence where hardware-specific truth is not the purpose;
- build/package/artifact construction that is reproducible in CI.

The normal PR gate must not depend on a local `atlas-local-e2e` status produced outside GitHub-hosted execution once the migration is complete.

### Tier 2 — Molehill-PC specialist, exception-only

Molehill may own only work with a documented capability reason such as:

- private/restricted full-frame visual review that cannot be retained in public GitHub artifacts;
- native Windows/browser compatibility that Linux/container proof cannot establish;
- real hardware WebGL/GPU/driver/device-loss/frame-pacing evidence;
- LAN-only post-deploy smoke against a private deployment endpoint;
- reproduction of a defect proven specific to the physical machine/environment;
- calibration of a Molehill-only specialist lane.

Every Molehill job must record a reason code and required capability. `because the old pipeline used Molehill`, `because the test is heavy`, or `because GitHub is slower for one process` is not a valid reason.

No ordinary PR is allowed to consume Molehill merely as a convenience. No agent may use Remote Desktop to poll routine test state that GitHub already exposes.

### Tier 3 — Synology deployment target

Synology owns only:

- receiving/promoting the already-built exact merged-main artifact;
- digest/integrity/revision verification;
- container/service deployment;
- health/readiness checks local to deployment;
- rollback boundary and rollback operation;
- exposing the deployed service for an externally executed bounded smoke if private-network access is required.

Synology does **not** own Playwright regression execution, full E2E, stress, scale, soak, performance, broad visual evidence or normal product construction.

## Agent inner-loop verification policy

This policy is mandatory for autonomous agents and must be mirrored into `AGENTS.md`/platform instructions during implementation.

During implementation:

1. after a small code edit, run the narrowest unit/contract/regression test that proves the changed behavior;
2. batch logically related edits before browser verification instead of rerunning a heavy suite after every file save/commit;
3. run a targeted E2E group when a meaningful integration checkpoint is reached or the changed behavior cannot be proven below E2E;
4. do not run the complete Playwright suite manually "for safety" unless the current verification plan is `full`, an explicit `force-full` incident is active, a verification-governance/bootstrap surface changed, or the current phase specifically requires a full safety-net measurement;
5. after a failing test is fixed, first rerun the failing regression plus directly dependent group; rerun broader layers only if their evidence was invalidated;
6. do not rerun unchanged expensive groups solely because `main` advanced if plan/input-digest logic proves their relevant inputs unchanged; final aggregate evidence must still bind the current candidate/integration base;
7. never use Synology or Molehill to avoid waiting for a normal GitHub-hosted run;
8. superseded PR heads must cancel obsolete heavy work so agents do not consume capacity validating code that can no longer merge.

The final authoritative qualification remains plan-driven and exact-head; narrow development checks do not replace required final evidence.

## Required verification profiles

Implement versioned profiles:

- `none` — proven documentation/prompt/evidence-only or otherwise non-runtime changes with no executable verification beyond cheap governance/syntax checks;
- `focused` — isolated pure logic/parser/schema/tool/generator changes whose behavior is completely covered by cheap deterministic tests;
- `targeted` — bounded feature/UI/browser surface with known dependencies and a small exact set of E2E groups;
- `broad` — shared runtime/render/state/input/load/UI shell changes with multiple impacted domains;
- `full` — verification/governance changes, cross-cutting runtime changes, major FullWorld architecture changes, unknown/ambiguous impact, force-full incidents and bootstrap escalations.

Cheap deterministic checks may run broadly when their measured cost is negligible. Selectivity is primarily for expensive browser/render/visual/stress/performance/build work.

## Granular verification catalog

Replace the coarse catalog with independently selectable stable groups. The exact names may evolve, but the catalog must be at least as granular as these domains:

- `deterministic.core`;
- `e2e.smoke.desktop`;
- `e2e.smoke.mobile`;
- `e2e.state-navigation`;
- `e2e.search`;
- `e2e.search-degraded`;
- `e2e.geometry-render.desktop`;
- `e2e.geometry-render.mobile`;
- `e2e.render-probe`;
- `e2e.race-fault`;
- `e2e.resilience`;
- `e2e.creature-state-search`;
- `e2e.creature-interaction.desktop`;
- `e2e.creature-interaction.mobile`;
- `e2e.creature-presentation-layout`;
- `e2e.creature-presentation-lod`;
- `e2e.creature-animation`;
- `e2e.farm.desktop`;
- `e2e.farm.mobile`;
- `e2e.responsive-mobile`;
- `e2e.accessibility.desktop`;
- `e2e.accessibility.mobile`;
- `visual.shell.desktop`;
- `visual.shell.mobile`;
- `visual.creatures`;
- `journey.fixed.desktop`;
- `journey.fixed.mobile`;
- `depth.journey.seeded`;
- `depth.stress`;
- `depth.scale`;
- `depth.performance`;
- `depth.soak`.

Each group definition must declare at least:

- stable group ID/version;
- exact stable test IDs/specs/projects;
- behavior/impact domains protected;
- primary oracle type;
- blocking vs informational semantics;
- normal trigger/profile eligibility;
- `fullSafetyNet` membership;
- GitHub-hosted compatibility;
- exceptional host requirement, if any, with a reason code;
- visual/evidence rights classification;
- parallel/sequential/exclusive requirements;
- expected artifact/evidence type;
- timeout class;
- historical duration metadata reference.

Do not use filename naming conventions as the only resource/impact policy.

## Test-suite audit and refactor mandate

Before declaring selective execution production-ready, audit the actual current suite test-by-test and classify every browser test/group as:

- `KEEP` — unique necessary behavior/oracle at the correct layer;
- `MOVE` — necessary but should run on a different cadence/lane;
- `NARROW` — necessary but should trigger for fewer domains or contain fewer repeated assertions;
- `SPLIT` — one file/test mixes independently selectable responsibilities;
- `MERGE` — duplicate behavior should share one authoritative test/oracle;
- `DELETE` — genuinely redundant/obsolete only after replacement/coverage proof;
- `ADD` — material gap discovered by the audit.

Use the following current audit findings as mandatory starting hypotheses and verify them against the fresh suite before mutation:

### Preserve as high-value independent oracles

- `e2e/tests/geometry-desktop.spec.mjs`;
- `e2e/tests/geometry-mobile.spec.mjs`;
- `e2e/tests/render-probes-desktop.spec.mjs`;
- `e2e/tests/state-desktop.spec.mjs`;
- `e2e/tests/workflows-desktop.spec.mjs`;
- `e2e/tests/race-desktop.spec.mjs`;
- `e2e/tests/resilience-desktop.spec.mjs`;
- `e2e/tests/degraded-search-desktop.spec.mjs`.

Keep their geometry/framebuffer/state/history/fault/fail-closed oracles. Narrow their triggers to the domains they actually protect; repeated depth runs belong in nightly where appropriate.

### Keep, but make feature-specific

- accessibility desktop/mobile;
- responsive mobile;
- Farm Explorer desktop/mobile;
- API/search browser contracts;
- creature feature interaction/presentation tests after decomposition.

These must not run for unrelated backend/data/governance changes merely because they live under the common E2E directory.

### Split current mega-tests

Review and decompose at minimum:

- `e2e/tests/creature-presentation-desktop.spec.mjs` — separate layout/badges, LOD/modes, edge/occupancy, selection/lifetime, animation/visual responsibilities where independently selectable;
- `e2e/tests/creatures-desktop.spec.mjs` — separate state/search/filter persistence from render/repaint behavior;
- `e2e/tests/creature-interaction-desktop.spec.mjs` and mobile equivalent — separate interaction/card/inspector behavior from geometry/lifetime concerns where useful;
- `e2e/tests/audit-desktop.spec.mjs` / `audit-mobile.spec.mjs` — move unique assertions into canonical mode/navigation/responsive/visual groups and retire standalone duplication when coverage is proven.

### Move out of routine PR gating

By default place these in nightly/depth or conditional domain-specific lanes, not ordinary targeted PR qualification:

- seeded exploratory user journeys;
- `stress-desktop`;
- `scale-desktop`;
- `performance-desktop` timing/depth evidence;
- `soak-desktop`.

The current benchmark showing a full 71-scenario gate around 25+ minutes and seeded mobile journey resource-sensitive timeout is evidence that these depth workloads must not be reflexive inner-loop/ordinary PR gates.

Fixed realistic cross-feature journeys remain valuable but should normally be `broad/full` integration proof, not run for every small targeted change.

### Reduce assertion duplication, not coverage

Examples to audit:

- drawer open/close is repeated across smoke, audit, responsive, accessibility, visual and journeys;
- search/navigation is repeated across smoke, workflow, visual and journey suites;
- basic control presence is repeated across smoke/audit/accessibility;
- feature workflows repeat deterministic tests already executed by the common verification job.

Keep one canonical assertion at the cheapest correct layer and retain higher-level tests only for the extra integration/oracle value they uniquely provide.

### Required-test skip semantics

If a plan requires a group, missing required fixtures/publications/prerequisites must be a preflight failure or explicit blocked result, not a `test.skip` that satisfies the group.

Optional feature absence may be skipped only when the verification plan did not require that feature proof. Record skip reasons structurally and ensure a required group cannot become success with missing required tests.

## Impact manifest requirements

The manifest must map changed paths and dependency fan-out to impact domains, minimum profile and exact required groups.

Rules:

- process all changed paths, including rename source and destination;
- union all domains/groups, never first-match-wins;
- use explicit cross-domain escalation when combinations are riskier;
- map feature modules narrowly where dependencies are known;
- map shared shell/runtime/renderer/state paths broadly;
- verification-governance and selector/catalog/workflow gate changes bootstrap to `full`;
- malformed, empty or incomplete diff evidence fails closed;
- unmatched runtime-impacting paths fail closed;
- docs-only classification must be strict and test-covered;
- generated products must account for producer/consumer dependency fan-out rather than only the directly edited path.

## Trusted bootstrap / anti-self-certification

A PR may not edit the selector/catalog and then use the edited version to reduce its own requirements.

Compute:

`required plan = max/union(trusted protected-base policy, candidate policy)`

Candidate policy may widen but not narrow below the trusted lower bound for verification-governance surfaces.

Bootstrap-to-full applies to, as relevant:

- impact manifest/schema;
- catalog/schema/group resolver;
- plan generator/validator;
- classifier/change enumeration;
- Playwright selection/config/shared fixtures;
- E2E execution/sharding policy;
- evidence reporter/validator/publisher;
- visual-review policy;
- required-gate workflow logic;
- worker/shard policy;
- selective-execution enable/rollback switch.

Use strict schema validation and allowlisted IDs. Plan values are data, never arbitrary shell fragments.

## Verification-plan identity

Generate a deterministic machine-readable plan bound to at least:

- schema version;
- repository;
- exact head SHA;
- base/integration SHA;
- merge-base/diff identity;
- changed-path digest including rename sources;
- trusted-policy digest;
- candidate-policy digest;
- catalog digest;
- selected profile;
- impact domains;
- exact required group IDs;
- exact stable test IDs/projects;
- visual scenario IDs;
- execution tier/resource class;
- worker/shard policy ID;
- retry policy;
- evidence requirements;
- exceptional host requirement and reason code;
- product/publication input digests;
- rights/evidence classification.

Stable Playwright identity must be equivalent to:

`project + normalized spec path + title path`

A count such as `71/71` is telemetry only. Missing/extra/duplicate test IDs must be detected even when counts match.

## Evidence invalidation and moving main

Do not rerun everything merely because protected `main` advanced.

Before final readiness:

1. resolve current `integration_main_sha`;
2. recompute the plan against that base;
3. compare required groups and their declared input/dependency digests;
4. invalidate only evidence materially affected by the candidate/head/base change;
5. rerun newly required/invalidated groups;
6. issue a new final aggregate bound to the exact current head and integration base;
7. refuse readiness if evidence/plan identity is stale or incomplete.

Evidence reuse must be explicit and cryptographically/input-digest justified; never copy a stale success status.

## GitHub-hosted Playwright architecture

The routine browser lane must be self-contained:

`checkout exact SHA -> obtain/build exact candidate product/publication inputs -> start local/container preview -> execute selected Playwright groups -> produce machine summary/artifacts -> validate exact required test IDs -> atlas-gate fan-in`

Requirements:

- prefer the existing pinned Docker/Playwright harness where deterministic and efficient;
- no dependency on `192.168.x.x`/Synology/live LAN for ordinary PR functional E2E;
- pin browser/harness versions and capture them in evidence;
- least-privilege workflow permissions;
- fork/untrusted PRs receive no secrets;
- cache only immutable/reproducible dependencies/products with correct keys;
- use `concurrency`/`cancel-in-progress` so superseded heads stop consuming expensive capacity;
- artifact names include exact head/plan/shard identity;
- cancellation cannot satisfy success evidence;
- avoid one job per tiny test; amortize startup/build cost with measured group/shard packing;
- isolate Compose/project/network/ports/artifacts per job;
- use deterministic local product bundles rather than loading a live NAS during benchmarks.

## GitHub-hosted worker and sharding benchmark

Do not preserve the old assumption that the primary benchmark is `1/2/4/6/8` workers on Molehill.

For the normal GitHub-hosted backend:

1. discover/document the actual runner class/resources used by the workflow;
2. measure cold and warm startup/build/cache cost separately;
3. benchmark plausible in-job Playwright worker counts appropriate to that runner, including 1 as baseline and at least 2/4 where supported by available resources;
4. separately benchmark GitHub-level sharding/parallel jobs, at least 1/2/4 shards when the suite size justifies it;
5. compare worker scale-up versus shard scale-out;
6. measure representative `targeted`, `broad` and `full` plans, not synthetic microbenchmarks;
7. perform enough repetitions to distinguish real gain from noise; use at least 3 clean repetitions per meaningful candidate and more when variance is high;
8. do not choose a larger worker/shard count if startup overhead, variance, crash/OOM rate or Actions consumption outweighs useful wall-clock gain.

Record:

- total wall time;
- queue/startup time when observable;
- checkout/cache/build/startup time;
- browser test time;
- report/artifact time;
- median/p95 test duration;
- first-run failure rate;
- retries (zero);
- browser/container crash/OOM;
- shard imbalance;
- CPU/RAM/shared-memory/disk pressure where available;
- artifact bytes;
- Actions job/minute consumption as a cost/efficiency signal;
- useful verified plans/hour.

Worker/shard policy may differ by profile/group and must be versioned.

Do not over-shard tiny targeted plans.

## Molehill specialist calibration

Only after the GitHub-hosted normal path is established, calibrate the exceptional Molehill lanes that remain necessary.

Do not benchmark 2/4/6/8 Molehill workers as a prerequisite for ordinary PR E2E. Benchmark only the actual specialist workload and concurrency needed for private visual/native Windows/GPU/LAN use.

Keep:

- unique work directories/projects/artifact namespaces;
- resource admission when more than one specialist job can contend;
- CPU/RAM/Docker/WSL/shared-memory/disk/GPU safety budgets;
- exclusive mode for hardware/performance evidence when required;
- least-privilege runner identity;
- crash-safe targeted cleanup;
- no broad routine `docker system prune`;
- no Remote Desktop polling of routine GitHub state.

## Visual evidence policy

Split visual evidence by rights and purpose.

### GitHub-safe Atlas-owned visual checks

May run on GitHub-hosted when rights-safe and deterministic:

- topbar/control/drawer/inspector snapshots;
- Atlas-owned layout crops;
- deterministic geometry/layout metrics;
- masked/redacted surfaces that exclude restricted raster where valid;
- screenshot diffs whose content policy permits artifact retention.

### Restricted/private visual acceptance

If full-frame evidence includes restricted Game-derived raster that must not be publicly retained, it may require the specialist private-review lane.

Run it only for plans whose changed domains can affect the relevant visual surface. Do not require full-frame visual review for backend/governance/data changes that cannot alter presentation.

Preserve:

- exact revision/plan/summary/screenshot digest binding;
- actual opening/review of every required frame;
- reviewer identity;
- no auto-approval;
- no tolerance weakening;
- rights-safe storage/retention.

## Accessibility policy

Keep the existing behavioral accessibility tests for keyboard focus, ARIA state/names, inert drawers and touch reachability, but run them only for relevant UI/DOM/CSS/shared-control changes or broad/full plans.

Audit whether an automated standards rules scan is missing. If no equivalent exists, add a pinned deterministic accessibility rules engine or repository-owned equivalent for selected Atlas-owned surfaces, provided it adds material coverage without flaky network/external dependencies. Treat the scan as complementary to behavioral keyboard/touch tests, not a replacement.

## Cross-browser policy

Do not automatically multiply the entire E2E suite by Chromium/Firefox/WebKit.

First resolve the declared product browser-support contract from current repository/product authority.

- If Chromium is the only declared supported acceptance browser, keep Chromium as canonical and do not invent a Firefox/WebKit requirement.
- If Firefox and/or Safari/WebKit are declared supported, add a bounded compatibility lane: boot/critical navigation/search/state/mobile interaction as appropriate, with deeper tests only for browser-specific regressions.
- Cross-browser compatibility is separate from native Windows/GPU hardware truth.

Any expansion of official browser support must update the verification catalog and product documentation together.

## Workflow deduplication audit

Audit all GitHub workflows for repeated execution of the same deterministic tests.

Known examples to verify:

- `semantic-search.yml` contains unique real-source rebuild/committed-output verification but may repeat Node search tests already executed by common CI;
- `creature-overlays.yml` contains valuable producer/fixture/trust checks but may repeat common deterministic tests;
- `mobile-layout.yml` is a good example of a small path-filtered focused browser proof and should not be replaced by a full E2E gate merely for uniformity.

For every duplicate invocation, decide whether it is:

- needed because the workflow provides a distinct environment/input contract;
- cheap enough and intentionally redundant;
- or accidental duplicate work that should be removed/fanned in from one authoritative result.

Do not remove unique integration/product-rebuild evidence merely because some unit-test names overlap.

## Nightly/depth safety net

Selective PR verification is allowed only with a complete periodic safety net.

Nightly/current-main should execute on GitHub-hosted by default and include the appropriate complete current suite:

- full deterministic regression;
- complete functional Playwright stable-ID set;
- repeated critical geometry/render probes;
- race/fault depth;
- fixed replayable stress seed bank;
- seeded exploratory journeys;
- scale/search corpus depth;
- accessibility depth;
- performance trend evidence;
- soak on an appropriate separate cadence;
- complete rights-safe visual contract;
- bounded cross-browser critical paths only when those browsers are supported.

Private/restricted visual or native hardware depth may use Molehill only for the specific specialist groups requiring it.

Nightly must not require Synology to execute the suite and must not cancel deployment.

A reproducible nightly defect becomes a permanent deterministic regression where feasible.

## Selective-planner shadow rollout and historical backtest

Do not enable work-saving selective execution merely because the classifier unit tests pass.

Before cutover:

1. run plan generation in shadow mode while legacy/full-safe behavior remains authoritative;
2. replay the selector against a representative historical set of real PR diffs/known regressions, including docs-only, pure logic, targeted feature, shared runtime, renderer, UI, verification-governance and cross-domain changes;
3. use at least 20 representative historical change sets when history provides them; if fewer suitable cases exist, use all suitable cases and document the shortfall;
4. for every historical regression with a known detecting test/group, verify the predicted plan would have selected the detecting group or a stricter superset;
5. compare shadow selected plans to full-suite outcomes on current/representative exact SHAs where technically feasible;
6. record false negatives, false positives/over-selection and unknown-path escalations;
7. every classifier miss becomes a permanent manifest/catalog regression test;
8. do not cut over with any unexplained false-negative escape;
9. prove the complete full current-main safety net is operational before enabling selective skips.

Over-selection is an optimization defect. Under-selection is a correctness defect.

## Post-cutover planner feedback loop / automatic safety fallback

After selective execution is enabled, the complete periodic full suite becomes an oracle for the selector.

If nightly/full safety-net finds a reproducible regression that the originating PR's selective plan should have caught but did not:

1. classify it as `SELECTOR_ESCAPE`;
2. immediately disable/narrow the work-saving selective mode or enable repository-wide `force-full` as needed to restore safe gating;
3. preserve the failing evidence;
4. add a permanent regression for the manifest/catalog/selector miss;
5. backtest the corrected policy against historical cases;
6. re-enable selective skipping only after the selector escape is closed and full safety evidence is green.

The fallback mechanism must be tested and auditable. It may widen verification only.

## Test value, flakiness and retirement telemetry

Build enough observability to maintain the suite intelligently without turning metrics into an excuse to delete protection.

For each stable test/group, retain rolling evidence where practical for:

- duration distribution;
- execution frequency;
- first-run failure count/rate;
- infrastructure failure classification;
- deterministic/replayable product defects detected;
- flake incidents;
- selected impact domains;
- overlap/duplicate behavior mapping;
- artifact/output cost.

Use these metrics to identify candidates for `MOVE/NARROW/SPLIT/MERGE/DELETE`, but never auto-delete or auto-skip a test because it is slow or rarely fails.

A test may be retired/merged only when:

1. its protected behavior/invariant is documented;
2. another cheaper or better independent oracle covers the same required behavior, or the product contract explicitly retires the behavior;
3. historical known-regression coverage is not lost;
4. the final full stable-ID safety net and affected feature tests remain green;
5. the catalog/impact mapping is updated in the same change.

Periodically audit duplicate assertions and stale tests so the suite does not grow indefinitely by accretion.

## Performance/soak semantics

Separate structural correctness from hardware timing SLOs.

- Structural budgets/invariants that are deterministic and product-critical may block relevant PRs.
- Timing/heap/frame-rate trends that depend on runner hardware should normally be nightly/trend evidence unless the product has a declared calibrated SLO and a stable environment.
- Hardware-specific performance claims belong to an explicitly calibrated specialist lane.
- Soak/leak tests are depth evidence and should not block unrelated small PRs.

Do not convert non-blocking timing evidence into a universal PR bottleneck.

## Exact artifact lifecycle

Because squash merge changes the SHA, keep two lifecycles.

### PR candidate

`PR head -> exact plan -> exact candidate artifact/product if needed -> selected exact-head verification -> protected gate`

### Merged-main release

`exact merged-main SHA -> build release artifact once on GitHub-hosted/approved off-Synology builder -> verify exact artifact -> content-address/digest -> transfer/promote same bytes -> Synology verifies digest/revision -> deploy -> bounded live checks -> external private-LAN smoke if required`

Synology must not rebuild the release product.

Do not relabel a PR-head artifact as merged-main merely because content seems equivalent. If equivalence is proven, record it as additional evidence; release identity still binds the merged-main build/provenance contract.

Artifact transport/storage must honor rights/provenance restrictions.

## Active-stack reconciliation requirement

Before implementing further phases of #179, reconcile existing stacked PRs instead of blindly continuing their old architecture.

### PR #190 or successor

Preserve useful security/isolation components such as trust checks, supersession handling, unique workspace/project/artifact identity and specialist-host admission where still needed.

Remove or redesign the assumption that normal `browser-full` PR evidence is produced on Molehill. Retarget the ordinary functional execution path to GitHub-hosted. Self-hosted admission remains only for specialist resource classes.

Do not use `pull_request_target` to execute untrusted candidate code. Prefer ordinary `pull_request` GitHub-hosted execution for routine candidate E2E.

### PR #195 or successor

Repurpose normal worker/resource calibration around the GitHub-hosted backend and GitHub-level sharding. Keep a distinct measured policy only for the specialist Molehill workloads that actually remain.

Do not let the old Molehill 1/2/4/6/8 benchmark gate selective cutover of GitHub-hosted normal E2E.

### PR #200 or successor

Preserve fail-closed plan-based selection, plan-scoped groups, force-full widening, shadow evidence and full-safety-net precondition.

Change its execution backend assumptions so selected ordinary E2E groups run GitHub-hosted. Selective execution must not mean selective production of `atlas-local-e2e` from a physical PC.

If the cleanest safe integration is to close/supersede an obsolete draft rather than contort it, do so with explicit provenance and preserved useful commits. Do not merge architectural debt merely to retain PR numbering.

## Implementation programme

Ship reviewable phases. The exact branch/PR structure may be adjusted to current repository state, but the dependency order and safety gates must remain.

### Phase 0 — corrective alignment and execution freeze

- resolve fresh #179/#190/#195/#200 and current main;
- mark/document the GitHub-hosted-first correction;
- reconcile `AGENTS.md`, verification-platform docs and Issue #179 so no active instruction still requires routine Molehill full E2E;
- keep current full-safe behavior authoritative while the corrected hosted path is built;
- prevent further investment in Molehill-only normal PR architecture.

### Phase A — inventory, stable IDs and test audit

- inventory every current test/workflow/group;
- create stable test IDs and exact executed/required set validation;
- produce KEEP/MOVE/NARROW/SPLIT/MERGE/DELETE/ADD audit ledger;
- implement finer catalog and impact domains;
- add tests for catalog/manifest integrity and required skip semantics;
- no destructive retirement until replacement proof exists.

### Phase B — GitHub-hosted self-contained E2E

- make selected Playwright groups execute on GitHub-hosted runners against exact self-contained candidate inputs;
- reuse/pin Docker/Playwright harness appropriately;
- remove ordinary PR dependence on `atlas-local-e2e`/Molehill/local publication;
- add exact-head plan-bound summary/evidence;
- cancellation/supersession and artifact isolation.

### Phase C — test decomposition and workflow deduplication

- split mega-tests into independently selectable groups;
- merge duplicate assertions at the cheapest correct layer;
- keep unique higher-level integration oracles;
- move stress/scale/performance/soak/seeded journeys to depth cadence;
- remove duplicated workflow invocations that add no unique environment/input proof;
- add missing accessibility/required-precondition coverage where justified.

### Phase D — hosted worker/shard/caching calibration

- benchmark GitHub-hosted worker counts and 1/2/4 shard scale-out;
- measure cold/warm build/cache/startup overhead;
- choose per-profile worker/shard policy from evidence;
- avoid pathological over-sharding;
- optimize Docker/build/cache/I/O only where measured benefit exists.

### Phase E — trusted planner/evidence hardening

- implement/finish `none/focused/targeted/broad/full` planning;
- trusted-base anti-self-certification;
- exact plan/evidence stable-ID validation;
- rename/multi-path/cross-domain/unknown negative tests;
- plan-scoped visual/a11y and specialist requirement encoding;
- moving-main/input-digest invalidation logic.

### Phase F — shadow calibration and backtest

- historical representative backtest;
- live shadow plans versus full-safe outcomes;
- record over-selection and escapes;
- permanent regression for every selector miss;
- demonstrate complete current-main full safety net;
- keep work-saving selective execution disabled until criteria pass.

### Phase G — selective cutover

- enable selective execution;
- prove docs/focused/targeted PRs avoid unrelated heavy work;
- prove broad/full/unknown/governance changes still widen correctly;
- prove `force-full` and automatic selector-escape safety fallback;
- verify agents no longer reflexively run full suite in the inner loop.

### Phase H — specialist lanes and release/Synology reduction

- keep only justified Molehill private visual/native GPU/Windows/LAN groups;
- calibrate their actual workload/resource policy;
- build exact merged-main release artifact off Synology;
- promote unchanged by digest;
- remove browser E2E/stress/soak/performance/build work from Synology;
- preserve deployment/integrity/revision/rollback and bounded external live smoke.

### Phase I — terminal optimization closeout

- run complete full safety net;
- execute realistic concurrent PR load/cancellation tests;
- verify selector feedback fallback;
- compare before/after wall-clock latency, queueing and compute consumption;
- verify no regression-detection/provenance/right boundary was weakened;
- close #179 only when the end-state is merged and proven.

## Required negative proofs

At minimum test that:

- unknown runtime path selects broad/full;
- multi-path/rename union cannot under-select;
- verification-policy mutation cannot self-narrow;
- missing/duplicate stable test ID rejects evidence even if counts match;
- required group with missing prerequisite cannot pass via skip;
- stale plan/integration base cannot satisfy readiness;
- superseded/cancelled job cannot satisfy success evidence;
- untrusted candidate cannot reach Molehill specialist runner;
- ordinary plan cannot request Molehill without an allowlisted specialist reason;
- Synology runner cannot accept normal browser-full/stress/soak/performance resource classes;
- ordinary PR E2E cannot depend on private LAN publication;
- plan-scoped visual evidence cannot be replaced by stale/copied review;
- selector escape triggers safe full-mode rollback/fallback;
- `force-full` can only widen;
- shard evidence union equals exact required stable test-ID set;
- duplicate shard/test execution is visible and does not hide missing IDs;
- artifact promotion rejects wrong digest/revision;
- no release product is rebuilt on Synology;
- restricted visual bytes are not uploaded through the public artifact path;
- workflow dedup does not remove unique producer/integration proof.

## Acceptance criteria

The programme is complete only when objective evidence proves all of the following:

1. Current repository instructions/docs/Issue #179 agree on GitHub-hosted-first normal E2E placement.
2. Routine PR Playwright no longer requires Molehill or manually published `atlas-local-e2e` evidence.
3. Molehill is used only by explicit specialist capability groups.
4. Synology executes no ordinary/full browser E2E, stress, scale, soak, performance or broad visual suite.
5. Synology does not rebuild the exact release artifact.
6. `none/focused/targeted/broad/full` plans are deterministic, versioned and fail closed.
7. Impact classification unions all changed paths/renames and handles dependency fan-out.
8. Candidate policy cannot self-narrow below trusted base.
9. Exact stable test-ID sets replace scenario count as correctness identity.
10. Required tests cannot disappear through skip/missing prerequisite semantics.
11. Catalog granularity is sufficient to select state/search/geometry/creatures/farm/a11y/visual/depth independently.
12. Every current E2E test/group has a documented KEEP/MOVE/NARROW/SPLIT/MERGE/DELETE/ADD decision.
13. No unique independent oracle is removed without replacement/contract-retirement proof.
14. Mega-tests are decomposed enough that unrelated feature changes do not pull the whole file/group unnecessarily.
15. Seeded journeys, stress, scale, performance trend and soak are not universal ordinary PR gates.
16. Fixed cross-feature journeys are broad/full rather than default targeted work.
17. Geometry/render/state/fault/resilience high-value oracles remain blocking for affected domains.
18. Accessibility remains behaviorally tested and missing automated rules coverage is explicitly resolved.
19. Cross-browser scope matches the declared product support contract; no accidental full 3-browser multiplication.
20. GitHub-hosted worker/shard policy is measured on the real target runner environment.
21. Shard count is selected from wall-clock/variance/startup/cost evidence, not intuition.
22. Ordinary PR E2E is self-contained and does not load Synology/private LAN.
23. Superseded heads cancel obsolete expensive work.
24. Workflow duplicate execution is audited and unnecessary duplicate work removed without losing unique integration proof.
25. Shadow/live historical calibration shows no unexplained selective false-negative escape before cutover.
26. Full current-main safety net is operational before selective skips become authoritative.
27. A tested selector-escape feedback mechanism can restore force-full/full-safe behavior after a miss.
28. Retries remain zero; assertions/tolerances/oracles/provenance are not weakened.
29. Visual evidence remains exact, genuinely reviewed where required and rights-safe.
30. Exact plan/evidence bind head/base/diff/policy/catalog/worker-shard/product identities.
31. Moving main invalidates only materially affected proof while final readiness remains exact and fail closed.
32. Exact merged-main artifact is built once off Synology and promoted unchanged by digest.
33. Deployment verifies exact revision/integrity and retains rollback proof.
34. Private-LAN live browser smoke, if still needed, is bounded and externally executed; it is not the full suite and not a Synology compute responsibility.
35. Agent instructions explicitly forbid reflexive full E2E after each small edit and require narrow inner-loop tests.
36. Remote Desktop/Desktop Commander is exception-only and not routine CI/test polling.
37. `atlas-gate` and `provenance-gate` remain protected required checks.
38. Full safety-net stable test-ID membership has not accidentally shrunk during refactor.
39. Before/after evidence shows materially lower median ordinary PR verification latency and reduced dependence on the user's physical PC without increased deterministic failure/flake/selector-miss rate.
40. The implementation has a documented safe rollback path to full verification if selective or hosted execution is found unsound.

## Success metrics

Report both correctness and efficiency. At minimum compare before/after:

- median and p95 PR verification wall time by profile;
- full-suite wall time;
- targeted-plan wall time;
- queue/startup time;
- GitHub Actions job/minute consumption;
- Molehill jobs per normal PR (target: zero unless specialist capability required);
- Synology browser-test jobs (target: zero);
- full-suite executions per small PR (target: zero unless plan/full-safe rule requires it);
- first-run deterministic failure rate;
- flake/infrastructure failure rate;
- selector false-negative escapes (target: zero at cutover; any later escape triggers safety fallback);
- over-selection rate;
- cache hit/build/startup contribution;
- artifact bytes and restricted-artifact compliance;
- useful verified plans/hour under realistic concurrent development.

Do not optimize one metric by making another safety metric worse.

## Merge and branch lifecycle

For every phase PR:

1. refresh protected `main` before final readiness;
2. reconcile upstream movement without discarding valid task history;
3. inspect complete changed-file set and full diff;
4. run the exact verification plan for the phase plus bootstrap/full proof where verification-governance changed;
5. require exact-head protected checks/reviews;
6. renew only invalidated evidence after changes;
7. squash merge with expected-head fencing;
8. verify resulting merged-main SHA and post-merge checks;
9. delete terminal branches unless they have a documented provenance role;
10. continue autonomously through #179 until the target state is actually merged and proven.

Never force-push published history merely because `main` moved. A lost merge race returns to integration/reconciliation, not implementation from scratch.

## Final report

At terminal completion separate FACT / INFERENCE / UNKNOWN and include:

- lifecycle Issue and every implementation/supersession PR;
- final protected main SHA;
- final execution-placement matrix by group;
- exact impact-manifest/catalog/plan schema versions/digests;
- complete test audit ledger and all retired/merged/split/add decisions;
- current full safety-net stable test-ID census;
- GitHub-hosted worker/shard benchmark and selected policy;
- Docker/cache/build/startup before/after data;
- workflow deduplication result;
- selective historical/shadow calibration result;
- selector escape/fallback proof;
- accessibility/cross-browser decisions;
- Molehill final specialist role and measured usage;
- Synology final role with proof it no longer executes heavy E2E/build work;
- exact merged-main artifact digest/promotion/deployment chain;
- bounded live-smoke evidence where applicable;
- protected gate results;
- before/after PR latency/throughput/compute metrics;
- any remaining external blocker precisely classified.

Do not claim completion from a design, benchmark, partial hosted migration, green subset, or selective planner alone. Completion requires the merged end-state, full safety-net proof and measured evidence that ordinary development no longer pays for unrelated full E2E or unnecessary physical-PC/Synology execution.
