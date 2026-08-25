# ATLAS-CREATURE-PRESENTATION-INTEGRATOR-RESUME

ALIAS:
`ATLAS-CREATURE-PRESENTATION-INTEGRATOR-RESUME`

MODE:
Autonomous continuation + defect recovery + exact-head verification + protected merge + lifecycle closeout.

DO NOT START A SECOND IMPLEMENTATION.
DO NOT OPEN A SECOND #115 IMPLEMENTATION PR WHILE THE EXISTING CONTINUATION IS RECOVERABLE.
DO NOT STOP AT AUDIT, FAILURE CLASSIFICATION, OR PARTIAL GREEN CHECKS.

## Mission

Resume and finish the existing Oteryn Atlas Issue #115 implementation through its already-established integration lifecycle. The expected canonical continuation is PR #163 on branch `feat/issue-115-creature-label-badge-ux`, created by `ATLAS-CREATURE-PRESENTATION-INTEGRATOR` after the four parallel workers delivered their handoffs.

Your job is to take the current GitHub state as authority, preserve valid work already present, repair any real regressions with RED -> GREEN evidence, complete shared runtime integration and visual acceptance, satisfy exact-head protection, squash-merge the single implementation PR, and close Issue #115 only when its Definition of Done is actually satisfied.

This is a continuation prompt, not permission to redesign the feature from scratch.

Oteryn-Game remains canonical World/Content authority and MUST NOT be mutated by this task.

## Canonical authority

Repository:
`https://github.com/Oteryn/Oteryn-Atlas`

Lifecycle Issue:
`Oteryn/Oteryn-Atlas#115`

Existing implementation PR:
`Oteryn/Oteryn-Atlas#163`

Expected implementation branch:
`feat/issue-115-creature-label-badge-ux`

Read current-main versions first:
- root `AGENTS.md`;
- `docs/agents/prompts/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
- `docs/agents/prompts/ATLAS-CREATURE-PRESENTATION-INTEGRATOR.md`;
- `docs/agents/prompts/ATLAS-CREATURE-PRESENTATION-PARALLEL-AGENT-SUITE.md`;
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`;
- Issue #115;
- Issue #113 and its merged implementation evidence;
- current #111/#118 visual-user acceptance authority;
- any currently active creature animation/presentation PRs that overlap `web/fullworld-creatures.mjs`, presentation geometry, diagnostics, FullWorld view/LOD, or E2E.

## Creation-time snapshot — historical evidence only

At creation of this continuation prompt, the observed state was:
- Atlas `main`: `8d28fb5ea2f9b4937c517490073b1e14ab9efc58`;
- PR #163: OPEN, DRAFT, mergeable;
- PR #163 branch: `feat/issue-115-creature-label-badge-ux`;
- PR #163 previously failed the `Deterministic verification contracts` job on head `93dea80e8e06956ee6f66a9984cdb6bfa27cbcbf`, specifically in the `Run deterministic Atlas verification suite` step;
- PR #163 subsequently advanced to observed head `aff12f22ff206c0c90d8fb63937435e8b95e4154`;
- on that newer observed head, fresh GitHub checks had started and `Deterministic verification contracts` was still in progress at snapshot time;
- PR #163 already contained runtime integration work, not only worker fan-in;
- Issue #115 remained OPEN.

These SHAs and statuses are NOT execution authority. Refresh GitHub before every mutation and use the exact current remote state.

## Worker provenance to preserve and revalidate

The integration originated from these worker branches/observed handoff heads:
- geometry/layout: `work/115-presentation-geometry-layout` @ `6825c8826ef5ac403270bfaebc8e08673ee07b4e`;
- NPC badges v2: `work/115-npc-functional-badges-v2` @ `ea7c29d9859ac520ebcaba4a8ce80170e711e72b`;
- creature LOD: `work/115-creature-presentation-lod` @ `31640ffe379ae1f11dc4f04ee2d3b0be8002d53b`;
- independent verification: `work/115-creature-presentation-verification` @ `3341a510ee7ca3145dba714062980c43e4e82057`.

Re-resolve each branch from GitHub before relying on it. Do not replace already-integrated reviewed code with stale worker content merely because a historical SHA is listed here.

## Mandatory GitHub-first resume gate

Before local execution or mutation:
1. Resolve current `main` SHA and branch protection from GitHub.
2. Refresh Issue #115 state and complete body.
3. Refresh PR #163 state, draft status, exact base/head SHAs, changed-file list, reviews, review threads, checks and workflow runs.
4. Confirm the exact remote head of `feat/issue-115-creature-label-badge-ux`.
5. Search for overlapping open PRs/branches that touch creature presentation, animation, geometry, diagnostics, FullWorld mode/LOD or the E2E harness.
6. Refresh #113 and use its merged canonical interaction/presentation geometry instead of creating a second hit-test or selection authority.
7. Confirm the parallel-suite/integrator prompts are on current `main`.
8. Inspect the full PR #163 diff against current `main`; do not trust old summaries.

If another actor advanced PR #163, continue from the new remote head after reviewing the delta. Never reset the branch backward to the creation-time snapshot.

If `main` advanced, integrate current `main` forward into the PR branch using the repository-safe method appropriate to current policy. Do not discard newer main work. If history rewriting is actually required, use exact remote-head lease semantics and never blind-force-push.

## Existing PR continuity rules

### Normal case — PR #163 is open

Continue PR #163 and its existing branch. Do not create a replacement implementation PR.

Preserve all valid existing implementation commits and fix forward from the exact current head.

### If PR #163 is already merged

Do not reimplement the feature. Verify the merged SHA, merged-main required checks and Issue #115 state. Perform only missing terminal closeout that is still authorized and evidence-backed.

### If PR #163 was closed unmerged

Determine why from GitHub evidence. If #115 is still open and the implementation branch/head is recoverable, recover that exact intended work into one continuation branch/PR only after reconciling with current `main`. Do not start a parallel rewrite.

If recovery would overwrite newer unrelated work or ownership is ambiguous, fail closed and report the exact blocker rather than guessing.

## First priority — resolve the current deterministic failure

Do not rerun CI repeatedly hoping for green.

1. Inspect the latest failing PR #163 workflow/job logs and exact test failure output.
2. Reproduce the failure on the exact current PR head using the repository-prescribed deterministic command.
3. Classify whether the failure is:
   - a real #115 product/runtime defect;
   - a test-contract defect;
   - stale fixture/publication evidence;
   - main drift/integration drift;
   - an external dependency/infrastructure failure.
4. For any reproducible product or test defect, add or retain a permanent regression that is RED for the expected reason before the fix.
5. Apply the smallest architecture-consistent fix.
6. Re-run the focused failing test, then the complete deterministic suite required for the changed paths.
7. Do not weaken assertions, tolerances, timeouts, retries, coverage, provenance, fail-closed behavior or required gates just to obtain green.

External publication/network failures must remain visible and be classified separately from product regressions.

## Required final #115 behavior

Finish the existing implementation so current Issue #115 is satisfied generically for all published NPCs and monsters:
- canonical CSS-pixel creature presentation bounds are reused from the accepted shared geometry seam;
- label presentation uses bounded deterministic layout, ellipsis and collision suppression;
- `functional-icons-v2` truthfully represents NPC factual roles including 0/1/2/3/>3 role cases and exact overflow;
- active factual NPC role filter remains visibly represented under overflow;
- effective presentation LOD is mode-aware and follows the canonical AUTO/effective-representation decision without duplicating AUTO thresholds;
- selected/hovered promotion respects canonical #113 state;
- labels/badges avoid viewport edges and actual reserved HUD/card rectangles;
- DPR 1/2 CSS-pixel geometry is correct with no double scaling;
- animation-frame-only changes do not churn text measurement/collision layout when stable geometry is unchanged;
- diagnostics are versioned and truthful, including `creature-labels-v1`, `functional-icons-v2`, labels considered/drawn/suppressed, `drawnNpcBadges`, compatible `drawnNpcIcons`, effective presentation, layout generation/key and bounded presentation/label/badge rectangles;
- existing selection, deep link, filters, inspector and #113 interaction/card behavior remain intact;
- no Game-owned creature facts or roles are invented;
- no proprietary copied Tibia/CipSoft icon art is introduced.

Named creatures such as Albinius and Eremo are acceptance fixtures only. Production behavior must never branch on fixture name, record ID, coordinate or other fixture-specific identity.

## #113 and concurrent animation coexistence

Issue #113 is expected to be merged and owns click/tap, hover, hit testing, selection and contextual card interaction. Reuse its canonical geometry/state and do not create duplicate interaction ownership.

Refresh any current walking-in-place/creature animation work before finalizing #115. If overlapping work has merged into `main`, reconcile it explicitly and requalify the resulting exact PR head. Do not silently overwrite animation behavior, presentation geometry or diagnostics introduced after PR #163 began.

## Heavy browser execution policy

Follow current `AGENTS.md` and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` exactly.

Molehill-PC owns the heavy exact-head PR browser qualification. Run it through the repository wrapper (`e2e/run.ps1` or its current accepted successor) so the machine-wide heavy-E2E lock serializes execution.

Do NOT launch a competing full browser matrix while another heavy Atlas E2E run holds the lock. Wait for the canonical wrapper instead of bypassing serialization.

Use the exact worker/retry policy required by current repository rules; do not introduce retries or tolerance widening to mask deterministic failures.

Synology is not a substitute for the heavy PR qualification. This task does not grant production deployment authority.

## Required deterministic and browser evidence

Before PR #163 can become merge-ready, obtain fresh exact-head evidence required by current policy, including all applicable layers for the final diff.

At minimum verify and actually inspect user-facing evidence for:
- mixed NPC + monster presentation;
- several nearby NPCs;
- exact-head revalidated two-role NPC;
- exact-head revalidated >3-role NPC and exact overflow;
- active role filter that would otherwise be overflow-hidden;
- dense monster scene;
- real long name near viewport edge;
- map far/medium/close LOD;
- forced minimap and classic sparse presentation;
- AUTO in both effective presentation states;
- overview behavior;
- selected deep link and reload;
- #113 hover/card coexistence;
- pan, zoom, floor and resize synchronization;
- animation on/off with no avoidable label-layout churn;
- DPR 1 desktop and DPR 2/mobile;
- HUD/card non-occlusion;
- no unexpected console/page/runtime errors.

Generating screenshots is not acceptance. Open and review the required full-frame evidence and bind the review to the exact final PR head and exact Playwright summary according to current policy.

## PR #163 finalization

Keep one implementation PR for #115.

Before marking it ready for review:
1. ensure its body describes the final shipped implementation rather than an obsolete "current draft phase";
2. record the refreshed final base/head SHAs;
3. record consumed worker handoff SHAs actually used;
4. record the exact deterministic and browser qualification results;
5. record exact-head visual review evidence;
6. state that Oteryn-Game was not mutated;
7. state the deployment boundary explicitly;
8. use `Closes #115` only when the PR merge plus required merged-main verification will satisfy the Issue Definition of Done.

After any code-changing update, treat previous exact-head browser/visual evidence as stale and requalify the new head where current policy requires it.

## Protected merge gate

Do not merge while PR #163 is draft, while required review threads remain unresolved, or while any required exact-head check is failing/pending.

Required protected status includes current branch-protection checks such as `atlas-gate` and `provenance-gate` and every other required check active at execution time.

When all required evidence is current and green:
1. mark PR #163 ready for review if still draft;
2. refresh checks/reviews/mergeability one final time;
3. squash-merge through protected `main` only;
4. verify the resulting merged SHA is present on current `main`;
5. verify required merged-main checks relevant to the closeout;
6. close #115 only when the Issue Definition of Done is satisfied;
7. delete the completed implementation branch unless current repository policy or provenance explicitly requires retaining it.

Never bypass branch protection, manufacture statuses, dismiss valid failures, or push product work directly to `main`.

## Deployment boundary

NO LIVE/PRODUCTION DEPLOYMENT IS AUTHORIZED BY THIS PROMPT.

Do not deploy or cut over Synology/live Atlas as part of this task unless the owner gives separate explicit deployment authorization at execution time. A successful code merge is not implicit deployment permission.

## Final report

Return one terminal report containing:
- refreshed starting `main` and PR #163 head;
- any main drift/overlap reconciled;
- root cause of the observed deterministic failure and retained regression evidence;
- final PR head and merged SHA;
- consumed worker SHAs;
- exact deterministic verification commands and pass/fail counts;
- exact Molehill/browser qualification summary;
- visual evidence review summary;
- final required GitHub checks and review state;
- PR #163 final state;
- Issue #115 final state;
- branch disposition;
- deployment state and authorization boundary;
- confirmation that behavior is generic for all published NPCs/monsters and that Oteryn-Game was not mutated.
