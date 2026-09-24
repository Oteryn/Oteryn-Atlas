# Atlas META Agent Policy 3.1 Adoption

## Current authority

Atlas adopts `OTERYN_ORGANIZATION_AGENT_POLICY` version `3.1.0` from protected META commit `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`.

Protected META `33b212e652c680bd4047be3b414c9a358b8bf26f` carried the publication-integrity authority previously consumed by Atlas. Protected META PR #224 later integrated the organization-wide integration-capability routing guard without changing policy version `3.1.0`; the current immutable provider authority is now `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`.

The organization integration contract now resolves the bound META integration-capability router. A freshly proven `DIRECT_CAPABLE` route may use native exact-head `merge-async`; when direct capability is absent, a freshly proven `DELEGATED_CAPABLE` route may use `meta.governed_merge_queue_executor.v1`. `BLOCKED_CAPABILITY_UNAVAILABLE` is valid only when neither route is proven. Neither route changes Atlas Merge Queue, verification, review or protected-main authority.

## Atlas lifecycle truth

The Atlas verification simplification / legacy-retirement programme Oteryn/Oteryn-Atlas#315 is CLOSED. LR4 retirement PR #444 is protected on current Atlas `main`; historical #315/#457 restoration topology is not standing authority for this adoption.

This repin changes provider policy authority and activates the protected META publication-integrity contract for Atlas provider consumption. It does not reactivate retired recovery topology, create a new verification executor, change product/runtime/deployment behavior, alter rulesets or required checks, or authorize a bypass. Atlas continues to use its current protected verification and Merge Queue authority as they exist on the integration candidate.

## Verification-authority effect

`docs/agents/META_AGENT_POLICY_BINDING.json` is an explicit component of the protected Atlas verification-authority identity. Repinning its immutable META commit therefore changes the verification-authority digest even though this PR authors no verification executor, planner, workflow, ruleset, required-check or activation change.

That authority-identity movement invalidates reuse of verification evidence bound to the previous authority. Under the current protected base-advance contract, `classifyBaseAdvance` must classify this authority movement as `FULL_RERUN`; prior-base verification evidence is not terminal proof for this adoption. The exact candidate must be qualified afresh by the protected Atlas gates after every protected-base advance that changes this authority identity.

This is an evidence-reuse/authority-identity effect, not a reactivation of the completed #315 restoration programme and not an authorization to require `real_fullworld` unless the current protected plan independently requires that capability.

## Delivery contract

The authenticated Atlas consumer must resolve the exact bound META commit, validate policy identity/version and canonical human surfaces, and fail closed if the binding cannot be authenticated as protected-META ancestry. Root/reusable prompt validation remains provider-owned; binding success does not itself grant merge, production or cross-repository authority.

The fail-closed provider consumer preserves policy `3.0.0` compatibility while admitting current policy `3.1.0` at exactly one immutable META coordinate. This repin atomically supersedes `33b212e652c680bd4047be3b414c9a358b8bf26f` with `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`; the previous coordinate is no longer accepted for the current 3.1 binding, and mixed, unknown or malformed coordinates remain fail-closed.

For an already-prepared material candidate, unavailable normal publication is a custody/blocking outcome. Atlas must preserve the candidate and must not synthesize a substitute through raw Git Data or per-file API reconstruction.

## Integration

Before integration, refresh GitHub LIVE state and require the current Atlas repository gates plus any applicable fresh independent exact-head review. Resolve the current bound META integration-capability route: use freshly proven direct capability when available, otherwise freshly proven delegated executor capability, and block only when neither is proven. Require real protected Merge Queue/`merge_group` plus protected-main readback. Direct merge, generic auto-merge, GraphQL enqueue, provider-local bridge creation, bypass, force/reset and protection weakening are forbidden substitutes.
