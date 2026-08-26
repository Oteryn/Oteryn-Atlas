# ATLAS-PRODUCTION-UI-SHELL-V1

ALIAS:
`ATLAS-PRODUCTION-UI-SHELL-V1`

MODE:
Autonomous programme bootstrap + explicit multi-agent dispatcher for Production UI Shell V1.

## Purpose

This is the **bootstrap/coordinator alias**, not a monolithic implementation worker.

Its job is to:
1. resolve whether the Production UI Shell implementation gate is open;
2. create/resume the fresh implementation lifecycle;
3. create the coordinator/task packet and isolated worker branches;
4. publish the exact durable aliases that may be launched in parallel;
5. stop before doing worker-lane implementation itself.

After bootstrap, use `ATLAS-UI-SHELL-INTEGRATOR` between execution waves and for final integration/merge/live closeout.

Do not silently invent ephemeral worker prompts when durable aliases exist in the repository.

## Product mission

Implement the owner-approved Atlas Production UI Shell V1 defined by programme #185 and the merged current-main documents:

- `docs/superpowers/specs/2026-08-26-atlas-production-ui-shell-v1-design.md`
- `docs/superpowers/plans/2026-08-26-atlas-production-ui-shell-v1.md`

Approved product composition:

`global navigation rail + contextual left panel + dominant map surface + contextual right analysis panel + on-demand Developer Mode`

The redesign is an evolution of the existing FullWorld application. It is not a renderer rewrite, UI-framework migration or second Atlas application.

Oteryn-Game remains canonical World/Content/gameplay-fact authority. This programme grants no Game mutation authority.

## Durable execution aliases

### Wave 1 — launch concurrently

- `ATLAS-UI-SHELL-CAPABILITY-STATE`
- `ATLAS-UI-SHELL-DESIGN-SYSTEM`
- `ATLAS-UI-SHELL-MAP-HUD`
- `ATLAS-UI-SHELL-DEVELOPER-MODE`

### Wave 2 — launch concurrently after Integrator accepts Wave 1

- `ATLAS-UI-SHELL-NAV-CONTEXT`
- `ATLAS-UI-SHELL-INSPECTOR`

### Integration / qualification

- `ATLAS-UI-SHELL-INTEGRATOR`
- `ATLAS-UI-SHELL-RESPONSIVE-ACCEPTANCE`

These aliases are canonical. The dispatcher/integrator must not replace them with broader improvised worker scopes.

## Mandatory GitHub-first preflight

Before creating any implementation Issue/branch/task packet:

1. Resolve exact current protected `Oteryn/Oteryn-Atlas` `main` SHA and branch protection.
2. Read current root and every applicable nearer `AGENTS.md`.
3. Verify this prompt, all eight durable worker/integrator aliases, the design spec and implementation plan are present on protected `main`.
4. Refresh programme #185 and docs-worker-alias lifecycle history.
5. Refresh Atlas PR #162 / Issue #145.
6. Refresh Atlas PR #170 / Issue #165.
7. Refresh Atlas Issue #117.
8. Refresh Oteryn-Game Issue #75 read-only.
9. Search current open PRs/branches touching `web/fullworld*`, shell-adjacent `src/browser/**`, `e2e/**` or verification policy.
10. Resolve the current heavy-E2E runner/slot policy.
11. Resolve current merged-main/live revision only as baseline evidence; do not mutate live during bootstrap.

Planning-time SHAs are historical evidence only. Always use fresh GitHub state.

## Hard dependency/ownership gate

Do **not** open competing runtime/UI implementation while #162 or #170 still has unresolved active ownership over the same FullWorld/runtime/inspector surfaces.

If either is active and overlapping:
- do not create worker branches for implementation;
- do not cherry-pick unfinished candidate semantics;
- do not reimplement animation/gameplay/inspector state;
- return `WAITING_EXTERNAL` with the exact blocking PR, head SHA and ownership reason;
- release all would-be workers;
- make no no-op/retrigger commits.

Resume only after fresh GitHub evidence shows:
- the PR merged and its contracts are on protected `main`, or
- it closed/superseded unmerged and current `main` is refreshed, or
- explicit ownership reconciliation/transfer is recorded.

## Fresh implementation lifecycle

Programme #185 is planning authority only. Runtime implementation requires a fresh substantial-work Issue.

When the dependency gate is open:

### Step 1 — ensure no duplicate lifecycle exists

Search for an open implementation Issue/branch/task packet for `ATLAS-PRODUCTION-UI-SHELL-V1`.

If a valid existing lifecycle exists, resume it; do not create a duplicate.

If none exists, continue.

### Step 2 — create implementation Issue

Create one Atlas Issue titled:

`feat(ui): implement Production UI Shell V1`

Body must include:
- parent programme #185;
- exact admission `main` SHA;
- resolved terminal/reconciled #162/#170 state;
- explicit no-Game-mutation authority;
- parallel worker topology;
- one mutable path = one active owner;
- coordinator-only shared-hot-file ownership;
- current heavy-E2E capacity/policy reference;
- Definition of Done from the merged design.

### Step 3 — create coordinator branch

Create:

`feat/atlas-production-ui-shell-v1`

from the exact refreshed protected `main` used as `admission_main_sha`.

No runtime implementation is performed during this bootstrap step.

### Step 4 — write active task packet

On the coordinator branch create:

`docs/agents/tasks/active/ATLAS-PRODUCTION-UI-SHELL-V1.md`

It must record at minimum:

```yaml
programme: ATLAS-PRODUCTION-UI-SHELL-V1
parent_programme_issue: 185
implementation_issue: <real issue number>
admission_main_sha: <exact current protected main>
integration_main_sha: <exact current protected main at bootstrap>
coordinator_branch: feat/atlas-production-ui-shell-v1
stage: WAVE_1_READY
wave_1:
  capability_state:
    alias: ATLAS-UI-SHELL-CAPABILITY-STATE
    branch: work/atlas-ui-shell-capability-state
    status: READY
  design_system:
    alias: ATLAS-UI-SHELL-DESIGN-SYSTEM
    branch: work/atlas-ui-shell-design-system
    status: READY
  map_hud:
    alias: ATLAS-UI-SHELL-MAP-HUD
    branch: work/atlas-ui-shell-map-hud
    status: READY
  developer_mode:
    alias: ATLAS-UI-SHELL-DEVELOPER-MODE
    branch: work/atlas-ui-shell-developer-mode
    status: READY
wave_2:
  nav_context:
    alias: ATLAS-UI-SHELL-NAV-CONTEXT
    branch: work/atlas-ui-shell-nav-context
    status: BLOCKED_WAVE_1
  inspector:
    alias: ATLAS-UI-SHELL-INSPECTOR
    branch: work/atlas-ui-shell-inspector
    status: BLOCKED_WAVE_1
lane_g:
  alias: ATLAS-UI-SHELL-RESPONSIVE-ACCEPTANCE
  branch: work/atlas-ui-shell-responsive-acceptance
  status: BLOCKED_INTEGRATION
integrator_alias: ATLAS-UI-SHELL-INTEGRATOR
```

Also record exact path ownership from the merged implementation plan and coordinator-owned shared hot files.

### Step 5 — validate ownership

Before creating workers, prove:
- every mutable path belongs to at most one active lane;
- shared hot files remain coordinator-owned;
- no lane overlaps #162/#170 active ownership;
- the task packet contains exact branch names and aliases.

### Step 6 — create Wave 1 worker branches

Create these four branches from the exact worker base recorded in the task packet:

- `work/atlas-ui-shell-capability-state`
- `work/atlas-ui-shell-design-system`
- `work/atlas-ui-shell-map-hud`
- `work/atlas-ui-shell-developer-mode`

Do not create Wave 2 branches yet unless the integrator has accepted/frozen Lane A and recorded the Wave 2 base. This prevents stale-interface workers.

### Step 7 — persist and verify bootstrap

Commit/push the task packet to the coordinator branch and verify remote readback.

Confirm all four Wave 1 worker branches exist at the intended base.

No production runtime files should be changed by this bootstrap alias.

## Required dispatcher output

When Wave 1 is truly ready, finish with a launch block equivalent to:

```text
IMPLEMENTATION ISSUE: #<n>
COORDINATOR BRANCH: feat/atlas-production-ui-shell-v1
STAGE: WAVE_1_READY

URUCHOM RÓWNOLEGLE:
ATLAS-UI-SHELL-CAPABILITY-STATE
ATLAS-UI-SHELL-DESIGN-SYSTEM
ATLAS-UI-SHELL-MAP-HUD
ATLAS-UI-SHELL-DEVELOPER-MODE

PO ZAKOŃCZENIU TYCH 4 ZADAŃ URUCHOM:
ATLAS-UI-SHELL-INTEGRATOR
```

Do not claim worker work has started merely because branches exist.

Do not continue implementing Lane A/B/D/F in the same bootstrap execution. The purpose of durable aliases is to make the parallel jobs independently visible and launchable.

## Wave progression

After Wave 1 workers finish, run:

`ATLAS-UI-SHELL-INTEGRATOR`

The integrator reviews/integrates Wave 1, freezes Lane A interfaces, creates/releases Wave 2 branches and tells the user to launch in parallel:

- `ATLAS-UI-SHELL-NAV-CONTEXT`
- `ATLAS-UI-SHELL-INSPECTOR`

After Wave 2 finishes, run `ATLAS-UI-SHELL-INTEGRATOR` again. It performs shared FullWorld wiring and releases:

`ATLAS-UI-SHELL-RESPONSIVE-ACCEPTANCE`

After Lane G finishes, run `ATLAS-UI-SHELL-INTEGRATOR` again for defect reconciliation, final candidate freeze, exact-head qualification, protected squash merge and merged-main live acceptance.

## Parallel and verification invariants

- One mutable path = one active owner.
- One worker = one branch/worktree.
- Worker aliases never merge to protected `main`.
- The integrator owns the only implementation PR and all coordinator hot files.
- Targeted deterministic tests may run concurrently when isolated.
- Heavy browser tests must use current `e2e/run.ps1` slot policy; never bypass or exceed current capacity.
- Lane-local evidence never substitutes for final exact-head integrated qualification.
- Any code-changing post-freeze commit invalidates affected final evidence.
- Required visual frames must be actually opened/reviewed before local E2E approval.
- Oteryn-Game remains read-only for this programme.

## Stop conditions

Return `WAITING_EXTERNAL` if implementation ownership prerequisites are not satisfied.

Return `WAITING_COORDINATOR` if a resumptive invocation finds an incomplete/malformed task packet that cannot be safely repaired from GitHub authority.

Return `WAVE_1_READY` only after the implementation Issue, coordinator task packet and four Wave 1 branches are durable and verified.

Never fabricate a readiness state to keep workers busy.