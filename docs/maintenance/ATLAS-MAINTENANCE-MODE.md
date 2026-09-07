# Atlas maintenance remediation mode

Lifecycle authority: [Issue #315](https://github.com/Oteryn/Oteryn-Atlas/issues/315).

## Purpose

Keep the retired Atlas test/verification/depth/dispatcher/publication/deployment workflow stack suspended while allowing the bounded F01-F16 corrective-engineering programme to proceed through normal protected pull requests and Merge Queue. Production deployment and automatic publication remain outside this programme.

## Enforcement

The organization ruleset requires `.github/workflows/merge-authority-audit.yml` from protected `main`. That workflow checks out the exact protected base and the candidate into separate directories, then runs only `trusted-base/tools/maintenance/verify-maintenance-diff.mjs`. Candidate code is inert input.

The validator binds repository, event, base and head identity; derives the complete diff from Git; rejects rename escapes, unsafe paths, non-regular modes, symlinks, gitlinks, binary/invalid UTF-8 and oversized content; and enforces protected-base admission authority.

Normal documentation/governance maintenance keeps a closed path/operation allowlist. F01-F16 corrective engineering is separately bounded by `ATLAS_REMEDIATION_ALLOWLIST.json`, read from the protected base. A candidate may use only one compatible remediation lane, and remediation rules permit additions/modifications rather than deletion. Changing the allowlist in a candidate does not expand that candidate's own authority.

Verification-contract deletion is controlled by the exact protected-base inventory `OBSOLETE_VERIFICATION_CONTRACTS.json`. A path-pattern match alone is never deletion authority, and a candidate cannot add an entry to the inventory and consume that new authority in the same PR.

The maintenance validator and active workflow control plane remain self-frozen after this authority transition. Future changes to those surfaces require a separately authorized control-plane transition; candidate-defined self-authorization, fabricated statuses, direct merge and protection bypass are not ordinary maintenance paths.

## Completed cutover

1. Stage A merged the independent protected maintenance validator and repointed the organization-required audit to it.
2. Protected-main readback confirmed Stage A was active.
3. Stage B archived every suspended workflow byte-for-byte under `docs/maintenance/suspended-workflows/` and left only the audit, minimal MQ gate and terminal branch lifecycle active.
4. META/provider policy cleanup integrated through the resulting maintenance path.
5. Issue #315 now records maintenance as active and the F01-F16 remediation programme as the current corrective sequence.

## Current admitted scope

The old aggregate verification/bootstrap stack remains suspended. Normal maintenance admits only its existing documentation/governance surfaces. Corrective product/runtime/tooling/test work is admitted only when every non-maintenance path in the candidate belongs to one lane already present in the protected-base remediation allowlist.

The current remediation lanes are:

- `canonical-foundation` — F01;
- `geometry` — F06;
- `verification` — F11/F12/F13;
- `docs-dependencies` — F09/F10/F14/F15;
- `publication-safety` — F02;
- `runtime-safety` — F04/F05/F07/F08.

Publication Safety and Runtime Safety remain sequencing-dependent on Canonical Foundation as recorded by the active F01-F16 programme. Admission of a path does not waive lane prerequisites, test obligations, review requirements, Game authority, or normal Merge Queue integration.

## Still suspended or frozen

- production deployment and live-system mutation;
- automatic publication/deployment workflows;
- restoration of the retired aggregate verification stack;
- ordinary edits to active workflows or `tools/maintenance/**`;
- arbitrary runtime/product paths outside the protected remediation allowlist;
- deletion of verification tests not explicitly listed by protected exact path.

## Current protected state

The active workflow inventory is exactly `.github/workflows/merge-authority-audit.yml`, `.github/workflows/merge-group-gate.yml`, and `.github/workflows/terminal-branch-lifecycle.yml`.

Repository ruleset `22103758` requires the strict `Merge authority audit / protected-base validate` status and Merge Queue. Organization ruleset `22352928` requires `.github/workflows/merge-authority-audit.yml` from protected `main`. The retained merge-group workflow emits additional `atlas-gate` evidence; it is not the configured required status during maintenance.

Restored verification groups return only incrementally: first non-blocking/shadow qualification and real PR/MQ canaries, then impact-applicable blocking coverage after qualification. `AUDIT_COMPLETE` or a focused remediation test result is not product qualification.
