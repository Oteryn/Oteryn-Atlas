# ATLAS-COMPREHENSIVE-VERIFICATION-PLATFORM

ALIAS:
ATLAS-COMPREHENSIVE-VERIFICATION-PLATFORM

MODE:
Autonomous cross-cutting test-platform implementation + verification + integration + closeout.

DO NOT STOP AT AUDIT, DESIGN, OR A PARTIAL TEST ADDITION.

Lifecycle authority:
- Oteryn/Oteryn-Atlas#85

Repository:
- https://github.com/Oteryn/Oteryn-Atlas

Authoritative platform design:
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`

Historical E2E baseline:
- Issue #55
- PR #56
- PR #66

## Mission

Implement the comprehensive Atlas verification platform defined by `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` on top of the existing repository `node:test` contracts and Dockerized Playwright harness.

The goal is not another test framework or a user-facing module-status system. The goal is to make every shipped Atlas behavior deeply and reproducibly testable and to ensure applicable failures block merge.

Every reproducible bug found during this work must receive a permanent deterministic regression test before the fix is accepted.

## Preflight

Before any mutation:

1. refresh current `main`;
2. read root `AGENTS.md`;
3. read Issue #85 and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`;
4. inspect current `tests/**`, `e2e/**`, `.github/workflows/**`, current required checks, and any nearer `AGENTS.md`;
5. inspect open PRs/issues/branches for overlap, especially active runtime/animation/creature work;
6. record exact base SHA;
7. use one dedicated task branch and one PR;
8. never push ordinary work directly to `main`.

If `main` advances materially while implementation is in progress, refresh/rebase before final qualification and rerun the complete applicable suite on the exact final head.

## Hard implementation rules

- Preserve Oteryn-Game as canonical World/Content authority.
- Extend existing `node:test` and Playwright systems rather than duplicating them.
- Do not introduce framework churn for convenience.
- Keep Playwright retries at zero for deterministic acceptance.
- Never use broad console/network allowlists to hide failures.
- Prefer observable committed state over arbitrary sleeps.
- Do not calculate expected geometry solely with the same production function being tested.
- Testability hooks must be read-only truthful diagnostics, not setters/mocks/alternate loaders.
- Do not weaken fail-closed behavior or provenance checks.
- Do not deploy a task-branch revision as live Atlas.
- Do not claim live acceptance against a stale deployed SHA.

## Required delivery tracks

All tracks below are part of this implementation unless current architecture proves one is technically inapplicable; any inapplicability must be evidenced precisely.

### 1. Testing policy integration

Update repository agent/test policy so future feature and bug-fix work is required to add deep applicable tests in the same delivery.

Encode at minimum:

- behavior coverage over mere code/UI presence;
- edge/failure/state/integration testing where applicable;
- geometry/render testing for world-anchored/map changes;
- performance/stress testing for performance-sensitive runtime changes;
- permanent regression for each reproducible bug;
- no completion claim without exact-head applicable tests.

Do not add a user-facing module status system.

### 2. Current-suite inventory and normalized evidence

Inventory current unit/contract/browser/E2E/workflow coverage and preserve useful existing tests.

Normalize machine-readable run/scenario evidence so failures identify:

- exact revision/target;
- scenario/category;
- browser/profile;
- duration;
- seed where applicable;
- evidence paths;
- explicit skip reason.

Do not rewrite working tests merely to satisfy a preferred directory layout.

### 3. Read-only renderer observability

Implement a bounded serializable diagnostic snapshot of the real browser runtime sufficient for geometry/render diagnosis.

Use or extend existing truthful diagnostic surfaces when possible.

The exposed state may include camera/zoom/floor/mode/viewport/DPR/frame generation, actual committed base/overlay transforms, bounded visible world-anchor records, chunk/cache counts, and renderer timing evidence.

Requirements:

- no mutators;
- no fake data injection;
- no privileged loaders;
- no alternate source of authority;
- snapshot/copy/frozen values;
- explicit tests proving the diagnostics reflect real state and do not change behavior.

### 4. Geometry and transform invariants

Implement an independent geometry oracle plus real-browser assertions for all shipped world-anchored layers.

Mandatory first regression:

**NPC/monster overlay drift relative to the base map during pan/zoom.**

The regression must fail when base-map and overlay screen deltas diverge beyond a justified small tolerance and must retain before/after diagnostic/screenshot evidence.

At minimum cover:

- horizontal/vertical/diagonal pan;
- repeated inverse pan;
- wheel and button zoom;
- combined pan+zoom;
- resize/orientation-like transition;
- floor transition where applicable;
- relevant AUTO/MINIMAP/MAP transitions;
- NPC only, monster only, both enabled;
- layer toggle around/in movement;
- reload/deep-link restoration after movement.

Do not satisfy this track using only toggle state, `drawnRecords`, or absence of console errors.

### 5. Deterministic property/metamorphic tests

Add deterministic generated tests for pure coordinate/state invariants where meaningful, including round trips and inverse/composition properties.

The runner must print/replay seeds or use fully enumerated deterministic cases.

If a new property-test dependency is proposed, prove it provides shrinking/replay/value beyond a small repository-owned generator and pin it with a lockfile.

### 6. Seeded model-based interaction stress

Implement a bounded action model for legal Atlas interactions and deterministic seeded sequence execution.

Include actions such as pan, zoom, floor, mode, layer toggles, search/selection, navigation history, reload and resize where shipped.

Requirements:

- seed and action log retained;
- invariant assertions after actions;
- first failing action index retained;
- exact replay support;
- fixed PR smoke seeds;
- broader scheduled seed matrix;
- newly discovered failures promoted to named permanent regressions.

### 7. Race/fault scenarios

Add bounded cases for in-flight interactions and failure behavior where the harness can cleanly control them, including delayed/failed/malformed required and optional resources, rapid pan/zoom/layer changes during load, and state/history interaction around pending work.

Do not mask expected failures globally.

### 8. WebGL/render probes

Implement stable bounded probes for failures not provable through DOM geometry alone, such as blank/stale map regions, wrong floor/mode, stale render generation, missing tile/texture replacement or required layer ordering.

Use independent evidence where practical.

### 9. Targeted visual regression

Add only stable high-signal visual baselines/crops.

Required baseline metadata:

- browser/container identity;
- viewport/DPR;
- locale/timezone;
- baseline revision/provenance;
- explicit reviewed baseline updates.

On failure retain expected/actual/diff images.

Avoid a fragile full-page pixel-perfect gate.

### 10. Performance/stability workloads

Implement reproducible representative interaction workloads for map pan/zoom, overlay enablement, renderer transitions and other shipped heavy paths.

Collect stable available evidence such as scenario duration, frame/late-frame signals, long tasks, renderer timings, request/chunk/cache counts and bounded memory indicators.

Do not invent blocking performance budgets. First measure a repeated known-good baseline, document distribution/variance, then adopt evidence-backed budgets. Once adopted, budgets are blocking unless deliberately revised with reviewed evidence.

### 11. Soak/leak depth

Add scheduled bounded repeated interaction checks that can detect unbounded cache/record/heap/resource growth and duplicated retained overlay state.

### 12. Accessibility/input depth

Preserve existing accessible-name/state checks and extend critical keyboard/touch/responsive reachability. An axe integration is optional and must not be presented as formal WCAG conformance.

### 13. Mutation-test evaluation

Run a bounded proof of mutation testing for critical pure logic such as transforms/parsing/state normalization if technically reasonable.

Adopt only if it produces useful deterministic signal at acceptable cost with pinned dependencies. Otherwise record evidence for why it is not adopted; do not force mutation testing onto WebGL/browser code where it is noisy/prohibitively expensive.

### 14. Required CI integration

Integrate applicable deterministic verification into required CI fan-in (`atlas-gate` or repository-approved equivalent) so the new platform is not an optional disconnected workflow.

Preserve `provenance-gate`, security, and existing product checks.

Design runtime-cost tiers, but do not use tiering to merge changed behavior without its complete applicable deterministic coverage.

Scheduled depth can run longer seed/soak/mutation/browser matrices, but PR exact-head gates must still cover every changed behavior appropriately.

## Failure artifact contract

Implement the machine-readable failure evidence described in `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`.

For geometry/stress/render failures, retain where applicable:

- exact Atlas SHA/target mode;
- browser/container/profile;
- scenario id;
- seed/action log;
- before/after renderer snapshots;
- expected/observed movement and drift;
- first failing action/frame generation;
- console/page/network failures;
- trace/video/screenshot;
- visual expected/actual/diff;
- performance observation/budget.

Keep artifacts bounded and do not commit bulky generated run output to source control unless repository evidence policy explicitly requires a compact durable manifest.

## Verification of the test platform itself

Do not trust a new gate merely because its happy path passes.

For each major harness component, prove at least one controlled bad case causes the intended failure, for example:

- geometry oracle rejects a deliberately offset test fixture/probe;
- visual diff rejects a controlled changed crop;
- stress replay reproduces a deliberately induced deterministic invariant failure in a harness-only fixture;
- performance comparator rejects an over-budget synthetic measurement;
- failure artifact manifest validates required fields;
- diagnostics cannot mutate production state.

Use test-only fixtures/harness controls for these self-tests rather than shipping broken production behavior.

## Exact-head validation before completion

At minimum:

1. run all affected and new `node:test`/property/contracts;
2. run full Docker Playwright suite on exact branch head;
3. run all geometry/render/visual/stress/performance PR gates;
4. run harness self-tests/negative proofs;
5. run provenance verification;
6. run repository syntax/static checks and `git diff --check` equivalent;
7. inspect complete changed-file set and full diff;
8. verify no production/test authority boundary was weakened;
9. require exact-head GitHub CI including `atlas-gate` and `provenance-gate` plus applicable security checks;
10. resolve review findings and rerun after any change.

Where an authorized matching preview and appropriate runner are available, run exact-revision direct-preview acceptance. If the live/preview SHA is stale, report it and do not claim current-head live acceptance.

## Definition of Done

This task is DONE only when all acceptance criteria in Issue #85 and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` are objectively met, the exact final head is fully qualified, required CI gates are green, the PR is squash-merged according to repository policy, and terminal evidence is recorded on Issue #85.

Do not close #85 on the basis of design documentation alone.

## Final report

Report FACT / INFERENCE / UNKNOWN separately and include:

- base SHA;
- final branch head SHA;
- PR number;
- exact commands/results for unit/property/Playwright/geometry/render/visual/stress/performance suites;
- NPC/monster drift regression result;
- scenario/seed census;
- artifact paths;
- adopted performance baselines/budgets and evidence;
- mutation-test disposition and evidence;
- exact GitHub workflow run IDs and required-check status;
- merged SHA if merged;
- live/direct-preview URL/revision/result if exact-revision acceptance was actually performed;
- any remaining blocker precisely identified.

Never claim completion without objective exact-head evidence.