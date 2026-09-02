# Atlas PR #268 finalization handoff

Alias: `OTERYN-ATLAS-PR268-FINALIZATION-HANDOFF`

Date: 2026-09-02
Repository: `Oteryn/Oteryn-Atlas`
Programme context: finish the Atlas governance propagation only after the Phase-D / qualification repair is genuinely safe.

## Governing rule

**GitHub LIVE STATE IS THE ONLY SOURCE OF TRUTH.**

Do not trust SHAs, ruleset values, PR bases, check states, local branches, local `main`, old summaries, or this document without refreshing them first. This file is a durable handoff, not authority over newer GitHub state.

Do not touch PR #284 unless fresh live evidence explicitly makes it relevant. Another Atlas effort is handling that problem separately.

## Fresh live baseline captured before this handoff

- protected `main`: `e31015d0880e9f81a4b96f990658490af45e8fa6` (`fix(ci): fail closed Atlas Merge Queue gate (#292)`).
- PR #268: OPEN, head `a23072e9160f2f81e8262ed7e79739bd9655e669`, base snapshot `e31015d...`, 29 changed files.
- PR #279: OPEN, head `2bb81d19cbd88ae62805106fde68dd3fe4a79f68`, 1 changed file, stale base snapshot `f8de8e42...`.
- PR #301: OPEN DRAFT, head `b3460312f44f4be786891169b8b630b7f5eb6d2f`, disposable validation-only PR.
- ruleset `Protect main` id `22103758`: enforcement active, bypass actor count 0, required check `atlas-gate`, strict required-status-check policy **true**, Merge Queue method SQUASH, grouping ALLGREEN.
- No break-glass bypass is active.

## What is actually verified

PR #294 was closed as obsolete. Do not revive or merge it: its `3ab...` repin no longer matches the current #268 product.

The qualification product on the current repair line was independently rebuilt deterministically as:

`sha256:c36ed503f8ada27a673ba96780b70cb361fa2fe2ce08240e372dbff664a2866a`

PR #268 currently contains the matching update to `tools/verification/protected-hosted-product-identities.json` and its contract test in commit `a23072e...`.

Before that registry commit, commit `2a6919fa2f6f0671ebd6562eb004a2d8d964451c` fixed two real defects found by the GitHub-hosted validation lane:

- `src/browser/animation-runtime-service.mjs` now derives animation source expectations from live FullWorld trust instead of always enforcing production animation identity.
- `e2e/tests/audit-desktop.spec.mjs` imports `fixtureAwarePosition`, fixing a real `ReferenceError`.

The deterministic verification suite after those fixes passed 494/494 locally and the rebuilt product remained exactly `c36ed503...`.

On remote head `a23072e...`, ordinary CI components including deterministic verification contracts, browser WebGL proof, repository contract, semantic proof and browser-semantic were GREEN. The CI aggregate remained RED because `Protected Hosted Playwright evidence` could not validate the required hosted lifecycle/fan-in, so `atlas-gate` remained RED.

The old #301 validation run on earlier exact candidate `f8209a6...` was genuinely RED: 9 PASS / 59 FAIL. Do not reinterpret that run as proof for the current head.

## Pending local repair that is NOT on PR #268 yet

A second common browser root cause was found after the animation fix: qualification browser execution failed with:

`Creature overlay disabled: unsupported creature index authority`

Cause: `web/fullworld-creatures.mjs` still hard-codes production creature authority (`oteryn-game-atlas-export-v1`, `animated-creatures-v1`, production semantic digest) even when qualification trust is active. This disagrees with the builder, which already validates fixture creature sources through trust-derived expectations.

A TDD repair is prepared but intentionally **not pushed**:

- import `FULLWORLD_TRUST` and `ancillarySourceExpectations` from `fullworld-trust.mjs`;
- import and use `validateCreaturePublicationSource`;
- derive `CREATURE_SOURCE_EXPECTATIONS = ancillarySourceExpectations(FULLWORLD_TRUST).creatures`;
- replace the duplicated production-only authority/root assertions with the shared validator;
- add a regression contract in `tests/verification/qualification-world.test.mjs`.

RED was observed before the change; after the change the targeted qualification tests passed 8/8 and `git diff --check` passed.

Exact pending bytes are stored beside this handoff:

`docs/handoffs/patches/2026-09-02-pr268-creature-trust-followup.patch`

The source worktree when this handoff was written was `C:\Oteryn\worktrees\atlas-pr268-final2`. Treat that path as convenience only; verify the live PR head before applying anything.

## Mistakes to avoid repeating

1. Do not run a proof on head A and mutate #268 to head B before consuming the proof. That created avoidable proof churn. Freeze the candidate while an exact-head proof runs.
2. Do not create or repeatedly edit disposable validation PRs unless an existing trusted lane cannot answer the question. Prefer the repository's canonical protected promotion lane after the candidate is coherent.
3. Do not assume an old ruleset snapshot. A prior assumption about `strict_required_status_checks_policy` became stale; fresh live readback shows it is **true**.
4. Do not treat local `main` as authoritative. During this handoff local `C:\Oteryn\Oteryn-Atlas` showed stale `main@890802e...` while GitHub live `main` was `e31015d...`.
5. Do not classify dozens of browser failures independently before finding the earliest shared runtime failure. The 59-failure run collapsed first to animation trust, then to creature source trust.
6. Do not use no-op commits, force pushes, admin merge, direct pushes to protected main, or settings weakening as retrigger mechanisms.
7. Do not broaden #268 casually. If the pending creature-trust repair adds `web/fullworld-creatures.mjs` beyond the current effective 29-file set, recompute and explicitly fence the new exact changed-file set.
8. Do not claim completion until protected main and all final GitHub state have been read back live.

## Explicit break-glass authority from the user

The user authorized one narrow emergency operation **only after #268 is genuinely verified**:

- temporarily add only GitHub user `blakinio` to ruleset `Protect main` as `User` with `bypass_mode=pull_request`;
- do not disable the ruleset, `atlas-gate`, strict checks, Merge Queue, review-thread resolution, or any other protection;
- use the bypass only for the verified #268 repair;
- immediately remove the bypass after #268 merges;
- perform a full live ruleset readback proving bypass actors are empty again;
- then finish #279 through normal Merge Queue, not through bypass.

Do not open the bypass window while the candidate is still failing browser proof or while there is no reliable channel for immediate rollback.

## Recommended completion sequence

1. Refresh live `main`, #268, #279, #301, ruleset 22103758, review threads and exact current checks. Inspect concurrent active PRs/branches before writing anything.
2. If #268 head is still `a23072e...`, inspect the stored pending patch against that exact head. If the head moved, discard assumptions and re-derive the delta from live code.
3. Apply only the root-cause creature-source trust repair that remains necessary. Use TDD and run the full deterministic verification suite. Rebuild and verify the qualification product digest.
4. Keep the candidate frozen. Run one authoritative full qualification browser proof with `workers=1`, `retries=0`, exact stable-ID census and exact-head fencing. Do not mutate the branch while this proof runs.
5. If browser proof is RED, diagnose the earliest common failure and fix the root cause before rerunning. Do not use reruns as diagnosis.
6. Reconcile product identity and protected promotion authority only from the measured exact-head product. Avoid reviving obsolete `3ab...` or other historical digests.
7. Resolve only review threads whose underlying issue is demonstrably fixed on the exact final head.
8. When #268 is fully verified but blocked only by the proven control-plane bootstrap, perform the authorized PR-only break-glass, merge with exact-head fence and SQUASH, then immediately remove the bypass and read the ruleset back live.
9. Close/delete disposable validation #301 once it is no longer needed; do not merge it.
10. Re-evaluate #279 against the new protected main. Update its branch only if live evidence requires integration. Obtain current-head `atlas-gate`, enqueue through normal Merge Queue, observe merge-group `atlas-gate`, and confirm merge.
11. Verify issue #278 closed as intended.
12. Final global readback: protected-main root `AGENTS.md` in META, Game, Platform and Atlas contains the exact External execution-skill precedence section; record current main SHA for each; Atlas ruleset is active with strict checks and no bypass actors.

## Completion condition

Do not say DONE merely because #268 merged. DONE means: #268 safely merged, bypass removed, #279 normally merged through MQ, #278 closed, Atlas protections preserved, and the exact governance section is present on protected main in all four repositories.

## Prompt for the next agent

```text
Act as the autonomous finalizer for the Atlas governance propagation task in Oteryn/Oteryn-Atlas.

FIRST read docs/handoffs/2026-09-02-atlas-pr268-finalization-handoff.md and the adjacent pending patch, but treat them only as historical handoff. GITHUB LIVE STATE IS THE ONLY SOURCE OF TRUTH.

Refresh protected main, PR #268, PR #279, PR #301, ruleset Protect main id 22103758, all current review threads/checks, and any concurrent Atlas PRs or branches before changing anything. Do not touch #284 unless fresh live evidence explicitly makes it part of this task.

The previous agent made an operational mistake by repeatedly changing #268 while exact-head validation was running. DO NOT repeat that. Once you launch an authoritative exact-head proof, freeze that candidate until the proof is consumed.

The last known remote #268 head was a23072e9160f2f81e8262ed7e79739bd9655e669 with 29 changed files. A not-yet-pushed TDD repair for web/fullworld-creatures.mjs is stored in docs/handoffs/patches/2026-09-02-pr268-creature-trust-followup.patch. Its observed root cause was `Creature overlay disabled: unsupported creature index authority`: browser creature boot hard-coded production source authority instead of using trust-derived ancillary expectations. Before applying it, confirm live code/head and independently prove that this is still the current defect.

Do not trust historical product digests. Measure the exact current qualification product by build+verify. The last measured digest before handoff was sha256:c36ed503f8ada27a673ba96780b70cb361fa2fe2ce08240e372dbff664a2866a.

Use TDD for any remaining root-cause repair. Run the full deterministic suite, git diff --check, exact changed-file census, independent product rebuild/verify, and then one authoritative full Chromium qualification proof with workers=1, retries=0, exact stable-ID census and exact-head fencing. Diagnose earliest common failures; do not rerun blindly.
The user has explicitly authorized exactly one narrow break-glass, but ONLY after #268 is genuinely verified: temporarily add only blakinio to Protect main as a User with bypass_mode=pull_request; do not disable or weaken ruleset enforcement, atlas-gate, strict checks, Merge Queue or review protections; use the bypass only to merge the verified #268 through a PR with exact-head fencing; immediately remove the bypass and prove bypass_actors is empty by live readback. Never use --admin or direct protected-main push.

After #268 is merged and the bypass is removed, finish any required authority repin through the normal protected path if live state still requires it. Then re-evaluate PR #279 and take it through the normal Merge Queue with current-head atlas-gate and merge-group verification. Close disposable PR #301 rather than merging it.

Do not create no-op commits, force-push, weaken assertions, manufacture checks, or create a chain of validation PRs. Do not accept local main as authority. Do not claim that a previous run proves a different head.

Finish autonomously through final merge and readback. DONE only when:
- #268 is merged safely;
- the temporary bypass is removed and the ruleset is fully restored with strict=true and no bypass actors;
- #279 is merged through normal Merge Queue;
- issue #278 is closed;
- the exact External execution-skill precedence section is present in root AGENTS.md on protected main in Oteryn/Oteryn, Oteryn/Oteryn-Game, Oteryn/Oteryn-Platform and Oteryn/Oteryn-Atlas;
- current protected-main SHAs for all four repos are recorded.

Do not stop at a status report if the next action is authorized and safe. Stop only for a genuinely new security-sensitive authorization not covered above, an external credential/owner requirement, or contradictory live evidence that cannot be safely resolved.
```
