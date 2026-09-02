# Atlas Incremental Semantic Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse compatible Atlas verification evidence across different PR/merge-group Git SHAs and execute only evidence nodes whose semantic dependencies changed, while preserving fail-closed governance and provenance.

**Architecture:** Keep the existing protected plan, evidence-manifest, evidence-reuse and lifecycle modules as the single verification authority. Split semantic identity from execution/consumer provenance: Git SHAs remain exact provenance/fencing fields, while semantic digests are derived only from verification dependencies. Lifecycle planning compares node dependency identity and base-impact classification to choose EXECUTE versus REUSE; reused manifests point to immutable source evidence and bind the current consumer plan/run.

**Tech Stack:** Node.js ESM, `node:test`, GitHub Actions, existing Atlas protected verification schemas and lifecycle.

**Spec:** `docs/agents/prompts/OTERYN-ATLAS-INCREMENTAL-VERIFICATION-ANTI-WASTE.md` at PR #304 head `2ab0377fd5c381b8564649d6a50d41e13133f715`; implementation lifecycle #305.

## Global Constraints

- Admission protected `main`: `e31015d0880e9f81a4b96f990658490af45e8fa6`.
- `candidateHeadSha` remains exact execution/consumer provenance and stale-head acceptance fencing, but is not a semantic-validity input.
- Preserve `qualification_fixture`, `bounded_real_world`, and `real_fullworld` capability separation.
- Preserve protected-base controller authority, zero retries, exact stable-ID fan-in, evidence availability/revocation checks, and `atlas-gate` fail-closed behavior.
- No new PR-number/branch-name changed-file allowlist or bootstrap architecture.
- No Molehill/full heavy execution during the deterministic inner loop unless a concrete failing gate proves it necessary.
- TDD is mandatory: every production behavior change follows a verified failing regression first.
- #303 overlaps `protected-hosted-execution.mjs` and `protected-hosted-gate.mjs`; do not edit those files in the deterministic-core stages.

---

### Task 1: Separate protected plan semantic identity from Git provenance

**Files:**
- Modify: `tests/verification/protected-hosted-plan.test.mjs`
- Modify: `tools/verification/protected-hosted-plan.mjs`

**Interfaces:**
- Consumes: existing `buildProtectedHostedPlan(input)` schemaVersion 3 contract.
- Produces: `planSemanticDigest` stable across different `candidateHeadSha` values when all semantic inputs are equal; `planInstanceDigest` remains different because exact candidate provenance stays in the plan instance. Candidate census keeps an exact-head provenance digest and gains/uses a SHA-independent semantic census identity for `planSemanticDigest`.

- [ ] **Step 1: Write the failing semantic-identity regressions**

Add tests that build two plans with different `candidateHeadSha` values and matching candidate census head provenance, while holding changed paths, catalogs, impact policy, stable IDs, authority, environment and product identities constant. Assert:

```js
assert.equal(left.planSemanticDigest, right.planSemanticDigest);
assert.notEqual(left.planInstanceDigest, right.planInstanceDigest);
assert.notEqual(left.candidateDigest, right.candidateDigest);
```

Also assert that changing the qualification product digest still changes `planSemanticDigest`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/verification/protected-hosted-plan.test.mjs
```

Expected: the cross-SHA semantic test fails because current `semanticIdentity` includes `candidateDigest` and the candidate census digest includes `candidateHeadSha`.

- [ ] **Step 3: Implement the minimal semantic/provenance split**

In `validateCandidateCensus`, retain the existing exact-head `digest`, and add a SHA-independent `semanticDigest` over:

```js
{
  schemaVersion: 1,
  status: 'success',
  sandboxPolicyId: SANDBOX_POLICY_ID,
  censusDigest: census.digest,
}
```

In `buildProtectedHostedPlan`, keep `candidateDigest` and exact candidate-census provenance fields in the plan instance, but remove `candidateDigest` from `semanticIdentity` and use the candidate census `semanticDigest` rather than its provenance digest in semantic identity. Keep all authority/environment/catalog/policy/product/stable-ID digests semantic.

- [ ] **Step 4: Run focused verification and verify GREEN**

Run the Task 1 command again and require zero failures.

- [ ] **Step 5: Commit**

Commit message:

```text
refactor(verification): separate plan semantics from candidate sha
```

---

### Task 2: Make evidence semantic identity reusable across Git SHAs

**Files:**
- Modify: `tests/verification/evidence-manifest.test.mjs`
- Modify: `tests/verification/evidence-reuse.test.mjs`
- Modify: `tools/verification/evidence-manifest.mjs`
- Modify: `tools/verification/evidence-reuse.mjs`

**Interfaces:**
- Consumes: `buildEvidenceManifest`, `buildEvidenceSemanticDigest`, `resolveReusableEvidence`.
- Produces: evidence semantic identity based on evidence type/id, authority, environment, products, stable tests, execution policy and semantic dependencies; source `candidateHeadSha` remains immutable provenance but is not required to equal the current consumer candidate SHA for reuse.

- [ ] **Step 1: Write failing evidence identity/reuse tests**

Add a manifest test proving otherwise identical evidence with `candidateHeadSha='a'.repeat(40)` and `'b'.repeat(40)` has the same `evidenceSemanticDigest` but different `evidenceDigest`.

Change the reuse mismatch table so candidate SHA difference is no longer expected to reject. Add a dedicated regression:

```js
const source = evidence({ candidateHeadSha: 'a'.repeat(40) });
const result = resolveReusableEvidence(expected({
  candidateHeadSha: 'b'.repeat(40),
  evidenceSemanticDigest: source.evidenceSemanticDigest,
  availableEvidenceDigests: [source.evidenceDigest],
}, source), source);
assert.equal(result.reusable, true);
```

Keep authority, environment, product, policy, stable-ID, dependency, expiry, revocation and byte-availability rejection tests unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/verification/evidence-manifest.test.mjs tests/verification/evidence-reuse.test.mjs
```

Expected: cross-SHA semantic digest equality/reuse fails under the current SHA-bound implementation.

- [ ] **Step 3: Implement the minimal evidence split**

Remove `candidateHeadSha` only from the object hashed by `semanticCore`. Continue validating and storing exact `candidateHeadSha` in every manifest. Remove `CANDIDATE_HEAD_MISMATCH` as a semantic reuse rejection in `resolveReusableEvidence`; stale/current-head acceptance remains the responsibility of the protected controller/gate, not source-evidence semantic compatibility.

- [ ] **Step 4: Run focused verification and verify GREEN**

Run the Task 2 command again and require zero failures.

- [ ] **Step 5: Commit**

Commit message:

```text
refactor(verification): reuse evidence across candidate shas
```

---

### Task 3: Reuse qualified evidence after candidate/synthetic SHA changes

**Files:**
- Modify: `tests/verification/protected-verification-lifecycle.test.mjs`
- Modify: `tools/verification/protected-verification-lifecycle.mjs`

**Interfaces:**
- Consumes: `planProtectedVerificationLifecycle`, `materializeReusedEvidence`, `resolveReusableEvidence`.
- Produces: `REUSE` or `PARTIAL_RERUN` across candidate SHA changes when semantic/dependency identities remain compatible; `heavyExecutionsRequired=0` when every heavy evidence node is reusable.

- [ ] **Step 1: Write failing lifecycle regressions**

Add cases for:

```text
same semantic dependencies + new candidate SHA -> REUSE, heavyExecutionsRequired=0
same semantic dependencies + merge-group/synthetic SHA -> REUSE, heavyExecutionsRequired=0
product digest changed -> environment REUSE, hosted EXECUTE
missing source evidence -> affected node EXECUTE
```

For cross-SHA reuse, assert `decision.candidateHeadSha` is the current candidate SHA and materialized reused manifests use the current candidate SHA while `sourceEvidenceDigest` points to the immutable prior evidence.

- [ ] **Step 2: Run focused lifecycle test and verify RED**

Run:

```bash
node --test tests/verification/protected-verification-lifecycle.test.mjs
```

Expected: cross-SHA cases report `FULL_RERUN` because `canConsiderReuse` currently requires identical candidate heads and the circuit-breaker comparison is also SHA-coupled.

- [ ] **Step 3: Implement minimal lifecycle compatibility changes**

Allow reuse consideration when a qualified previous lifecycle state exists even if `candidateHeadSha` changed. Use semantic identity, base-impact classification, exact authority/environment/product identities and per-node evidence identity to decide reuse. Change repeated-failure anti-loop equivalence to semantic failure identity rather than exact candidate SHA, while preserving exact current-head checks in workflow failure classification/acceptance.

Do not treat a candidate SHA change alone as an affected evidence node. Preserve `REINTEGRATE` on merge conflicts and fail-closed rerun on dependency identity changes.

- [ ] **Step 4: Run focused verification and verify GREEN**

Run the Task 3 command again and require zero failures.

- [ ] **Step 5: Commit**

Commit message:

```text
refactor(verification): plan cross-sha evidence reuse
```

---

### Task 4: Preserve source execution provenance and current consumer provenance

**Files:**
- Modify: `tests/verification/evidence-manifest.test.mjs`
- Modify: `tests/verification/protected-verification-lifecycle.test.mjs`
- Modify: `tools/verification/evidence-manifest.mjs`
- Modify: `tools/verification/protected-verification-lifecycle.mjs`

**Interfaces:**
- Consumes: REUSED evidence manifest schema and `materializeReusedEvidence`.
- Produces: a reused manifest that binds current `candidateHeadSha`/plan/run provenance while retaining explicit immutable source evidence identity and original source run provenance.

- [ ] **Step 1: Write failing provenance regression**

For a cross-SHA materialization, assert the REUSED manifest contains:

```js
assert.equal(reused.candidateHeadSha, currentPlan.candidateHeadSha);
assert.equal(reused.sourceEvidenceDigest, source.evidenceDigest);
assert.deepEqual(reused.sourceRunProvenance, source.runProvenance);
assert.deepEqual(reused.runProvenance, currentConsumerRun);
```

Also assert tampering with `sourceRunProvenance` invalidates the manifest digest.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/verification/evidence-manifest.test.mjs tests/verification/protected-verification-lifecycle.test.mjs
```

Expected: `sourceRunProvenance` is currently absent.

- [ ] **Step 3: Extend the existing REUSED provenance contract minimally**

For `disposition === 'REUSED'`, normalize/store `sourceRunProvenance` alongside `sourceEvidenceDigest` and `compatibilityDigest`. Executed evidence must reject reuse-only provenance fields. `materializeReusedEvidence` copies `source.runProvenance` into `sourceRunProvenance` and uses the supplied current run as `runProvenance`.

- [ ] **Step 4: Run focused verification and verify GREEN**

Run the Task 4 command again and require zero failures.

- [ ] **Step 5: Commit**

Commit message:

```text
feat(verification): retain source provenance on reused evidence
```

---

### Task 5: Prove anti-waste behavior without running heavy browser evidence

**Files:**
- Modify: `tests/verification/protected-verification-lifecycle.test.mjs`
- Modify: `tests/verification/protected-hosted-evidence-fan-in.test.mjs` only if fan-in currently rejects valid cross-SHA REUSED manifests after Tasks 1-4.
- Modify: `tools/verification/protected-hosted-fan-in.mjs` only if the new regression proves a concrete SHA-coupled semantic rejection.

**Interfaces:**
- Consumes: final deterministic lifecycle/evidence contracts.
- Produces: executable proof of `HEAVY_EXECUTION_SUPPRESSED_REUSABLE_EVIDENCE` semantics through zero scheduled hosted evidence nodes, without invoking Molehill or Playwright.

- [ ] **Step 1: Add the anti-waste regression**

Construct a previous qualified state on PR-head SHA and a current merge-group/synthetic SHA with identical semantic dependencies. Assert:

```js
assert.equal(decision.disposition, 'REUSE');
assert.equal(decision.heavyExecutionsRequired, 0);
assert.deepEqual(decision.executeHostedEvidenceIds, []);
```

Add an assertion/reason code containing `HEAVY_EXECUTION_SUPPRESSED_REUSABLE_EVIDENCE` if the lifecycle result does not already expose an equivalent explicit suppression reason.

- [ ] **Step 2: Run the deterministic verification subset and verify RED if a missing explicit contract remains**

Run:

```bash
node --test \
  tests/verification/protected-hosted-plan.test.mjs \
  tests/verification/evidence-manifest.test.mjs \
  tests/verification/evidence-reuse.test.mjs \
  tests/verification/protected-verification-lifecycle.test.mjs \
  tests/verification/protected-hosted-evidence-fan-in.test.mjs
```

- [ ] **Step 3: Implement only the failing deterministic contract**

If Tasks 1-4 already satisfy fan-in, make no production change. If a concrete fan-in SHA coupling is proven, replace only that semantic equality with source-evidence semantic identity plus current consumer provenance validation; do not weaken exact current-plan/head acceptance.

- [ ] **Step 4: Run the Task 5 deterministic subset and require zero failures**

No browser, Molehill or FullWorld execution is justified by this task.

- [ ] **Step 5: Commit**

Commit message:

```text
test(verification): prove heavy evidence reuse suppression
```

---

### Task 6: Integrate and remove obsolete recovery coupling only after deterministic core is proven

**Files:**
- Inspect first: `.github/workflows/protected-hosted-executor.yml`
- Inspect first: `.github/workflows/ci.yml`
- Inspect first: `.github/workflows/merge-group-gate.yml`
- Inspect first: `.github/workflows/protected-execution-promotion-qualification.yml`
- Do not edit while overlapping #303 owns the same file unless #303 is terminal or the change is reconciled explicitly.
- Tests: matching workflow-contract tests under `tests/verification/**`.

**Interfaces:**
- Consumes: deterministic semantic reuse lifecycle.
- Produces: PR and Merge Queue workflows consume the lifecycle decision and publish/rebind compatible evidence instead of polling for a head-specific heavy artifact when reusable PASS evidence exists.

- [ ] **Step 1: Refresh GitHub authority and #303/#268 state**

Verify current `main`, #303 merge/state/head, #268 head/checks, and changed-file overlap. If #303 is still active on overlapping files, record integration as blocked-by-overlap rather than creating another competing workflow patch.

- [ ] **Step 2: If overlap is clear, write workflow-contract RED tests first**

Require the protected workflow to choose REUSED evidence before starting/polling heavy hosted execution when lifecycle says all nodes are reusable, and require Merge Queue synthetic SHA to consume the same semantic evidence.

- [ ] **Step 3: Run only deterministic workflow-contract tests and verify RED**

Use the narrow `node --test tests/verification/<affected-contract>.test.mjs` commands identified from the changed workflow.

- [ ] **Step 4: Implement the minimal workflow integration**

Reuse existing lifecycle/state artifacts; do not add branch-name/PR-number registries. Preserve exact current-head/current-merge-group acceptance and protected-base code authority.

- [ ] **Step 5: Verify deterministic workflow contracts GREEN**

Then run the repository-selected deterministic verification contract suite for the changed paths. Do not trigger Molehill/full E2E unless a failing gate demonstrates a semantic browser dependency that cannot be proven deterministically.

- [ ] **Step 6: Commit**

Commit message:

```text
refactor(ci): consume reusable semantic verification evidence
```

---

### Task 7: Final exact-head verification and closeout

**Files:**
- Review: complete PR diff
- Update: issue #305 / PR body with exact evidence

**Interfaces:**
- Consumes: final implementation head.
- Produces: merge-ready exact-head evidence or an explicit external blocker.

- [ ] **Step 1: Refresh `main` and reconcile only if required**

If `main` advanced, classify `UPSTREAM_ADVANCED`; do not restart. Merge-up non-force only when entering final integration and rerun verification invalidated by that merge.

- [ ] **Step 2: Run the complete applicable deterministic verification suite**

Require fresh zero-failure output for all modified verification modules and workflow contracts.

- [ ] **Step 3: Review exact final diff and provenance**

Confirm no unrelated product/runtime/world-data changes, no PR-specific hacks, no weakened stale-head/authority/environment/product/fan-in controls, and no accidental `real_fullworld` routing expansion.

- [ ] **Step 4: Inspect exact-head GitHub required checks**

Require required deterministic/security/governance checks to succeed. A heavy browser check may only be run/re-run when its semantic node is actually invalidated by the final dependency identity; otherwise the lifecycle must reuse compatible PASS evidence.

- [ ] **Step 5: Close lifecycle only on verified terminal state**

Close #305 only after exact-head required checks and the incremental reuse acceptance regressions pass. Otherwise leave the issue/PR open with the exact failing gate and smallest missing dependency.