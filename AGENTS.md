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

## Capability truthfulness and tool discovery

Technical execution capability is determined by the tools, connectors and actions actually exposed in the current session, not by assumptions about Chat, Work, Codex or another UI mode. A rejected handoff, missing local checkout, missing `gh`, unauthenticated local CLI, or an earlier agent statement is not proof that GitHub or write capability is unavailable.

Before reporting that GitHub is read-only, commit/push/PR cannot be performed, Work mode is required, or repository work cannot continue, inspect all relevant currently exposed tools/actions and available authentication/permission evidence. Prefer repository-native GitHub operations for repository lifecycle work. If the preferred route fails, evaluate safe authorized fallbacks before asking the owner to switch modes or perform work manually.

Classify a real limitation precisely as missing tool/action, unauthenticated context, permission denied, unsupported operation, repository/policy restriction, transient transport/service failure, or another directly observed condition. Do not generalize one failed action into a broader capability claim. If the capability has not been checked, record it as `UNKNOWN` and perform discovery rather than presenting it as a blocker.

Capability discovery MUST be observational and least-mutating. Do not create throwaway branches, files, commits, comments, PRs, workflow runs, deployments or other durable state merely to prove write access. A genuine blocker report must name the exact operation, tool/connector/action inspected or attempted, observed failure, checked safe authorized fallbacks, and smallest missing capability or permission.

Remote Desktop/Desktop Commander remains exception-only under the organization execution-routing policy and is not the routine fallback for repository work. Tool availability never grants or broadens authorization.

## Parallel-agent Git concurrency

The organization baseline is META ADR 0004 plus the central agent execution/continuation contract. Atlas keeps the bootstrap-critical minimum here because repository instructions do not inherit across repositories.

- For substantial mutating work, keep `admission_main_sha`, `task_head_sha` and `integration_main_sha` distinct. `admission_main_sha` is immutable task provenance; `task_head_sha` is the current task-branch head; `integration_main_sha` is the protected `main` selected at final integration.
- One active mutating worker owns one canonical task branch and one writable worktree. Do not share a writable branch/worktree between active agents.
- If protected `main` advances after admission, classify it as `UPSTREAM_ADVANCED`; that movement alone does not invalidate implementation and is not a reason to restart, reset, recreate, rebase, force-push or discard still-applicable work.
- If the upstream delta changes an applicable instruction, safety/security/provenance rule, architecture authority, compatibility contract or invariant, reload and reconcile that governing authority before further mutation while preserving unaffected work.
- Preserve published task history by default. When entering final integration, refresh to current `integration_main_sha` with a normal non-force merge-up, resolve only authorized conflicts, review the resulting diff and rerun every validation/review layer invalidated by the new `task_head_sha`.
- A lost merge race returns the task to integration/reconciliation, not to implementation from scratch.
- Invalidate affected work only when verified task cancellation/supersession/rescope, incompatible governing authority, semantic contract/API/schema/invariant conflict, an unresolvable authorized reconciliation, or required tests prove prior assumptions no longer hold. Textual overlap or a changed filename alone is not sufficient proof.

## META execution-routing policy

The canonical organization policy is [`Oteryn/Oteryn@8fac1d55805fc3372351ea0a55ad7728b3570ebc:ecosystem/agent-execution-routing-policy.json`](https://github.com/Oteryn/Oteryn/blob/8fac1d55805fc3372351ea0a55ad7728b3570ebc/ecosystem/agent-execution-routing-policy.json). Atlas adopts it by reference and must not create a weaker local copy.

Route project work through GitHub state, GitHub Actions or the repository-approved runner, and an isolated worktree first. Remote Desktop/Desktop Commander is default-deny; a host exception requires a closed recorded reason and a least-privilege recorded action. It is not a route for ordinary builds, tests, Git inspection or manual polling. Equivalent CI prohibits RDC polling of process output, Docker logs, workflow state and Git state.

Before resuming, refresh GitHub repository/default-branch SHA/governing Issue/PR/task-head state; a local worktree or handoff is evidence only. Substantial task packets must plan parallel-first with independent lanes, exclusive branch/worktree and owned paths, dependencies, needed shared-resource leases and integration order. Serial work needs an explicit reason.

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
- User-visible UI/rendering changes additionally require user-facing visual acceptance in the real browser: representative user journeys, clipping/occlusion/hit-target checks, stable targeted visual baselines where useful, and exact-revision full-frame evidence.
- Required full-frame visual evidence must actually be opened and reviewed before any specialist visual approval or success evidence is published. The review manifest must bind the reviewer, exact Atlas revision, exact Playwright summary and screenshot digests; agents must not auto-approve images they did not inspect.
- Map, camera, floor, viewport, WebGL, world-anchored layer, marker, creature or animation changes require geometry/transform/render synchronization verification where applicable. Performance-sensitive runtime changes require bounded stress/performance verification where applicable.
- Every reproducible defect found by a user, agent, audit, CI or live acceptance must receive a permanent deterministic regression test before the fix is accepted. Prefer: reproduce -> failing regression -> fix -> full applicable exact-head verification.
- Preserve independent test oracles: do not calculate an expected result exclusively through the same implementation path being tested.
- Keep deterministic acceptance failures visible. Do not use retries, broad allowlists, enlarged tolerances, arbitrary sleeps or unconditional skips to turn a real first failure green.
- Testability hooks may expose truthful read-only runtime diagnostics but must not mutate product state, bypass normal loading, inject fake authority, or become an alternate runtime data source.
- Do not add a user-facing module verification/status system. The source of truth is the executable suite and exact-head evidence.
- Follow the architecture and evidence contract in `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` for cross-cutting test-platform work and for selecting the applicable verification layers for feature changes.

## Verification execution placement

- GitHub-hosted CI is the default execution plane for ordinary deterministic browser E2E, targeted/broad/full functional Playwright, deterministic Node/contract/property checks, provenance, security/CodeQL and the routine complete safety net. `atlas-gate` must consume exact-head GitHub-hosted evidence for ordinary pull requests and must not depend on an external Molehill success status.
- Molehill-PC (`oteryn-molehill-atlas`, custom label `oteryn-atlas-pc`) is specialist/exception-only. Use it only when a required fact cannot be proved equivalently on the GitHub-hosted plane, such as rights-restricted full-frame visual review, native Windows/browser or GPU/driver truth, LAN-only smoke, a specific hardware/driver reproduction, or an explicitly justified specialist benchmark. Merely being heavy or historically local is not a valid exception.
- Every Molehill exception must enter through an explicit fail-closed specialist workflow that records a closed `reason_code`, required capability, current protected-main policy SHA, exact current PR head and bounded resource class before the runner is scheduled. Ordinary PR events must not automatically schedule Molehill.
- Specialist Molehill browser qualification that uses `e2e/run.ps1` remains subject to its bounded machine-wide slot pool and isolated Compose/artifact namespaces. The measured legacy capacity remains a safety ceiling, not an ordinary-PR concurrency policy. Do not bypass the pool or treat its historical worker/slot values as the GitHub-hosted worker policy.
- Worker/shard defaults for ordinary PR Playwright must be selected only from fresh measurements on the actual GitHub-hosted target environment. Until the versioned Phase E policy exists, use a conservative explicit provisional setting; do not infer GitHub-hosted capacity from Molehill measurements.
- A pull request may skip ordinary GitHub-hosted browser qualification only when the repository CI classifier proves every current/previous changed path is safe lowercase-Markdown under `docs/**`. Mixed, empty, malformed, non-Markdown, root-doc, workflow, test, runtime, package, data or unknown changes fail closed to requiring exact-head browser E2E.
- Full-frame evidence containing Game-derived raster pixels remains restricted: keep it off routine GitHub artifacts, open every required frame through a policy-allowed visual inspection path before approval, and bind any approval to exact revision/summary/screenshot digests.
- Synology (`oteryn-synology-atlas`, custom label `oteryn-atlas`) is deployment-only: immutable merged-main artifact receive/verify, deploy, rollback, exact revision/container/header identity, and bounded external smoke/live acceptance. Synology must not build product artifacts or run ordinary/full E2E, broad stress matrices, soak, performance depth or visual-regression depth as a fallback.
- The complete routine full safety net belongs on GitHub-hosted infrastructure. Scheduled Molehill work may remain only for explicitly capability-specific specialist depth and must not duplicate ordinary full E2E merely because the machine is available.
- If a specialist capability is unavailable, that specialist proof remains blocked. Do not move it to Synology, reuse stale evidence, weaken timeouts/retries/tolerances/provenance, or substitute a copied success status.
- Molehill GitHub Actions steps must use the Windows PowerShell shell actually installed on the runner (`powershell`), not assume PowerShell 7 (`pwsh`).

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
