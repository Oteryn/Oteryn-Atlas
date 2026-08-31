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
primary_pull_request: 273
protected_cutover_pull_request: 274
protected_cutover_main_sha: b285c4d57d48cbc70bca54619849b7f7cfd423f6
protected_stabilization_pull_request: 276
protected_stabilized_main_sha: f8de8e42ca57112cf71100aa19322ef22527b168
status: PRIMARY_PR_EXACT_HEAD_VERIFICATION_PENDING
normative_design: docs/superpowers/specs/2026-08-30-atlas-e2e-verification-anti-loop-hardening-design.md
implementation_plan: docs/superpowers/plans/2026-08-30-atlas-e2e-verification-anti-loop-hardening.md
```

> GitHub live state is the source of truth. This checkpoint replaces the earlier incomplete audit. Never use this document to override a newer GitHub head, check, review, issue or branch-protection state.

## Objective

Eliminate the serial verification loop in which authority/environment defects caused candidate churn, one-off bootstrap PRs, repeated main reintegration and repeated full E2E. Preserve exact-head fencing, protected lower-bound planning, retries=0, exact stable-ID equality, immutable product identity, verification-profile/data-capability separation, GitHub-hosted ordinary E2E, specialist-only Molehill, deployment-only Synology, `atlas-gate` and `provenance-gate`.

## Protected implementation state

### FACT

Protected cutover PR #274 was merged normally through branch protection as:

`main@b285c4d57d48cbc70bca54619849b7f7cfd423f6`

No admin bypass, force-push or no-op commit was used.

A final protected environment/control-plane correction was then consolidated into PR #276 and normally squash-merged through the same protection as:

`main@f8de8e42ca57112cf71100aa19322ef22527b168`

The correction fixed the one-shot environment artifact ownership handoff, completed strict `profile=none` zero-work lifecycle/fan-in semantics, and bound the retained transition widening to an independently built protected lower-bound plan. Its exact candidate head `5cc3c467c07119cad9bd3098b28aba4a312a02d0` passed 468/468 deterministic tests, provenance 144/144, CodeQL Actions/JavaScript/Python, 77/77 zero-retry transition scenarios, 17/17 reviewed canonical frames, `Protected Hosted Playwright evidence` and `atlas-gate`.

The protected cutover contains the active anti-loop architecture:

- canonical content-derived verification authority identity;
- canonical protected execution-environment identity and bounded qualification;
- distinct `planSemanticDigest` and forensic `planInstanceDigest`;
- executable `REUSE`, `PARTIAL_RERUN`, `FULL_RERUN`, `REINTEGRATE` dispositions;
- machine-readable failure ownership;
- persisted progress and circuit-breaker state;
- versioned evidence manifests with semantic and instance digests;
- dependency-bound evidence reuse with byte-availability checks;
- one validator path for `EXECUTED` and `REUSED` evidence;
- protected lifecycle/state fan-in and hosted gate;
- active base-advance dispatcher;
- protected controller -> executor trust boundary with no candidate self-promotion;
- candidate census materialized as inert `git archive` bytes and executed only in a no-network/read-only/cap-drop sandbox;
- Phase E semantic experiment identity;
- Phase F selector/specialist-obligation reuse safety.

## Exact cutover verification evidence

Final cutover head before squash merge:

`4eb9b886b57dbe0e5b1e51014ba12bc1afd83c69`

Fresh evidence on that exact head:

- local deterministic verification: `459/459 PASS`;
- extraction provenance: `144/144 PASS`;
- `git diff --check`: PASS;
- GitHub deterministic verification job: SUCCESS;
- Extraction Provenance workflow: SUCCESS;
- CodeQL: SUCCESS for Actions, JavaScript/TypeScript and Python;
- Docker E2E Harness: SUCCESS;
- protected legacy transition plan: exactly 77 stable IDs;
- retained transition capabilities: `qualification_fixture`, `bounded_real_world`, `real_fullworld`;
- `requiresRealFullWorld=true` only because the retained transition includes the explicit specialist animation census;
- heavy transition capture: 77/77 scenarios PASS, workers=1, retries=0;
- exact verification-plan SHA: `sha256:8d56ed3f45a0e1d2d8b5da21e3128641605d3ff25ba6b72ae3063338d7c49f4f`;
- 17/17 canonical visual frames independently opened and reviewed;
- reviewed summary SHA: `sha256:ccf1b705320e61bbf3a3bd8363cbec5e80bb3aa4ee33bcc6f4267a173cf16a11`;
- repository-native protected publisher revalidated the exact head, plan, merge-base, 77-ID census, review and screenshot digests and published `atlas-local-e2e=success`;
- CI rerun consumed that exact evidence: `Protected Hosted Playwright evidence` SUCCESS and `atlas-gate` SUCCESS;
- review threads: none;
- required branch checks at merge: `provenance-gate` and `atlas-gate`, both satisfied.

The GitHub Actions publication job itself recorded a transport-level `gh api --input -` HTTP 400 after all evidence validation had succeeded. The same protected repository publisher was then executed on the repository-approved Molehill runner from the exact clean remote head; it repeated all validation and published the status successfully. This was not a branch-protection or admin bypass.

## Trust-boundary correction discovered during closeout

CodeQL detected a high-severity candidate-checkout pattern in the `pull_request_target` controller. The controller was hardened before cutover:

- privileged `git worktree add` candidate checkout was removed;
- candidate bytes are materialized with `git archive "$ATLAS_CANDIDATE_HEAD_SHA" | tar -x ...`;
- candidate Playwright census still executes only in the protected no-network, read-only, cap-dropped sandbox;
- deterministic regression contracts explicitly forbid privileged candidate worktree checkout;
- final CodeQL on the corrected exact head is GREEN.

## Base-advance / evidence behavior now executable

Deterministic integration contracts prove:

- unrelated protected-base movement can `REUSE` valid evidence with zero heavy rerun;
- product-only movement reruns only evidence that consumes the changed product;
- authority/environment changes invalidate dependent evidence fail-closed;
- merge conflict / candidate integration incompatibility produces `REINTEGRATE`;
- revoked, expired, unavailable, dependency-missing or digest-mismatched evidence cannot be reused;
- repeated identical deterministic failures with unchanged semantic inputs enter `STALLED` rather than retriggering;
- repeated serial control-plane defects reach `ARCHITECTURE_STABILIZATION_REQUIRED`;
- authority/environment failures cannot recommend candidate mutation.

## Promotion/bootstrap inventory

The detailed inventory is preserved at:

`docs/testing/ATLAS-E2E-ANTI-LOOP-PROMOTION-PHASE-EF-AUDIT-2026-08-30.md`

Historical promotion workflows are not deleted merely because their original caller merged. `protected-execution-promotion-qualification.yml` still has a live parent-programme caller (#268), so it remains protected until that responsibility is retired. The exact-base `ci.yml` compatibility tombstone was repinned once to pre-correction protected SHA `b285c4d57d48cbc70bca54619849b7f7cfd423f6` for #276. After #276 advanced `main` to `f8de8e42ca57112cf71100aa19322ef22527b168`, that fallback is again functionally unreachable without forbidden history rewriting and is not widened by #273.

## Phase E / Phase F adoption

Phase E contract:

- benchmark repetition identity depends on candidate/harness/authority/environment/product/policy/workload/selector semantic inputs, not unrelated whole-main SHA movement.

Phase F contract:

- planner/catalog/census identity and exact stable-ID/specialist obligations are reuse inputs;
- any new/removed required stable ID or specialist obligation invalidates reuse;
- `force-full` and `SELECTOR_ESCAPE` remain widening-only.

PR #217 and PR #219 remain Draft preparation lanes. This task supplies the semantic safety model; it does not claim Phase E calibration or enable Phase F selective savings. GitHub live state shows parent programme #179 already closed/completed at 2026-08-31T05:56:40Z; this task did not close or reopen it.

## Primary PR #273 closeout boundary

After integrating protected `main@f8de8e42ca57112cf71100aa19322ef22527b168`, the primary branch has no delta in `verification-authority-manifest.json` authority paths. Its remaining net delta is documentation/audit only. GitHub live state also shows Issue #272 already closed/completed at 2026-08-31T08:35:01Z; terminal closeout must verify that state after #273 merge rather than assuming it from this checkpoint.

Before #273 merge, GitHub must still prove on the exact published head:

1. deterministic repository verification GREEN;
2. protected controller plan GREEN;
3. the protected lifecycle independently proves zero executable evidence obligations for the final documentation-only delta, so environment/browser work is skipped rather than rerun;
4. hosted executor fan-in/state GREEN with `REUSE`, exact empty evidence set and heavy executions = 0;
5. `Protected Hosted Playwright evidence` GREEN;
6. `atlas-gate` and `provenance-gate` GREEN;
7. applicable CodeQL/security GREEN;
8. no unresolved review threads;
9. exact-head expected-head normal merge;
10. post-merge `main` readback and required-check verification.

Issue #272 may close only after those terminal steps. Issue #179 must not be closed by this task.
