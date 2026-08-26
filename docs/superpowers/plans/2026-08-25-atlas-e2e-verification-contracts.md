# Atlas E2E Verification Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fail-closed, shadow-only verification-plan foundation without changing the current required heavy-E2E decision.

**Architecture:** A strict impact manifest maps changed paths to minimum risk and stable verification group IDs. A separate catalog owns group membership and resource metadata. The planner validates both a protected-base policy and a candidate policy, applies mandatory bootstrap `full` escalation for verification-governance changes, and writes canonical output. The existing classifier keeps the legacy `docs_only` / `requires_e2e` pair until calibration and later cutover evidence exist.

**Tech Stack:** Node.js ESM, `node:test`, JSON policy files, Playwright reporter, GitHub Actions YAML, Windows PowerShell.

**Spec:** `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`

## Global Constraints

- Retries remain `0`; unknown, malformed, empty, incomplete, and governance changes fail closed to `full`.
- Candidate policy can widen but cannot narrow below trusted protected-base requirements.
- Stable test identity is `project + normalized spec path + title path`; counts are diagnostic only.
- This is shadow-only: legacy non-doc changes still require full heavy E2E.
- No worker/slot/shared-memory default changes without Molehill measurements.

---

### Task 1: Strict policy and plan contracts

**Files:**

- Create: `tools/verification/impact-manifest.json`, `tools/verification/verification-catalog.json`, `tools/verification/verification-plan-schema.mjs`, `tools/verification/build-verification-plan.mjs`
- Test: `tests/verification/impact-manifest.test.mjs`, `tests/verification/verification-plan.test.mjs`

**Interfaces:** `buildVerificationPlan({ repository, headSha, integrationBaseSha, changedFiles, trustedImpactManifest, candidateImpactManifest, verificationCatalog })` returns a canonical plan with profile, stable groups, policy/catalog digests, changed-path digest, and `shadowOnly: true`.

- [ ] Write failing tests for targeted union, unknown/malformed evidence, rename source coverage, and trusted-base bootstrap escalation.
- [ ] Run `node --test tests/verification/impact-manifest.test.mjs tests/verification/verification-plan.test.mjs` and observe the missing-module failure.
- [ ] Implement strict schema validation, canonical hashing, multi-path union, maximum profile, allowlisted groups, and `full` bootstrap surfaces.
- [ ] Re-run the new contracts plus `tests/verification/docs-only-e2e-gating.test.mjs`.
- [ ] Commit: `test(verification): add shadow plan contracts`.

### Task 2: Preserve legacy gating while emitting shadow identity

**Files:**

- Modify: `tools/verification/classify-pr-changes.mjs`, `.github/workflows/ci.yml`
- Test: `tests/verification/docs-only-e2e-gating.test.mjs`, `tests/verification/ci-workflow-contract.test.mjs`

**Interfaces:** Existing `docs_only` and `requires_e2e` values retain current behavior. Shadow outputs include a plan digest/path but do not change the required browser gate.

- [ ] Write a failing workflow contract asserting a shadow-plan output and unchanged legacy E2E decision.
- [ ] Run the classifier/workflow tests and observe the missing output failure.
- [ ] Wire planner execution and exported `shadow_plan_digest`; leave browser selection bound to legacy `requires_e2e`.
- [ ] Re-run focused contracts and commit `ci(verification): emit shadow plan identity`.

### Task 3: Stable scenario identities

**Files:**

- Modify: `e2e/summary-reporter.mjs`
- Test: `tests/verification/summary-reporter.test.mjs`, `tests/verification/verification-plan.test.mjs`

**Interfaces:** `normalizeSummaryScenario` emits immutable `specPath` and `stableTestId`, built from project, normalized spec path, and title path.

- [ ] Add a failing test for an exact stable ID with Windows path normalization.
- [ ] Run `node --test tests/verification/summary-reporter.test.mjs` and observe the absent field failure.
- [ ] Implement bounded normalized-path and stable-ID construction.
- [ ] Re-run reporter/planner contracts and commit `test(e2e): emit stable test identities`.

### Task 4: Measurement-only worker benchmark harness

**Files:**

- Create: `e2e/benchmark-workers.ps1`
- Create: `tests/verification/benchmark-workers-contract.test.mjs`
- Modify: `e2e/README.md`

**Interfaces:** The script accepts only candidates `1,2,4,6,8`, emits versioned environment/telemetry JSON, and never selects or applies a default.

- [ ] Write a failing script-contract test requiring candidates, at least three repetitions, PowerShell performance counters, Docker stats, and no `LoadPercentage` dependency.
- [ ] Run `node --test tests/verification/benchmark-workers-contract.test.mjs` and observe the absent-script failure.
- [ ] Implement `-SelfTest` and measurement-only capture; document the exact Molehill invocation.
- [ ] Run static contract locally and `powershell -NoProfile -File .\e2e\benchmark-workers.ps1 -SelfTest` on Molehill.
- [ ] Commit `test(e2e): add measured worker benchmark harness`.

### Task 5: Integrate and verify

- [ ] Inspect `git diff origin/main...HEAD --check` and the complete diff.
- [ ] Run `node --test tests/verification/*.test.mjs tests/properties/*.test.mjs`.
- [ ] Run the real Molehill 1/2/4/6/8 benchmark before any policy-cutover PR; retain results as exact SHA evidence.
- [ ] Push the dedicated #179 branch, open the phase PR, require exact-head `atlas-gate` and `provenance-gate`, then merge only after integration-base refresh.
