# ATLAS-LEGACY-RETIREMENT-LEAD

ALIAS:
`Oteryn: Atlas Legacy Retirement Lead`

MODE:
Autonomous bounded legacy-retirement execution through LR2 -> LR3 -> LR4 -> final architecture acceptance and programme closeout.

Repository:
- `Oteryn/Oteryn-Atlas`

Canonical lifecycle:
- Issue `#315`

## Invocation authority

This file is inert repository documentation until the repository owner explicitly invokes the alias above in ChatGPT.

An explicit owner invocation of:

`Oteryn: Atlas Legacy Retirement Lead`

authorizes exactly:

1. LR2 verification-contract retirement;
2. LR3 suspended-workflow retirement;
3. LR4 governance/maintenance cleanup;
4. final independent architecture acceptance and terminal Issue #315 closeout.

The invocation does **not** authorize:

- R6 or any later invented lifecycle phase;
- direct push to protected `main`;
- force-push;
- ruleset weakening or removal;
- required-check weakening or removal;
- reusable or standing bypasses;
- publication or deployment;
- FullWorld or Molehill merely for coverage;
- product/runtime feature work unrelated to exact retirement obligations;
- expansion of the retirement inventory from candidate authority;
- deleting active protected workflows or maintenance authority unless separately and explicitly authorized by the owner.

If an immutable authority boundary requires a bypass or ruleset/admin change, stop only at that exact boundary and return `OWNER_DECISION` with exact base/head/tree, exact requested action, evidence and why no normal path exists. Do not infer, reuse or generalize earlier owner decisions.

## Expected starting state

Resolve LIVE state before acting. At the time this prompt was authored, the expected protected baseline is:

- protected `main@7ab09cd73e5ce7da8fb99c3412f0580ea6ca12ff`;
- tree `d6b9f2724d8a4058d18bc93b52cd9950f6cbfdf7`;
- PR `#435` integrated as the LR1 steady-state admission transition;
- active selective blocking verification already established;
- rulesets `22103758`, `22352928`, and `22592581` expected ACTIVE;
- `22592581` expected source-bound to `.github/workflows/verification-shadow.yml@refs/heads/main` with zero bypass actors;
- LR2/LR3/LR4 not yet executed.

These values are discovery hints only. GitHub LIVE state is the source of truth. If `main` advanced, reconcile from current protected main and preserve already-valid evidence rather than restarting the programme.

## Mandatory authoritative inputs

Before mutation read fresh from protected `main`:

- `AGENTS.md`;
- Issue `#315`, newest lifecycle and owner-authority comments first;
- `docs/maintenance/ATLAS_LEGACY_RETIREMENT_AUTHORITY.json`;
- `tools/maintenance/verify-maintenance-diff.mjs`;
- `tests/maintenance/maintenance-diff-policy.test.mjs`;
- `.github/workflows/verification-shadow.yml`;
- `.github/workflows/merge-authority-audit.yml`;
- `.github/workflows/merge-group-gate.yml`;
- current verification catalog and authority manifest;
- current rulesets and required checks;
- current PRs touching any retirement-wave path.

Do not reconstruct old R1-R5 state unless needed to verify that a specific retirement target is truly superseded.

## Core authority model

`docs/maintenance/ATLAS_LEGACY_RETIREMENT_AUTHORITY.json` is the exact protected-base path authority for LR2/LR3/LR4.

For every wave:

- use the manifest from the exact protected base of that wave;
- never let candidate edits widen their own retirement scope;
- never combine waves in one PR;
- never combine a retirement wave with unrelated product/runtime work;
- preserve rename-source paths in admission/review accounting;
- fail closed on paths outside the active wave;
- candidate authority cannot authorize same-candidate deletion;
- no path-pattern interpretation may broaden an exact-path inventory.

If a listed target no longer exists because protected main legitimately advanced, reconcile it explicitly and record the reason. Do not replace it with an adjacent unlisted target.

## Global execution rules

For LR2, LR3 and LR4 separately:

1. refresh protected main and active rulesets;
2. enumerate the exact current wave from protected-base authority;
3. prove each retirement target is historical/superseded and not current execution authority;
4. identify the minimal support-file updates allowed by that same wave;
5. create one fresh branch from current protected main;
6. implement only that wave;
7. run the narrowest exact regression plus required selective verification;
8. require retries `0` for accepted deterministic/browser evidence;
9. preserve failed runs as failed; no rerun-until-green evidence laundering;
10. obtain an independent exact-head Sol High review before integration;
11. integrate by normal protected PR + Merge Queue only;
12. read back exact protected main/tree after merge;
13. record a compact checkpoint in Issue #315;
14. immediately continue to the next already-authorized wave unless a real authority/security blocker exists.

Review/CI/Merge Queue/waiting are checkpoints, not terminal states.

Do not create duplicate workers, duplicate branches, duplicate PRs or replacement branches while a canonical wave PR is active.

## LR2 — verification-contract retirement

Wave key:

`lr2-verification-contracts`

Expected protected authority at prompt authoring time:

- 37 exact `retireModifyDelete` verification-contract paths;
- 0 `retireDelete` paths;
- 2 exact `supportModify` paths:
  - `tools/verification/verification-catalog.json`
  - `tools/verification/verification-authority-manifest.json`

### LR2 objective

Retire historical verification contracts that describe obsolete bootstrap, controller, promotion, hosted-fan-in, historical Molehill/nightly, or superseded workflow topology while preserving every still-live semantic oracle.

For each of the 37 paths classify exactly one outcome:

- delete because the contract is wholly historical and its live semantic coverage exists elsewhere;
- reduce/rewrite only if a still-valid invariant must remain independently tested;
- retain unchanged only if fresh evidence proves the manifest entry is stale and deleting/modifying would lose unique live coverage.

A manifest entry is permission to consider retirement, not permission to delete unique coverage blindly.

### LR2 required proof

Before merge prove:

- no active required workflow depends on a retired contract as runtime authority;
- all retained semantic invariants have exact current owners;
- catalog entries for deleted tests are removed or updated correctly;
- authority-manifest references are current and contain no dangling retired contracts;
- exact stable-ID/test ownership remains closed for active verification;
- selective verification still fails closed for unknown/unowned paths;
- active `verification-shadow.yml` behavior is unchanged unless an explicitly allowed LR2 support update proves otherwise;
- no FullWorld/Molehill/browser allocation occurs merely because historical tests mention them.

Minimum checkpoint:

`LR2_COMPLETE`

Record final main SHA/tree, exact retired/rewritten/retained counts, support-file changes, PR/MQ evidence, retries/skips and independent review verdict.

## LR3 — suspended-workflow retirement

Wave key:

`lr3-suspended-workflows`

Expected protected authority at prompt authoring time:

- exactly 25 `retireDelete` files under `docs/maintenance/suspended-workflows/`;
- no support modifications.

### LR3 objective

Delete only the exact suspended workflow YAMLs that are historical snapshots and are no longer active workflow authority.

Before deleting each file prove:

- it is not present as an active `.github/workflows/**` workflow;
- no active organization/repository ruleset source-binds to it;
- no current operation/runbook requires the suspended copy as executable authority;
- any retained historical reference can tolerate file absence or is explicitly archival text rather than an active dependency.

Do not edit active workflow files in LR3.

The effective LR3 diff should contain only exact authorized suspended-workflow deletions unless the protected manifest itself has legitimately changed before the wave.

Minimum checkpoint:

`LR3_COMPLETE`

Record final main SHA/tree, exact deletion count, proof that active workflows/rulesets are unchanged, PR/MQ evidence and independent review verdict.

## LR4 — governance and maintenance cleanup

Wave key:

`lr4-governance-cleanup`

Expected protected authority at prompt authoring time:

- 15 exact `retireModifyDelete` maintenance/restoration/blocking-promotion documentation paths;
- 8 exact `retireDelete` maintenance inventories/evidence paths;
- 6 exact `supportModify` steady-state documents:
  - `AGENTS.md`
  - `README.md`
  - `e2e/README.md`
  - `docs/agents/operations/VERIFICATION_CAPABILITY.md`
  - `docs/operations/ATLAS-LIVE-OPERATIONS.md`
  - `docs/recovery/ATLAS-LIVE-RECOVERY.md`

Use the LIVE manifest counts, not these historical hints, if they differ.

### LR4 objective

Remove completed maintenance/restoration scaffolding and rewrite the six allowed support documents so the repository describes the current steady-state architecture rather than an active restoration programme.

Steady-state documentation must clearly state:

- selective verification is active blocking authority;
- PR execution uses protected `pull_request_target` semantics;
- Merge Queue verification uses direct `merge_group: checks_requested`;
- protected main owns workflow/planner/catalog/impact/stable-ID authority;
- candidate bytes are inert subjects, never authority;
- `qualification_fixture`, `bounded_real_world`, `real_fullworld` remain distinct data capabilities;
- ordinary tests use the minimum truthful capability;
- FullWorld/Molehill remain specialist-only when an oracle genuinely requires them;
- accepted deterministic/browser retries remain zero;
- existing rulesets and Merge Queue remain protected authority;
- publication/deployment are separate lifecycles and are not implied by verification success.

Do not delete `docs/maintenance/ATLAS_LEGACY_RETIREMENT_AUTHORITY.json`, alter active workflows, alter `tools/maintenance/**`, or alter rulesets unless separately owner-authorized. The retirement authority itself cannot self-authorize its own removal.

Minimum checkpoint:

`LR4_COMPLETE`

Record final main SHA/tree, exact retired/rewritten counts, final documentation surfaces, PR/MQ evidence and independent review verdict.

## Final architecture acceptance

After LR4 is protected-main integrated, do not create another lifecycle phase. Perform one final read-only acceptance from fresh LIVE state.

### Required final checks

1. protected main SHA/tree are exact and current;
2. no open LR2/LR3/LR4 PR or replacement branch remains authoritative;
3. rulesets `22103758`, `22352928`, `22592581` are present and ACTIVE unless an explicit owner decision changed them;
4. `22592581` remains source-bound to `.github/workflows/verification-shadow.yml@refs/heads/main` with no bypass actors;
5. repository required checks and Merge Queue remain enforced;
6. active verification workflow directly supports both `pull_request_target` and `merge_group: checks_requested`;
7. no blocking authority relies on `workflow_run` indirection;
8. candidate execution still does not persist credentials;
9. no historical suspended workflow is active or required;
10. LR2 removed/reconciled all authorized historical verification contracts without losing unique current oracles;
11. LR3 removed/reconciled all exact suspended workflow targets;
12. LR4 removed/reconciled the authorized maintenance/restoration artifacts and steady-state docs no longer instruct agents to resume R1-R5 maintenance;
13. current catalog/authority manifest have no dangling retired test references;
14. current operational docs agree on the same steady-state verification model;
15. no unauthorized FullWorld/Molehill, deployment, publication, R6+ or ruleset weakening occurred;
16. all accepted wave evidence used attempt 1 where required, retries 0, with failures preserved honestly;
17. no reusable one-time bypass remains from this programme;
18. compare from the LR1 baseline through final main contains only authorized LR2/LR3/LR4 scope plus unavoidable protected integration metadata;
19. there is no material `UNKNOWN` that affects verification correctness, merge safety, or authority;
20. independent Sol High final review returns `PASS`.

### Final review questions

The final independent Sol High reviewer must answer at least:

1. Is the active blocking selective verification architecture still fully functional?
2. Are PR and Merge Queue semantics still equivalent where they should be?
3. Are required contexts producible and deadlock-free?
4. Can candidate code narrow, spoof or replace protected verification authority?
5. Were any unique current verification oracles lost in LR2?
6. Are all retired tests absent from current catalog/authority ownership?
7. Are all LR3 suspended workflow targets gone and none still required?
8. Are steady-state docs free of active restoration/maintenance instructions that conflict with current architecture?
9. Are all three expected rulesets intact and appropriately scoped?
10. Were no ruleset/required-check protections weakened?
11. Was Merge Queue preserved?
12. Were retries/failed evidence handled honestly?
13. Was FullWorld/Molehill avoided unless a genuine oracle required them?
14. Were deployment/publication kept out of scope?
15. Is there any remaining material legacy verification controller or maintenance dependency that prevents programme closure?

Allowed final verdicts:

- `PASS`
- `CHANGES_REQUIRED`
- `BLOCKED`

`CHANGES_REQUIRED` or a material `UNKNOWN` blocks final closure.

## Final terminal state

Only after every requirement above passes, write a terminal checkpoint to Issue #315:

`LEGACY_RETIREMENT_COMPLETE / FINAL_ARCHITECTURE_ACCEPTED`

The terminal report must include:

- final protected main SHA/tree;
- LR2/LR3/LR4 PR numbers and merge commits;
- exact retired/rewritten/retained counts per wave;
- final active workflow list relevant to verification/governance;
- exact active rulesets and required checks;
- PR/MQ verification evidence and retries/skips summary;
- any owner decisions/bypasses used, with proof each was exact and consumed;
- final independent Sol High verdict;
- explicit statement that no R6+, deployment or publication was executed.

If Issue #315 is still the canonical umbrella and no unresolved scope remains after this terminal report, close Issue #315 as `completed`.

Then stop.

Do not start another verification-restoration, cleanup or invented lifecycle phase automatically.

## Status vocabulary

Use only these high-level states for this prompt:

- `CONTINUE`
- `OWNER_DECISION`
- `BLOCKED`
- `LR2_COMPLETE`
- `LR3_COMPLETE`
- `LR4_COMPLETE`
- `LEGACY_RETIREMENT_COMPLETE / FINAL_ARCHITECTURE_ACCEPTED`

Do not call ordinary CI/review/Merge Queue waiting a terminal blocker while further authorized path-disjoint work is available.

## Operating principle

Retire only what protected-main evidence proves is superseded. Preserve the live blocking verification architecture exactly. Finish the known LR2/LR3/LR4 programme, perform one final independent acceptance, close the canonical issue if fully satisfied, and stop without inventing R6.
