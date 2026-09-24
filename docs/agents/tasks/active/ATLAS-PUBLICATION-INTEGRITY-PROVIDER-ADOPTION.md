# ATLAS-PUBLICATION-INTEGRITY-PROVIDER-ADOPTION

Governing Issue: #512

```yaml
status: implementing
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 495c5e3c8581642468660eb7dfad60698b59a575
branch: governance/bounded-connector-publication-512
pr: pending
owner: coordination-agent
created_at: 2026-09-24T14:04:06Z
updated_at: 2026-09-24T14:06:00Z
owned_paths:
  - AGENTS.md
  - docs/agents/META_AGENT_POLICY_BINDING.json
  - tools/governance/validate_meta_agent_policy.py
  - tools/governance/test_validate_meta_agent_policy.py
  - tools/governance/test_agent_prompt_lifecycle.mjs
  - docs/maintenance/META_AGENT_POLICY_V3_ADOPTION.md
  - docs/agents/tasks/active/ATLAS-PUBLICATION-INTEGRITY-PROVIDER-ADOPTION.md
depends_on:
  - Oteryn/Oteryn#223
  - Oteryn/Oteryn-Game#838
cross_repository_coordination_id: PUBLICATION-INTEGRITY-PROVIDER-ROLLOUT
```

## Outcome

Atlas consumes protected META bounded-connector publication authority `21bc49bccef4874b037aabcbde9732b904187c32` while preserving selective-verification authority, protected Merge Queue and deployment boundaries.

## Evidence

- PROVEN: protected META PR #223 integrated as `Oteryn/Oteryn@21bc49bccef4874b037aabcbde9732b904187c32`.
- PROVEN: Game-first provider adoption #838 merged before this Atlas rollout.
- PROVEN: Atlas protected main at task start is `495c5e3c8581642468660eb7dfad60698b59a575`.
- PROVEN: Atlas binds policy `3.1.0` to one exact META coordinate; the supported coordinate therefore moves from `33b212e652c680bd4047be3b414c9a358b8bf26f` to `21bc49bccef4874b037aabcbde9732b904187c32`.
- PROVEN: binding movement is part of Atlas verification-authority identity and requires fresh protected qualification.

## Acceptance

- [ ] binding and fail-closed supported `3.1.0` coordinate equal exact `21bc49bccef4874b037aabcbde9732b904187c32`;
- [ ] Python and Node governance regressions reject the superseded/mixed coordinates;
- [ ] root and maintenance wording permit only the bound META API-native **new candidate** route, including bounded connector mode under exact one-writer/predecessor/one-commit/non-force/post-readback conditions;
- [ ] ad-hoc raw Git Data reconstruction, sequential per-file API publication, force/ref replacement, reset and rebase remain forbidden;
- [ ] protected Atlas verification / merge-authority gates are fresh and green on the exact final head;
- [ ] applicable independent review is clean;
- [ ] integration occurs only through protected Merge Queue, real `merge_group`, and protected-main readback.

## Excluded

No Atlas runtime/product/verification executor/planner/catalog/ruleset/protection/deployment/production/secret mutation. No retired verification-topology revival. No direct merge, generic auto-merge, force/rebase/reset, gate weakening or retry inflation.

## Checkpoint

```yaml
last_progress: bounded connector provider rebind authored on dedicated branch
head_sha: pending
pr: pending
status: implementing
validation: pending PR creation and exact-head protected qualification
blocker: null
next_action: open PR, bind its identity here, then consume exact-head protected checks and review
```
