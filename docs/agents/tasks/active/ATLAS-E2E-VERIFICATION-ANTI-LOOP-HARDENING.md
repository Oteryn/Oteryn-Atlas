# ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING

```yaml
task_id: ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING
title: Harden Atlas E2E verification against closeout and requalification loops
lifecycle_authority: GitHub Issue
lifecycle_issue: 272
parent_programme_issue: 179
repository: Oteryn/Oteryn-Atlas
base_branch: main
implementation_branch: feat/issue-272-e2e-verification-anti-loop-hardening
pull_request: 273
admission_base_sha: 00bc97034618fa0ce264685d1aa342c591a43914
checkpoint_head_sha: 07982112a0b6442fa9ab19a2ea20e91049d11958
checkpoint_date: 2026-08-30
status: INCOMPLETE_LIVE_AUDIT_CHECKPOINT
normative_design: docs/superpowers/specs/2026-08-30-atlas-e2e-verification-anti-loop-hardening-design.md
implementation_plan: docs/superpowers/plans/2026-08-30-atlas-e2e-verification-anti-loop-hardening.md
owned_paths:
  - docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING.md
```

> GitHub live state is the source of truth. Historical chat/handoff reports claiming terminal success are non-authoritative and must not be used to skip verification. This checkpoint was written after a fresh live-state audit.

## Objective

Eliminate the serial verification loop in which a non-candidate authority/environment defect causes candidate churn, a bootstrap/main advance, reintegration and another full exact-head E2E cycle. Preserve exact-head fencing, protected lower-bound planning, retries=0, exact stable-ID equality, immutable product identity, profile/data-capability separation, `atlas-gate`, `provenance-gate`, GitHub-hosted ordinary E2E, specialist-only Molehill and deployment-only Synology.

## Live checkpoint

### FACT

- `main` is still `00bc97034618fa0ce264685d1aa342c591a43914` and is protected.
- Required branch checks on `main` are `provenance-gate` and `atlas-gate` from GitHub Actions.
- PR #273 is `open`, `draft=true`, `merged=false`, mergeable, with head `07982112a0b6442fa9ab19a2ea20e91049d11958`.
- Issue #272 is `open`.
- The PR is therefore not deployed to protected `main` and the lifecycle is not terminal.
- On exact head `07982112a0b6442fa9ab19a2ea20e91049d11958`, CodeQL is GREEN, while `atlas-gate`, `provenance-gate`, `Deterministic verification contracts`, `repository-contract` and `protected-plan` are RED.
- `environment-qualification`, `hosted-shards`, `fan-in` and `Protected Hosted Playwright evidence` are skipped on that head, so the required exact protected controller -> executor -> fan-in proof has not completed.

## What is genuinely implemented on PR #273

The branch contains substantive anti-loop foundations, including:

- canonical protected authority identity and authority manifest;
- canonical protected execution environment identity/config;
- split `planSemanticDigest` and `planInstanceDigest` with protected plan/controller v3 work;
- `base-advance-compatibility.mjs` and deterministic classification tests;
- `verification-failure-classification.mjs` and failure-owner tests;
- `verification-progress-state.mjs` and circuit-breaker/state tests;
- versioned `evidence-manifest.mjs` and `evidence-reuse.mjs` with focused tests;
- `semantic-experiment-identity.mjs` with selector-obligation protections;
- protected executor work for one-shot `environment-qualification` before hosted browser execution;
- semantic/instance/authority/environment identity propagation into protected execution/evidence paths;
- expanded authority closure and protected environment probe work.

These are real implementation pieces, but file/module existence is not completion authority.

## Missing or not yet proven in the active control plane

### P0 — must finish before merge

1. **Restore exact-head deterministic/control-plane GREEN**
   - fix the current `protected-plan`, deterministic-contract and repository-contract failures;
   - restore `provenance-gate` and `atlas-gate` GREEN on the same exact head;
   - do not use a no-op/retrigger commit.

2. **Wire Base Advance Compatibility into the real lifecycle**
   - invoke protected `classifyBaseAdvance()` at the base-advance boundary;
   - make `REUSE`, `PARTIAL_RERUN`, `FULL_RERUN`, `REINTEGRATE` executable dispositions rather than unit-only behavior;
   - prove unrelated `main` movement causes zero heavy reruns and no candidate mutation.

3. **Wire failure ownership and circuit breakers into authoritative execution/coordinator evidence**
   - failed authoritative nodes must emit a primary failure class;
   - `AUTHORITY_FAILURE` and `ENVIRONMENT_FAILURE` must not recommend/mutate candidate code;
   - unchanged semantic inputs + identical deterministic failure must reach `STALLED`/no-retrigger behavior;
   - serial control-plane defects must reach `ARCHITECTURE_STABILIZATION_REQUIRED` per the plan.

4. **Wire safe evidence reuse through executor/fan-in**
   - `resolveReusableEvidence()` must participate in the authoritative reuse decision;
   - `EXECUTED` and `REUSED` evidence must pass the same digest/schema validation;
   - fan-in must independently reject stale/mismatched/revoked/unavailable evidence;
   - exact stable-ID union/no-duplicate guarantees must remain intact.

5. **Prove one-shot environment qualification end-to-end**
   - the job exists, but the current exact head skips it because earlier protected-plan/control-plane gates fail;
   - obtain successful exact-head environment qualification followed by hosted execution and fan-in.

### P1 — required by the normative Definition of Done

6. **Consolidate obsolete promotion/bootstrap machinery**
   - inventory every `protected-*-promotion*.yml` workflow;
   - record continuing responsibility, replacement owner/evidence and callers;
   - delete only paths proven superseded;
   - retain any promotion path that still owns a unique safety property.

7. **Phase E semantic identity adoption**
   - PR #217 remains a draft preparation lane, not final Phase E;
   - rebuild/adopt the semantic experiment identity on the final protected Phase D/anti-loop state;
   - unrelated main movement must not invalidate otherwise identical benchmark repetitions.

8. **Phase F semantic evidence/selective-safety adoption**
   - PR #219 remains a draft preparation lane and selective execution is intentionally not cut over;
   - bind shadow/full-safety evidence to exact current planner/catalog/census/semantic identities;
   - prove changed selector/specialist obligations invalidate reuse;
   - keep `force-full` / `SELECTOR_ESCAPE` widening-only.

9. **Terminal exact-head and post-merge verification**
   - `node --test tests/verification/*.test.mjs` GREEN on the exact final head;
   - diff/format/repository contracts GREEN;
   - exact protected controller -> environment qualification -> executor -> shard evidence -> fan-in path GREEN;
   - `atlas-gate`, `provenance-gate`, applicable CodeQL/security GREEN;
   - no unresolved review threads;
   - final trust-boundary/diff audit and branch-protection readback;
   - merge only if the expected head is still current;
   - post-merge `main` readback and required checks before closing #272.

## Remaining effort assessment

### FACTUAL scope assessment

The implementation plan has eight major tasks. Tasks 1 and 3 are substantially implemented; Task 2 is materially implemented but not yet proven end-to-end. Tasks 4, 5 and 6 have core modules/tests but still require authoritative workflow/control-plane integration. Task 7 remains an audit/consolidation exercise. Task 8 remains materially open because Phase E/F are still draft preparation lanes and terminal exact-head/merge proof has not occurred.

### ESTIMATE

- **Remaining implementation/verification effort: approximately 45–55% of the terminal task.**
- The code foundations are more than half present, but the remaining half carries disproportionate integration risk because it touches controller/executor/fan-in authority, reuse decisions, bootstrap retirement, Phase E/F adoption and exact-head protected gates.
- Treat the task as **HIGH remaining effort**, not as a small CI cleanup.
- Remaining work is best viewed as **five major closeout lanes**:
  1. exact-head CI/control-plane repair;
  2. compatibility + failure/circuit-breaker runtime wiring;
  3. evidence reuse + fan-in enforcement;
  4. promotion cleanup + Phase E/F adoption;
  5. exact-head protected proof, review, merge and post-merge readback.

## Required next execution order

1. Re-read live PR/head/main/check state.
2. Fix only the current deterministic/protected-plan/repository/provenance root causes until the same exact head can enter environment qualification.
3. Add RED integration contracts proving base-advance, failure-owner and evidence-reuse modules are actually invoked by the protected control plane.
4. Implement those integrations with a single writer for controller/executor/fan-in paths.
5. Run exact-head protected environment -> hosted execution -> fan-in and negative stale/reuse proofs.
6. Inventory/remove only superseded promotion machinery.
7. Rebuild/adopt Phase E then Phase F identities against the final protected state.
8. Perform complete Definition-of-Done audit, mark PR ready only when justified, merge through protection, then verify merged `main` and close #272.

## Completion rule

Do not report this alias as complete merely because the core modules or unit tests exist. It is DONE only when all ten Definition-of-Done conditions in the normative prompt are executable/proven and the implementation is merged into protected `main` with exact-head gates GREEN.
