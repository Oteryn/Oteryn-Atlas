# Atlas E2E Verification Anti-Loop Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace monolithic protected-base invalidation with semantic verification identities, compatibility-directed reruns, environment qualification and executable anti-loop bounds while preserving all current safety gates.

**Architecture:** Introduce canonical authority/environment identities and split forensic run identity from semantic evidence identity. Add a protected base-advance compatibility classifier, failure ownership/circuit breaker, then evolve fan-in toward dependency-bound reusable evidence manifests. Current candidate-head fencing, exact stable-ID equality, product identity, retries=0 and fail-closed protected lower-bound behavior remain invariants.

**Tech Stack:** Node.js ESM, `node:test`, GitHub Actions YAML, existing protected verification planner/executor/fan-in, canonical JSON/SHA-256 repository helpers.

**Spec:** `docs/superpowers/specs/2026-08-30-atlas-e2e-verification-anti-loop-hardening-design.md`

## Global Constraints

- GitHub live state is source of truth before every mutation; do not trust SHAs in this plan without refreshing them.
- Do not restart completed #179 work or create a parallel replacement verification framework.
- Candidate head movement remains strictly fenced before expensive work and evidence acceptance.
- Candidate code may widen but may never narrow protected verification authority.
- Preserve `atlas-gate`, `provenance-gate`, retries=0, exact stable-ID equality and immutable product identity.
- Ordinary deterministic/browser E2E remains GitHub-hosted; Molehill remains specialist-only; Synology remains deployment-only.
- `profile=full` must not imply `dataCapability=real_fullworld`.
- No empty/no-op commits for CI retriggering.
- If another serial environment/control-plane micro-bootstrap would be required during implementation, stop and consolidate the defect into this stabilization architecture rather than creating another one-off promotion chain.

---

### Task 1: Canonical verification authority identity

**Files:**
- Create: `tools/verification/verification-authority.mjs`
- Create: `tools/verification/verification-authority-manifest.json`
- Create: `tests/verification/verification-authority.test.mjs`
- Modify: `tools/verification/protected-hosted-plan.mjs`
- Modify: `tests/verification/protected-hosted-plan.test.mjs` or the current exact plan contract test that owns schema-v2 plan identity

**Interfaces:**
- Produces: `buildVerificationAuthorityIdentity({ readFile, manifest }) -> { schemaVersion, components, digest }`
- Produces protected plan fields: `authorityDigest`, `authorityManifestDigest`, while keeping protected source SHA as provenance metadata.
- Consumes existing `canonicalJson()` SHA-256 convention.

- [ ] **Step 1: Write failing authority identity tests**

Add tests with repository-owned fixtures proving:

```js
test('unrelated repository bytes do not alter authority digest', () => {
  const before = buildIdentity(fixtureFiles());
  const afterFiles = fixtureFiles();
  afterFiles.set('README.md', '# unrelated change\n');
  const after = buildIdentity(afterFiles);
  assert.equal(after.digest, before.digest);
});

test('protected stable-id bytes alter authority digest', () => {
  const before = buildIdentity(fixtureFiles());
  const files = fixtureFiles();
  files.set('tools/verification/stable-id.mjs', `${files.get('tools/verification/stable-id.mjs')}\n// changed`);
  assert.notEqual(buildIdentity(files).digest, before.digest);
});

test('protected executor bytes alter authority digest', () => {
  const before = buildIdentity(fixtureFiles());
  const files = fixtureFiles();
  files.set('.github/workflows/protected-hosted-executor.yml', `${files.get('.github/workflows/protected-hosted-executor.yml')}\n# changed`);
  assert.notEqual(buildIdentity(files).digest, before.digest);
});
```

Also prove duplicate paths, missing required files, unknown schema versions and non-canonical manifests fail closed.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node --test tests/verification/verification-authority.test.mjs
```

Expected: FAIL because authority builder/manifest do not exist.

- [ ] **Step 3: Implement manifest and canonical digest builder**

Manifest must enumerate roles and paths for controller, executor, fan-in, planner/schema/catalog/stable-ID/census/execution-contract/sandbox policy. The builder must hash content bytes for exactly the declared authority closure and canonicalize path/role/digest tuples before the final SHA-256.

It must reject:

```text
missing declared path
repeated path
unsupported schemaVersion
empty authority closure
malformed component role/path
```

Do not hash the whole repository commit SHA into `authorityDigest`.

- [ ] **Step 4: Bind authority digest into protected plan**

Extend the protected plan schema so `controller.sourceSha` remains forensic provenance, while semantic plan identity includes `authorityDigest` and `authorityManifestDigest`.

- [ ] **Step 5: Run focused and complete deterministic verification**

Run:

```bash
node --test tests/verification/verification-authority.test.mjs
node --test tests/verification/protected-hosted-plan*.test.mjs
node --test tests/verification/*.test.mjs
```

Expected: all PASS, zero skip/fail.

- [ ] **Step 6: Commit**

```bash
git add tools/verification/verification-authority.mjs tools/verification/verification-authority-manifest.json tests/verification/verification-authority.test.mjs tools/verification/protected-hosted-plan.mjs tests/verification
git commit -m "feat(verification): derive protected authority identity"
```

---

### Task 2: Canonical execution environment identity and one-shot qualification

**Files:**
- Create: `tools/verification/protected-execution-environment.mjs`
- Create: `tools/verification/protected-execution-environment.json`
- Create: `tests/verification/protected-execution-environment.test.mjs`
- Modify: `.github/workflows/protected-hosted-executor.yml`
- Modify: `.github/workflows/protected-execution-promotion-qualification.yml` only if it remains necessary after consolidation
- Modify: protected executor workflow contract tests

**Interfaces:**
- Produces: `buildProtectedExecutionEnvironmentIdentity(config) -> { schemaVersion, environmentDigest, ... }`
- Produces reusable `environment-qualification.json` evidence bound to the exact `environmentDigest`.

- [ ] **Step 1: Write failing environment identity tests**

Cover image digest, Python shim/cache, dependency mount phase, UID/GID, network/read-only policy, resource limits and browser/runtime assumptions.

```js
test('image digest change invalidates environment only', () => {
  const a = buildEnvironment(baseEnvironment());
  const b = buildEnvironment({ ...baseEnvironment(), playwrightImage: 'example@sha256:' + '2'.repeat(64) });
  assert.notEqual(a.environmentDigest, b.environmentDigest);
});
```

Also prove reordering equivalent configuration does not change the canonical digest.

- [ ] **Step 2: Run RED test**

```bash
node --test tests/verification/protected-execution-environment.test.mjs
```

Expected: FAIL because builder/config do not exist.

- [ ] **Step 3: Implement environment identity**

The config must explicitly include the exact current protected assumptions, including the `/tmp/atlas-python-bin/python -> /usr/bin/python3` compatibility and `PYTHONPYCACHEPREFIX=/tmp/atlas-python-pycache` contract introduced by #271.

- [ ] **Step 4: Add one-shot environment qualification before candidate browser work**

The workflow must prove in one bounded job/step set:

```text
pinned image identity
node/npm/playwright/chromium availability
python3 and python compatibility
writable /tmp + pycache
protected dependency link/mount
candidate source remains read-only
network none where required
loopback/socket self-test used by deterministic tests
UID/GID and artifact path writes
resource limits
```

Emit an exact environment evidence manifest. Hosted browser jobs depend on successful matching environment evidence.

- [ ] **Step 5: Add workflow negative contracts**

Tests must reject removal of Python compatibility, writable pycache, read-only source, network isolation, pinned image digest or protected dependency mounting.

- [ ] **Step 6: Run deterministic suite**

```bash
node --test tests/verification/protected-execution-environment.test.mjs
node --test tests/verification/*execution*.test.mjs
node --test tests/verification/*.test.mjs
```

- [ ] **Step 7: Commit**

```bash
git add tools/verification/protected-execution-environment* tests/verification .github/workflows/protected-hosted-executor.yml .github/workflows/protected-execution-promotion-qualification.yml
git commit -m "feat(verification): qualify protected execution environment once"
```

---

### Task 3: Split forensic plan identity from semantic evidence identity

**Files:**
- Modify: `tools/verification/protected-hosted-plan.mjs`
- Modify: `tools/verification/build-verification-plan.mjs`
- Modify: plan schema/validation tests under `tests/verification/`
- Modify: `tools/verification/protected-hosted-execution.mjs`

**Interfaces:**
- Produces: `planInstanceDigest`
- Produces: `planSemanticDigest`
- Keeps compatibility read of legacy `planDigest` only if needed during a bounded migration; do not retain ambiguous dual authority permanently.

- [ ] **Step 1: Write RED tests for identity invariants**

```js
test('unrelated protected base advance changes instance identity but not semantic identity', () => {
  const first = buildPlan({ protectedBaseSha: SHA_A, authorityDigest: AUTH, ...inputs });
  const second = buildPlan({ protectedBaseSha: SHA_B, authorityDigest: AUTH, ...inputs });
  assert.notEqual(first.planInstanceDigest, second.planInstanceDigest);
  assert.equal(first.planSemanticDigest, second.planSemanticDigest);
});

test('authority change alters semantic identity', () => {
  const first = buildPlan({ authorityDigest: AUTH_A, ...inputs });
  const second = buildPlan({ authorityDigest: AUTH_B, ...inputs });
  assert.notEqual(first.planSemanticDigest, second.planSemanticDigest);
});
```

Also cover candidate, environment, product, test-set and execution-policy changes.

- [ ] **Step 2: Verify tests fail against current monolithic digest**

Run the exact focused plan tests; expected RED is semantic identity absence/coupling to protected base SHA.

- [ ] **Step 3: Implement digest split**

`planInstanceDigest` includes provenance/base/run-instance facts. `planSemanticDigest` excludes unrelated protected base SHA but includes candidate/change-set, authority, environment, product, exact stable-ID and execution policy identities.

- [ ] **Step 4: Update execution-contract validation**

Execution contract must bind the semantic digest and separately retain controller source/base provenance. Do not allow a semantic digest supplied by candidate code.

- [ ] **Step 5: Run complete deterministic suite**

```bash
node --test tests/verification/*.test.mjs
```

- [ ] **Step 6: Commit**

```bash
git add tools/verification tests/verification
git commit -m "feat(verification): split semantic and instance plan identity"
```

---

### Task 4: Protected Base Advance Compatibility Gate

**Files:**
- Create: `tools/verification/base-advance-compatibility.mjs`
- Create: `tests/verification/base-advance-compatibility.test.mjs`
- Modify: `tools/verification/impact-manifest.json` and/or catalog only if explicit dependency closure needs additional truthful metadata
- Modify: protected controller/executor workflow to invoke the compatibility decision at the correct boundary

**Interfaces:**
- Produces:

```js
classifyBaseAdvance(input) -> {
  schemaVersion: 1,
  disposition: 'REUSE' | 'PARTIAL_RERUN' | 'FULL_RERUN' | 'REINTEGRATE',
  affectedEvidenceIds: string[],
  reasons: string[],
  oldBaseSha: string,
  newBaseSha: string,
  compatibilityDigest: string
}
```

- [ ] **Step 1: Write RED disposition tests**

Required cases:

```text
README-only advance -> REUSE
unrelated path outside candidate/dependency/authority closure -> REUSE
one selected dependency changed -> PARTIAL_RERUN with exact evidence IDs
authority file changed -> FULL_RERUN for authority-dependent evidence
stable-ID algorithm changed -> FULL_RERUN
merge conflict -> REINTEGRATE
candidate-required source changed and must be incorporated -> REINTEGRATE
```

- [ ] **Step 2: Run RED test**

```bash
node --test tests/verification/base-advance-compatibility.test.mjs
```

- [ ] **Step 3: Implement protected classifier**

The classifier uses protected manifests/catalog dependency closure. It must never ask candidate code whether a base change matters.

- [ ] **Step 4: Wire base-advance flow**

When `main` advances, coordinator/workflow logic must evaluate compatibility rather than automatically modifying the candidate. `REUSE` performs zero heavy reruns. `PARTIAL_RERUN` schedules only returned evidence nodes. `REINTEGRATE` is the only normal disposition that requires changing the candidate because of base movement.

- [ ] **Step 5: Add a regression proving main movement does not reset lifecycle**

The test must assert that a qualified state plus unrelated base advance transitions to `BASE_COMPATIBILITY`/`REUSE`, not `DISCOVERED` or full browser execution.

- [ ] **Step 6: Run deterministic suite and commit**

```bash
node --test tests/verification/*.test.mjs
git add tools/verification tests/verification .github/workflows
git commit -m "feat(verification): classify protected base advances"
```

---

### Task 5: Failure ownership and executable anti-loop circuit breaker

**Files:**
- Create: `tools/verification/verification-failure-classification.mjs`
- Create: `tools/verification/verification-progress-state.mjs`
- Create: `tests/verification/verification-failure-classification.test.mjs`
- Create: `tests/verification/verification-progress-state.test.mjs`
- Modify: protected workflow evidence/fan-in emitters as required
- Modify: root `AGENTS.md` only if the executable behavior needs a matching human/agent policy statement

**Interfaces:**
- Failure class enum:

```text
CANDIDATE_FAILURE
AUTHORITY_FAILURE
ENVIRONMENT_FAILURE
PRODUCT_FAILURE
EXTERNAL_FAILURE
STALE_CANDIDATE
INTEGRATION_INCOMPATIBILITY
```

- State enum includes:

```text
DISCOVERED
AUTHORITY_PREFLIGHT
ENVIRONMENT_QUALIFIED
PLANNED
EXECUTING
FANIN
QUALIFIED
BASE_COMPATIBILITY
MERGE_READY
DONE
BLOCKED_CANDIDATE
BLOCKED_AUTHORITY
BLOCKED_ENVIRONMENT
BLOCKED_PRODUCT
BLOCKED_EXTERNAL
STALLED
ARCHITECTURE_STABILIZATION_REQUIRED
```

- [ ] **Step 1: Write RED failure classification tests**

Map representative evidence to exact owner classes, including the #270 read-only dependency defect and #271 Python/pycache defect as environment/control-plane examples.

- [ ] **Step 2: Write RED circuit breaker tests**

```js
test('unchanged semantic inputs cannot be repeatedly retriggered after identical deterministic failure', () => {
  const state = advanceProgress(historyWithTwoIdenticalFailures());
  assert.equal(state.status, 'STALLED');
});

test('third serial closeout environment/control-plane defect requires architecture stabilization', () => {
  const state = advanceProgress(historyWithTwoBootstrapDefectsAndNewEnvironmentDefect());
  assert.equal(state.status, 'ARCHITECTURE_STABILIZATION_REQUIRED');
});
```

- [ ] **Step 3: Implement failure classifier and progress state machine**

A normal unrelated base advance from `QUALIFIED` must transition to `BASE_COMPATIBILITY`, not `DISCOVERED`.

- [ ] **Step 4: Wire machine-readable failure class into evidence**

Failed authoritative nodes must emit one primary failure class plus bounded detail. Coordinator logic must not mutate candidate for `AUTHORITY_FAILURE` or `ENVIRONMENT_FAILURE`.

- [ ] **Step 5: Enforce no-op/retrigger prohibition in contracts**

Add deterministic contracts proving the system does not recommend/create a new attempt when semantic inputs and deterministic failure signature are unchanged unless explicitly classified external/transient by allowed policy.

- [ ] **Step 6: Run suite and commit**

```bash
node --test tests/verification/verification-failure-classification.test.mjs tests/verification/verification-progress-state.test.mjs
node --test tests/verification/*.test.mjs
git add tools/verification tests/verification .github/workflows AGENTS.md
git commit -m "feat(verification): bound closeout retry and bootstrap loops"
```

---

### Task 6: Dependency-bound evidence manifests and safe reuse

**Files:**
- Create: `tools/verification/evidence-manifest.mjs`
- Create: `tools/verification/evidence-reuse.mjs`
- Create: `tests/verification/evidence-manifest.test.mjs`
- Create: `tests/verification/evidence-reuse.test.mjs`
- Modify: `tools/verification/protected-hosted-execution.mjs`
- Modify: protected hosted executor and fan-in workflow/contracts

**Interfaces:**
- Produces versioned evidence manifests with exact dependency digests.
- Produces `resolveReusableEvidence(expected, candidateEvidence) -> { reusable, reason }`.

- [ ] **Step 1: Write RED evidence schema tests**

Require evidence type/version, semantic digest, authority/environment/product/test-set/execution-policy identities as applicable, result, run provenance and dependency evidence digests.

- [ ] **Step 2: Write RED reuse tests**

Required decisions:

```text
all expected digests equal + successful manifest -> reusable
candidate digest mismatch -> reject
authority digest mismatch -> reject
environment mismatch -> reject when evidence depends on environment
product mismatch -> reject only dependent node
stable-ID/test-set mismatch -> reject
expired/unavailable/revoked evidence -> reject
unexpected/missing stable IDs -> reject at fan-in
```

- [ ] **Step 3: Implement schema and reuse resolver**

Reuse must never rely only on GitHub check state. It must validate manifest bytes and exact expected identity.

- [ ] **Step 4: Integrate initial evidence nodes**

Start with `ENVIRONMENT_QUALIFICATION`, product qualification and hosted functional partition evidence. Avoid a large migration of specialist/benchmark/shadow evidence until the base model is proven.

- [ ] **Step 5: Fan-in validation**

Fan-in accepts `EXECUTED` and `REUSED` evidence only through the same schema/digest validator and still proves exact stable-ID union equality with no missing/unexpected/duplicate IDs.

- [ ] **Step 6: Run deterministic suite and commit**

```bash
node --test tests/verification/evidence-*.test.mjs
node --test tests/verification/*.test.mjs
git add tools/verification tests/verification .github/workflows
git commit -m "feat(verification): reuse dependency-bound evidence safely"
```

---

### Task 7: Consolidate obsolete promotion/bootstrap machinery

**Files:**
- Audit: `.github/workflows/protected-*-promotion*.yml`
- Audit: `tools/verification/protected-hosted-execution.mjs` promotion registry
- Audit: corresponding `tests/verification/*promotion*.test.mjs`
- Modify/delete only workflows proven superseded by the new authority/environment/evidence architecture

**Interfaces:**
- No new public interface; goal is removal of redundant serial machinery after its replacement is protected and proven.

- [ ] **Step 1: Inventory every protected promotion workflow**

For each file record:

```text
continuing responsibility
replacement evidence node/workflow
remaining caller
safe-to-delete yes/no
```

- [ ] **Step 2: Add tests that require the new consolidated path before deletion**

Do not delete a promotion path until the deterministic contract proves its required safety property is owned elsewhere.

- [ ] **Step 3: Remove only proven-obsolete promotion/bootstrap paths**

Do not remove branch-protection required checks, provenance or specialist lanes.

- [ ] **Step 4: Run repository verification**

```bash
node --test tests/verification/*.test.mjs
git diff --check
```

- [ ] **Step 5: Commit**

```bash
git add -A .github/workflows tools/verification tests/verification
git commit -m "refactor(verification): remove superseded bootstrap machinery"
```

---

### Task 8: Phase E/F integration contracts and terminal verification

**Files:**
- Modify: Phase E benchmark harness contracts/docs as actually present after final Phase D
- Modify: Phase F shadow/backtest/selective contracts as actually present after Phase E
- Add deterministic regression tests ensuring semantic identity reuse cannot hide new selector obligations
- Update: `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-FINAL-CLOSEOUT-STATE-2026-08-30.md` or successor live closeout record only after implementation state is verified

**Interfaces:**
- Phase E repetition identity consumes semantic experiment inputs, not monolithic current-main SHA.
- Phase F consumes protected evidence identity but may never reuse evidence to bypass newly required stable IDs or specialist obligations.

- [ ] **Step 1: Bind Phase E measurements to semantic experiment identity**

Three clean repetitions remain valid across unrelated main advances when harness/authority/environment/product/policy/workload identities are unchanged.

- [ ] **Step 2: Bind Phase F shadow/full-safety comparison to exact current planner/catalog/census identities**

Any changed selector requirement invalidates dependent shadow evidence. `force-full` and `SELECTOR_ESCAPE` remain widening-only.

- [ ] **Step 3: Add current-main movement regression**

Create a deterministic scenario equivalent to:

```text
candidate H1 fully qualified
main M1 -> M2 changes unrelated docs
compatibility = REUSE
heavy executions = 0
candidate H1 unchanged
```

and a contrasting authority-change scenario that invalidates dependent evidence.

- [ ] **Step 4: Run complete exact-head deterministic verification**

```bash
node --test tests/verification/*.test.mjs
git diff --check
```

Expected: all PASS, zero fail/skip unless a pre-existing explicitly allowed skip is documented by current repository policy.

- [ ] **Step 5: Run the authoritative protected GitHub-hosted path on the exact implementation head**

Require current-head controller -> executor -> fan-in evidence, `atlas-gate`, `provenance-gate`, applicable CodeQL/security, retries=0 and no stale evidence reuse.

- [ ] **Step 6: Perform negative proof**

Demonstrate at least one controlled stale/mismatched reusable evidence manifest is rejected and one unrelated-base-advance case reuses valid evidence without browser execution.

- [ ] **Step 7: Final review and merge**

Review full diff, unresolved threads, current branch protection and exact live GitHub state. Squash merge only when all current required checks are green and the expected head has not moved.

- [ ] **Step 8: Post-merge verification**

Verify merged `main` identity and rerun only the post-merge checks required by current repository policy. Record the final architecture/evidence results on Issue #179. Do not close #179 unless remaining Phase D/E/F/administrative/full-safety acceptance criteria are actually complete.

---

## Parallelization guidance

Use parallel subagents only for independent read/review/test work. Recommended parallel lanes after Task 1 interfaces are fixed:

- authority + semantic identity review;
- environment qualification review;
- compatibility/circuit-breaker negative-test review;
- promotion-workflow inventory.

Do not allow parallel writers to the same protected controller/executor/fan-in/planner files. One integration owner must reconcile and qualify the final protected path.

## Terminal anti-loop rule for the implementing agent

Do not respond to a newly discovered protected environment/control-plane defect by automatically creating another narrow bootstrap PR. After the already observed serial #270/#271 defects, any further defect of the same class is evidence that the coherent stabilization in this plan must be completed. Preserve the candidate head whenever the failure owner is not the candidate.
