# Atlas Verification Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use TDD for every new behavior. This plan is intentionally one serial implementation lane.

**Goal:** Make the protected functional qualification baseline usable from current main and remove the self-bootstrap that made verification repairs require their own failing browser baseline.

**Architecture:** Land the measured functional qualification fixture as a clean current-main change, make the remaining creature runtime consumer trust-aware, narrow pure verification tests to deterministic-only classification, then prove the resulting exact candidate. Historical recovery branches are provenance only.

**Tech Stack:** Node.js ESM, Playwright, GitHub Actions, JSON verification policy.

**Spec:** `docs/superpowers/specs/2026-09-03-atlas-verification-simplification-design.md`

## Global Constraints

- Protected browser qualification: workers=1, retries=0.
- No `real_fullworld` requirement for ordinary fixture-capable functional oracles.
- No fake production identity in qualification data.
- No branch protection/ruleset weakening beyond the already-authorized temporary PR-only maintenance bypass.
- No force/rebase/reset and no resurrection of retired recovery PRs.

---

### Task 1: Restore the functional qualification baseline

**Files:** the exact 29-file effective functional-fixture delta previously measured on retired #268.

- [ ] Materialize those exact file versions on a new branch whose parent is current protected main; do not merge/cherry-pick old branch history.
- [ ] Verify the effective file census remains exactly the intended functional fixture/test/runtime set.
- [ ] Verify the rebuilt qualification product identity is deterministic and matches the committed protected identity.

### Task 2: Make creature source validation trust-aware

**Files:**
- Modify: `web/fullworld-creatures.mjs`
- Test: `tests/verification/qualification-semantic-source-trust.test.mjs`

- [ ] Add a regression asserting qualification creature expectations are fixture-owned and production expectations remain the existing Game-owned contract.
- [ ] Change the creature runtime to derive expected contract/capability/semantic digest/NPC role schema from `ancillarySourceExpectations(FULLWORLD_TRUST).creatures`.
- [ ] Preserve appearance/outfit root matching, bounded JSON limits and all existing search/chunk validation.

### Task 3: Remove verification-test self-recursion

**Files:**
- Modify: `tools/verification/impact-manifest.json`
- Test: `tests/verification/impact-classifier.test.mjs` or the existing impact-manifest contract test owning this rule.

- [ ] Add/adjust regression proving `tests/verification/**` resolves to `focused + deterministic.core` without `e2e.full`.
- [ ] Add/retain regression proving `tools/verification/**` and protected workflow changes remain `full + e2e.full`.
- [ ] Apply the minimal manifest change.

### Task 4: Validate the clean exact candidate

- [ ] Run deterministic verification suite and require zero failures.
- [ ] Run syntax/diff checks for touched JS/MJS/JSON/YAML.
- [ ] Run CodeQL and repository-required non-browser checks on the exact PR head.
- [ ] Run the complete GitHub-hosted qualification Chromium safety net, workers=1/retries=0, against the functional qualification product. Record exact pass/fail census.
- [ ] Perform whole-diff self-review and independent Codex review; require P0=0/P1=0/P2=0 before maintenance merge.

### Task 5: Maintenance merge and protection restoration

- [ ] Squash merge the one clean PR using the repository owner's temporary `pull_requests_only` bypass only if the old `atlas-gate` remains self-blocked while all replacement evidence is green.
- [ ] Verify the exact new protected-main SHA and run the new protected qualification baseline on merged main.
- [ ] Verify a representative pure verification-test change plans deterministic-only and a representative runtime change plans ordinary qualification E2E.
- [ ] Remove the temporary bypass actor from the `Protect main` ruleset immediately after the new main is proven healthy.
