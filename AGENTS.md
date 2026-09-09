# Oteryn Atlas agent instructions

These instructions govern `Oteryn/Oteryn-Atlas`.

## Authority bootstrap

Resolve `docs/agents/META_AGENT_POLICY_BINDING.json` before material mutation. The binding selects immutable organization policy; it does not grant repository, merge, production, secret, or cross-repository authority.

Current execution authority comes from protected `main`, the current GitHub task/Issue authority, and the workflows and rulesets active on protected `main`. Issue #315 is the lifecycle record for the completed verification-restoration and legacy-retirement programme; it is not standing authority to restart R1-R5 or revive retired topology.

Use one task branch per mutating owner, preserve unrelated work, and integrate only through protected PR and Merge Queue paths. Never direct-push or force-push protected `main`.

## Atlas authority and data boundaries

- `Oteryn/Oteryn-Game` owns canonical World/Content semantics.
- Atlas is a derived semantic projection/read model and must not invent Game-owned coordinates, floors, ordering, identity, or content semantics.
- Legacy OTBM/Tibia/Canary/Crystal inputs are migration/reference evidence only. Browser runtime must never use them as fallback authority.
- Platform may coordinate contracts but is not an Atlas runtime data source.
- Unknown provenance, rights, coordinates, or semantics block the affected claim; they never authorize guessing.

## Blocking verification authority

Selective verification is active blocking authority through `.github/workflows/verification-shadow.yml` on protected `main`.

- PR verification uses protected `pull_request_target` semantics.
- Merge Queue verification uses direct `merge_group: checks_requested` semantics.
- Protected `main` owns workflow, planner, catalog, impact-routing, stable-ID, execution-policy, and verification-oracle authority.
- Candidate bytes are inert subjects. Candidate code cannot narrow, replace, or spoof protected verification authority.
- Qualification fixtures and production data used to prove equivalent behavior must traverse the same publication manifest, floor/chunk/range, digest-validation, loader, runtime, renderer, and interaction seams; a parallel mock application is not equivalent evidence.
- Preserve independent test oracles. Test hooks and diagnostics may expose truthful read-only state, but must not mutate product state, inject fake authority, bypass normal loading, or become an alternate runtime source.
- Protected and candidate checkouts do not persist credentials.
- Unknown or unowned paths fail closed.
- Accepted deterministic and browser retries are zero; do not rerun-until-green, broaden allowlists, hide failures, or add arbitrary sleeps.

User-visible changes require real-browser journeys and reviewed full-frame evidence. Accepted visual evidence must identify the reviewer, exact Atlas revision, exact Playwright result, and screenshot digests before it can support a protected acceptance claim.

The expected protection chain is ruleset `22103758` (`Protect main`), organization workflow authority `22352928`, and selective-verification ruleset `22592581`. Do not weaken, remove, or bypass those protections without explicit owner authority for the exact action.

## Verification capability route

Verification profile (`none`, `focused`, `targeted`, `broad`, `full`) and data capability are independent. The data capabilities are `qualification_fixture`, `bounded_real_world`, and `real_fullworld`.

Use the minimum truthful capability for the oracle. Ordinary functional, interaction, state, geometry, responsive, accessibility, fault/race, and similar verification must not require complete FullWorld bytes when a qualification fixture or bounded real-world substrate proves the same invariant. `real_fullworld` and Molehill-PC are specialist-only when the protected plan proves a genuine complete-product, native/GPU, scale/performance/soak, or equivalent specialist requirement.

Before selecting a profile, capability, or specialist runner, read `docs/agents/operations/VERIFICATION_CAPABILITY.md`.

## Integration, publication, and deployment

Require the repository's protected exact-candidate checks and normal Merge Queue integration. Local tests are supporting evidence, not merge authority.

Verification success does not authorize publication or deployment. Publication and live deployment are separate lifecycles requiring their own explicit authority. A separately authorized deployment must originate from an exact clean revision already merged to protected `main` and follow `docs/agents/operations/LIVE_DEPLOYMENT.md` plus the current live-operations runbook.

## Historical material and safety

`docs/superpowers/**` and completed maintenance/restoration evidence are historical provenance only unless current live authority explicitly asks for a specific historical decision. Do not reconstruct retired workflow topology from historical material.

Preserve projection, provenance, rendering, geometry, and browser-oracle integrity. Do not commit secrets, private data, raw proprietary inputs, or unlicensed assets. Do not weaken verification, protection, provenance, or review requirements to make a change pass.