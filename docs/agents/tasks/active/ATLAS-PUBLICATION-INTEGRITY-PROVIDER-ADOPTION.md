# ATLAS-PUBLICATION-INTEGRITY-PROVIDER-ADOPTION

Governing Issue: #509

```yaml
status: validating
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: cfec1189fa658598111d9a6d63f1a11057772ae9
branch: governance/publication-integrity-adoption-509
pr: null
owner: coordination-agent
created_at: 2026-09-17T05:46:56Z
updated_at: 2026-09-17T05:46:56Z
owned_paths:
  - AGENTS.md
  - docs/agents/META_AGENT_POLICY_BINDING.json
  - tools/governance/validate_meta_agent_policy.py
  - tools/governance/test_validate_meta_agent_policy.py
  - tools/governance/test_agent_prompt_lifecycle.mjs
  - docs/maintenance/META_AGENT_POLICY_V3_ADOPTION.md
  - docs/agents/tasks/active/ATLAS-PUBLICATION-INTEGRITY-PROVIDER-ADOPTION.md
depends_on:
  - Oteryn/Oteryn#212
  - Oteryn/Oteryn#213
cross_repository_coordination_id: PUBLICATION-INTEGRITY-PROVIDER-ROLLOUT
```

## Outcome

Atlas consumes protected META publication-integrity authority `33b212e652c680bd4047be3b414c9a358b8bf26f` while preserving the current selective-verification architecture, protected Merge Queue route and retired verification-topology boundaries.

## Evidence

- PROVEN: protected META PR #213 integrated at `Oteryn/Oteryn@33b212e652c680bd4047be3b414c9a358b8bf26f`.
- PROVEN: Atlas protected main at task creation is `cfec1189fa658598111d9a6d63f1a11057772ae9`.
- PROVEN: Atlas's consumer intentionally binds each supported policy version to one exact META commit; `3.1.0` must therefore move atomically from superseded `ce20300...` to `33b212e...`.
- PROVEN: binding movement is part of Atlas verification-authority identity and requires fresh protected qualification rather than evidence reuse.

## Acceptance

- [ ] `META_AGENT_POLICY_BINDING.json` binds exact `33b212e...` at policy `3.1.0`.
- [ ] `validate_meta_agent_policy.py` accepts only that exact current 3.1 coordinate while retaining legacy 3.0 compatibility.
- [ ] deterministic Python and Node governance tests reject the superseded/mixed coordinates.
- [ ] root/bootstrap and maintenance truth require candidate preservation/report-blocked rather than raw Git Data/per-file publication reconstruction.
- [ ] protected Atlas verification/merge-authority gates are fresh and green on the exact final head.
- [ ] applicable independent review is clean.
- [ ] integration occurs only through governed/native Merge Queue, real `merge_group`, and protected-main readback.

## Excluded

No Atlas runtime/product/verification executor/planner/catalog/ruleset/protection/deployment/production/secret mutation. No #315/#457 topology revival. No direct merge, generic auto-merge, force/rebase/reset, gate weakening or retry inflation.

## Checkpoint

```yaml
last_progress: exact binding, fail-closed validator coordinate, local publication boundary and deterministic tests prepared
head_sha: null
pr: null
status: validating
validation: pending exact-head protected CI
blocker: null
next_action: open one Draft PR and consume protected exact-head qualification
```
