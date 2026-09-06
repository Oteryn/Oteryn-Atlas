# Atlas maintenance mode

Lifecycle authority: [Issue #315](https://github.com/Oteryn/Oteryn-Atlas/issues/315).

## Purpose

Temporarily suspend the existing Atlas verification/bootstrap stack so prompt, Markdown, AGENTS and governance cleanup can integrate through a normal pull request and Merge Queue path without allowing product/runtime or deployment changes to bypass verification.

## Enforcement

The organization ruleset requires `.github/workflows/merge-authority-audit.yml` from protected `main`. That workflow checks out the exact protected base and the candidate into separate directories, then runs only `trusted-base/tools/maintenance/verify-maintenance-diff.mjs`. Candidate code is inert input.

The validator binds repository, event, base and head identity; derives the complete diff from Git; rejects rename escapes, unsafe paths, non-regular modes, symlinks, gitlinks, binary/invalid UTF-8 and oversized content; and enforces a closed path/operation allowlist.

The repository ruleset continues to require `atlas-gate` and Merge Queue. During the suspension cutover, `.github/workflows/merge-group-gate.yml` is replaced byte-for-byte from the protected `tools/maintenance/minimal-merge-group-gate.yml` template. It runs the same protected-base maintenance validator and no test or candidate executable.

## Staged cutover

1. Stage A merges the independent protected maintenance validator and repoints the organization-required audit to it.
2. Protected-main readback confirms Stage A is active.
3. Stage B archives every suspended workflow byte-for-byte under `docs/maintenance/suspended-workflows/`, leaves only the audit, minimal MQ gate and terminal branch lifecycle active, and integrates as the real maintenance PR/MQ canary.
4. The #140 prompt/AGENTS/governance cleanup proceeds through that path.
5. Test groups return incrementally in shadow mode and become blocking only after real canaries.

## Frozen scope

Product/runtime files, publication roots and inputs, deployment behavior, active workflow additions, the maintenance validator and its template are frozen. `docs/**` is not a blanket exception. Automatic Synology publication/deployment is suspended in Stage B.

No direct merge, ruleset bypass, fabricated success, candidate code execution or unprotected transition interval is authorized.

## Current state

This document is introduced by Stage A. Maintenance enforcement becomes active only after the Stage A PR is merged through Merge Queue and the exact protected-main workflow is read back. Full test/deployment suspension becomes active only after the separate Stage B cutover is merged and read back.
