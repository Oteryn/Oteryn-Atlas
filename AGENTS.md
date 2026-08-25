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

## Parallel-agent Git concurrency

The organization baseline is META ADR 0004 plus the central agent execution/continuation contract. Atlas keeps the bootstrap-critical minimum here because repository instructions do not inherit across repositories.

- For substantial mutating work, keep `admission_main_sha`, `task_head_sha` and `integration_main_sha` distinct. `admission_main_sha` is immutable task provenance; `task_head_sha` is the current task-branch head; `integration_main_sha` is the protected `main` selected at final integration.
- One active mutating worker owns one canonical task branch and one writable worktree. Do not share a writable branch/worktree between active agents.
- If protected `main` advances after admission, classify it as `UPSTREAM_ADVANCED`; that movement alone does not invalidate implementation and is not a reason to restart, reset, recreate, rebase, force-push or discard still-applicable work.
- If the upstream delta changes an applicable instruction, safety/security/provenance rule, architecture authority, compatibility contract or invariant, reload and reconcile that governing authority before further mutation while preserving unaffected work.
- Preserve published task history by default. When entering final integration, refresh to current `integration_main_sha` with a normal non-force merge-up, resolve only authorized conflicts, review the resulting diff and rerun every validation/review layer invalidated by the new `task_head_sha`.
- A lost merge race returns the task to integration/reconciliation, not to implementation from scratch.
- Invalidate affected work only when verified task cancellation/supersession/rescope, incompatible governing authority, semantic contract/API/schema/invariant conflict, an unresolvable authorized reconciliation, or required tests prove prior assumptions no longer hold. Textual overlap or a changed filename alone is not sufficient proof.

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
- User-visible UI/rendering changes additionally require user-facing visual acceptance in the real browser: representative user journeys, clipping/occlusion/hit-target checks, stable targeted visual baselines where useful, and exact-revision full-frame evidence. Technical renderer correctness or DOM presence alone is not visual acceptance.
- Required full-frame visual evidence must actually be opened and reviewed before publishing `atlas-local-e2e=success`. The review manifest must bind the reviewer, exact Atlas revision, exact Playwright summary and screenshot digests; agents must not auto-approve images they did not inspect.
- Map, camera, floor, viewport, WebGL, world-anchored layer, marker, creature or animation changes require geometry/transform/render synchronization verification where applicable. Performance-sensitive runtime changes require bounded stress/performance verification where applicable.
- Every reproducible defect found by a user, agent, audit, CI or live acceptance must receive a permanent deterministic regression test before the fix is accepted. Prefer: reproduce -> failing regression -> fix -> full applicable exact-head verification.
- Preserve independent test oracles: do not calculate an expected result exclusively through the same implementation path being tested.
- Keep deterministic acceptance failures visible. Do not use retries, broad allowlists, enlarged tolerances, arbitrary sleeps or unconditional skips to turn a real first failure green.
- Testability hooks may expose truthful read-only runtime diagnostics but must not mutate product state, bypass normal loading, inject fake authority, or become an alternate runtime data source.
- Do not add a user-facing module verification/status system. The source of truth is the executable suite and exact-head evidence.
- Follow the architecture and evidence contract in `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` for cross-cutting test-platform work and for selecting the applicable verification layers for feature changes.

## Verification execution placement

- GitHub-hosted CI owns deterministic Node/contract/property checks, provenance, security/CodeQL, lightweight browser/WebGL verification and `atlas-gate` fan-in; it does not replace the heavy physical browser qualification.
- Molehill-PC (`oteryn-molehill-atlas`, custom label `oteryn-atlas-pc`) owns heavy exact-head browser verification: the full Docker Playwright PR gate and scheduled/manual browser-depth work including repeated geometry/render probes, replayable stress, extra viewport/DPR profiles and stable performance/visual/accessibility/race/soak depth.
- Heavy Molehill qualification must be serialized through `e2e/run.ps1`; never launch concurrent 77-scenario local gates or competing full browser-depth runs against the same publication origin. The wrapper holds a machine-wide exclusive lock so agents wait instead of overloading the publication path.
- A pull request may skip heavy Molehill qualification only when the repository CI change classifier proves every current/previous changed path is safe lowercase-Markdown under `docs/**`. Mixed, empty, malformed, non-Markdown, root-doc, workflow, test, runtime, package, data or unknown changes fail closed to requiring exact-head `atlas-local-e2e`.
- Synology (`oteryn-synology-atlas`, custom label `oteryn-atlas`) owns trusted merged-main deployment and live acceptance only: exact revision/container/header identity, publication/product checks, bounded desktop/mobile real-browser smoke, cutover and rollback proof.
- Synology must not run the 77-scenario full PR matrix, broad stress matrices, soak, performance depth or visual-regression depth as a substitute for Molehill-PC capacity.
- Nightly browser depth is additive to the exact-head PR gate and must not duplicate the generic full required matrix that already produced `atlas-local-e2e=success`.
- If Molehill-PC is unavailable, the corresponding heavy browser proof remains blocked. Do not move that workload to Synology, reuse stale evidence, weaken timeouts/retries/tolerances or publish a copied `atlas-local-e2e` status.
- Molehill GitHub Actions steps must use the Windows PowerShell shell actually installed on the runner (powershell), not assume PowerShell 7 (pwsh).
- Nightly browser depth must not share Synology live-acceptance concurrency in a way that can cancel a pending deployment. It remains read-only and must fail closed unless X-Oteryn-Atlas-Revision equals the exact nightly SHA both before and after depth execution.

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
