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

If an already-prepared material candidate cannot use the normal authorized publication path, do not silently reconstruct or relabel that selected candidate. Preserve its custody and return publication control to the active control plane. The control plane may select only an API-native **new candidate** route permitted by the bound META policy, including the bounded connector-compatible Git Data mode only under its exact one-writer/predecessor/one-commit/non-force/post-readback conditions. Ad-hoc raw Git Data reconstruction, sequential per-file API publication, force/ref replacement, reset and rebase remain forbidden.

Verification success does not authorize publication or deployment. Publication and live deployment are separate lifecycles requiring their own explicit authority. A separately authorized deployment must originate from an exact clean revision already merged to protected `main` and follow `docs/agents/operations/LIVE_DEPLOYMENT.md` plus the current live-operations runbook.

## Historical material and safety

`docs/superpowers/**` and completed maintenance/restoration evidence are historical provenance only unless current live authority explicitly asks for a specific historical decision. Do not reconstruct retired workflow topology from historical material.

Preserve projection, provenance, rendering, geometry, and browser-oracle integrity. Do not commit secrets, private data, raw proprietary inputs, or unlicensed assets. Do not weaken verification, protection, provenance, or review requirements to make a change pass.

## Jira programme coordination

Oteryn programme coordination is mirrored in Jira project `KAN` at `https://oteryn.atlassian.net`; `KAN-23` is the programme overview. When an Atlassian/Jira connector is available in the current session, use it as a bounded programme-coordination surface.

- After the normal GitHub preflight for a substantial start or resume, resolve an **existing mapped Jira Story** for the current workstream. Prefer a native GitHub source link on the Jira item; otherwise require an exact repository/workstream label match. Do not map work by a similar title alone.
- Read only the mapped Story, its parent Epic, priority, status, fixVersion/milestone and readiness labels needed for the current decision. Do not bulk-load unrelated Jira history.
- **GitHub remains repository lifecycle and technical source of truth** for repository identity, Issues/tasks, branches, PRs, exact SHAs, checks, review, Merge Queue and integration. Repository contracts/task records remain implementation authority. Jira is the programme roadmap/readiness/milestone view and never grants repository, merge, production, secret or cross-repository mutation authority.
- Ordinary repository workers may update only their already-mapped programme Story after a verified material state transition. Broad Jira restructuring, new programme Epics/Versions, cross-workstream reprioritization and edits to `KAN-23` belong to the programme coordinator unless the owner explicitly delegates them.
- Use the established programme state convention: queued/blocked/stalled work stays `Do zrobienia` with the matching `readiness-queued`, `readiness-blocked` or `readiness-stalled` label; active work is `W toku` with `readiness-active`; completed work is `Gotowe` with `readiness-complete` only after the Story's full acceptance is verified. Use `W trakcie weryfikacji` when implementation is complete but required review/qualification is still pending.
- Fresh-read both Jira and the linked GitHub state before a Jira mutation. Do not spam comments or rewrite unchanged fields. A closed individual GitHub Issue/PR does not make an aggregate Jira Story complete while another linked acceptance source remains open.
- If the Jira connector is unavailable, the mapping is absent, or Jira write capability is unavailable, continue otherwise-authorized repository work. Record Jira synchronization as pending/unknown rather than inventing a mapping, creating duplicate programme items, or treating Jira availability as an implementation blocker.
