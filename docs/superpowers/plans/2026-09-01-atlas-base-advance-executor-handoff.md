# Atlas Base-Advance Executor Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore automatic protected base-advance continuation from a successful bot-dispatched controller into the existing hosted executor/fan-in lifecycle without weakening exact-head or protected-producer trust.

**Architecture:** Keep `Protected Verification Controller` as the sole authoritative plan producer. A narrowly permissioned post-plan handoff job dispatches the existing executor only for validated `base_advance:<sha>` controller runs; the executor accepts that explicit dispatch only after revalidating the controller run, exact plan artifact, untrusted PR routing key, and current candidate head. Existing `workflow_run` execution remains unchanged, and downstream state/gate validators accept the executor's new event only because the protected executor itself fails closed before any evidence/state publication.

**Tech Stack:** GitHub Actions YAML, Bash, GitHub CLI/REST API, Node.js ESM, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-01-atlas-base-advance-executor-handoff-design.md`

## Global Constraints

- GitHub live state is the only source of truth; refresh protected `main`, PR #273 head, checks and review state before every mutation or merge-readiness decision.
- Preserve exact candidate-head fencing before expensive work and evidence acceptance.
- Preserve `retries=0`, exact stable-ID equality, protected lower-bound planning, immutable product identities and profile/data-capability separation.
- Ordinary deterministic/browser functional E2E stays GitHub-hosted; Molehill stays specialist-only; Synology stays deployment-only.
- Preserve required `atlas-gate` and `provenance-gate`; do not accept stale-green evidence.
- Do not add PAT/service-token dependencies, no-op commits, manual retrigger loops, new bootstrap PRs, or candidate self-certification.
- `inputs.pr_number` is an untrusted routing/concurrency key and must equal `plan.prNumber` before execution.
- Do not require executor-time current `main` to still equal the controller producer base; bind the exact producer run/head/artifact instead, allowing a later main advance to create its own bounded evaluation.
- The observed TDD RED is commit `dabeac6b1a62a44d66d9423a0122f71d7ffa881e`, CI run `33504871228`, deterministic job `99846427219`; after this plan commit moves the head, reproduce the targeted RED locally before implementation.

---

### Task 1: Reproduce and preserve the protected handoff RED

**Files:**
- Existing test: `tests/verification/protected-base-advance-executor-handoff.test.mjs`
- Read: `.github/workflows/protected-verification-controller.yml`
- Read: `.github/workflows/protected-hosted-executor.yml`

**Interfaces:**
- Consumes: the approved design and the already committed RED contract.
- Produces: fresh-head RED evidence proving the missing controller handoff and executor dispatch admission before implementation.

- [ ] **Step 1: Refresh exact branch and protected base in an isolated worktree**

```bash
git fetch --no-tags origin main feat/issue-272-e2e-verification-anti-loop-hardening
EXPECTED_REMOTE_HEAD="$(git rev-parse origin/feat/issue-272-e2e-verification-anti-loop-hardening)"
CURRENT_MAIN="$(git rev-parse origin/main)"
test "$CURRENT_MAIN" = "2d6309a4df1580ce1a23be844b35c6a3b125b131"
git checkout --detach "$EXPECTED_REMOTE_HEAD"
git status --short
```

Expected: detached exact PR head, empty working tree.

- [ ] **Step 2: Run the existing focused test and observe RED**

```bash
node --test tests/verification/protected-base-advance-executor-handoff.test.mjs
```

Expected: FAIL because the controller has no `base-advance-handoff` job and/or the executor has no narrow `workflow_dispatch` admission. Do not weaken the assertions.

- [ ] **Step 3: Record the fresh RED output before editing implementation files**

```bash
node --test tests/verification/protected-base-advance-executor-handoff.test.mjs > handoff-red.log 2>&1 || true
grep -E "not ok|AssertionError|base-advance|workflow_dispatch" handoff-red.log
rm handoff-red.log
```

Expected: at least one failure attributable to the missing approved handoff behavior.

---

### Task 2: Add the protected controller handoff

**Files:**
- Modify: `.github/workflows/protected-verification-controller.yml`
- Test: `tests/verification/protected-base-advance-executor-handoff.test.mjs`
- Test: `tests/verification/protected-verification-lifecycle-workflow-contract.test.mjs`

**Interfaces:**
- Consumes: `protected-plan` outputs `base_sha`, `candidate_head_sha`, `pr_number` from the existing `identity` step.
- Produces: `base-advance-handoff` job that dispatches `protected-hosted-executor.yml` with exact `controller_run_id` plus untrusted `pr_number` only after protected validation.

- [ ] **Step 1: Expose the existing identity step values as protected-plan job outputs**

Add directly under `protected-plan:`:

```yaml
    outputs:
      base_sha: ${{ steps.identity.outputs.base_sha }}
      candidate_head_sha: ${{ steps.identity.outputs.candidate_head_sha }}
      pr_number: ${{ steps.identity.outputs.pr_number }}
```

- [ ] **Step 2: Add the minimally permissioned handoff job after `protected-plan`**

Implement this shape, preserving the exact validation semantics from the committed RED contract:

```yaml
  base-advance-handoff:
    needs: protected-plan
    if: >-
      needs.protected-plan.result == 'success' &&
      github.event_name == 'workflow_dispatch' &&
      startsWith(inputs.trigger, 'base_advance:')
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions:
      contents: read
      actions: write
      pull-requests: read
    env:
      GH_TOKEN: ${{ github.token }}
      CONTROLLER_RUN_ID: ${{ github.run_id }}
      EXPECTED_PROTECTED_BASE_SHA: ${{ needs.protected-plan.outputs.base_sha }}
      EXPECTED_CANDIDATE_HEAD_SHA: ${{ needs.protected-plan.outputs.candidate_head_sha }}
      EXPECTED_PR_NUMBER: ${{ needs.protected-plan.outputs.pr_number }}
      ATLAS_BASE_ADVANCE_TRIGGER: ${{ inputs.trigger }}
```

- [ ] **Step 3: Validate the active controller run and exact plan artifact before dispatch**

The job script must:

```bash
set -euo pipefail
[[ "$CONTROLLER_RUN_ID" =~ ^[1-9][0-9]*$ ]]
[[ "$EXPECTED_PR_NUMBER" =~ ^[1-9][0-9]*$ ]]
[[ "$EXPECTED_PROTECTED_BASE_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$EXPECTED_CANDIDATE_HEAD_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$ATLAS_BASE_ADVANCE_TRIGGER" =~ ^base_advance:([a-f0-9]{40})$ ]]
test "${BASH_REMATCH[1]}" = "$EXPECTED_PROTECTED_BASE_SHA"
```

Fetch `actions/runs/$CONTROLLER_RUN_ID` and fail unless path is `.github/workflows/protected-verification-controller.yml`, event is `workflow_dispatch`, status is `in_progress`, `run_attempt == 1`, head branch is `main`, head SHA equals `EXPECTED_PROTECTED_BASE_SHA`, and actor plus triggering actor are `github-actions[bot]`. Fetch run artifacts and require exactly one non-expired name beginning `protected-verification-plan-`; download it and require the plan's `protectedBaseSha`, `controller.sourceSha`, `candidateHeadSha`, and `prNumber` to equal the expected values. Fetch the live PR and require open/same-repo/main-targeting/current-head equality.

- [ ] **Step 4: Dispatch only the existing executor with bound routing inputs**

```bash
gh workflow run protected-hosted-executor.yml \
  --repo "$GITHUB_REPOSITORY" --ref main \
  -f "controller_run_id=$CONTROLLER_RUN_ID" \
  -f "pr_number=$EXPECTED_PR_NUMBER"
```

Do not publish a status and do not execute candidate/browser code in the handoff job.

- [ ] **Step 5: Run focused controller contract tests**

```bash
node --test \
  tests/verification/protected-base-advance-executor-handoff.test.mjs \
  tests/verification/protected-verification-lifecycle-workflow-contract.test.mjs
```

Expected: controller-side assertions GREEN; executor-side assertions may remain RED until Task 3.

---

### Task 3: Add fail-closed executor workflow_dispatch admission

**Files:**
- Modify: `.github/workflows/protected-hosted-executor.yml`
- Test: `tests/verification/protected-base-advance-executor-handoff.test.mjs`
- Test: `tests/verification/protected-hosted-workflow-contract.test.mjs`

**Interfaces:**
- Consumes: `controller_run_id` and untrusted `pr_number` from the protected controller handoff, or the existing `github.event.workflow_run` payload.
- Produces: a normalized authoritative controller run ID feeding the existing plan download, identity, lifecycle, execution and fan-in path.

- [ ] **Step 1: Add required executor workflow_dispatch inputs without removing workflow_run**

```yaml
on:
  workflow_run:
    workflows: ["Protected Verification Controller"]
    types: [completed]
  workflow_dispatch:
    inputs:
      controller_run_id:
        description: Exact successful protected controller run to consume
        required: true
        type: string
      pr_number:
        description: Untrusted PR routing key; validated against protected plan
        required: true
        type: string
```

- [ ] **Step 2: Preserve per-PR cancellation for both entry paths**

```yaml
concurrency:
  group: atlas-protected-hosted-${{ inputs.pr_number || github.event.workflow_run.pull_requests[0].number || github.event.workflow_run.id }}
  cancel-in-progress: true
```

- [ ] **Step 3: Allow preflight for the two intended transports only**

The job-level condition must allow:

```yaml
if: >-
  (github.event_name == 'workflow_dispatch') ||
  (github.event_name == 'workflow_run' &&
   github.event.workflow_run.conclusion == 'success' &&
   (github.event.workflow_run.event == 'pull_request_target' || github.event.workflow_run.event == 'workflow_dispatch'))
```

- [ ] **Step 4: Resolve and validate the authoritative controller run before downloading artifacts**

Set:

```yaml
        env:
          WORKFLOW_RUN_ID: ${{ inputs.controller_run_id || github.event.workflow_run.id }}
          UNTRUSTED_ROUTING_PR_NUMBER: ${{ inputs.pr_number }}
```

For `workflow_dispatch`, fetch `actions/runs/$WORKFLOW_RUN_ID` and fail unless repository is `Oteryn/Oteryn-Atlas`, path is `.github/workflows/protected-verification-controller.yml`, event is `workflow_dispatch`, status/conclusion are `completed/success`, run attempt is exactly 1, head branch is `main`, and actor plus triggering actor are `github-actions[bot]`. Do **not** compare producer head SHA to current live main.

For the existing `workflow_run` path, preserve its current event/conclusion admission unchanged.

- [ ] **Step 5: Bind the untrusted routing PR number to the downloaded protected plan**

In `Resolve protected controller and candidate identities`, after parsing `plan.prNumber`, require on explicit dispatch:

```js
if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
  if (!/^[1-9][0-9]*$/.test(process.env.UNTRUSTED_ROUTING_PR_NUMBER ?? '')) {
    throw new Error('workflow_dispatch PR routing key is malformed.');
  }
  if (Number(process.env.UNTRUSTED_ROUTING_PR_NUMBER) !== plan.prNumber) {
    throw new Error('workflow_dispatch PR routing key does not match protected plan.');
  }
}
```

Keep the existing live PR current-head fence before expensive execution.

- [ ] **Step 6: Update prior-state producer acceptance inside the executor**

Where prior exact-candidate state artifacts are restored, accept prior successful executor runs only when `run.path === '.github/workflows/protected-hosted-executor.yml'` and `run.event` is either `workflow_run` or `workflow_dispatch`; continue validating state producer run ID/attempt/path/event exactly.

- [ ] **Step 7: Run executor workflow contracts**

```bash
node --test \
  tests/verification/protected-base-advance-executor-handoff.test.mjs \
  tests/verification/protected-hosted-workflow-contract.test.mjs
```

Expected: both GREEN, including negative assertions against current-main equality and arbitrary dispatch admission.

---

### Task 4: Bind workflow_dispatch executor state and gate evidence

**Files:**
- Modify: `tools/verification/protected-verification-state.mjs`
- Modify: `tools/verification/protected-hosted-gate.mjs`
- Test: `tests/verification/protected-verification-state.test.mjs`
- Test: `tests/verification/protected-hosted-gate.test.mjs`

**Interfaces:**
- Consumes: successful protected executor run metadata already bound into `state.producer` and gate `producerRun`.
- Produces: acceptance of `workflow_dispatch` only for the same protected executor workflow path/run identity; all other producer metadata remains fail-closed.

- [ ] **Step 1: Add producer-event regression tests first**

In state tests, prove an executor state with event `workflow_dispatch` validates while a non-authoritative event remains rejected:

```js
const dispatched = state({
  producer: {
    ...state().producer,
    event: 'workflow_dispatch',
  },
});
assert.equal(dispatched.producer.event, 'workflow_dispatch');
assert.throws(() => state({
  producer: { ...state().producer, event: 'repository_dispatch' },
}), /producer event/i);
```

In gate tests, clone the existing successful executor producer fixture with `event: 'workflow_dispatch'` and corresponding state producer event, assert validation succeeds, then assert `repository_dispatch` is rejected.

- [ ] **Step 2: Run the new producer-event tests and observe RED**

```bash
node --test \
  tests/verification/protected-verification-state.test.mjs \
  tests/verification/protected-hosted-gate.test.mjs
```

Expected before implementation: `workflow_dispatch` cases fail on the event whitelist.

- [ ] **Step 3: Make the minimal event-whitelist implementation**

```js
// tools/verification/protected-verification-state.mjs
const EVENTS = new Set(['pull_request', 'workflow_run', 'workflow_dispatch']);

// tools/verification/protected-hosted-gate.mjs
const PRODUCER_EVENTS = new Set(['workflow_run', 'workflow_dispatch']);
```

Do not broaden workflow paths, repository identity, run ID/attempt matching, status/conclusion requirements, plan identity, live PR head checks, or evidence availability rules.

- [ ] **Step 4: Re-run state and gate tests**

```bash
node --test \
  tests/verification/protected-verification-state.test.mjs \
  tests/verification/protected-hosted-gate.test.mjs
```

Expected: GREEN for both normal `workflow_run` and protected `workflow_dispatch`, RED assertions for unrecognized producer events remain effective.

---

### Task 5: Full verification, exact-head integration, merge and terminal live proof

**Files:**
- Verify all files changed by Tasks 2-4 plus the approved spec/plan/test.
- No new runtime/product files.

**Interfaces:**
- Consumes: complete protected handoff implementation.
- Produces: exact-head protected evidence, squash merge, then live dispatcher/controller/executor/fan-in proof required to close #272.

- [ ] **Step 1: Run the focused anti-loop and workflow suite**

```bash
node --test \
  tests/verification/protected-base-advance-executor-handoff.test.mjs \
  tests/verification/protected-verification-lifecycle-workflow-contract.test.mjs \
  tests/verification/protected-hosted-workflow-contract.test.mjs \
  tests/verification/protected-verification-state.test.mjs \
  tests/verification/protected-hosted-gate.test.mjs
```

Expected: all PASS, zero skips attributable to the new transport path.

- [ ] **Step 2: Run all verification contract tests**

```bash
node --test tests/verification/*.test.mjs
```

Expected: PASS with zero failures. If repository CI contains additional deterministic test globs, use the exact current `.github/workflows/ci.yml` list for a final local parity run before push.

- [ ] **Step 3: Commit only after local GREEN and push with a remote-head fence**

```bash
git status --short
git add \
  .github/workflows/protected-verification-controller.yml \
  .github/workflows/protected-hosted-executor.yml \
  tools/verification/protected-verification-state.mjs \
  tools/verification/protected-hosted-gate.mjs \
  tests/verification/protected-verification-state.test.mjs \
  tests/verification/protected-hosted-gate.test.mjs
git commit -m "fix(verification): continue protected base-advance execution"
REMOTE_BEFORE="$(git ls-remote origin refs/heads/feat/issue-272-e2e-verification-anti-loop-hardening | awk '{print $1}')"
test "$REMOTE_BEFORE" = "$EXPECTED_REMOTE_HEAD"
git push origin HEAD:refs/heads/feat/issue-272-e2e-verification-anti-loop-hardening
```

If the remote head moved, stop the push, fetch, reconcile without force, rerun affected tests, and update `EXPECTED_REMOTE_HEAD` only after verifying the new combined head.

- [ ] **Step 4: Verify exact pushed head from GitHub live state**

Require exact-head CI deterministic contracts, `atlas-gate`, `provenance-gate`, CodeQL/security checks, protected controller/executor evidence, review-thread readback, mergeability, and current protected-main fence. Do not reuse checks from an older head.

- [ ] **Step 5: Mark #273 Ready and squash-merge with expected-head fencing**

Only after all current protected policy requirements are GREEN. Use the exact current #273 head as the expected merge head; no admin bypass and no merge if protected main/current-head assumptions changed incompatibly.

- [ ] **Step 6: Verify post-merge automatic base-advance chain**

On the new protected-main merge, require a real automatic chain:

```text
Protected Base Advance Dispatcher
  -> Protected Verification Controller (workflow_dispatch, attempt 1, current protected main)
  -> base-advance-handoff
  -> Protected Hosted Verification Executor (workflow_dispatch)
  -> lifecycle disposition
  -> bounded reuse / only-required hosted execution
  -> fan-in + protected verification state
```

For PR #268 specifically, confirm the controller resolves the then-current protected main rather than stale `pr.base.sha`, the executor binds the controller run/artifact and current candidate head, and no Molehill/FullWorld work occurs unless the protected plan independently requires a specialist capability.

- [ ] **Step 7: Close #272 only after terminal live proof**

Add a concise evidence comment listing merged main SHA, dispatcher run, #268 controller run, handoff/executor run, disposition, heavy execution count/reuse count, fan-in/state artifact, and absence of stale-head/no-op/requalification-loop behavior. Then close #272 as completed. If live proof exposes another authority defect, keep #272 open and classify/fix it without candidate churn or a retrigger-only commit.
