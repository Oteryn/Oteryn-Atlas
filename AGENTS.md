# Oteryn Atlas agent instructions

These instructions govern `Oteryn/Oteryn-Atlas`.

## Authority

- Oteryn-Game is canonical World/Content authority.
- Atlas is a derived semantic projection/read model and may not invent Game-owned coordinates, floors, ordering, identity or content semantics.
- Legacy OTBM/Tibia/Canary/Crystal inputs are migration/reference evidence only; browser runtime must never parse them as fallback authority.
- Platform may coordinate Atlas contracts but is not an Atlas runtime data source.

## GitHub-first execution gate

GitHub is the authoritative control plane for Atlas repository identity, `main`, Issue/task status, PR, task branch, exact remote SHA, checks, reviews and merge state.

Before any local/remote repository mutation, including work through Remote Desktop/Desktop Commander, Synology, WSL, Docker or a local worktree, the agent MUST first resolve from GitHub the exact repository, current `main` SHA, governing Issue/task (or explicit `NOT_APPLICABLE` for bounded trivial/read-only work), active PR/task branch, exact base/head SHAs and material overlapping work.

Only after that preflight may host-local tooling be used for implementation, builds, tests, containers, Playwright, browser acceptance or artifact generation. Local clones, filesystems, worktrees, containers, shell history and cached state are execution/cache planes only and MUST NOT be treated as authority or used to bypass GitHub lifecycle.

Before editing locally, verify remote URL, branch/worktree identity, HEAD and working-tree state against the GitHub-resolved task. Preserve unrelated dirty work. After durable local changes, commit on the authorized task branch, push to GitHub, verify the remote head equals the intended commit, update the PR/task when applicable, and use exact-head GitHub CI/review state for readiness and completion.

Local-only work receives no completion credit until the durable result exists on the approved GitHub branch/PR. If GitHub is genuinely unavailable, continue safe read-only analysis/patch preparation but do not start new product mutations merely to bypass the control plane unless the owner explicitly authorizes an emergency exception.

## Work boundary

- Use a GitHub Issue as lifecycle authority for substantial work.
- Work from `main` on one dedicated task branch and one PR; never push ordinary work directly to `main`.
- Record exact base/head revisions and any pinned external evidence used by the task.
- Treat `UNKNOWN` provenance, rights, coordinates or semantics as a blocker to the affected claim, not permission to guess.

## Preflight

Before editing, inspect the current default-branch head, this file, the active Issue/PR, overlapping work, and only the architecture/contracts relevant to the paths being changed. Read a nearer `AGENTS.md` if one exists for a touched path.

## Testing completeness

- Treat executable verification as part of implementation. Every shipped behavior and every bug fix must include the deep applicable tests in the same delivery unless a precise technical blocker is recorded.
- Tests must prove behavior, not merely code/UI presence, a DOM node, a successful action, or a non-zero renderer counter. Cover relevant edge cases, failure paths, state transitions, reload/history behavior, malformed/unavailable inputs, and integration boundaries.
- Map, camera, floor, viewport, WebGL, world-anchored layer, marker, creature or animation changes require geometry/transform/render synchronization verification where applicable. Performance-sensitive runtime changes require bounded stress/performance verification where applicable.
- Every reproducible defect found by a user, agent, audit, CI or live acceptance must receive a permanent deterministic regression test before the fix is accepted. Prefer: reproduce -> failing regression -> fix -> full applicable exact-head verification.
- Preserve independent test oracles: do not calculate an expected result exclusively through the same implementation path being tested.
- Keep deterministic acceptance failures visible. Do not use retries, broad allowlists, enlarged tolerances, arbitrary sleeps or unconditional skips to turn a real first failure green.
- Testability hooks may expose truthful read-only runtime diagnostics but must not mutate product state, bypass normal loading, inject fake authority, or become an alternate runtime data source.
- Do not add a user-facing module verification/status system. The source of truth is the executable suite and exact-head evidence.
- Follow the architecture and evidence contract in `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` for cross-cutting test-platform work and for selecting the applicable verification layers for feature changes.

## Validation and merge

- Run repository-selected checks applicable to the changed paths and deterministic fixture/contract tests for generated semantic data.
- Run the complete applicable verification layers required by `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` for changed behavior; targeted local checks do not replace exact-final-head qualification.
- Review the complete changed-file set and full diff on the exact final head.
- Verify browser runtime consumes Atlas projection data only.
- Require exact-head CI, including stable `atlas-gate`, before merge.
- Squash merge only after all required checks/reviews pass; delete the completed task branch unless it has a documented continuing provenance role.

## Live deployment authority

- Live Atlas deployments originate only from merged `main`; task branches and detached experimental revisions must never be deployed.
- Dirty working trees must never be deployed. A live deployment must use the exact GitHub Actions `github.sha` for `refs/heads/main`.
- The deployed revision must match both the live container `org.oteryn.revision` label and the `X-Oteryn-Atlas-Revision` HTTP header before acceptance can pass.
- Historical Atlas SHAs must not be hard-coded as live deployment targets. External Game/legacy evidence may remain explicitly pinned where provenance requires it.
- Direct host mutation is not a normal deployment path; emergency rollback may only restore a previously merged `main` revision and must be re-qualified.

## Safety

- Do not commit raw OTBM/OTB/SPR/DAT inputs, secrets, credentials, private data or unlicensed proprietary assets.
- Do not publish Tibia/CipSoft-derived pixels without explicit rights/provenance authority for that publication surface.
- Do not weaken protection, validation or provenance gates to make a task pass.
- Production deployment, protected environments, secrets and live-system mutation require separate explicit authority.
