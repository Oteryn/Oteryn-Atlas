# Atlas Maintenance Freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suspend every current Atlas test, verification, scheduled depth, dispatcher, publication, deployment, and runner-health pipeline while preserving PR + Merge Queue behind an independently enforced maintenance-only diff gate.

**Architecture:** Use the organization-required `.github/workflows/merge-authority-audit.yml` as the protected-base maintenance freeze entrypoint and keep the repository-required `atlas-gate` context as a minimal Merge Queue wrapper over the same inert diff policy. Deliver in two PR/MQ stages: first establish the protected freeze, then use that protected freeze to archive and deactivate the old workflows. Candidate code is never executed by either retained gate.

**Tech Stack:** GitHub Actions, Node.js standard library, Git raw-diff inspection, GitHub PR and Merge Queue lifecycle.

**Spec:** [Oteryn-Atlas Issue #315 — Active owner direction: maintenance first](https://github.com/Oteryn/Oteryn-Atlas/issues/315)

## Global Constraints

- Authority is fresh GitHub LIVE state; the admitted base for this plan is `c9129a9e65c57a56ed63aeff061caa54e0de0868` and must be refreshed before every integration decision.
- Preserve normal pull requests, squash merge, review-thread resolution, required `atlas-gate`, and Merge Queue.
- Preserve organization ruleset `22352928` and repository ruleset `22103758`; no bypass, direct merge, or fabricated status.
- The maintenance policy runs only protected-base code and treats the candidate checkout as inert data.
- Normal maintenance permits only the closed governance/documentation path and operation allowlist defined below.
- Product/runtime/publication/deployment inputs remain frozen; mixed diffs fail closed.
- Unsafe paths, rename escapes, symlinks, submodules, executable modes, NUL/binary content, and incomplete diff enumeration fail closed.
- Existing workflow source and historical evidence are archived byte-for-byte; GitHub Actions is not disabled globally.
- `terminal-branch-lifecycle.yml` remains active because it is repository governance rather than a test, product publication, deployment, or verification pipeline.
- Restoring a test group is a later #315 phase and requires shadow qualification before blocking enforcement.

---

### Task 1: Establish the standalone maintenance diff policy with TDD

**Files:**
- Create: `tools/maintenance/verify-maintenance-diff.mjs`
- Create: `tools/maintenance/minimal-merge-group-gate.yml`
- Create: `tests/maintenance/maintenance-diff-policy.test.mjs`

**Interfaces:**
- Consumes: `node tools/maintenance/verify-maintenance-diff.mjs <trusted-base-root> <candidate-root>` plus GitHub event identity environment variables.
- Produces: exit status `0` and one JSON PASS record for a valid maintenance-only complete diff; non-zero exit with a precise error for every rejected transition.

- [ ] **Step 1: Write failing policy tests against real temporary Git repositories**

```js
test('accepts governance-only regular text changes', () => {
  const repo = fixture();
  repo.write('docs/agents/prompts/example.md', '# Prompt\n');
  assert.equal(repo.verify().status, 0);
});

test('rejects a mixed governance and runtime diff', () => {
  const repo = fixture();
  repo.write('docs/agents/prompts/example.md', '# Prompt\n');
  repo.write('web/fullworld-app.mjs', 'export const bypass = true;\n');
  assert.match(repo.verify().stderr, /maintenance path is frozen/);
});
```

Cover added/modified/removed governance text; removed obsolete governance tests; runtime/product; `.github` changes; rename both ends; symlink; executable bit; gitlink; NUL bytes; oversized file; duplicate/unsafe path; wrong base/head/tree/event identity; dirty candidate; complete-diff mismatch; complete byte-preserving workflow suspension; and partial/altered cutover rejection.

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/maintenance/maintenance-diff-policy.test.mjs`

Expected: FAIL because `tools/maintenance/verify-maintenance-diff.mjs` does not exist.

- [ ] **Step 3: Implement the minimum self-contained protected-base validator**

```js
const NORMAL_RULES = [
  {prefix: 'docs/agents/', operations: new Set(['A', 'M', 'D'])},
  {prefix: 'docs/evidence/', operations: new Set(['A', 'M', 'D'])},
  {prefix: 'tools/governance/', operations: new Set(['A', 'M', 'D'])},
  {exact: 'AGENTS.md', operations: new Set(['M'])},
];
const OBSOLETE_TEST_REMOVAL = /^tests\/(?:verification\/)?[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:mjs|js|py)$/;
```

Derive the authoritative diff with `git diff --raw -z --no-renames <base> <head>`, reject rename/copy mode, validate both tree modes, validate UTF-8 text and bounded size, and never import or execute candidate files. Bind PR/MQ identity to the supplied environment and exact checked-out commits.

- [ ] **Step 4: Run the policy tests and verify GREEN**

Run: `node --test tests/maintenance/maintenance-diff-policy.test.mjs`

Expected: all policy cases PASS with no skipped tests.

- [ ] **Step 5: Commit the standalone policy**

```bash
git add tools/maintenance/verify-maintenance-diff.mjs tests/maintenance/maintenance-diff-policy.test.mjs
git commit -m "feat(maintenance): add protected Atlas freeze policy"
```

### Task 2: Stage A — install the protected freeze entrypoint

**Files:**
- Modify: `.github/workflows/merge-authority-audit.yml`
- Modify: `AGENTS.md`
- Add: `docs/maintenance/ATLAS-MAINTENANCE-MODE.md`

**Interfaces:**
- Consumes: the Task 1 validator from the exact protected base.
- Produces: organization-required workflow `Merge authority audit / protected-base validate` that validates PR and MQ diffs without executing candidate code.

- [ ] **Step 1: Extend tests with workflow contract assertions and verify RED**

```js
test('required workflow invokes only protected-base maintenance policy', () => {
  const yaml = read('.github/workflows/merge-authority-audit.yml');
  assert.match(yaml, /node trusted-base\/tools\/maintenance\/verify-maintenance-diff\.mjs/);
  assert.doesNotMatch(yaml, /candidate\/tools\//);
  assert.doesNotMatch(yaml, /run-protected-authority-audit/);
});
```

Run: `node --test tests/maintenance/maintenance-diff-policy.test.mjs`

Expected: FAIL because the protected workflow still invokes the old verification chain.

- [ ] **Step 2: Repoint the organization-required workflow to the protected maintenance validator**

Keep `pull_request_target` and `merge_group`; check out exact protected base and inert candidate with pinned `actions/checkout`; pass explicit repository/base/head/event identity; invoke only `trusted-base/tools/maintenance/verify-maintenance-diff.mjs`.

- [ ] **Step 3: Record the active freeze contract in repository instructions**

State that product/runtime/publication/deployment inputs are frozen, normal work is limited to the closed maintenance allowlist, old tests remain present but are pending suspension until Stage B, and no status bypass is authorized.

- [ ] **Step 4: Verify Stage A locally**

Run:

```bash
node --test tests/maintenance/maintenance-diff-policy.test.mjs
git diff --check
git diff -- .github/workflows/merge-authority-audit.yml AGENTS.md docs/maintenance/ATLAS-MAINTENANCE-MODE.md
```

Expected: PASS and a reviewable Stage A-only diff.

- [ ] **Step 5: Commit, push, and create the Stage A PR governed by #315**

```bash
git add .github/workflows/merge-authority-audit.yml AGENTS.md docs/maintenance/ATLAS-MAINTENANCE-MODE.md tests/maintenance/maintenance-diff-policy.test.mjs tools/maintenance/verify-maintenance-diff.mjs
git commit -m "ci(maintenance): enforce protected Atlas freeze"
```

Create a non-draft PR to `main`, link #315, and record exact base/head. Do not merge directly.

### Task 3: Qualify and integrate Stage A through normal Merge Queue

**Files:**
- No additional repository files unless an evidence-backed defect is found.

**Interfaces:**
- Consumes: Stage A PR exact head and current rulesets.
- Produces: protected `main` where organization-required rule `22352928` executes the maintenance validator from `refs/heads/main`.

- [ ] **Step 1: Read back exact PR checks, required workflow, reviews, and rulesets**

Verify current base/head, full changed-file list, ruleset `22103758` required `atlas-gate` + Merge Queue, and organization ruleset `22352928` required workflow path.

- [ ] **Step 2: Queue the exact Stage A head without bypass**

Use GitHub Merge Queue and wait for the exact merge-group identity; do not use direct/admin merge.

- [ ] **Step 3: Verify protected-main readback**

Confirm the squash merge SHA on `main`, fetch `.github/workflows/merge-authority-audit.yml` from that SHA, and confirm it invokes only the protected maintenance validator.

### Task 4: Stage B — suspend old pipelines and install the minimal MQ context

**Files:**
- Modify: `.github/workflows/merge-group-gate.yml`
- Move byte-for-byte to `docs/maintenance/suspended-workflows/`: all workflow YAML files except `merge-authority-audit.yml`, `merge-group-gate.yml`, and `terminal-branch-lifecycle.yml`
- Modify: `docs/maintenance/ATLAS-MAINTENANCE-MODE.md`

**Interfaces:**
- Consumes: Stage A protected maintenance gate.
- Produces: minimal Merge Queue check named exactly `atlas-gate`; no existing Atlas test, depth, promotion, dispatcher, publication, deployment, CodeQL, or runner-health workflow remains active.

- [ ] **Step 1: Re-run the Stage A cutover-transition policy tests against protected main**

```js
test('accepts only a complete byte-preserving workflow suspension cutover', () => {
  const repo = fixtureWithWorkflowInventory();
  repo.archiveAllSuspendableWorkflows();
  repo.installMinimalMergeGate();
  assert.equal(repo.verify({mode: 'cutover'}).status, 0);
});

test('rejects cutover that omits one scheduled workflow', () => {
  const repo = fixtureWithWorkflowInventory();
  repo.archiveAllSuspendableWorkflowsExcept('codeql.yml');
  assert.match(repo.verify({mode: 'cutover'}).stderr, /active workflow inventory/);
});
```

Run and expect PASS because the cutover contract was independently implemented and qualified in Stage A before becoming protected authority.

- [ ] **Step 2: Exercise the generic, content-bound cutover transition**

Accept the cutover only when every protected workflow other than the three retained files is removed from `.github/workflows/` and copied to `docs/maintenance/suspended-workflows/` with the identical protected blob. Require the retained audit workflow to be unchanged. Require the candidate `merge-group-gate.yml` to equal the protected `tools/maintenance/minimal-merge-group-gate.yml` template byte-for-byte. Reject partial inventories, changed archived bytes, added active workflows, and any unrelated path.

- [ ] **Step 3: Replace heavy `atlas-gate` with inert protected-base validation**

The only job name is `atlas-gate`; trigger only on `merge_group: checks_requested`; check out exact protected base and candidate without credentials; invoke `trusted-base/tools/maintenance/verify-maintenance-diff.mjs`; do not run Docker, Python, npm, Playwright, browser, fixture, FullWorld, publication, or candidate script.

- [ ] **Step 4: Archive and deactivate 25 workflows**

Archive:

```text
ci.yml
codeql.yml
creature-gameplay-profiles.yml
creature-overlays.yml
docker-e2e.yml
legacy-molehill-transition-qualification.yml
mobile-layout.yml
protected-admission.yml
protected-base-advance-dispatcher.yml
protected-bounded-real-identity-repin.yml
protected-execution-promotion-qualification.yml
protected-hosted-compose-promotion.yml
protected-hosted-executor.yml
protected-hosted-fan-in-promotion.yml
protected-hosted-readiness-reentry-promotion.yml
protected-hosted-readiness-wiring-promotion.yml
protected-main-depth.yml
protected-publication-readiness-promotion.yml
protected-qualification-product-promotion.yml
protected-qualification-repair.yml
protected-verification-controller.yml
semantic-search.yml
synology-live-acceptance.yml
synology-runner-health.yml
verification-depth.yml
```

- [ ] **Step 5: Verify Stage B without running retired suites**

Run:

```bash
node --test tests/maintenance/maintenance-diff-policy.test.mjs
git diff --check
find .github/workflows -maxdepth 1 -type f -name '*.yml' -printf '%f\n' | sort
git diff --summary
```

Expected active inventory: `merge-authority-audit.yml`, `merge-group-gate.yml`, and `terminal-branch-lifecycle.yml` only. Expected policy suite: PASS. Every archived workflow blob must equal its protected source blob.

- [ ] **Step 6: Commit and push Stage B as a separate PR**

Use a second dedicated branch/worktree from the Stage A protected-main SHA. Link #315 and explicitly state that Stage B is the meaningful maintenance/MQ canary.

### Task 5: Prove Stage B in PR and Merge Queue, then read back the terminal state

**Files:**
- No additional repository files unless the protected gate exposes a defect.

**Interfaces:**
- Consumes: Stage B exact PR head, protected Stage A gate, and both active rulesets.
- Produces: protected-main maintenance state with no active test/deployment pipelines and a working PR/MQ safety gate.

- [ ] **Step 1: Verify the PR event uses the Stage A protected-base workflow**

Confirm the organization-required workflow passes by executing `trusted-base/tools/maintenance/verify-maintenance-diff.mjs` and no retired test suite is used as acceptance evidence.

- [ ] **Step 2: Enqueue through Merge Queue and verify both retained gates**

Confirm organization-required maintenance audit PASS and repository-required `atlas-gate` PASS for the exact merge-group SHA. Ensure no old browser, Docker, deterministic test, CodeQL, depth, dispatcher, publication, deployment, or runner workflow starts for the merge group.

- [ ] **Step 3: Verify protected-main terminal readback**

Read the merged SHA and exact active workflow directory; verify both rulesets remain active and unchanged; verify the issue records maintenance as active rather than merely planned.

- [ ] **Step 4: Update #315 with exact evidence**

Record Stage A and Stage B PR numbers, head and merge SHAs, required workflow/check run IDs, active workflow inventory, unchanged ruleset IDs, and remaining downstream work: #140 cleanup first, then incremental shadow restoration.

### Task 6: Final verification before completion claim

**Files:**
- No changes.

**Interfaces:**
- Consumes: protected-main and GitHub LIVE state.
- Produces: evidence-backed completion report for only the maintenance cutover.

- [ ] **Step 1: Re-fetch `main`, #315, both PRs, checks, and both rulesets**

- [ ] **Step 2: Confirm exactly three active workflow YAML files and 25 byte-preserved archived workflows**

- [ ] **Step 3: Confirm product/runtime and deployment changes are rejected by a real or fixture-bound gate proof**

- [ ] **Step 4: Confirm governance-only PR/MQ canary merged normally**

- [ ] **Step 5: Report unknowns or blockers precisely; do not claim #140 or test restoration complete**
