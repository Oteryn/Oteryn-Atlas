# ATLAS-FULLWORLD-COORDINATOR

```yaml
task_id: ATLAS-FULLWORLD-COORDINATOR
title: Full-world Atlas programme coordination
lifecycle_authority: GitHub Issue
lifecycle_issue: 11
repository: Oteryn/Oteryn-Atlas
base_branch: main
coordination_origin_branch: coord/ATLAS-FULLWORLD-COORDINATOR
coordination_origin_branch_state: merged_and_deleted
base_sha: 610518701ad3709692d55c6dc38a152edd0363f3
source_repository: Oteryn/Oteryn-Game
source_main_sha: 63a6cb8cb3e69b7c2f792475f24093e90bd7fd81
prompt: docs/agents/prompts/ATLAS-FULLWORLD-AGENT-SUITE.md
prompt_sha: 610518701ad3709692d55c6dc38a152edd0363f3
created_at: 2026-08-19T09:07:00+02:00
owned_paths:
  - docs/agents/tasks/active/ATLAS-FULLWORLD-COORDINATOR.md
  - docs/evidence/ATLAS-FULLWORLD-PROGRAMME-LEDGER.md
```

> Lifecycle state, ownership, dependencies and acceptance are authoritative in GitHub Issue #11. This packet is technical/provenance detail only; do not maintain mutable lifecycle status here.

## Objective

Coordinate the complete-world Atlas programme without taking over the heavy local generation implementation owned by `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`. Preserve the authority boundary that `Oteryn-Game` owns World/Content semantics and `Oteryn-Atlas` is a derived semantic read model.

## Verified startup state

### PROVEN

- Atlas `main` is `610518701ad3709692d55c6dc38a152edd0363f3` at activation.
- Game `main` is `63a6cb8cb3e69b7c2f792475f24093e90bd7fd81` at activation.
- DYN-ATLAS-001 is present on Atlas `main` through merge commit `750ecab7b600ea078a832f5f95059f08ce57a06a`.
- The canonical execution suite is `docs/agents/prompts/ATLAS-FULLWORLD-AGENT-SUITE.md`.
- Atlas has no open PR at activation.
- Atlas issue #6 (`governance: close Atlas extraction and protect main`) remains open.
- Live repository metadata reports Atlas `main` as unprotected at activation.
- The bounded DYN proof remains evidence only; it does not prove full-world floors, counts, layer availability or production-scale performance.

### CONFLICT

The archived DYN-ATLAS-001 task file still describes the remaining merge as pending, while live `main` already contains PR #4 via merge commit `750ecab7b600ea078a832f5f95059f08ce57a06a`. Treat the live repository state as current and the archived wording as historical/stale closeout text; do not use it to reopen the completed proof.

### UNKNOWN

- full-world floor census, bounds and counts;
- measured optimal worker count and local resource envelope;
- full-world semantic/pixel roots and byte sizes;
- authoritative availability of each requested semantic layer;
- full-world browser memory/performance characteristics;
- final Synology preview revision/URL;
- final exact-head CI run IDs.

## Dependency graph

```text
COORDINATOR
  |
  +--> LOCAL-GENERATION-FABRIC ----------------------+
  |                                                  |
  +--> SEMANTIC-LAYERS (authority audit only)        |
  |                                                  v
  +--> CI-PREVIEW-CLOSEOUT (planning only)      COMPILER-PUBLICATION
                                                     |
                                                     +--> SEMANTIC-LAYERS implementation
                                                     |
                                                     +--> GUI-RUNTIME
                                                               |
                                                               v
                                                    CI/PREVIEW/CLOSEOUT
                                                               |
                                                               v
                                                           COORDINATOR
                                                          final reconcile
```

## Agent status and hand-offs

| Agent | Current status | May start now | Required hand-off |
| --- | --- | --- | --- |
| `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC` | READY | yes | census, benchmark evidence, deterministic resumable shard manifests/digests |
| `ATLAS-FULLWORLD-COMPILER-PUBLICATION` | BLOCKED_ON_GENERATION_HANDOFF | no heavy compile yet | world/floor manifests, roots, pixel publication and reconciliation evidence |
| `ATLAS-SEMANTIC-LAYERS-AND-INDEXES` | READY_AUTHORITY_AUDIT_ONLY | yes | per-layer source proof/status; implementation waits for stable publication contracts where required |
| `ATLAS-FULLWORLD-GUI-RUNTIME` | BLOCKED_ON_PUBLICATION_CONTRACT | bounded design inspection only | full-world browser/runtime qualification and screenshots |
| `ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT` | READY_PLANNING_ONLY | yes | CI plan may proceed; final verification/deploy waits for publication + layers + GUI |

## Path ownership

Path ownership is advisory locking. An agent that needs a path outside its allocation must stop and request coordinator reconciliation before editing.

### Coordinator

- `docs/agents/tasks/active/ATLAS-FULLWORLD-COORDINATOR.md`
- `docs/evidence/ATLAS-FULLWORLD-PROGRAMME-LEDGER.md`

### `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`

- `tools/fullworld-generation/**`
- `docs/evidence/fullworld-generation/**`
- local workstation work/cache/checkpoint directories outside the repository

`Oteryn/Oteryn-Game` is read-only unless the generation agent proves an export/tooling change is required. Any Game mutation requires a separate Game task, branch and PR under Game policy, with the same programme coordination ID.

### `ATLAS-FULLWORLD-COMPILER-PUBLICATION`

- `tools/fullworld-publication/**`
- `docs/evidence/fullworld-publication/**`
- `tests/fullworld-publication/**`
- publication format/contracts under `src/publication/**`

### `ATLAS-SEMANTIC-LAYERS-AND-INDEXES`

- `tools/fullworld-layers/**`
- `docs/evidence/fullworld-layers/**`
- `src/layers/**`
- `tests/fullworld-layers/**`

Browser-shell integration is not owned by this agent; expose stable layer contracts/data APIs for the GUI agent.

### `ATLAS-FULLWORLD-GUI-RUNTIME`

- `src/browser/**`
- `web/**`
- browser/runtime-specific tests under `tests/**` after checking for overlap with existing or newly claimed publication/layer tests
- `docs/evidence/fullworld-gui/**`

### `ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT`

- `.github/workflows/**`
- `docs/evidence/fullworld-closeout/**`
- preview/deployment-only tooling under a dedicated `tools/fullworld-closeout/**` subtree

Do not alter another agent's evidence or task record merely to make a gate pass.

## Acceptance gates

### G0 — programme preflight

PASS when current Atlas/Game heads, authority boundaries, open work and path ownership are recorded without guessed facts.

Status: **PASS** at activation.

### G1 — census and local benchmark

PASS when all exported floors/bounds/counts are censused and representative worker-count benchmarks establish the measured stable local concurrency/resource policy.

Status: **PENDING — owner: LOCAL-GENERATION-FABRIC**.

### G2 — complete generation fabric

PASS when every authoritative full-world shard exists, validates against the pinned Game source, is independently resumable/deterministic and has exact digests/provenance.

Status: **PENDING — owner: LOCAL-GENERATION-FABRIC**.

### G3 — canonical full-world publication

PASS when world/per-floor roots, semantic indexes, authorized pixel publication and resolved-primitive reconciliation are deterministic and fail closed.

Status: **BLOCKED on G2 — owner: COMPILER-PUBLICATION**.

### G4 — semantic layers

PASS when every intended layer is either `ENABLED/PROVEN` from authoritative data or has an exact `BLOCKED/UNKNOWN` reason, with deterministic full-world indexes/tests for enabled layers.

Status: **PARTIALLY STARTABLE (authority audit), implementation dependent on upstream facts — owner: SEMANTIC-LAYERS-AND-INDEXES**.

### G5 — full-world GUI/runtime

PASS when all exported floors can be navigated in the real browser from verified manifests, enabled layers/search/inspector/deep-links work, and memory/performance evidence is measured without legacy fallback.

Status: **BLOCKED on stable G3/G4 contracts — owner: GUI-RUNTIME**.

### G6 — CI and preview

PASS when exact-head CI verifies the full-world contracts without hosted heavy generation, and an isolated Synology preview is independently verified from a real client.

Status: **PLANNING STARTABLE; final execution BLOCKED on G3-G5 — owner: CI-PREVIEW-CLOSEOUT**.

### G7 — final integration/closeout

PASS when subordinate PRs are reconciled in dependency order, exact-head CI is green on the intended final head, issue #6 governance/protection gap is dispositioned, preview points to the intended merged revision, tasks are archived and post-merge `main` inspection passes.

Status: **BLOCKED on G1-G6**.

## Baseline evidence from DYN-ATLAS-001

These values are bounded proof baselines only and MUST NOT be reused as full-world results:

```text
bounded floor = -7
bounded tiles = 24,311
bounded presentation records = 39,282
bounded semantic root = sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1
bounded pixel root = sha256:91bbce72598fc3887d8e0d454d03d0aa5cc4d9ef0d30c3848e3ab1b711ede70a
bounded sprite refs = 990
bounded unique pixel blobs = 987
15.32.zip SHA-256 = 1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f
```

Authorization applies only to the exact archive/digest already attested by DYN-ATLAS-001 unless separately extended by authoritative evidence.

## Merge order

Default integration order unless measured evidence forces a coordinator re-plan:

1. local generation fabric tooling/evidence and any separately required Game export PR;
2. compiler/publication;
3. semantic layers/indexes;
4. GUI/runtime;
5. CI/preview/closeout;
6. coordinator final reconciliation/archive.

Authority-audit and CI-planning documentation may merge earlier when disjoint and truthful.

## Context checkpoint

```yaml
last_verified_at: 2026-08-19T09:07:00+02:00
atlas_main_sha: 610518701ad3709692d55c6dc38a152edd0363f3
game_main_sha: 63a6cb8cb3e69b7c2f792475f24093e90bd7fd81
phase: A
next_action: merge this coordination bootstrap after exact-head CI, then start LOCAL-GENERATION-FABRIC while SEMANTIC-LAYERS performs authority audit and CI-PREVIEW-CLOSEOUT performs planning only
blockers:
  - full-world census/generation hand-off not yet produced
  - Atlas issue #6 governance/main-protection gap remains open for final closeout
```
