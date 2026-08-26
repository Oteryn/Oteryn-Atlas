# Atlas E2E Verification Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the fail-closed, risk-proportionate Atlas verification lifecycle without reducing protected exact-head proof.

**Architecture:** Keep GitHub-hosted deterministic checks authoritative for cheap proof. Generate a deterministic plan from trusted-base and candidate policy, bind execution evidence to that plan, then admit heavy Docker/native work to Molehill by resource class. Synology receives only verified merged-main release artifacts and bounded live acceptance.

**Tech Stack:** GitHub Actions YAML, Node `node:test`, Playwright, Docker Compose, Windows PowerShell, JSON schemas.

**Spec:** `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`

## Global Constraints

- Issue `#179` and PR `#180` are the lifecycle authority for Phase A/C work; `admission_main_sha` is `188aa73d6fdedccb1933b99b9da950c13e5b9bbb`.
- Preserve `atlas-gate`, `provenance-gate`, exact-head evidence, no-retry acceptance, and the trusted-base lower bound.
- `UNKNOWN_RUNTIME_IMPACT`, malformed change evidence, stale plans, untrusted candidates, and resource exhaustion fail closed.
- Heavy E2E, stress, soak, performance, and broad visual work run only on Molehill-PC. Synology is never a fallback.
- Do not force-push published history; reconcile a newer `main` with a normal merge and renew only materially invalidated proof.

---

### Task 1: Reconcile Phase A and establish plan identity

**Files:**
- Modify: `tools/verification/build-verification-plan.mjs`
- Modify: `tools/verification/verification-plan-schema.mjs`
- Test: `tests/verification/verification-plan.test.mjs`

- [ ] Write tests for merge-base/diff identity, worker-policy digest, and invalid/missing identity rejection.
- [ ] Run the focused test and confirm it fails for the absent fields.
- [ ] Add canonical identity/digest validation and emit those fields in every plan.
- [ ] Re-run focused and complete deterministic verification suites.
- [ ] Commit the independently reviewable Phase C identity change.

### Task 2: Make evidence plan-bound

**Files:**
- Modify: `e2e/publish-local-e2e-status.ps1`
- Modify: `e2e/summary-reporter.mjs`
- Modify: `e2e/approve-visual-user-acceptance.ps1`
- Test: `tests/verification/summary-reporter.test.mjs`
- Test: `tests/verification/e2e-policy-contract.test.mjs`

- [ ] Add a failing publisher contract proving a matching count with a missing/duplicated stable ID is rejected.
- [ ] Add a failing contract proving a stale integration base, plan digest, or visual subset is rejected.
- [ ] Consume an exact candidate plan; validate required group IDs, stable-ID set, zero retries, plan digest, current integration base, and plan-scoped visual scenarios.
- [ ] Retain full-current behavior while `shadowOnly` remains true; remove magic count and unconditional workers=1 only when a plan supplies the measured policy.
- [ ] Run all deterministic contracts and commit the reviewable Phase C publisher migration.

### Task 3: Add trusted Molehill admission and resource model

**Files:**
- Create: `tools/verification/resource-admission.mjs`
- Create: `tools/verification/trust-admission.mjs`
- Modify: `.github/workflows/docker-e2e.yml`
- Modify: `.github/workflows/verification-depth.yml`
- Test: `tests/verification/resource-admission.test.mjs`
- Test: `tests/verification/trust-admission.test.mjs`

- [ ] Add negative tests for fork/bot rejection, superseded evidence rejection, exclusivity conflicts, unsafe budget rejection, and Synology-heavy rejection.
- [ ] Confirm the tests fail before the modules/workflow admission exist.
- [ ] Implement versioned, data-only admission decisions with records for running/queued/blocked/rejected states and least-privilege workflow permissions.
- [ ] Run deterministic checks, then Molehill self-tests; commit as the Phase D PR.

### Task 4: Measure and select worker/concurrency policy

**Files:**
- Modify: `e2e/benchmark-workers.ps1`
- Create: `tools/verification/worker-policy.json`
- Create: `docs/evidence/atlas-e2e-worker-benchmark/`
- Test: `tests/verification/benchmark-workers-contract.test.mjs`

- [ ] Make a failing contract for missing 1/2/4/6/8 repetitions, absent environment fingerprint, and nonzero-retry selection.
- [ ] Run isolated Molehill 1/2/4/6/8 benchmark plus required targeted/broad multi-job experiments.
- [ ] Derive the versioned policy only from recorded stable measurements; leave unsafe/resource-exhausted combinations rejected.
- [ ] Bind the policy digest into plans and evidence, then run full deterministic checks and commit Phase E.

### Task 5: Remove remote publication coupling and complete selective cutover

**Files:**
- Modify: `e2e/run.ps1`
- Modify: `e2e/run.sh`
- Modify: `e2e/compose.yml`
- Modify: `e2e/compose.selfhosted.yml`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/verification/e2e-proxy-contract.test.mjs`
- Test: `tests/verification/ci-workflow-contract.test.mjs`

- [ ] Add failing isolation/cutover contracts for host IPC, duplicate identities, force-full-only widening, safety-net presence, and no Synology heavy dependency.
- [ ] Stage immutable exact publication/product inputs on Molehill and retain per-container shared-memory limits.
- [ ] Calibrate shadow plans against actual full outcomes; promote every escape to a regression test.
- [ ] Enable selective execution only after the complete current-main safety net and calibration evidence are present.
- [ ] Commit Phase F after exact-head Molehill qualification.

### Task 6: Native hardware, merged-main artifact, deployment and closeout

**Files:**
- Modify: `.github/workflows/synology-live-acceptance.yml`
- Create: `.github/workflows/atlas-release-artifact.yml`
- Create: `.github/workflows/atlas-native-hardware.yml`
- Modify: `.github/workflows/verification-depth.yml`
- Test: `tests/verification/release-artifact-contract.test.mjs`
- Test: `tests/verification/native-hardware-contract.test.mjs`

- [ ] Add failing contracts for untrusted native admission, mismatched release SHA/digest, task-branch deployment, and stale nightly revision.
- [ ] Implement build-once merged-main artifact promotion, exact digest/revision checks, bounded native GPU truth, and full nightly safety-net execution.
- [ ] Execute merged-main Molehill/Synology evidence only from final protected `main`.
- [ ] Recompute the final plan against late `integration_main_sha`, review the whole diff, obtain exact-head gates, squash merge, verify deployed headers/labels, and close #179.
