# ATLAS-PORTAL-DOCKER-E2E-EXPANSION

ALIAS:
ATLAS-PORTAL-DOCKER-E2E-EXPANSION

MODE:
Autonomous implementation + verification + integration + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Lifecycle authority:
- Oteryn/Oteryn-Atlas#55

Repository:
- https://github.com/Oteryn/Oteryn-Atlas

Primary goal:
Expand the existing Dockerized Playwright/Chromium portal E2E harness into a broad, deterministic acceptance suite that can qualify the current checkout and the deployed Synology preview without conflicting with the active animation workstream.

## Preflight

1. Refresh current `main` before any mutation.
2. Read root `AGENTS.md`, Issue #55, the existing Docker E2E harness introduced by PR #38, current test contracts, and any nearer `AGENTS.md` for touched paths.
3. Inspect open PRs/issues and active branches for overlap.
4. Record exact base SHA.
5. Use one dedicated task branch and one PR; never push ordinary work directly to `main`.

## Strict non-overlap boundary

Another agent owns `ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME-IMPLEMENTATION` / Atlas Issue #49.

Do NOT modify or take ownership of:
- `src/browser/animation-runtime.mjs`
- `tools/animation-runtime/**`
- animation product generation
- animation scheduler/runtime implementation
- world animation rendering
- creature outfit renderer implementation
- Game-owned animation semantics

Do not alter #49's branch, commits, PR, evidence or lifecycle state.

You MAY add generic E2E infrastructure that #49 can later consume, provided it does not encode unmerged animation-specific assumptions.

If a test target is not yet present on `main`, mark it as future/conditional coverage rather than modifying the feature implementation.

## Existing baseline

Use the repository's current Docker/Chromium E2E harness as the implementation baseline. Preserve its existing contract and extend it instead of creating a disconnected second harness.

The suite must remain runnable from Molehill-PC entirely inside Docker and must not depend on a host-installed browser, Node or Python unless the current repository contract explicitly requires it.

## Required target modes

Support both:

1. exact local checkout / locally served repository revision;
2. optional deployed preview origin, including the existing Synology Atlas preview when supplied as the target URL.

The test report must always record:
- target URL/origin;
- tested Atlas SHA when determinable;
- browser/container identity;
- viewport/device profile;
- scenario name;
- PASS/FAIL;
- failure evidence paths.

Never silently test a stale deployed revision while claiming current-main qualification.

## Core acceptance coverage

Expand deterministic real-Chromium coverage across at least:

### Boot / page integrity
- main portal loads successfully;
- FullWorld runtime initializes;
- expected qualification/runtime state becomes ready;
- no uncaught page errors;
- no unexpected console errors;
- no unexpected HTTP >= 400 responses for required resources;
- known optional/fail-closed resources are classified explicitly rather than globally ignored.

### Desktop navigation and map controls
- zoom in/out buttons;
- wheel zoom;
- drag/pan;
- floor selector;
- floor up/down controls;
- AUTO / MINIMAP / MAP modes across meaningful zoom thresholds;
- overview toggle;
- map remains interactive after repeated state transitions;
- URL/runtime state remains coherent.

### Coordinate navigation
- coordinate input/go flow;
- valid coordinates navigate deterministically;
- invalid/out-of-bounds inputs fail safely;
- floor is preserved/changed only as declared by runtime semantics.

### Semantic search
- named search;
- stable ID/entity search where currently shipped;
- result selection;
- navigation to coordinates;
- inspector/result consistency;
- deep-link/reload persistence where supported;
- no test may invent Game-owned facts: use repository-published fixtures/index data or authoritative current products.

### Inspector / state / history
- selecting inspectable records updates the inspector;
- refresh preserves declared URL state;
- browser back/forward remains coherent;
- repeated selection does not corrupt semantic inspector state;
- no mojibake or obviously broken labels in critical paths.

### Current creature surfaces
For creature/NPC functionality present on current `main`:
- independent NPC toggle;
- independent Monster/Spawns toggle;
- search;
- stable creature deep-link;
- inspector;
- enable/disable persistence;
- bounded drawing diagnostics where exposed;
- fallback/failure behavior.

Do NOT add assertions that depend on unmerged animated outfit rendering from Issue #49.
After #49 merges, its owner may extend this harness with animation-specific acceptance.

### Mobile/responsive
At minimum qualify representative phone viewport(s):
- full-width map workspace;
- controls drawer open/close;
- inspector drawer open/close;
- backdrop behavior;
- Escape where supported;
- visible zoom controls;
- coordinate/search access;
- floor controls;
- creature controls currently shipped;
- resize/orientation-like viewport transitions where meaningful;
- no horizontal layout breakage blocking core controls.

### Accessibility contract checks
For critical controls:
- accessible names/labels exist;
- buttons/inputs are operable;
- drawer state is exposed consistently where applicable;
- hidden/disabled controls are truthful;
- keyboard Escape/activation paths are exercised where repository UI supports them.

Do not claim formal WCAG conformance unless a separate audited requirement exists.

## Failure injection / resilience

Add bounded negative scenarios where practical without changing application semantics:
- required resource HTTP failure;
- malformed JSON/product response if harness can intercept it cleanly;
- unavailable creature index/search product;
- delayed response/timeouts within bounded test policy;
- invalid deep-link/search state.

Failures must produce deterministic diagnostics and artifacts.
Do not weaken application fail-closed behavior to satisfy tests.

## Determinism and anti-flake requirements

- Prefer observable application state/events/contracts over arbitrary sleeps.
- Avoid fixed long timeouts as synchronization mechanisms.
- Use bounded polling only where necessary.
- Stabilize viewport, browser flags, locale and timezone when they influence assertions.
- Scenario retries must not hide genuine first-run failures.
- If retries are retained for infrastructure noise, preserve first-failure evidence and classify the retry explicitly.
- Tests must be independently reproducible from a clean Docker invocation.

## Network/error policy

The suite must fail on:
- uncaught page exceptions;
- unexpected browser console errors;
- unexpected required-resource HTTP >= 400;
- broken navigation/assertion contracts.

Maintain a small explicit allowlist only for known optional resources whose absence is an intentional fail-closed state. Every allowlist entry must include the reason and should be removable when the feature becomes required.

Do not use broad wildcard ignores.

## Artifact requirements

On failure, retain bounded evidence under `artifacts/e2e/` or the repository-approved equivalent:
- screenshot;
- concise Playwright/browser log;
- console/page errors;
- failed request summary;
- exact scenario metadata;
- tested target/revision;
- optional trace only when size remains bounded and useful.

On success, retain a compact machine-readable summary proving the executed scenario matrix.

Do not commit bulky generated artifacts unless repository policy explicitly calls for durable evidence; prefer CI artifacts and compact evidence manifests.

## Docker requirements

- pinned/reproducible browser image or repository-standard image strategy;
- no privileged container unless already justified by the existing harness;
- no host Docker socket unless current harness explicitly requires and documents it;
- bounded CPU/memory expectations;
- clean exit and cleanup;
- failure must return non-zero;
- target URL and relevant options must be explicit environment/CLI inputs rather than source edits.

## Performance / boundedness

Record at least coarse acceptance timing per scenario or suite.
Avoid unbounded test loops, unbounded screenshot/trace generation, and unnecessary full-world downloads when a bounded viewport scenario proves the contract.

The E2E expansion must not materially change production/runtime code solely to make tests easier. Small testability hooks are allowed only when they expose existing truthful state and are reviewed as non-authoritative diagnostics.

## Integration with active work

Before final PR qualification, refresh current `main` because Issue #49 or other Atlas work may merge while this task runs.

If main advances:
- update/rebase the branch;
- inspect conflicts;
- rerun the complete applicable E2E matrix;
- do not import feature-specific assertions from unmerged branches.

Do not close Issue #43 or Issue #49 from this task.
Issue #55 is the lifecycle authority for this work.

## Validation before PR completion

Run:
- the expanded Docker E2E suite against exact branch head;
- existing repository unit/contract tests affected by changed paths;
- `git diff --check` or repository equivalent;
- complete changed-file and full-diff self-review;
- exact-head GitHub CI;
- required `atlas-gate`;
- required `provenance-gate`;
- applicable CodeQL/security workflows.

If Molehill-PC is available, run the final Docker E2E there against exact final head and retain evidence.

If a Synology preview is available and its served revision matches the intended target, run the same bounded suite against it. If the deployed revision is stale, report the stale SHA/header precisely and do not claim current-main live acceptance.

## PR and merge discipline

- one Issue (#55), one branch, one PR;
- record base and final head SHAs;
- no unrelated runtime/animation implementation changes;
- resolve review findings;
- exact-head gates must pass;
- squash merge according to repository policy;
- delete terminal branch after merge unless explicitly required for provenance.

## Definition of Done

This task is DONE only when:

[ ] existing Docker E2E harness is expanded rather than duplicated
[ ] desktop core portal journeys are covered
[ ] mobile core portal journeys are covered
[ ] FullWorld map controls are covered
[ ] coordinate navigation is covered
[ ] semantic search/navigation/inspector is covered
[ ] current shipped creature/NPC surfaces are covered
[ ] browser/page/HTTP failure detection is strict and deterministic
[ ] bounded negative/failure scenarios exist
[ ] artifacts are retained on failure
[ ] current checkout target mode works
[ ] deployed-preview target mode works when a matching preview is available
[ ] exact final head is tested on Molehill-PC when available
[ ] no conflict/ownership violation with Issue #49 animation work occurred
[ ] exact-head CI / atlas-gate / provenance-gate pass
[ ] PR is merged
[ ] Issue #55 has terminal evidence and is closed only after verified completion

## Final report

Report FACT / INFERENCE / UNKNOWN separately and include:
- final Atlas main SHA;
- Issue #55;
- PR number and merged SHA;
- exact branch-head E2E command/result;
- Molehill-PC result and artifact path if available;
- deployed-preview URL/revision/result if tested;
- scenario census;
- any explicitly skipped/conditional cases and why;
- exact CI run IDs;
- confirmation that no Issue #49-owned implementation paths were modified.

Never claim completion without objective exact-head evidence.
