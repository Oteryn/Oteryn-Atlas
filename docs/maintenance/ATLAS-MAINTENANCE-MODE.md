# Atlas maintenance remediation mode

Lifecycle authority: [Issue #315](https://github.com/Oteryn/Oteryn-Atlas/issues/315).

## Purpose

Keep the retired Atlas test/verification/depth/dispatcher/publication/deployment workflow stack suspended while allowing the bounded F01–F16 corrective-engineering programme to proceed through protected pull requests and Merge Queue. Production deployment and automatic publication remain outside this programme.

## Enforcement

The organization ruleset requires `.github/workflows/merge-authority-audit.yml` from protected `main`. That workflow checks out the exact protected base and candidate separately, then runs only `trusted-base/tools/maintenance/verify-maintenance-diff.mjs`. Candidate code remains inert input.

The validator binds repository/event/base/head identity, derives the complete diff from Git, rejects rename/copy escapes, unsafe paths, non-regular modes, symlinks/gitlinks, binary/invalid UTF-8 and oversized content, and resolves admission only from protected-base authority.

Ordinary documentation/governance maintenance retains its closed path/operation allowlist. F01–F16 remediation is separately controlled by protected-base `ATLAS_REMEDIATION_ALLOWLIST.json`: all remediation paths in a candidate must resolve to exactly one lane and use only the lane's allowed add/modify operations. Candidate edits to the manifest are immutable for that candidate and cannot self-authorize scope.

Verification-contract deletion is controlled by exact protected-base `OBSOLETE_VERIFICATION_CONTRACTS.json`. Matching `tests/verification/**` by pattern is not deletion authority. A candidate cannot extend the inventory and consume the new entry in the same PR.

The repository ruleset requires `Merge authority audit / protected-base validate` and Merge Queue. The retained `.github/workflows/merge-group-gate.yml` also emits `atlas-gate` for merge groups; it is additional maintenance evidence, not the configured required status. Both gates execute protected-base maintenance authority only.

## Completed transitions

1. Stage A installed the independent protected maintenance validator and protected-main audit entrypoint.
2. Stage B suspended the old workflow stack byte-for-byte under `docs/maintenance/suspended-workflows/`, leaving only the audit, minimal MQ gate and terminal branch lifecycle active.
3. P0 integrated the protected remediation allowlist and exact obsolete-contract inventory through the normal required check and Merge Queue at `main@9db8e55a3ef2da851e34c4931fe60cf07633f02f`.
4. P1 activated protected-base consumption of those manifests at `main@5d7e9a7b3d5972d030c874c57d59eea40af16f8e`, including exact-one-lane resolution and fail-closed ambiguity handling.
5. Current instructions/documentation now describe the active bounded remediation authority; this prose does not grant authority beyond the protected validator.

## Current admitted remediation lanes

- `canonical-foundation` — F01;
- `geometry` — F06;
- `verification` — F11/F12/F13;
- `docs-dependencies` — F09/F10/F14/F15;
- `publication-safety` — F02;
- `runtime-safety` — F04/F05/F07/F08.

Publication Safety and Runtime Safety remain sequencing-dependent on Canonical Foundation as recorded by the active F01–F16 programme. Path admission does not waive lane prerequisites, focused regression evidence, review requirements, Game authority, or normal Merge Queue integration.

## Still suspended or frozen

- production deployment and live-system mutation;
- automatic publication/deployment workflows;
- restoration of the retired aggregate verification stack;
- ordinary edits to active workflows or `tools/maintenance/**`;
- arbitrary product/runtime paths outside the protected remediation allowlist;
- verification-test deletion outside the exact protected obsolete inventory.

## Current protected state

The active workflow inventory remains exactly `.github/workflows/merge-authority-audit.yml`, `.github/workflows/merge-group-gate.yml`, and `.github/workflows/terminal-branch-lifecycle.yml`.

Repository ruleset `22103758` retains strict required-status freshness, squash-only protected PR integration and ALLGREEN Merge Queue. Organization ruleset `22352928` retains the protected-main required workflow source. No ruleset or workflow weakening is part of the Authority Fix.

Restored verification groups return only incrementally: first non-blocking/shadow qualification and real PR/MQ canaries, then impact-applicable blocking coverage after qualification. `AUDIT_COMPLETE`, local focused PASS, or path admission alone is not product qualification.
