# Atlas META Agent Policy 3.1 Adoption

## Current authority

Atlas adopts `OTERYN_ORGANIZATION_AGENT_POLICY` version `3.1.0` from protected META commit `3b39e0be05aef008f1bd442821daefa898a201dd`.

This is the final app-free META 3.1 authority produced by Oteryn/Oteryn#187. The organization integration contract uses native GitHub REST `merge-async` with the exact qualified `sha` and explicit `merge_action=merge_queue`. A direct authenticated execution surface may invoke that native operation. A custom Oteryn GitHub App is not required or authorized merely to submit Merge Queue work, and built-in workflow `GITHUB_TOKEN` is not used as the queue mutation credential when downstream `merge_group` execution is required.

## Atlas lifecycle truth

The Atlas verification simplification / legacy-retirement programme Oteryn/Oteryn-Atlas#315 is CLOSED. LR4 retirement PR #444 is protected on current Atlas `main`; the historical R5/#457 prerequisite is superseded and is not part of this adoption.

This repin changes only provider policy authority. It does not reactivate retired recovery topology, create a new verification executor, change product/runtime/publication/deployment behavior, alter rulesets or required checks, or authorize a bypass. Atlas continues to use its current protected verification and Merge Queue authority as they exist on the integration candidate.

## Verification-authority effect

`docs/agents/META_AGENT_POLICY_BINDING.json` is a verification-authority input. Changing its immutable META commit changes verification-authority identity, so evidence from a different binding must not be treated as proof for this candidate. The repository's current protected classifier/gates decide the required qualification from the actual candidate; historical verification-shadow/R5 blockers are not carried forward as current authority.

## Delivery contract

The authenticated Atlas consumer must resolve the exact bound META commit, validate policy identity/version and canonical human surfaces, and fail closed if the binding cannot be authenticated as protected-META ancestry. Root/reusable prompt validation remains provider-owned; binding success does not itself grant merge, production or cross-repository authority.

## Integration

Before integration, refresh GitHub LIVE state and require the current Atlas repository gates plus fresh independent exact-head review. Submit only through the protected META-governed native exact-head `merge-async` route and require real Merge Queue/`merge_group` plus protected-main readback. Direct merge, generic auto-merge, GraphQL enqueue, custom-App/PAT bridge creation, bypass, force/reset and protection weakening are forbidden substitutes.
