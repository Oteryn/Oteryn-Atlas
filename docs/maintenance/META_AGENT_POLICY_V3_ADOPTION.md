# Atlas META Agent Policy 3.1 Adoption

## Current authority

Atlas adopts `OTERYN_ORGANIZATION_AGENT_POLICY` version `3.1.0` from protected META commit `3b39e0be05aef008f1bd442821daefa898a201dd`.

This is the final app-free META 3.1 authority produced by Oteryn/Oteryn#187. The organization integration contract uses native GitHub REST `merge-async` with the exact qualified `sha` and explicit `merge_action=merge_queue`. A direct authenticated execution surface may invoke that native operation. A custom Oteryn GitHub App is not required or authorized merely to submit Merge Queue work, and built-in workflow `GITHUB_TOKEN` is not used as the queue mutation credential when downstream `merge_group` execution is required.

## Atlas lifecycle truth

The Atlas verification simplification / legacy-retirement programme Oteryn/Oteryn-Atlas#315 is CLOSED. LR4 retirement PR #444 is protected on current Atlas `main`; historical #315/#457 restoration topology is not standing authority for this adoption.

This repin changes provider policy authority. It does not reactivate retired recovery topology, create a new verification executor, change product/runtime/publication/deployment behavior, alter rulesets or required checks, or authorize a bypass. Atlas continues to use its current protected verification and Merge Queue authority as they exist on the integration candidate.

## Verification-authority effect

`docs/agents/META_AGENT_POLICY_BINDING.json` is an explicit component of the protected Atlas verification-authority identity. Repinning its immutable META commit therefore changes the verification-authority digest even though this PR authors no verification code, workflow, ruleset, required-check or activation change.

That authority-identity movement invalidates reuse of verification evidence bound to the previous authority. Under the current protected base-advance contract, `classifyBaseAdvance` must classify this authority movement as `FULL_RERUN`; prior-base verification evidence is not terminal proof for this adoption. The exact candidate must be qualified afresh by the protected Atlas gates after every protected-base advance that changes this authority identity.

This is an evidence-reuse/authority-identity effect, not a reactivation of the completed #315 restoration programme and not an authorization to require `real_fullworld` unless the current protected plan independently requires that capability.

## Delivery contract

The authenticated Atlas consumer must resolve the exact bound META commit, validate policy identity/version and canonical human surfaces, and fail closed if the binding cannot be authenticated as protected-META ancestry. Root/reusable prompt validation remains provider-owned; binding success does not itself grant merge, production or cross-repository authority.

The fail-closed provider consumer must be coherently updated to policy `3.1.0` before this binding can integrate. That consumer migration is a separately protected prerequisite so this provider repin cannot self-authorize its own verification routing or validator behavior.

## Integration

Before integration, refresh GitHub LIVE state and require the current Atlas repository gates plus fresh independent exact-head review. Submit only through the protected META-governed native exact-head `merge-async` route and require real Merge Queue/`merge_group` plus protected-main readback. Direct merge, generic auto-merge, GraphQL enqueue, custom-App/PAT bridge creation, bypass, force/reset and protection weakening are forbidden substitutes.
