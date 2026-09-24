# ATLAS-META-INTEGRATION-ROUTING-REPIN

Governing Issue: #511

```yaml
status: implementing
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: f901028d489622fec5d5017c199825afd2e68b4d
branch: governance/meta-routing-repin-v2-511
pr: null
owner: coordination-agent
created_at: 2026-09-24T14:47:00Z
updated_at: 2026-09-24T14:47:00Z
owned_paths:
  - docs/agents/META_AGENT_POLICY_BINDING.json
  - tools/governance/validate_meta_agent_policy.py
  - tools/governance/test_validate_meta_agent_policy.py
  - tools/governance/test_agent_prompt_lifecycle.mjs
  - docs/maintenance/META_AGENT_POLICY_V3_ADOPTION.md
  - docs/agents/tasks/active/ATLAS-META-INTEGRATION-ROUTING-REPIN.md
depends_on:
  - Oteryn/Oteryn#224
cross_repository_coordination_id: META-INTEGRATION-ROUTING-REPIN
```

## Outcome

Atlas consumes final protected META policy 3.1 authority `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`, including the organization protected-integration capability router, while preserving Atlas selective-verification and Merge Queue authority unchanged.

## Evidence

- PROVEN: META PR #224 protected-integrated at `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`.
- PROVEN: real META merge-group CI succeeded for #224.
- PROVEN: protected Atlas `main@f901028d489622fec5d5017c199825afd2e68b4d` currently binds policy 3.1 to `21bc49bccef4874b037aabcbde9732b904187c32`.
- DERIVED: this authority identity movement requires fresh Atlas qualification and cannot reuse prior-base terminal verification as final evidence.

## Acceptance

- [ ] binding and exact supported 3.1 coordinate equal `1bfb5ff98c8aa156e73669a14e083a1d464c29fb`;
- [ ] Python and Node governance tests reject superseded `21bc49bccef4874b037aabcbde9732b904187c32` for current 3.1;
- [ ] current maintenance truth defers route selection to the bound META integration-capability router;
- [ ] protected Atlas verification and merge-authority gates are fresh and green on the exact final head;
- [ ] applicable independent review is clean;
- [ ] protected Merge Queue `merge_group` succeeds and protected-main readback contains the accepted candidate.

## Excluded

No Atlas runtime/product/verification executor/planner/catalog/ruleset/protection/deployment/production/secret mutation. No retired #315/#457 topology revival. No direct merge, generic auto-merge, bypass, force/reset/rebase or provider-local Merge Queue bridge.

## Checkpoint

```yaml
last_progress: rebuilt from current protected main after #514 base conflict
head_sha: null
pr: null
status: implementing
validation: pending exact-head protected CI after PR creation
blocker: null
next_action: open canonical successor PR and qualify its exact head
```
