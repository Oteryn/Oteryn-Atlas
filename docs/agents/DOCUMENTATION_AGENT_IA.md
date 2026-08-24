# Atlas Documentation and Agent Information Architecture

**Artifact class:** `GOVERNANCE_POLICY`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Version:** 1  
**Status:** ACTIVE  
**Machine-readable companion:** `docs/agents/DOCUMENTATION_AGENT_IA.json`

## Purpose

This document is the bounded Atlas provider decision for the Documentation/Agent Information Architecture gaps discovered by `OTERYN-ORG-AUDIT-v3.10`. It does not create a symmetric documentation taxonomy. It records which existing Atlas authorities remain sufficient, which recurring procedures justify new canonical artifacts, and how prompt/task lifecycle is classified without becoming a second mutable status database.

Oteryn-Game remains canonical World/Content authority. This policy does not change runtime, generated data, migration/extraction provenance, runner state, deployment state, branch protection, secrets or dependency authority.

## Exact audited material

Audit-start Atlas head: `b8235bd4f46947aa54dfc2f19c96d3bc21e64283`.

Refreshed current-head inventory used for this closeout: `7130bea8e95016aa821eefd51b3dba9c18be09c7`, root tree `71f3db277c4238ccb242b104e82fe3c5c09210fa`.

Material IA identities are locked in the companion JSON. High-signal current identities include:

- prompt tree: `900d5262eac75bc01bf15efd4579b7e26f0f5aeb` — fourteen prompt files;
- active-task tree: `e8ee9b563973e819f0b63a236b1ed020ab8cc98c` — three active packets;
- `AGENTS.md`: blob `e4a498a875c7e01d5fc74a735a9098b0bfdb2f90`;
- `.github/CODEOWNERS`: blob `e3e59db55ac2b97068aae54a805373fc1261eee5`;
- `docs/agents/BRANCH_LIFECYCLE_ADR.md`: blob `72b4554ab8130cde375e8985f3d4fe4f53ee0e42`;
- `docs/agents/BRANCH_LIFECYCLE_POLICY.json`: blob `2d2ece5c5649ee8fd426bbcad3ce879899aa09f5`;
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`: blob `482abc9d0b54ba103e817743205360248646c11f`;
- `.github/workflows/ci.yml`: blob `913cedcae9423e9487fb2849fe4644e31ed82a55`;
- historical FullWorld handoff: blob `12f9aa0426596b7128f3455d068daa46dced8b1d`.

If protected `main` advances before merge, the closeout agent must re-inventory any material Documentation/Agent IA changes and update the companion registry before claiming terminal completion.

## Terminal gap dispositions

| Gap | Disposition | Canonical evidence |
| --- | --- | --- |
| `GAP-DOCS-PROVIDER-CURRENT-001` | `CREATE_CANONICAL_ARTIFACT` | this policy + JSON registry |
| `GAP-DOCS-ATLAS-ARCH-001` | `NOT_NEEDED` | explicit trigger below; no empty `docs/architecture/` taxonomy |
| `GAP-DOCS-ATLAS-CONTRACT-001` | `NOT_NEEDED` | explicit trigger below; no duplicate `docs/contracts/` authority |
| `GAP-DOCS-ATLAS-GOV-001` | `KEEP_EXISTING` | `AGENTS.md`, `.github/CODEOWNERS`, branch lifecycle ADR |
| `GAP-DOCS-ATLAS-POLICY-001` | `KEEP_EXISTING` | `AGENTS.md`, branch lifecycle policy |
| `GAP-DOCS-ATLAS-TEST-001` | `KEEP_EXISTING` | `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` |
| `GAP-DOCS-ATLAS-OPS-001` | `CREATE_CANONICAL_ARTIFACT` | `docs/operations/ATLAS-LIVE-OPERATIONS.md` |
| `GAP-DOCS-ATLAS-RECOVERY-001` | `CREATE_CANONICAL_ARTIFACT` | `docs/recovery/ATLAS-LIVE-RECOVERY.md` |
| `GAP-PROMPT-ATLAS-001` | `CREATE_CANONICAL_ARTIFACT` | companion registry + deterministic validator |
| `GAP-TASK-ATLAS-001` | `CREATE_CANONICAL_ARTIFACT` | companion registry + deterministic validator |

### Architecture decision trigger

A standalone provider-wide architecture artifact is `NOT_NEEDED` now because durable decisions already have scoped owners, including the existing branch-lifecycle ADR and programme/task design/spec documents. Reopen this class only when a durable **cross-programme Atlas architecture decision** has no existing authoritative owner/path. Do not create `docs/architecture/` merely to match another repository.

### Provider-contract decision trigger

A standalone provider-contract taxonomy is `NOT_NEEDED` now because shipped interfaces are already owned by executable tests/source contracts, accepted publication/provenance artifacts and task-specific specifications. Reopen this class only when a recurring **non-executable provider interface** needs one durable authority not already represented by an executable/schema/provenance owner. Do not create `docs/contracts/` merely for symmetry.

## Prompt lifecycle

`docs/agents/prompts/*.md` contains technical execution contracts. The companion registry supplies adjacent lifecycle metadata without mass-editing live prompt bodies:

- stable ID equals the file stem;
- registry metadata version is `1` and records the exact prompt blob;
- class is `PROMPT_TASK_EXECUTION` for live execution contracts or `PROMPT_ONE_SHOT` for terminal one-shots;
- GitHub Issue is mutable lifecycle authority;
- `ACTIVE` means the owning Issue was verified open at the recorded audit date;
- terminal one-shots are `HISTORICAL` and non-executable unless a new live Issue explicitly re-authorizes work;
- the registry records owner, scope, input/output, prohibited actions, validation, supersession and terminal disposition.

At this audit, `ATLAS-PORTAL-DOCKER-E2E-EXPANSION.md` points to completed Issue #55 and is therefore `PROMPT_ONE_SHOT / HISTORICAL / ARCHIVE_HISTORICAL`. Its file remains in place as provenance; it is not a current task. Current verification-platform authority is Issue #85 plus `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`.

## Task lifecycle

GitHub Issues own mutable lifecycle status. `docs/agents/tasks/active/*.md` is an optional detail cache and must never override Issue or merged-PR truth.

At the refreshed audit head, all three active packets point to verified-open Issues:

- `ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md` -> #115;
- `ATLAS-FULLWORLD-COORDINATOR.md` -> #11;
- `ATLAS-HUNT-INTELLIGENCE-PROJECT.md` -> #117.

A packet may remain under `active/` only while its owning Issue is live. When an owning Issue becomes terminal, protected maintenance must archive or delete the packet while preserving required Issue/PR provenance. The validator mechanically prevents unregistered active packets and duplicate registrations; live GitHub state must still be checked at closeout/maintenance time because CI must not become a second status database.

## Handover classification

`docs/evidence/fullworld-generation/handoff-summary.json` is retained as `HANDOVER_CACHE / HISTORICAL / ARCHIVE_HISTORICAL` and is explicitly **non-authoritative**. Its local workstation paths, generation revisions, digests and measurements are historical evidence only. It cannot override current GitHub lifecycle, merged `main`, accepted Game/Atlas publication authority or merged-main workflows.

## Operations and recovery

Recurring merged-main live publication/acceptance is documented by `docs/operations/ATLAS-LIVE-OPERATIONS.md`. Recovery is documented by `docs/recovery/ATLAS-LIVE-RECOVERY.md`. These runbooks route operators to existing workflow authority; they do not reproduce mutable host commands or authorize direct task-branch deployment.

## Deterministic validation

Run from repository root:

```text
python tools/governance/test_documentation_ia.py
python tools/governance/validate_documentation_ia.py
python -m py_compile tools/governance/validate_documentation_ia.py tools/governance/test_documentation_ia.py
```

The validator checks the registered prompt/task sets, exact prompt/task blobs, classes/statuses, target gap dispositions, evidence paths and handover classification. GitHub Issue state is deliberately verified through GitHub at lifecycle checkpoints rather than polled by the repository validator.

## CI/provenance boundary

`OUT_OF_SCOPE_FINDING: Exact-head CI run 32754885744 proved that tools/governance/verify_extraction_provenance.py pins .github/workflows/ci.yml to blob 913cedcae9423e9487fb2849fe4644e31ed82a55. Adding the Documentation/Agent IA validator to ci.yml fails selective-extraction provenance before the new step can run. Updating docs/migration/legacy-atlas-extraction-provenance.json is outside OTERYN-V310-ATLAS-DOC-IA-CLOSEOUT authority.`

Therefore `REC-DOCS-007` is closed for this bounded task as `KEEP_EXISTING`: `atlas-gate` and `provenance-gate` remain unchanged, `.github/workflows/ci.yml` remains byte-identical, and the provider-local deterministic validator is exact closeout evidence. A future internal CI subcheck requires separately authorized reconciliation of migration provenance; it must not be achieved by weakening or bypassing provenance.

## Supersession and rollback

This policy and registry own only Atlas Documentation/Agent IA classification. They do not replace prompt/task technical contracts, GitHub Issue lifecycle, executable/schema/provenance authority, or workflow authority.

A successor protected change must update policy, registry and validator evidence together when material IA changes. Rollback for this closeout is a documentation/governance revert only; never mutate runtime, generated data, migration provenance, runner state, deployment state or branch protection to roll it back.
