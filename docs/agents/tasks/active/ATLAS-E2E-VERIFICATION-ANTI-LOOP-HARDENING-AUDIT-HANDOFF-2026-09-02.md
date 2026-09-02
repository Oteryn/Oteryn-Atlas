# ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING — original-prompt audit handoff

```yaml
task_id: ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING
audit_date: 2026-09-02
source_of_truth: GitHub live state + current main + executable verification contracts
baseline_main: e31015d0880e9f81a4b96f990658490af45e8fa6
lifecycle_issue: 272
primary_pr: 273
active_fixture_repair_pr: 268
status: ORIGINAL_PROMPT_DOD_INCOMPLETE
```

## Purpose

This handoff records a strict re-audit of the **original task prompt**, not merely the lifecycle state of PR #273 / issue #272. It exists so a new agent does not infer that `#272 closed/completed` means every literal original Definition of Done is already satisfied.

The anti-loop architecture is substantially implemented and its deterministic contracts are green. The original prompt must **not** yet be called 100% complete because the ordinary hosted `e2e.full` path declared as `qualification_fixture` still lacks a successful end-to-end browser proof on protected GitHub-hosted execution.

## Fresh audit result

On a clean checkout of `main@e31015d0880e9f81a4b96f990658490af45e8fa6`:

- `node --test tests/verification/*.test.mjs` -> **488/488 PASS**, 0 failed;
- `git diff --check` -> **PASS**.

The deterministic suite covers the core anti-loop architecture, including:

- verification profile separated from data capability;
- `qualification_fixture`, `bounded_real_world`, `real_fullworld`;
- canonical authority and environment identities;
- distinct `planSemanticDigest` and `planInstanceDigest`;
- `REUSE`, `PARTIAL_RERUN`, `FULL_RERUN`, `REINTEGRATE`;
- dependency-bound evidence reuse with fail-closed invalidation;
- machine-readable failure ownership;
- persisted progress / circuit breakers;
- Phase E semantic identity;
- Phase F stable-ID and specialist-obligation safety;
- zero-work lifecycle/fan-in behavior;
- exact candidate-head fencing and protected lower-bound semantics.

The current capability catalog and per-spec inventory also structurally express the intended Phase-D split:

- ordinary functional/browser suites such as accessibility, creature interaction/cards, geometry, pan/zoom, LOD, search, state/history, responsive, race/fault, performance/soak and user journeys -> `qualification_fixture`;
- source-contract / genuinely bounded real-data oracles -> `bounded_real_world`;
- complete production-wide animation census -> `real_fullworld` / specialist execution.

## Material remaining defect — authoritative browser proof is RED

The structural catalog is not enough. The original prompt requires ordinary GitHub-hosted E2E to **actually run successfully** against a minimal immutable qualification world through the production manifest/floor/chunk/range/loader/runtime path, without requiring the ~19 GB FullWorld.

Fresh live evidence shows that condition is not yet satisfied on current main.

Synthetic merge-group run:

- workflow: `Atlas Merge Queue gate`
- run: `33634886355`
- synthetic candidate: `06639567126e1182750aa0878419c27a1e689170`
- protected base: `e31015d0880e9f81a4b96f990658490af45e8fa6`
- result: **FAILURE**
- failing step: `Prove complete protected-base browser qualification for synthetic candidate`
- browser execution: **68 tests, 6 passed, 62 failed**, workers=1, retries=0.

Representative failures include:

- `x is outside exported floor bounds`;
- `requested floor is not exported`;
- semantic-search qualification timeout / `semantic search source authority invalid`;
- renderer commit timeouts;
- `Creature overlay disabled: animation Game SHA mismatch`;
- fixture/runtime expectations that still assume data not correctly represented by the current qualification product.

This is a **real implementation gap in the ordinary `qualification_fixture` execution path**, not evidence that those ordinary tests should be moved back to `real_fullworld`.

Do not weaken assertions, widen ordinary tests to `real_fullworld`, add retries, or route ordinary CI to Molehill to make this green.

## Active repair lane already exists — do not create a duplicate implementation PR

PR **#268** is currently open:

- title: `fix(e2e): make qualification fixture functionally complete`
- branch: `fix/issue-179-qualification-functional-fixture`
- current head at handoff: `70745a580b1cecdb58e0f9c8f0975da22c7f842d`
- current base: `main@e31015d0880e9f81a4b96f990658490af45e8fa6`
- changed files: 28.

Its stated intent is exactly the missing condition: make `qualification_fixture` functionally complete while keeping ordinary E2E off `real_fullworld` and preserving production loader/range/runtime paths.

At the time of this handoff, exact-head checks on `70745a...` show:

- Docker E2E Harness: SUCCESS;
- CodeQL: SUCCESS;
- Creature overlays: SUCCESS;
- Semantic search: SUCCESS;
- repository-contract: SUCCESS;
- browser-semantic: SUCCESS;
- browser-webgl-proof: SUCCESS;
- deterministic verification contracts: SUCCESS;
- semantic-proof: SUCCESS;
- `Protected Hosted Playwright evidence`: **still in progress**, waiting for exact protected hosted fan-in/lifecycle evidence.

Therefore the next agent should **continue/audit PR #268**, not start another fixture-repair chain.

## Documentation inconsistency

The canonical checkpoint:

`docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING.md`

still contains:

`status: PRIMARY_PR_EXACT_HEAD_VERIFICATION_PENDING`

although PR #273 is already merged and issue #272 is closed/completed. The file itself says GitHub live state overrides stale text, so this does not invalidate live execution; however it is repository consistency debt and must be corrected at final closeout.

Do **not** update that checkpoint to `COMPLETE` merely because #272 is closed. Update it only after the remaining ordinary hosted qualification proof is genuinely green.

## Historical lifecycle note

PR #273 is merged and issue #272 is closed/completed. That establishes lifecycle closeout of the focused anti-loop issue, but it is not sufficient evidence for literal original-prompt completion.

Earlier closeout history also contains bounded owner-authorized merge exceptions around the self-referential protected gate path. Do not rewrite the history to claim those exceptions never happened. Persistent policy/protection must remain fail-closed; no new bypass is authorized by this handoff.

## Required final closeout conditions

The original task may be called fully complete only when all of the following are true on the then-current exact head/base:

1. `e2e.full` ordinary hosted qualification runs on GitHub-hosted infrastructure using `qualification_fixture`, not FullWorld.
2. The qualification fixture traverses the intended production manifest/floor/chunk/range/loader/runtime path and supplies all representative functional data required by the ordinary oracles.
3. Full selected stable-ID census equality is preserved; workers=1 and retries=0 remain enforced.
4. No ordinary test is reclassified to `real_fullworld` merely to avoid fixing the fixture.
5. `real_fullworld` remains limited to explicit real-production-byte or complete-world oracles and specialist routing.
6. Exact-head protected controller/executor/fan-in / hosted evidence for the repaired path is GREEN.
7. Required security/provenance/gate checks are GREEN for the exact accepted candidate.
8. The canonical checkpoint is updated from its stale pending state to a truthful terminal state, recording the exact proof runs and final SHAs.

## Start prompt for the next agent

Use this as the continuation prompt:

> Resume the strict original-prompt closeout for `ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING`. Do not assume issue #272 being closed means the original DoD is complete. Read `docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING-AUDIT-HANDOFF-2026-09-02.md` first, then fetch fresh GitHub live state. The remaining material condition is ordinary GitHub-hosted `e2e.full` success on `qualification_fixture` through the production manifest/floor/chunk/range/loader/runtime path. Existing PR #268 (`fix/issue-179-qualification-functional-fixture`) is the active repair lane; do not create a duplicate implementation PR. Revalidate its current exact head and protected hosted fan-in. Preserve profile/data-capability separation, exact-head fencing, retries=0, exact stable-ID equality, protected lower-bound planning, immutable product identity, `atlas-gate`, `provenance-gate`, specialist-only Molehill and deployment-only Synology. Do not weaken assertions or move ordinary tests to `real_fullworld` to obtain green. If #268 becomes fully GREEN and proves the required hosted qualification semantics, complete exact-head review/security/diff checks, merge normally under the then-current protection policy, verify post-merge live behavior, and only then update the canonical checkpoint to terminal COMPLETE with exact SHAs/run IDs. If the hosted proof remains RED, diagnose the actual fixture/runtime contract and continue test-first without candidate churn or one-off bootstrap chains.

## Anti-loop discipline for continuation

- Fetch GitHub live state before acting; never rely only on this handoff's SHAs if the repository has advanced.
- Reuse the existing repair lane where valid.
- No no-op/retrigger commits.
- No force push.
- No assertion weakening.
- No retries > 0.
- No ordinary FullWorld dependency.
- No new bypass/gate weakening unless the owner explicitly authorizes a narrowly bounded exception in live GitHub state.
- Do not claim completion without fresh executable evidence.
