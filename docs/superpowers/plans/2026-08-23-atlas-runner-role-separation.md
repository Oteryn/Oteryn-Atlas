# Atlas Runner Role Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Molehill-PC the only heavy Atlas browser-qualification/nightly runner while reserving Synology for merged-main deployment/live acceptance and keeping nightly additive to the PR gate.

**Architecture:** Keep the existing exact-head `atlas-local-e2e` PR gate and current Synology live workflow. Fold PR #104's additive-nightly rule into PR #106, route scheduled/manual browser depth to `oteryn-molehill-atlas`, and pin the separation with repository policy plus executable workflow contracts.

**Tech Stack:** GitHub Actions YAML, Node.js `node:test`, Playwright/Docker, PowerShell, Markdown governance.

**Spec:** `docs/superpowers/specs/2026-08-23-atlas-runner-role-separation-design.md`

## Global Constraints
- Heavy PR qualification remains 48 scenarios, workers=1, retries=0, exact-head `atlas-local-e2e=success`.
- Nightly is additive and must not rerun the generic full required browser matrix.
- `oteryn-molehill-atlas` / `oteryn-atlas-pc` owns heavy browser depth.
- `oteryn-synology-atlas` / `oteryn-atlas` remains live-acceptance only.
- No timeout, retry, tolerance, assertion or allowlist weakening is permitted as a performance workaround.
- A physical runner outage blocks proof; stale evidence must never be reused.

---

### Task 1: Pin runner-role and additive-nightly contracts

**Files:**
- Modify: `tests/verification/ci-workflow-contract.test.mjs`
- Read: `.github/workflows/verification-depth.yml`
- Read: `.github/workflows/synology-live-acceptance.yml`
- Read: `AGENTS.md`

**Interfaces:**
- Consumes: current workflow text and repository governance.
- Produces: deterministic assertions that fail if nightly duplicates the full PR matrix, heavy browser depth returns to Synology, live acceptance leaves Synology, or repository policy loses the role split.

- [ ] **Step 1: Write failing tests**
Add assertions that nightly does not contain `run_case required ... e2e npm test`, that the browser-depth block contains `labels: oteryn-atlas-pc` plus Molehill/Windows identity, that Synology live acceptance contains `labels: oteryn-atlas` plus `oteryn-synology-atlas`, and that `AGENTS.md` states heavy browser verification belongs on Molehill while Synology is live-acceptance only.

- [ ] **Step 2: Verify RED**
Run: `node --test tests/verification/ci-workflow-contract.test.mjs`
Expected: failure because the current #106 branch still duplicates the generic full required matrix and lacks the final governance wording.

- [ ] **Step 3: Commit RED checkpoint**
Commit only the failing contract changes with message `test(ci): pin Atlas runner role separation`.

### Task 2: Make nightly additive and codify the runner split

**Files:**
- Modify: `.github/workflows/verification-depth.yml`
- Modify: `AGENTS.md`
- Modify: `e2e/README.md`
- Test: `tests/verification/ci-workflow-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 contracts.
- Produces: nightly that runs only enumerated depth suites on Molehill and durable repository documentation forbidding heavy CI on Synology.

- [ ] **Step 1: Remove the duplicated required matrix**
Delete only the `run_case required ... e2e npm test` invocation from `verification-depth.yml`; retain repeated critical probes, fixed stress seeds, extra profiles and optional performance/visual/accessibility/race/soak depth.

- [ ] **Step 2: Add repository policy**
Add an `Execution placement` subsection to `AGENTS.md` stating GitHub-hosted CI owns deterministic/security checks, Molehill owns heavy exact-head/full/nightly browser work, and Synology owns merged-main deploy/live acceptance only. Explicitly forbid moving 48-scenario/stress/soak/performance/visual depth onto Synology to compensate for unavailable Molehill capacity.

- [ ] **Step 3: Update E2E documentation**
Document that scheduled depth is additive to the 48-scenario PR gate and runs on Molehill; Synology remains the live target and is not a general-purpose heavy CI runner.

- [ ] **Step 4: Verify GREEN**
Run: `node --test tests/verification/ci-workflow-contract.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Run deterministic verification fan-in**
Run the same deterministic Node/contract/property file set used by CI and require zero failures.

- [ ] **Step 6: Commit implementation**
Commit workflow/policy/docs with message `ci(atlas): separate heavy verification from Synology live acceptance`.

### Task 3: Reconcile PR lifecycle and exact-head gates

**Files:**
- Update PR #106 metadata/body.
- Close PR #104 as superseded only after its unique additive-nightly rule is present on #106.
- Update Issue #105 with exact evidence.

**Interfaces:**
- Consumes: Task 2 exact remote head.
- Produces: one authoritative delivery path with no duplicate repair PR.

- [ ] **Step 1: Push/verify remote head**
Confirm PR #106 head equals the intended commit and is based on current `main`; no force push unless required by an explicitly reviewed rebase.

- [ ] **Step 2: Update PR #106**
Record the combined architecture: Molehill routing + additive nightly + Synology live-only governance.

- [ ] **Step 3: Close #104 as superseded**
State that its unique three-file additive-nightly rule has been absorbed by #106; do not merge #104.

- [ ] **Step 4: Require physical exact-head E2E**
On Molehill, run the fresh clean 48-scenario Docker Playwright gate with workers=1/retries=0 and publish `atlas-local-e2e=success` only after summary validation. If Molehill is offline, stop here; do not fabricate or reuse old status.

- [ ] **Step 5: Require GitHub gates**
Require exact-head `atlas-gate`, `provenance-gate`, CodeQL/security and applicable repository workflows green before merge.

### Task 4: Post-merge physical acceptance

**Files:**
- No product mutation unless a reproducible defect is found.
- Evidence: GitHub Actions artifacts/statuses and Issue #105/#85 comments.

**Interfaces:**
- Consumes: squash-merged #106 exact main SHA.
- Produces: terminal proof that heavy verification works on Molehill and live deployment reality works on Synology.

- [ ] **Step 1: Run one manual nightly on exact merged main**
Require deterministic depth success and Molehill browser-depth success without a duplicated full PR matrix.

- [ ] **Step 2: Verify Synology live acceptance**
Require live container/header revision equality to the same exact merged-main SHA plus bounded desktop/mobile live smoke and publication/product checks.

- [ ] **Step 3: Close lifecycle**
Close #105 only after both physical proofs. Close #85 only if its complete independent Definition of Done is satisfied; unrelated migration work is not automatically a blocker unless its provenance gate is actually required and failing.