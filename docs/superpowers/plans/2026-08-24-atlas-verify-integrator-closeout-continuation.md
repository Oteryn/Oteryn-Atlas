# Atlas Verify Integrator Closeout Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish `Oteryn/Oteryn-Atlas#85` without bypassing any exact-head, browser, provenance, security, live-deployment or nightly-depth gate.

**Architecture:** Treat GitHub as authority, Molehill-PC as the serialized heavy-browser runner, and Synology as merged-main live acceptance only. Repair discovered harness defects with TDD, integrate all #85-owned follow-ups, and qualify one exact final `main` revision before closing lifecycle issues.

**Tech Stack:** GitHub Actions, PowerShell/Windows PowerShell, Python TCP forwarder, Docker Desktop/Compose, Playwright, Node `node:test`, Synology live publication.

**Spec:** `docs/agents/tasks/active/ATLAS-VERIFY-INTEGRATOR-CLOSEOUT.md`

## Global Constraints

- Follow `AGENTS.md` and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`.
- Oteryn-Game is read-only for this closeout.
- Never fabricate/copy `atlas-local-e2e`; use the repository publisher only after exact all-pass evidence.
- Workers=1 and retries=0 for the required Molehill browser gate.
- Every newly reproducible defect gets a permanent regression before its fix.
- Never weaken assertions, tolerances, timeouts, allowlists, provenance or deployment authority to obtain green status.
- Re-read GitHub `main`, open issues and PR heads before every mutation or merge.
---

### Task 1: Refresh PR #126 and preserve the failed-run evidence

**Files:**
- Modify if needed after rebase: `.github/workflows/verification-depth.yml`
- Modify if needed after rebase: `tests/verification/ci-workflow-contract.test.mjs`
- Evidence: `artifacts/e2e/atlas126-final-c73d3ff/summary.json` on Molehill-PC

- [ ] Refresh GitHub `main`, #85, #105, #109, PR #126, PR #118 and Issue #121.
- [ ] Rebase `fix/issue-109-molehill-shell` onto the exact current `main`; resolve conflicts without weakening the four `powershell` declarations or their regression.
- [ ] Verify effective diff and `git diff --check`.
- [ ] Preserve the recorded 47/48 failure; do not overwrite or describe it as flaky success.
- [ ] Run the focused workflow-contract test and full deterministic matrix on the rebased head.
- [ ] Commit/push only if the remote branch and worktree identity match PR #126.
### Task 2: Classify the publication-forwarder interruption correctly

**Files:**
- Inspect: `e2e/run.ps1`
- Inspect: `e2e/local-publication-forwarder.py`
- Test only if reproducible defect exists: `tests/verification/*.test.mjs` or a focused executable forwarder regression

- [ ] Prove Molehill has no competing `*-e2e-1` container, heavy Playwright process, or foreign cleanup process before reproduction.
- [ ] Account for the current status of PR #118, because it introduces machine-wide serialization for heavy Molehill qualification.
- [ ] Reproduce the failing seed `133`, first action index `7`, only through a controlled serialized run; do not retry the whole suite merely to seek green.
- [ ] Correlate Nginx, forwarder stdout/stderr, process lifetime and direct Synology reachability.
- [ ] If reproducible, write a regression that fails before changing forwarder/lifecycle code; then implement the minimum fix and prove GREEN.
- [ ] If not reproducible and evidence identifies external interruption, record that classification and retain the original failure evidence.
### Task 3: Finish and merge PR #126 through normal protection

- [ ] On the exact final PR #126 head, run the repository-required current Playwright count (50 after merged #112), checkout-overlay, workers=1, retries=0.
- [ ] Validate `summary.json`: `status=passed`, exact expected revision, all scenarios PASS, no retry.
- [ ] Publish `atlas-local-e2e` only with `e2e/publish-local-e2e-status.ps1` and only after all publisher preconditions pass.
- [ ] Require exact-head deterministic/repository/semantic/WebGL checks, CodeQL, `provenance-gate` and `atlas-gate` SUCCESS.
- [ ] Review the full final diff and review threads.
- [ ] Squash merge using expected-head protection; delete the task branch.
- [ ] Keep #109 open until post-merge nightly + live acceptance succeed.

### Task 4: Integrate remaining #85 follow-ups

- [ ] Finish PR #118 / Issue #111 from the then-current main, including exact reviewed visual evidence and normal protected gates.
- [ ] Verify all 15 required full-frame visual scenarios are actually reviewed at the exact final head before publishing its local status.
- [ ] Finish Issue #121 Firefox/WebKit depth after #111. Prove actual pinned-image engine launches and representative desktop/mobile-like journeys; zero retries.
- [ ] If cross-engine testing discovers a product defect, add a permanent regression before the fix.
- [ ] Re-run applicable hosted and Molehill gates after each material base/head change.
### Task 5: Final exact-main qualification and lifecycle closeout

- [ ] Refresh `main` after the last verification-related merge and freeze the exact SHA used for final acceptance.
- [ ] Require post-merge CI, deterministic verification, CodeQL/security and `provenance-gate` SUCCESS on that exact SHA.
- [ ] Require Synology Live Acceptance SUCCESS on the same SHA and verify `X-Oteryn-Atlas-Revision` equals exact current main.
- [ ] Manually dispatch `Verification Nightly Depth` on that same main SHA.
- [ ] Require deterministic nightly SUCCESS and Molehill browser-depth SUCCESS, preserving seeds `133`, `1096043585`, `2779096485`, `3735928559`, bounded artifacts and zero hidden retries.
- [ ] Capture workflow run/job/artifact IDs, exact test counts, relevant digests and explicit skip reasons if a category is genuinely non-applicable.
- [ ] Close #109 and #105 only after their exact acceptance criteria are evidenced.
- [ ] Add a line-by-line Definition-of-Done evidence comment to #85 mapping every checkbox to exact SHAs/runs/artifacts.
- [ ] Re-fetch `main` immediately before closure. If it moved materially, requalify the new exact main instead of closing against stale evidence.
- [ ] Close #85 as completed only when all applicable criteria and parent-programme follow-ups are terminal.

## Completion evidence

The continuation is complete only when GitHub shows #85 CLOSED/completed and the terminal evidence names one exact final main SHA that is simultaneously CI/provenance/security qualified, live-served on Synology, and nightly-depth qualified. A partial green state is not completion.