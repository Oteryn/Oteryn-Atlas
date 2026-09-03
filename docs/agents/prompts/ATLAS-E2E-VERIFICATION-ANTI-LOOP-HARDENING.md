# ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING

ALIAS:
ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING

MODE:
Autonomous senior verification-architecture implementation + migration + negative proof + protected integration + closeout.

EFFORT:
Use the highest available reasoning/implementation effort. This is a correctness-critical protected CI architecture change; do not downgrade it to a quick workflow patch.

Repository:
- `Oteryn/Oteryn-Atlas`

Lifecycle authority:
- Issue #179 `Implement plan-bound, resource-aware Atlas E2E verification`

Normative design:
- `docs/superpowers/specs/2026-08-30-atlas-e2e-verification-anti-loop-hardening-design.md`

Implementation plan:
- `docs/superpowers/plans/2026-08-30-atlas-e2e-verification-anti-loop-hardening.md`

## Mission

Systemically eliminate the verification closeout/requalification loop that has caused serial protected bootstrap PRs, repeated candidate reintegration and repeated expensive exact-head qualification after unrelated `main` movement.

The observed failure pattern is:

`candidate repair -> protected workflow/environment defect -> bootstrap PR -> merge main -> reintegrate candidate -> exact-head rerun -> next protected environment defect -> repeat`.

The Phase-D chain already included #266, #270 and #271 before returning to #268 and final #213. Do not continue this pattern.

The root problem is not that exact candidate identity is too strict. Exact candidate-head fencing is required and must remain. The problem is that the current implementation conflates current protected `main` commit identity with semantic verification authority/evidence identity. It also discovers protected environment assumptions too late in the expensive browser path.

Implement the architecture in the normative design and plan so that unrelated base movement can be classified and valid evidence reused safely, while real authority/candidate/environment/product/test-set changes still invalidate the correct dependent evidence.

## Live-state authority

GitHub live state is the only source of truth.

Before any mutation:

1. refresh current protected `main`;
2. read root `AGENTS.md` and all applicable nearer instructions;
3. read current Issue #179 including newest comments;
4. refresh PR #268, PR #213 and any newer overlapping #179 PRs;
5. inspect current branch protection / required checks visible to the authorized source;
6. inspect current controller/executor/fan-in/planner files from the exact live base;
7. inspect current workflow runs relevant to #179;
8. record the exact starting SHA and do not trust SHAs embedded in this prompt/design/plan after live state has moved.

Do not restart completed work. Continue from the furthest valid current state.

## Critical invariants

These are non-negotiable:

- preserve `atlas-gate` and `provenance-gate`;
- preserve exact candidate-head fencing before expensive work and evidence acceptance;
- preserve retries=0 for deterministic/browser acceptance;
- preserve exact expected stable-ID equality with no missing/unexpected/duplicate IDs;
- preserve protected lower-bound planning; candidate may widen but cannot narrow;
- preserve immutable product identity and data-capability separation;
- `profile=full` must not imply `real_fullworld`;
- ordinary deterministic/browser functional E2E stays GitHub-hosted;
- Molehill remains specialist-only for explicit real-fullworld/native/private/hardware truth;
- Synology remains deployment-only;
- no no-op commits solely to retrigger CI;
- no stale evidence accepted merely because a historical GitHub check is green;
- no blanket ignore of `main` movement: use protected compatibility classification.

## Mandatory architecture

Implement the normative design, including all of the following.

### 1. Verification authority identity

Create a protected machine-readable authority manifest and canonical `authorityDigest` based on bytes/configuration that can alter protected planning, placement, execution or evidence acceptance.

Current protected `main` SHA remains provenance metadata but must no longer be the semantic identity of the whole verification authority.

Tests must prove:

- unrelated repository/main changes do not change `authorityDigest`;
- planner/stable-ID/controller/executor/fan-in authority changes do change it;
- missing/unknown authority paths fail closed.

### 2. Protected execution environment identity and qualification

Create a canonical `environmentDigest` and one bounded environment qualification that executes before expensive browser candidate work.

It must cover all current real assumptions, including the defects already exposed by #270/#271:

- protected Node dependency placement before read-only candidate mount;
- exact pinned Playwright image/browser;
- Python 3 availability and required `python` compatibility shim;
- writable Python bytecode cache in `/tmp`;
- read-only source/candidate tree;
- required network-none/loopback/socket behavior;
- UID/GID, resource limits and artifact paths;
- required runtime tools/dependencies.

Do not wait for full Chromium qualification to discover the next environment prerequisite one at a time.

### 3. Semantic versus forensic plan identity

Split current monolithic plan identity into:

- `planInstanceDigest`: complete run/provenance identity, allowed to change when base SHA/run instance changes;
- `planSemanticDigest`: only candidate/change-set, authority, environment, product, exact test set, execution policy and other semantic dependency identities.

An unrelated `main` advance must be capable of changing instance identity while leaving semantic identity unchanged.

### 4. Base Advance Compatibility Gate

Implement protected classification for `main B1 -> B2`:

- `REUSE`
- `PARTIAL_RERUN`
- `FULL_RERUN`
- `REINTEGRATE`

Use protected changed-path/dependency/authority/environment/product/stable-ID/merge conflict evidence.

Changing `main` must not automatically mutate the candidate or reset the lifecycle.

A qualified candidate with an unrelated base advance goes to compatibility assessment, not back to discovery.

### 5. Failure ownership

Every authoritative failure must have one primary class:

- `CANDIDATE_FAILURE`
- `AUTHORITY_FAILURE`
- `ENVIRONMENT_FAILURE`
- `PRODUCT_FAILURE`
- `EXTERNAL_FAILURE`
- `STALE_CANDIDATE`
- `INTEGRATION_INCOMPATIBILITY`

Do not change the candidate branch in response to `AUTHORITY_FAILURE` or `ENVIRONMENT_FAILURE` unless candidate code is independently proven to require modification.

### 6. Anti-loop state machine and circuit breaker

Implement explicit progress states from discovery through qualification/base compatibility/merge ready/done plus blocked/stalled/stabilization states.

Executable policy must prevent:

- repeated identical deterministic reruns with unchanged semantic inputs;
- no-op commit retrigger loops;
- indefinite micro-bootstrap PR cascades.

The #179 closeout has already encountered serial protected environment/control-plane defects (#270/#271). If another defect of this class is found, DO NOT create a new one-off micro-bootstrap chain. Consolidate it into this coherent stabilization work and enter `ARCHITECTURE_STABILIZATION_REQUIRED` as designed.

### 7. Dependency-bound evidence manifests and safe reuse

Introduce evidence manifests and protected reuse validation.

Evidence reuse must bind exact semantic dependencies. Fan-in must validate the evidence manifest itself and all relevant digests, not only historical workflow/check state.

Reuse must fail closed on candidate/authority/environment/product/test-set/policy mismatch, revocation, unavailable evidence or stable-ID mismatch.

### 8. Consolidation

Once the replacement path is protected and proven, inventory the existing `protected-*-promotion*.yml` and related promotion registry/tests. Remove only bootstrap/promotion machinery proven obsolete. Do not preserve redundant serial mechanisms merely because they were needed during Phase-D bring-up.

## Required negative proofs

Before completion, prove at minimum:

1. unrelated README/docs `main` advance -> semantic evidence remains reusable and heavy browser executions = 0;
2. authority file change -> dependent evidence invalidated;
3. Playwright/environment change -> environment-dependent evidence invalidated but unrelated product/candidate identity preserved;
4. product digest change -> only dependent product/browser evidence invalidated;
5. candidate head change -> candidate-bound evidence invalidated;
6. one dependency-intersecting base advance -> `PARTIAL_RERUN` with exact affected evidence IDs;
7. merge conflict -> `REINTEGRATE`;
8. stale/revoked evidence -> reuse rejected;
9. missing/unexpected/duplicate stable IDs in reused evidence -> fan-in rejected;
10. repeated identical deterministic failure with unchanged semantic input -> circuit breaker prevents looping;
11. third serial closeout environment/control-plane defect after the already observed sequence -> architecture stabilization path, not another micro-bootstrap PR.

## Parallel execution policy

Before execution, estimate effort and identify independent work that benefits from parallel agents.

Reasonable parallel read/review lanes include:

- verification authority/semantic identity review;
- environment qualification review;
- base-advance compatibility/circuit-breaker negative-test review;
- obsolete promotion-workflow inventory.

Do not over-parallelize.

One integration owner must control protected controller/executor/fan-in/planner changes. Do not assign concurrent writers to the same protected files or critical workflow path.

## TDD and debugging

Use systematic root-cause analysis for every failure. Do not guess fixes.

For every new behavior:

1. write a failing deterministic contract/test;
2. verify the intended RED reason;
3. implement the minimum coherent change;
4. rerun focused tests;
5. rerun complete applicable deterministic verification;
6. inspect the full diff before integration.

Do not weaken an oracle, assertion, timeout, provenance rule or retry policy to make the architecture pass.

## Current #179 closeout interaction

Do not blindly discard or restart #268/#213 work.

Refresh live state and choose the safest shortest sequence. If #268/#213 can proceed without invalidating the architecture implementation, preserve their work. If this hardening must land before further expensive Phase-D qualification to stop the loop, integrate it coherently as one stabilization change rather than another micro-bootstrap series.

Do not let unrelated `main` changes repeatedly force fresh candidate SHAs merely to maintain perceived freshness. Use the new compatibility model once implemented; until then, minimize candidate mutation and preserve already-proven evidence where current policy safely permits.

## Phase E/F requirement

This task is not complete if the new identity model only solves Phase D.

Ensure Phase E benchmark repetitions bind semantic experiment identities so unrelated `main` advances do not discard valid repeated measurements.

Ensure Phase F shadow/selective execution uses the same protected evidence identity rules and cannot reuse evidence to bypass newly required stable IDs, specialist obligations, `force-full` or `SELECTOR_ESCAPE` widening.

## Verification before completion

At minimum, on the exact final implementation head:

- `node --test tests/verification/*.test.mjs` passes;
- `git diff --check` equivalent passes;
- all new negative proofs pass;
- exact protected controller -> hosted executor -> fan-in path passes where applicable;
- `atlas-gate` is GREEN;
- `provenance-gate` is GREEN;
- applicable CodeQL/security checks are GREEN;
- exact current head is still current before merge;
- no unresolved review threads remain;
- complete changed-file/diff audit finds no weakened trust boundary;
- any removed promotion/bootstrap workflow is proven superseded;
- current branch protection/administrative facts required by #179 are rechecked from an authorized source.

Use verification-before-completion discipline. Never claim completion from local reasoning or historical runs.

## Definition of done

This hardening task is DONE only when:

1. semantic evidence identity is decoupled from unrelated whole-`main` movement;
2. genuine candidate/authority/environment/product/test-set/policy changes still invalidate the correct evidence;
3. base advance compatibility directs reuse/partial/full/reintegration deterministically;
4. protected environment assumptions are prequalified before expensive browser work;
5. failure ownership prevents candidate churn for non-candidate defects;
6. executable circuit breakers prevent repeat/bootstrap loops;
7. safe digest-bound evidence reuse is independently validated at fan-in;
8. obsolete serial bootstrap machinery is removed where safely superseded;
9. Phase E/F contracts use the model safely;
10. exact-head protected tests/checks prove the final implementation.

Do not close Issue #179 merely because this hardening is complete. #179 closes only when its remaining current Phase D/E/F/administrative/full-safety acceptance criteria are terminally satisfied.

## Final report

Report FACT / INFERENCE / UNKNOWN separately and include:

- starting protected `main` SHA;
- implementation branch and exact final head SHA;
- PR number and merged SHA if merged;
- authority/environment/semantic identity schemas and final digests used in proof;
- base-advance REUSE/PARTIAL/FULL/REINTEGRATE negative-proof results;
- circuit-breaker proof results;
- complete deterministic test counts;
- authoritative workflow run IDs;
- required gate status;
- promotion/bootstrap workflows retained versus removed and why;
- interaction with #268/#213 and remaining #179 work;
- any blocker that could not be resolved without weakening safety.

Do not invent success, run IDs, checks, SHAs or completion state.
