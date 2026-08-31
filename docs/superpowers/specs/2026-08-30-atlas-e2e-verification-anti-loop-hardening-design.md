# Atlas E2E Verification Anti-Loop Hardening Design

**Lifecycle:** Oteryn/Oteryn-Atlas#179
**Scope:** systemic elimination of verification closeout/requalification loops without weakening protected verification, provenance, exact candidate identity, retries=0, data-capability separation, or fail-closed behavior.

## Problem statement

The current closeout path can enter a costly serialization loop:

`candidate repair -> protected workflow defect -> bootstrap PR -> merge to main -> candidate reintegration -> exact-head qualification -> next environment defect -> another bootstrap PR`.

Observed Phase-D sequence included #266, #270, #271, #268 and only then #213. The policy that normal upstream movement must not restart completed work is not fully represented in the verification implementation.

The root architectural issue is identity coupling. The protected controller binds `ATLAS_PROTECTED_BASE_SHA` to the PR base SHA. `buildProtectedHostedPlan()` then embeds the protected base SHA as `controller.sourceSha`, `protectedBaseSha`, `integrationBaseSha`, and ultimately inside `planDigest`. Consequently an unrelated `main` advance changes the identity of the complete protected plan even when the bytes that define verification authority, environment, products and required tests are unchanged.

The second issue is environment discovery occurring too late. Read-only dependency placement, Python command availability and writable bytecode cache requirements were discovered serially while exercising the expensive functional qualification path. Environment-contract defects must be discovered by one bounded environment qualification before candidate browser execution.

## Goals

1. Preserve exact candidate-head fencing and fail closed on a genuinely superseded PR head.
2. Stop treating an unrelated `main` SHA change as automatic invalidation of all prior evidence.
3. Separate forensic run identity from semantic evidence identity.
4. Reuse valid evidence only when all semantically relevant inputs are identical.
5. Requalify only the evidence nodes affected by an actual changed dependency.
6. Add a bounded base-advance compatibility check before forcing candidate reintegration or heavy reruns.
7. Qualify the protected execution environment as a versioned input before expensive browser work.
8. Classify failures by ownership so environment/control-plane defects do not mutate the candidate unnecessarily.
9. Add a circuit breaker that prevents an unbounded chain of micro-bootstrap PRs or unchanged reruns.
10. Make the model usable by Phase E benchmarking and Phase F selective execution without allowing stale evidence to authorize unsafe skipping.

## Non-goals

- Do not weaken `atlas-gate`, `provenance-gate`, branch protection or protected-base control-plane ownership.
- Do not permit reuse merely because a GitHub status is green; reusable evidence must be digest-bound and revalidated.
- Do not allow candidate code to define or narrow the protected lower bound.
- Do not move ordinary functional E2E back to Molehill or Synology.
- Do not change retries from zero.
- Do not make `real_fullworld` the default data capability for ordinary functional tests.

## Core model: Verification Capsule + Evidence DAG

Every authoritative verification run must distinguish the following identities.

### Candidate identity

`candidateDigest`

Binds the exact PR head tree/commit being evaluated. A change to the PR head invalidates candidate-bound evidence. Current-head fencing remains mandatory before expensive execution and before evidence acceptance.

### Change-set identity

`changeSetDigest`

Binds canonical changed paths/renames and the semantic diff inputs used for protected planning. It is distinct from the current base SHA so a base advance can be assessed rather than blindly treated as complete invalidation.

### Verification authority identity

`authorityDigest`

Binds only the protected bytes and immutable configuration that can change planning, execution placement or evidence acceptance. At minimum it must cover:

- protected verification controller;
- protected hosted executor;
- protected fan-in/acceptance implementation;
- planner and plan schema;
- verification catalog and impact manifest used as protected lower bound;
- stable-ID implementation and census parser;
- protected execution-contract builder;
- relevant pinned GitHub Actions;
- sandbox policy definition;
- any file whose change can alter authoritative selection, placement, execution or acceptance.

The current entire protected `main` commit SHA remains recorded as provenance but must not itself be the semantic authority key.

### Environment identity

`environmentDigest`

Binds the deterministic execution environment, including:

- pinned Playwright image digest;
- browser version/image;
- Node/npm execution assumptions;
- Python command mapping when required;
- writable tmp/bytecode paths;
- UID/GID;
- read-only/source mount policy;
- network policy;
- resource limits;
- dependency materialization strategy;
- runtime tools used by deterministic/browser tests.

### Product identity

`productIdentitiesDigest`

Continue binding exact immutable products separately by data capability: `qualification_fixture`, `bounded_real_world`, `real_fullworld`.

### Test-set identity

`testSetDigest`

Binds the exact expected stable-ID set for the evidence node. Exact equality remains required at fan-in.

### Execution-policy identity

`executionPolicyDigest`

Binds retries, workers, shards, placement and other execution policy that can affect the proof contract.

## Forensic identity versus semantic identity

Replace the current single-role `planDigest` semantics with two concepts.

### `planInstanceDigest`

For audit/provenance. It may include:

- protected base SHA;
- candidate SHA;
- merge-base SHA;
- workflow/run identity;
- all semantic digests;
- current repository state metadata.

It uniquely identifies the exact run instance and is never reused as proof equivalence.

### `planSemanticDigest`

For evidence validity/reuse. It contains only inputs whose byte/contract changes can alter the meaning of the evidence:

- candidate/change-set identity;
- authority digest;
- environment digest;
- selected product identities;
- exact test-set digest;
- execution-policy digest;
- other explicit dependency digests required by the selected evidence node.

An unrelated `main` movement with unchanged semantic inputs must leave this digest unchanged.

## Evidence DAG

Evidence must be represented as dependency-bound nodes instead of one all-or-nothing run.

Recommended node classes:

- `AUTHORITY_PREFLIGHT`
- `ENVIRONMENT_QUALIFICATION`
- `PRODUCT_QUALIFICATION:<dataCapability>`
- `CANDIDATE_CENSUS`
- `HOSTED_FUNCTIONAL:<partition>`
- `SPECIALIST:<capability>`
- `FANIN`
- `BASE_ADVANCE_COMPATIBILITY`
- `INTEGRATION_ACCEPTANCE`

Each evidence manifest must state:

- evidence type/version;
- candidate digest where applicable;
- authority digest;
- environment digest where applicable;
- product digests where applicable;
- exact stable-ID/test-set digest where applicable;
- execution-policy digest where applicable;
- result;
- generated run identity;
- dependency evidence digests;
- reusable/non-reusable classification.

Fan-in may accept newly executed or reusable evidence only after independently validating every declared digest and dependency.

## Base Advance Compatibility Gate

A protected `main` advance must not automatically move a qualified candidate back to discovery.

When base moves from `B1` to `B2`, evaluate a bounded protected compatibility contract using:

- canonical `B1..B2` changed paths/renames;
- candidate changed paths;
- dependency closure from protected impact/catalog policy;
- authority manifest changes;
- environment/product identity changes;
- stable-ID/census-affecting changes;
- merge-tree/conflict result;
- optional exact synthetic merge checks where necessary.

The gate returns exactly one disposition:

### `REUSE`

The base advance does not intersect any semantic dependency of previously accepted evidence. Candidate SHA remains untouched and heavy evidence is reused.

### `PARTIAL_RERUN`

Only identified evidence nodes are invalidated. The gate must return their exact IDs/reasons. Unaffected nodes remain reusable.

### `FULL_RERUN`

A protected authority, candidate-relevant dependency, test-set identity, product/environment requirement or equivalent correctness-critical input changed such that complete affected qualification is required.

### `REINTEGRATE`

The candidate must actually change because the new base creates a conflict or a semantic dependency requires incorporation. Only this disposition authorizes changing the candidate solely due to base movement.

A `main` advance therefore transitions a qualified candidate to compatibility assessment, never back to initial discovery by default.

## Protected Verification Authority Manifest

Introduce a machine-readable authority manifest, for example:

`tools/verification/verification-authority-manifest.json`

The manifest enumerates protected authority files/components and their role. The controller derives the digest from canonical content hashes, not from the whole `main` SHA.

Requirements:

- complete enough that changing any byte capable of altering protected planning/execution/acceptance changes `authorityDigest`;
- deterministic ordering/canonical JSON;
- protected tests proving listed authority changes alter the digest;
- negative tests proving unrelated repository changes do not alter it;
- fail closed if an authority-owned path changes but is not represented by the manifest/closure.

## Protected Execution Environment Qualification

Add one environment qualification keyed by `environmentDigest` before expensive candidate browser work.

It must prove in one run all environment assumptions required by deterministic and hosted browser execution, including at minimum:

- pinned container/image identity;
- Node and npm availability;
- Playwright CLI and Chromium availability;
- Python 3 and required `python` compatibility mapping;
- writable `/tmp` and configured Python bytecode cache;
- protected dependency mount/link strategy;
- read-only candidate/source tree;
- no candidate-supplied `node_modules` authority;
- network disabled where required;
- allowed loopback/socket behavior used by tests;
- UID/GID and file permissions;
- artifact/readiness paths;
- memory/CPU/pid limits;
- required shared runtime libraries/tools.

Candidate browser execution must not start if this environment evidence is absent or invalid for the exact environment digest.

Environment evidence is reusable across candidates only when its complete digest is identical.

## Failure ownership classification

Every authoritative failed evidence node must emit exactly one primary failure class:

- `CANDIDATE_FAILURE`
- `AUTHORITY_FAILURE`
- `ENVIRONMENT_FAILURE`
- `PRODUCT_FAILURE`
- `EXTERNAL_FAILURE`
- `STALE_CANDIDATE`
- `INTEGRATION_INCOMPATIBILITY`

Coordinator behavior is determined by class.

Examples:

- missing Python command in pinned protected image: `ENVIRONMENT_FAILURE`;
- protected planner defect: `AUTHORITY_FAILURE`;
- assertion failure in candidate runtime behavior: `CANDIDATE_FAILURE`;
- PR head moved during execution: `STALE_CANDIDATE`;
- merge conflict after base advance: `INTEGRATION_INCOMPATIBILITY`.

Environment/authority failures must not automatically mutate the candidate branch.

## Anti-loop circuit breaker

The coordinator and executable contracts must enforce bounded progress.

### Bootstrap cascade breaker

For the same lifecycle/candidate goal, after two serial protected environment/control-plane defects are discovered during closeout, a further micro-bootstrap PR is forbidden. Enter `ARCHITECTURE_STABILIZATION_REQUIRED` and implement one coherent environment/control-plane stabilization change.

### Unchanged-input rerun breaker

If all semantic input digests are unchanged, an identical deterministic failure may not be repeatedly retriggered by no-op commit or workflow churn. The next action must be diagnosis, explicit transient classification, or `STALLED`.

### Transient retry bound

Automatic retry is permitted only for evidence explicitly classified as transient/external and only within repository policy. Deterministic candidate/browser acceptance retains Playwright retries=0.

### No-op/retrigger prohibition

No empty/no-op commits solely to obtain another CI attempt.

## Coordinator state machine

Use explicit persisted states:

`DISCOVERED -> AUTHORITY_PREFLIGHT -> ENVIRONMENT_QUALIFIED -> PLANNED -> EXECUTING -> FANIN -> QUALIFIED -> BASE_COMPATIBILITY -> MERGE_READY -> DONE`

Failure/block states:

- `BLOCKED_CANDIDATE`
- `BLOCKED_AUTHORITY`
- `BLOCKED_ENVIRONMENT`
- `BLOCKED_PRODUCT`
- `BLOCKED_EXTERNAL`
- `STALLED`
- `ARCHITECTURE_STABILIZATION_REQUIRED`

Critical transition rule:

A normal `main` advance from a qualified state yields `BASE_COMPATIBILITY`, not `DISCOVERED`.

## Evidence reuse registry

Before scheduling expensive work, the controller must resolve whether a valid evidence manifest exists for the exact semantic evidence key.

Example conceptual key:

`sha256(candidateDigest + authorityDigest + environmentDigest + productDigest(s) + testSetDigest + executionPolicyDigest + evidenceType)`

Reuse requirements:

- artifact/evidence bytes remain available and unexpired under the chosen storage contract;
- evidence manifest validates against schema;
- all digests exactly match;
- original run result is successful;
- no revocation/escape record invalidates it;
- current candidate head fencing still succeeds for candidate-bound evidence;
- fan-in independently verifies the reused manifest.

If any requirement fails, execute rather than reuse.

## Integration policy

Do not merge/rebase latest `main` into a candidate merely because `main` moved.

Reintegration is required only when:

1. the compatibility gate returns `REINTEGRATE`;
2. a real merge conflict exists;
3. a candidate dependency changed such that incorporation is semantically required; or
4. effective branch-protection/up-to-date requirements force one final integration before merge.

If an up-to-date branch is administratively required, perform a single terminal integration as late as possible and use the compatibility result to determine the minimum evidence rerun.

## Verification authority lease during closeout

Do not freeze the whole repository. Instead serialize mutations to the protected verification authority surface.

During terminal verification closeout:

- one writer owns controller/executor/fan-in/planner/authority-manifest changes;
- unrelated feature/docs/dependency work may continue when it does not change semantic verification inputs;
- concurrent PRs touching authority-owned paths join the same authority queue;
- avoid parallel micro-bootstrap PRs changing the same protected machinery.

## Phase E and Phase F implications

Phase E benchmark observations must bind semantic experiment inputs rather than current `main` as a monolithic validity key. An unrelated base advance must not invalidate three clean repetitions if candidate/harness/authority/environment/product/policy identities are unchanged.

Phase F selective execution may reuse evidence only through the same protected digest validation. Selector savings must never use reuse semantics to bypass a newly required stable ID or changed authority/product/environment input. `force-full` and `SELECTOR_ESCAPE` remain widening-only.

## Migration strategy

### Stage 0 — freeze the loop, not the repo

During the current #179 closeout, stop creating new micro-bootstrap PRs for ordinary environment discoveries. If another protected environment defect appears, switch to one coherent stabilization change.

### Stage 1 — identity split and compatibility

Implement first:

- authority manifest/digest;
- environment manifest/digest;
- `planInstanceDigest` versus `planSemanticDigest`;
- base-advance compatibility disposition;
- regression tests proving unrelated `main` movement does not invalidate semantic evidence;
- regression tests proving authority changes do invalidate dependent evidence.

### Stage 2 — environment qualification and failure ownership

Implement the complete environment preflight and machine-readable failure class.

### Stage 3 — Evidence DAG/reuse

Introduce evidence-node manifests and protected reuse validation. Start with environment/product/candidate functional nodes before extending to benchmark/shadow evidence.

### Stage 4 — Phase E/F adoption

Bind benchmark repetitions and selective-execution proofs to semantic evidence keys and compatibility rules.

## Required regression scenarios

At minimum add deterministic contract tests for:

1. unrelated README/docs change on `main` -> `authorityDigest` unchanged;
2. unrelated runtime path outside selected dependency closure -> prior unaffected evidence reusable;
3. protected `stable-id.mjs` change -> authority digest changed and dependent evidence invalidated;
4. protected executor workflow change -> authority digest changed;
5. Playwright image digest change -> environment digest changed while candidate/product identity remains unchanged;
6. qualification product digest change -> only dependent product/browser evidence invalidated;
7. candidate head change -> candidate-bound evidence invalidated;
8. base advance with no intersection -> `REUSE` and zero heavy executions;
9. base advance intersecting one selected dependency -> `PARTIAL_RERUN` with exact affected evidence nodes;
10. merge conflict -> `REINTEGRATE`;
11. repeated identical deterministic failure with unchanged semantic inputs -> circuit breaker prevents retrigger loop;
12. two prior serial environment/control-plane closeout defects plus another -> `ARCHITECTURE_STABILIZATION_REQUIRED`;
13. stale/revoked evidence manifest -> reuse rejected;
14. reused evidence with unexpected/missing stable IDs -> fan-in rejects it;
15. branch-protection-required terminal update -> one late integration, followed by minimum compatibility-directed rerun.

## Acceptance criteria

This architecture is accepted only when live repository tests prove all of the following:

- an unrelated `main` advance does not change semantic evidence identity;
- protected authority changes invalidate all and only dependent evidence;
- environment assumptions are proven before expensive browser execution;
- candidate head movement remains strictly fenced;
- reused evidence is digest-bound and independently revalidated;
- base advance produces one of the explicit compatibility dispositions;
- unchanged-input rerun loops and micro-bootstrap cascades are bounded by executable policy;
- fan-in still proves exact stable-ID equality, exact candidate identity, retries=0 and required product identities;
- ordinary functional E2E remains GitHub-hosted and minimal-data-capability based;
- Molehill remains specialist-only and Synology remains deployment-only;
- Phase E/F can consume the semantic identity model without weakening safety.

## Current closeout safety rule

Until the new model is implemented, the current #179 coordinator must use the shortest existing Phase-D path and must not restart already-proven areas. If another environment/control-plane defect appears after the #270/#271 sequence, stop the micro-bootstrap cascade and perform the architecture stabilization described here rather than creating another serial one-off workaround.
