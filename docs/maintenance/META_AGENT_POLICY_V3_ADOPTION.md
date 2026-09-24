# Atlas META Agent Policy 3.1 Adoption

## Current authority

Atlas adopts `OTERYN_ORGANIZATION_AGENT_POLICY` version `3.1.0` from protected META commit `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`.

Protected META `21bc49bccef4874b037aabcbde9732b904187c32` carried the bounded connector-compatible publication authority previously consumed by Atlas. Protected META PR #224 later integrated the organization-wide integration-capability routing guard without changing policy version `3.1.0`; the current immutable provider authority is now `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`.

The organization integration contract now resolves the bound META integration-capability router. Provider task prose does not select the native or delegated actuator. The active control plane consumes the router's sealed current decision, and `BLOCKED_CAPABILITY_UNAVAILABLE` is valid only when that bound router returns the blocked state. Atlas Merge Queue, verification, review and protected-main authority remain unchanged.

## Atlas lifecycle truth

The Atlas verification simplification / legacy-retirement programme Oteryn/Oteryn-Atlas#315 is CLOSED. LR4 retirement PR #444 is protected on current Atlas `main`; historical #315/#457 restoration topology is not standing authority for this adoption.

This repin changes provider policy authority and activates the protected META publication-integrity contract for Atlas provider consumption. It does not reactivate retired recovery topology, create a new verification executor, change product/runtime/deployment behavior, alter rulesets or required checks, or authorize a bypass. Atlas continues to use its current protected verification and Merge Queue authority as they exist on the integration candidate.

## Verification-authority effect

`docs/agents/META_AGENT_POLICY_BINDING.json` is an explicit component of the protected Atlas verification-authority identity. Repinning its immutable META commit therefore changes the verification-authority digest even though this PR authors no verification executor, planner, workflow, ruleset, required-check or activation change.

That authority-identity movement invalidates reuse of verification evidence bound to the previous authority. Under the current protected base-advance contract, `classifyBaseAdvance` must classify this authority movement as `FULL_RERUN`; prior-base verification evidence is not terminal proof for this adoption. The exact candidate must be qualified afresh by the protected Atlas gates after every protected-base advance that changes this authority identity.

This is an evidence-reuse/authority-identity effect, not a reactivation of the completed #315 restoration programme and not an authorization to require `real_fullworld` unless the current protected plan independently requires that capability.

## Delivery contract

The authenticated Atlas consumer must resolve the exact bound META commit, validate policy identity/version and canonical human surfaces, and fail closed if the binding cannot be authenticated as protected-META ancestry. Root/reusable prompt validation remains provider-owned; binding success does not itself grant merge, production or cross-repository authority.

Protected prerequisite PR #489 established the fail-closed provider consumer, PR #510 moved policy `3.1.0` to `33b212e652c680bd4047be3b414c9a358b8bf26f`, and the later bounded-connector adoption moved it to `21bc49bccef4874b037aabcbde9732b904187c32`. This repin atomically supersedes `21bc49bccef4874b037aabcbde9732b904187c32` with `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`; the previous coordinate is no longer accepted for the current 3.1 binding, while legacy 3.0 compatibility and rejection of mixed, unknown or malformed coordinates remain unchanged.

For an already-prepared material candidate, unavailable normal publication remains a custody boundary: Atlas must not relabel or silently reconstruct that selected candidate. The active control plane may instead select only an API-native **new candidate** route permitted by the bound META policy. The bounded connector-compatible Git Data mode is allowed only under the exact single-writer, fresh predecessor, one complete sole-parent commit, one non-force task-branch update and immediate candidate-readback conditions; ad-hoc raw Git Data reconstruction, sequential per-file publication, force/ref replacement, reset and rebase remain forbidden.

## Integration

Before integration, refresh GitHub LIVE state and require the current Atlas repository gates plus any applicable fresh independent exact-head review. Resolve protected integration through the current bound META integration-capability router without selecting a provider-local actuator in Atlas task prose; if the bound router returns `BLOCKED_CAPABILITY_UNAVAILABLE`, preserve the qualified candidate. Require real protected Merge Queue/`merge_group` plus protected-main readback. Direct merge, generic auto-merge, GraphQL enqueue, provider-local bridge creation, bypass, force/reset and protection weakening are forbidden substitutes.
