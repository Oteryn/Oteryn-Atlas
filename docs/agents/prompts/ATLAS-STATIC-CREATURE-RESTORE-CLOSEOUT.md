ALIAS:
ATLAS-STATIC-CREATURE-RESTORE-CLOSEOUT

MODE:
Autonomous verification + integration + merge + deployment + live acceptance closeout.

DO NOT STOP AT AUDIT, ANALYSIS, TESTING OR PR REVIEW.
FINISH THE EXISTING TASK COMPLETELY.

==================================================
REPOSITORY
==================================================

Atlas:
https://github.com/Oteryn/Oteryn-Atlas

Canonical Game authority:
https://github.com/Oteryn/Oteryn-Game

IMPORTANT:
This task is Atlas-side.
Do NOT modify Oteryn-Game.

==================================================
EXISTING LIFECYCLE — DO NOT DUPLICATE
==================================================

Continue the EXISTING issue and PR.

Issue:
https://github.com/Oteryn/Oteryn-Atlas/issues/130

PR:
https://github.com/Oteryn/Oteryn-Atlas/pull/134

Branch:
fix/issue-130-static-creature-restore

Known PR head at handoff:
e779f82c92fdb26cd74783781150a9744e021a90

Known PR base at handoff:
b8235bd4f46947aa54dfc2f19c96d3bc21e64283

IMPORTANT:
Repository is highly concurrent.
REFRESH GitHub and origin/main before doing anything.
Do not assume the SHAs above are still current.

Do NOT create another issue.
Do NOT create another competing fix branch.
Do NOT abandon PR #134 and replace it unless repository state makes that strictly necessary.

If main advanced:
- inspect whether PR #134 is still cleanly mergeable;
- update/rebase the existing branch according to repository policy if needed;
- any changed PR HEAD invalidates previous exact-head browser evidence, so rerun all required exact-head qualification.

==================================================
ORIGINAL FAILURE
==================================================

Merged PR #112 / Issue #108 introduced stronger creature animation coverage.

Merged commit:
319d85c36ffa626403adf2b701748c13eac1592b

Post-merge Synology Live Acceptance:
run 32732004313

The candidate build, exact-main staging/cutover, animated products and desktop live E2E passed.

Mobile live E2E failed with:

creature pixel state timeout: monster static pixels were not restored

from:
e2e/tests/live-creature-preview.cjs

Rollback succeeded and live preview was restored to:
881065f671daabb069c56af3caedc34669abcb39

At the last verified handoff the public/internal preview:
http://192.168.1.2:8097

was still serving that rollback revision.

==================================================
ROOT CAUSE ALREADY ESTABLISHED
==================================================

Do not restart from speculative debugging unless new evidence contradicts this.

The established root cause in #130 / PR #134 is:

web/fullworld-creatures.mjs previously handled every
`oteryn-atlas-view` event by synchronously repainting
`state.lastPreparedRecords` before the asynchronous refresh.

Across animation ON -> OFF, those prepared records could still contain the last animated bitmap.

That allowed stale animated pixels to be repainted after playback had already switched to static mode.

The existing fix in PR #134:

1. introduces:
   src/browser/creature-view-transition.mjs

2. explicitly classifies animation state transitions;

3. on animation state change, reparses/reprepares current visible creature records instead of repainting stale prepared bitmaps;

4. uses the existing `drawEpoch` invalidation mechanism so older in-flight animated draws cannot commit after the new static draw;

5. preserves the existing fast repaint behavior for non-animation view transitions;

6. does NOT weaken:
   - timeouts,
   - retries,
   - pixel equality oracle,
   - tolerances,
   - allowlists,
   - animation semantics.

Do not replace this with sleeps, retries or looser assertions.

==================================================
TDD EVIDENCE ALREADY IN PR
==================================================

RED commit:
3ca82a2575e1a51950cc545d2f9f3f09ad9d7b1

GREEN commit:
e779f82c92fdb26cd74783781150a9744e021a90

Known regression tests:
- tests/creature-view-transition.mjs
- tests/creature-view-transition-integration.mjs

Known modified runtime:
- web/fullworld-creatures.mjs

Known helper:
- src/browser/creature-view-transition.mjs

At handoff:
- focused regression: 2/2 PASS
- full deterministic suite: 194/194 PASS
- git diff --check: PASS
- runtime parse check: PASS
- lightweight GitHub CI / CodeQL / provenance checks were GREEN

Verify all of this yourself against the CURRENT PR head.

==================================================
HEAVY E2E HANDOFF
==================================================

A final exact-head Molehill run was started before handoff.

Machine:
Molehill-PC

Device ID:
2fa411e9-75e2-46f1-82b5-dfedfa8943ab

Expected project/artifact name:
atlas130-final-e779f82

Expected PR HEAD for that run:
e779f82c92fdb26cd74783781150a9744e021a90

Expected matrix:
50 scenarios
workers=1
retries=0

A machine-wide exclusive lock was used:
C:\Users\barte\AppData\Local\Temp\oteryn-atlas-heavy-e2e.lock

FIRST inspect whether that exact run already completed.

If it completed successfully and all evidence is valid for the still-current PR HEAD, reuse it.

If it failed:
- inspect the exact failure;
- distinguish product assertion failure from environmental interference;
- repair only real product/test infrastructure defects;
- do NOT weaken test assertions;
- rerun from the exact candidate head.

If the PR HEAD changed for any reason, the old 50/50 evidence is stale and MUST NOT be published as evidence for the new head.

Do not run multiple heavy Atlas E2E suites concurrently on Molehill-PC.

==================================================
REQUIRED PRE-MERGE ACCEPTANCE
==================================================

Before merging PR #134, require ALL of the following against the exact final PR head:

1. clean worktree;
2. exact origin branch SHA recorded;
3. focused regression tests PASS;
4. full deterministic verification PASS;
5. git diff --check PASS;
6. relevant JavaScript module parse checks PASS;
7. Molehill-PC Docker Playwright:
   - exactly 50/50 PASS
   - workers=1
   - retries=0
   - exact candidate SHA
   - valid machine-readable summary/evidence;
8. publish exact-head:
   atlas-local-e2e=success
   using the repository-supported publisher only;
9. wait for all required GitHub checks;
10. atlas-gate = SUCCESS;
11. provenance-gate = SUCCESS;
12. repository-contract = SUCCESS;
13. deterministic verification = SUCCESS;
14. browser-semantic = SUCCESS;
15. browser-webgl-proof = SUCCESS;
16. relevant CodeQL checks = SUCCESS.

Do not bypass branch protection.
Do not merge with required checks red or stale.

==================================================
MERGE
==================================================

Once all required exact-head evidence is GREEN:

- squash-merge PR #134 into main;
- bind the merge operation to the exact expected PR HEAD SHA so a concurrent branch update cannot be merged accidentally;
- use the repository's expected commit title/body conventions;
- ensure Issue #130 closes as completed;
- delete the task branch after successful merge if repository lifecycle requires it.

Record:
- final PR head SHA;
- merge commit SHA;
- current main SHA after merge.

After merge, refresh origin/main and verify GitHub main actually points at the merged commit.

==================================================
POST-MERGE SYNOLOGY LIVE ACCEPTANCE
==================================================

THIS IS A HARD COMPLETION REQUIREMENT.

The task is NOT complete merely because PR #134 merged.

After merge, require Synology Live Acceptance for the exact merged-main SHA.

The workflow must:

- build the exact Atlas main revision;
- use the correct pinned Oteryn-Game authority revision;
- qualify candidate products;
- perform atomic publish/cutover;
- run real Chromium desktop and mobile live acceptance;
- keep the strict creature pixel-change / static restoration oracle;
- finish SUCCESS.

Specifically verify that the previous mobile failure is gone:

monster playback changes real creature-overlay pixels
AND
animation OFF restores the exact static monster pixels.

Desktop must also continue to PASS.

If Synology Live Acceptance fails:
- inspect exact workflow/job logs and evidence;
- identify root cause;
- fix it in a new protected PR if code changes are required;
- merge that follow-up normally;
- repeat post-merge live acceptance.

DO NOT simply rerun until green without understanding a deterministic failure.

==================================================
PRIMARY CONTAINER / BROWSER DEPLOYMENT
==================================================

After Synology Live Acceptance succeeds, verify the real primary preview:

http://192.168.1.2:8097

Check at minimum:

GET /web/fullworld.html

The response revision header:
X-Oteryn-Atlas-Code-Revision
or
X-Oteryn-Atlas-Revision

MUST equal the exact current merged `main` SHA.

Also verify:

- the primary Atlas container is healthy;
- it is not still serving rollback revision 881065f671daabb069c56af3caedc34669abcb39;
- the HTML and animation products are accessible;
- desktop browser loads Atlas successfully;
- mobile browser loads Atlas successfully;
- NPC and monster layers work;
- animation can be turned ON;
- animation can be turned OFF;
- static creature pixels restore correctly after OFF.

The user's goal is to open the normal Atlas URL in the browser and immediately see the finished merged-main deployment.

Do not leave the successful candidate only in a temporary/staging container.
It must be the PRIMARY live/main Atlas container.

==================================================
CONCURRENCY / SAFETY
==================================================

The repository has other agents working concurrently.

Therefore:

- refresh origin/main before mutations;
- refresh PR #134 before merge;
- never overwrite unrelated work;
- never reset shared main destructively;
- do not clean up containers/worktrees owned by another active task;
- use the Atlas heavy-E2E exclusive lock on Molehill;
- if main advances, re-evaluate mergeability;
- exact-head evidence must always correspond to the candidate actually merged.

Do not modify Oteryn-Game.

==================================================
SUPERPOWERS / DEVELOPMENT METHOD
==================================================

Use the installed Superpowers workflow where applicable:

- systematic-debugging for any new failure;
- test-driven-development before any new bugfix;
- verification-before-completion before claiming success.

Do not introduce speculative refactors.

==================================================
DEFINITION OF DONE
==================================================

You may report COMPLETE only when ALL are true:

- Issue #130 completed;
- PR #134 or its necessary follow-up merged;
- final code is on `main`;
- exact merged-main SHA identified;
- required PR checks GREEN;
- Molehill exact-head 50/50 PASS;
- Synology Live Acceptance on merged-main PASS;
- mobile monster animation OFF restores exact static pixels;
- primary container healthy;
- http://192.168.1.2:8097 serves the exact current main SHA;
- browser acceptance succeeds against the primary container;
- no rollback revision remains live;
- no dirty task work is left;
- relevant task branch/worktree cleanup completed safely.

==================================================
FINAL RESPONSE
==================================================

Do not give me a plan-only answer.

Work autonomously until terminal completion or a genuine external blocker.

At the end report concisely:

STATUS: COMPLETE / BLOCKED

Issue:
PR:
Final PR head:
Merge SHA:
Current main SHA:
Molehill E2E:
GitHub required checks:
Synology Live Acceptance run ID + conclusion:
Primary container:
Revision served by :8097:
Desktop live acceptance:
Mobile live acceptance:
Static monster pixel restoration:
Branch/worktree cleanup:

If BLOCKED, give the exact blocker, failing command/workflow/job and evidence.
Do not call the task complete while the main container is still serving an older revision.
