# Atlas META Agent Policy 3.1 Adoption

## Current authority

Atlas adopts `OTERYN_ORGANIZATION_AGENT_POLICY` version `3.1.0` from protected META commit `21bc49bccef4874b037aabcbde9732b904187c32`.

The prior protected META 3.1 authority `33b212e652c680bd4047be3b414c9a358b8bf26f` established the CAS-only API publication contract. Protected META PR #223 later added the bounded connector-compatible Git Data **new candidate** route without changing policy version `3.1.0`, so the current immutable provider authority for this rollout is `21bc49bccef4874b037aabcbde9732b904187c32`.

The organization integration contract continues to use native GitHub REST `merge-async` with the exact qualified `sha` and explicit `merge_action=merge_queue`. A direct authenticated execution surface may invoke that native operation. A custom Oteryn GitHub App is not required or authorized merely to submit Merge Queue work, and built-in workflow `GITHUB_TOKEN` is not used as the queue mutation credential when downstream `merge_group` execution is required.

## Atlas lifecycle truth

The Atlas verification simplification / legacy-retirement programme Oteryn/Oteryn-Atlas#315 is CLOSED. LR4 retirement PR #444 is protected on current Atlas `main`; historical #315/#457 restoration topology is not standing authority for this adoption.

This repin changes provider policy authority and activates the protected META publication-integrity contract for Atlas provider consumption. It does not reactivate retired recovery topology, create a new verification executor, change product/runtime/deployment behavior, alter rulesets or required checks, or authorize a bypass. Atlas continues to use its current protected verification and Merge Queue authority as they exist on the integration candidate.

## Verification-authority effect

`docs/agents/META_AGENT_POLICY_BINDING.json` is an explicit component of the protected Atlas verification-authority identity. Repinning its immutable META commit therefore changes the verification-authority digest even though this PR authors no verification executor, planner, workflow, ruleset, required-check or activation change.

That authority-identity movement invalidates reuse of verification evidence bound to the previous authority. Under the current protected base-advance contract, `classifyBaseAdvance` must classify this authority movement as `FULL_RERUN`; prior-base verification evidence is not terminal proof for this adoption. The exact candidate must be qualified afresh by the protected Atlas gates after every protected-base advance that changes this authority identity.

This is an evidence-reuse/authority-identity effect, not a reactivation of the completed #315 restoration programme and not an authorization to require `real_fullworld` unless the current protected plan independently requires that capability.

## Delivery contract

The authenticated Atlas consumer must resolve the exact bound META commit, validate policy identity/version and canonical human surfaces, and fail closed if the binding cannot be authenticated as protected-META ancestry. Root/reusable prompt validation remains provider-owned; binding success does not itself grant merge, production or cross-repository authority.

Protected prerequisite PR #489 originally established the fail-closed provider consumer, and PR #510 later moved policy `3.1.0` to `33b212e652c680bd4047be3b414c9a358b8bf26f`. This bounded-connector adoption supersedes that exact 3.1 coordinate with `21bc49bccef4874b037aabcbde9732b904187c32`; the previous `33b212e6...` coordinate is no longer accepted for the current 3.1 binding, while legacy 3.0 compatibility and rejection of mixed, unknown or malformed coordinates remain unchanged.

For an already-prepared material candidate, unavailable normal publication remains a custody boundary: Atlas must not relabel or silently reconstruct that selected candidate. The active control plane may instead select only an API-native **new candidate** route permitted by the bound META policy. The bounded connector-compatible Git Data mode is allowed only under the exact single-writer, fresh predecessor, one complete sole-parent commit, one non-force task-branch update and immediate candidate-readback conditions; ad-hoc raw Git Data reconstruction, sequential per-file publication, force/ref replacement, reset and rebase remain forbidden.

## Integration

Before integration, refresh GitHub LIVE state and require the current Atlas repository gates plus any applicable fresh independent exact-head review. Submit only through the protected META-governed native exact-head `merge-async` route and require real Merge Queue/`merge_group` plus protected-main readback. Direct merge, generic auto-merge, GraphQL enqueue, custom-App/PAT bridge creation, bypass, force/reset and protection weakening are forbidden substitutes.
