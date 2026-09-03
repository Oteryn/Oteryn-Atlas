# Atlas Documentation and Agent Information Architecture

**Artifact class:** `GOVERNANCE_POLICY`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Version:** 2  
**Status:** ACTIVE

## Purpose

This policy defines the minimum Atlas Documentation/Agent Information Architecture. It intentionally avoids maintaining a second mutable registry of prompt files, Git blob identities, task packets, Issue states or audit heads.

Oteryn-Game remains canonical World/Content authority. This policy does not change runtime, generated data, migration/extraction provenance, runner state, deployment state, branch protection, secrets or dependency authority.

## Authority model

Use the smallest existing authority for each fact:

- `docs/agents/prompts/*.md` owns prompt/execution-contract text;
- the prompt file stem is its stable repository identifier;
- Git history owns exact file/blob provenance and supersession history;
- GitHub Issues own mutable task/lifecycle state;
- `docs/agents/tasks/active/*.md` is an optional detail cache only and never overrides Issue or merged-PR truth;
- executable tests, schemas, accepted publication/provenance artifacts and scoped design/spec documents remain authoritative for the technical contracts they already own.

Do not duplicate those facts into a hand-maintained JSON census. A prompt addition, removal or edit is represented by the filesystem and Git commit that actually performs it. A lifecycle change is represented by the owning Issue. No separate registry repin is required.

Historical plans and evidence may refer to the retired `DOCUMENTATION_AGENT_IA.json` registry or its validator. Those references are historical provenance only and are not current authority.

## Documentation topology

Atlas does not create empty provider-wide taxonomies merely for symmetry with another repository.

### Architecture decision trigger

A standalone provider-wide architecture artifact is needed only when a durable **cross-programme Atlas architecture decision** has no existing authoritative owner/path. Existing scoped ADRs, design/spec documents and executable contracts remain sufficient otherwise.

### Provider-contract decision trigger

A standalone provider-contract artifact is needed only when a recurring **non-executable provider interface** needs one durable authority not already represented by executable code/tests, a schema, provenance, publication authority or an existing scoped specification.

### Existing durable owners

- repository and agent governance: `AGENTS.md`, `.github/CODEOWNERS` and applicable lifecycle policy;
- verification architecture: `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` plus executable verification contracts;
- live operation: `docs/operations/ATLAS-LIVE-OPERATIONS.md`;
- recovery: `docs/recovery/ATLAS-LIVE-RECOVERY.md`.

## Prompt lifecycle

`docs/agents/prompts/*.md` contains technical execution contracts.

- Treat a prompt as current execution authority only when an applicable live Issue, explicit owner instruction or other governing task authority authorizes it.
- A prompt whose owning task is terminal remains historical provenance unless new authority explicitly reactivates its work.
- Do not mass-edit prompt bodies merely to mirror Issue status, Git SHA, audit date or another mutable control-plane field.
- Do not maintain duplicate prompt counts, blob SHA maps or `ACTIVE/HISTORICAL` flags in a repository-side registry.
- When a prompt is materially superseded, record that through the successor authority and normal Git/Issue history; delete or archive the old file only when doing so improves current navigation without losing required provenance.

## Task lifecycle

GitHub Issues own mutable lifecycle status. `docs/agents/tasks/active/*.md` is an optional cache for detailed task context.

A packet may remain under `active/` only while its owning Issue is live. When the Issue becomes terminal, archive or delete the packet while preserving required Issue/PR provenance. Stale active packets are maintenance defects, not evidence that the Issue is still active.

Repository CI must not become a second Issue-state database. Lifecycle checks that depend on current GitHub state are performed against GitHub at admission, continuation and closeout checkpoints.

## Handover and evidence caches

Handoff summaries, local workstation paths, generation revisions, digests and measurements are historical evidence unless another current authority explicitly adopts them. They cannot override current GitHub lifecycle, merged `main`, accepted Game/Atlas publication authority or merged-main workflows.

## Validation

There is no mutable Documentation/Agent IA registry to reconcile.

For a Documentation/Agent IA change:

1. inspect the actual changed prompt/task/document files;
2. verify applicable owning Issue/task state directly from GitHub;
3. verify stale `tasks/active` packets are archived or removed when their Issue is terminal;
4. review the exact final Git diff and repository-selected checks for the changed paths;
5. rely on Git for exact content identity instead of copying blob SHAs into another file.

A future machine-readable index may be generated as a disposable build/report artifact when useful, but it must be derived from current authoritative sources and must not become a committed mutable status database.

## Supersession and rollback

This policy replaces the former policy+JSON-registry+validator model. The retired registry and its dedicated validator/test carried duplicated mutable state and are not required for current authority.

Rollback of this policy is documentation/governance-only. Never mutate runtime, generated data, migration provenance, runner state, deployment state or branch protection to roll it back.
