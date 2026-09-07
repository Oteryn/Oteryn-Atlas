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

## Active maintenance freeze

- Issue #315 is lifecycle authority for the temporary Atlas maintenance freeze. The organization-required `.github/workflows/merge-authority-audit.yml` evaluates the complete exact candidate diff with protected-base code and never executes candidate code.
- Product/runtime, publication inputs, deployment behavior, verification authority, and maintenance-gate code are frozen. Mixed maintenance/runtime changes are rejected. Automatic publication and deployment remain suspended.
- Normal maintenance changes are limited to the gate's closed operation/path allowlist: `AGENTS.md`, `docs/agents/**`, `docs/evidence/**`, `docs/maintenance/**`, `tools/governance/**`, and removal of obsolete `tests/verification/*.test.mjs` governance contracts. Matching a path is insufficient when its mode, content type, size, or operation is disallowed.
- The suspension cutover is integrated. The active workflow inventory is exactly the protected maintenance audit, the minimal Merge Queue `atlas-gate`, and terminal branch-lifecycle governance. The cutover was the only admitted workflow transition; normal maintenance does not authorize further workflow changes.
- The repository ruleset requires the strict `Merge authority audit / protected-base validate` status from GitHub Actions and Merge Queue. The retained merge-group workflow emits an additional `atlas-gate` check for merge groups; `atlas-gate` is not the configured required status during maintenance. Both retained gates run only the protected-base maintenance validator.
- Test restoration is a later #315 phase: restore each group in non-blocking shadow mode, qualify it through real PR/MQ canaries, then make only impact-applicable coverage blocking.

## Projection, provenance, and rendering invariants

- The immutable qualification world and production data must traverse the same publication manifest, floor/chunk/range, digest validation, loader, runtime, renderer, and interaction seams. A mock or alternate test application is not a substitute.
- Preserve independent test oracles. Test hooks may expose truthful read-only diagnostics but must not mutate product state, inject fake authority, bypass normal loading, or become another runtime source.
- Map, camera, floor, viewport, WebGL, world-anchored layer, marker, creature, and animation changes require applicable geometry, transform, render-synchronization, and bounded performance proof.
- User-visible changes require real-browser journeys and reviewed full-frame evidence where applicable. Evidence must bind the reviewer, exact Atlas revision, exact Playwright result, and screenshot digests; an agent cannot approve images it did not inspect.
- Keep deterministic failures visible. Do not use retries, broad allowlists, enlarged tolerances, arbitrary sleeps, or unconditional skips to turn a first failure green.
- Every reproducible defect receives a deterministic regression test before acceptance. Tests must prove behavior, failure paths, state transitions, reload/history behavior, malformed or unavailable inputs, and integration boundaries as applicable.
- Do not add user-facing verification/status UI. Executable exact-revision evidence is the source of truth.

## Verification capability route

Before selecting a verification profile, data capability or runner, or performing specialist/nightly verification, read `docs/agents/operations/VERIFICATION_CAPABILITY.md`. This route does not restore suspended verification or change the active maintenance freeze.

## Integration and live deployment

- Run repository-selected checks and every verification layer applicable to the changed behavior. Review the complete changed-file set and exact final-head diff.
- Verify that browser runtime consumes Atlas projection data only. Require the repository's exact-head aggregate gate before Merge Queue integration.

Before any separately authorized deployment, live acceptance or rollback, read `docs/agents/operations/LIVE_DEPLOYMENT.md`. Deployment sources remain clean, merged `main` revisions; the active maintenance freeze still governs whether the operation is permitted.

## Safety

- Do not commit raw OTBM/OTB/SPR/DAT inputs, secrets, credentials, private data, or unlicensed proprietary assets.
- Do not publish Tibia/CipSoft-derived pixels without explicit rights/provenance authority for that publication surface.
- Do not weaken protection, validation, provenance, or maintenance gates to make a task pass.
- Production deployment, protected environments, secrets, and live-system mutation require separate explicit authority.
