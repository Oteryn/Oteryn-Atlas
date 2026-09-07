# Oteryn Atlas agent instructions

These instructions govern `Oteryn/Oteryn-Atlas`.

## Organization-policy bootstrap

Resolve `docs/agents/META_AGENT_POLICY_BINDING.json` before material mutation. The binding selects one immutable, merged META policy revision; it does not grant repository, merge, production, secret, or cross-repository authority. If required bound authority cannot be authenticated, fail closed for the affected operation while continuing safe independent work.

GitHub Issues remain Atlas lifecycle authority. Use one dedicated task branch and writable worktree per mutating owner, preserve unrelated work, and integrate only through the repository's protected PR and Merge Queue path. Repository, user, and task authority govern; skills and plugins are subordinate execution aids.

For an already-authorized write to an existing task branch/PR, if `GH_TOKEN` and `GITHUB_TOKEN` are unset but agent-visible `GH` is present, it may be mapped transiently to `GH_TOKEN` for the exact authorized `gh` command. Never embed that credential in a remote URL or persist a new credential helper. Credential presence does not broaden repository, branch, path, merge, production, or secret authority.

## Atlas authority and data boundaries

- Oteryn-Game is canonical World/Content authority.
- Atlas is a derived semantic projection/read model and must not invent Game-owned coordinates, floors, ordering, identity, or content semantics.
- Legacy OTBM/Tibia/Canary/Crystal inputs are migration/reference evidence only. Browser runtime must never parse them as fallback authority.
- Platform may coordinate Atlas contracts but is not an Atlas runtime data source.
- Treat unknown provenance, rights, coordinates, or semantics as a blocker to the affected claim, never permission to guess.

## Active maintenance remediation mode

- Issue #315 is lifecycle authority. The old Atlas test/verification/depth/dispatcher/publication/deployment workflow stack remains suspended. Production deployment and automatic publication remain outside the F01-F16 remediation programme and require separate authority.
- The organization-required `.github/workflows/merge-authority-audit.yml` evaluates the complete exact candidate diff with protected-base code and never executes candidate code. The maintenance validator and active workflow control plane remain self-frozen in steady state.
- Ordinary maintenance changes remain limited to the closed documentation/governance allowlist enforced by the protected validator.
- Corrective engineering for audit findings F01-F16 is not categorically frozen. It is admitted only by the protected-base `docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json`. A candidate may use at most one remediation lane; allowed remediation operations are additions/modifications only. Candidate edits to that allowlist do not authorize any other path in the same candidate because admission is resolved from the protected base.
- Verification-test deletion is not path-pattern authority. A verification contract may be deleted only when its exact path is already present in protected-base `docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json`. Editing that inventory and deleting the newly listed path in the same candidate must fail closed.
- The active workflow inventory remains exactly `.github/workflows/merge-authority-audit.yml`, `.github/workflows/merge-group-gate.yml`, and `.github/workflows/terminal-branch-lifecycle.yml`. Normal remediation does not authorize workflow additions or restoration of the retired aggregate stack.
- The repository ruleset requires the strict `Merge authority audit / protected-base validate` status from GitHub Actions and Merge Queue. The retained merge-group workflow emits an additional `atlas-gate` check for merge groups; `atlas-gate` is not the configured required status during maintenance. Both retained gates run only protected-base maintenance authority.
- Test restoration remains a later #315 phase: restore each group in non-blocking shadow mode, qualify it through real PR/MQ canaries, then make only impact-applicable coverage blocking.

## Projection, provenance, and rendering invariants

- The immutable qualification world and production data must traverse the same publication manifest, floor/chunk/range, digest validation, loader, runtime, renderer, and interaction seams. A mock or alternate test application is not a substitute.
- Preserve independent test oracles. Test hooks may expose truthful read-only diagnostics but must not mutate product state, inject fake authority, bypass normal loading, or become another runtime source.
- Map, camera, floor, viewport, WebGL, world-anchored layer, marker, creature, and animation changes require applicable geometry, transform, render-synchronization, and bounded performance proof.
- User-visible changes require real-browser journeys and reviewed full-frame evidence where applicable. Evidence must bind the reviewer, exact Atlas revision, exact Playwright result, and screenshot digests; an agent cannot approve images it did not inspect.
- Keep deterministic failures visible. Do not use retries, broad allowlists, enlarged tolerances, arbitrary sleeps, or unconditional skips to turn a first failure green.
- Every reproducible defect receives a deterministic regression test before acceptance. Tests must prove behavior, failure paths, state transitions, reload/history behavior, malformed or unavailable inputs, and integration boundaries as applicable.
- Do not add user-facing verification/status UI. Executable exact-revision evidence is the source of truth.

## Verification capability route

Before selecting a verification profile, data capability or runner, or performing specialist/nightly verification, read `docs/agents/operations/VERIFICATION_CAPABILITY.md`. This route does not restore suspended verification or alter protected maintenance admission.

## Integration and live deployment

- During F01-F16 remediation, run the narrow focused checks that prove the edited behavior and review the complete changed-file set and exact final-head diff. Suspended historical workflows are not current qualification evidence and must not be resurrected as a prerequisite.
- Require the repository's configured exact-candidate protected maintenance status and normal Merge Queue before integration. A remediation PR is not qualified merely because local focused tests pass.
- Verify that browser runtime consumes Atlas projection data only.

Before any separately authorized deployment, live acceptance or rollback, read `docs/agents/operations/LIVE_DEPLOYMENT.md`. Deployment sources remain clean, merged `main` revisions; active maintenance restrictions still govern whether the operation is permitted.

## Safety

- Do not commit raw OTBM/OTB/SPR/DAT inputs, secrets, credentials, private data, or unlicensed proprietary assets.
- Do not publish Tibia/CipSoft-derived pixels without explicit rights/provenance authority for that publication surface.
- Do not weaken protection, validation, provenance, or maintenance gates to make a task pass.
- Production deployment, protected environments, secrets, and live-system mutation require separate explicit authority.
