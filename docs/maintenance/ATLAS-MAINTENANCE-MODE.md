# Atlas maintenance mode

Lifecycle authority: [Issue #315](https://github.com/Oteryn/Oteryn-Atlas/issues/315).

## Purpose

Temporarily suspend the existing Atlas verification/bootstrap stack so prompt, Markdown, AGENTS and governance cleanup can integrate through a normal pull request and Merge Queue path without allowing product/runtime or deployment changes to bypass verification.

## Enforcement

The organization ruleset requires `.github/workflows/merge-authority-audit.yml` from protected `main`. That workflow checks out the exact protected base and the candidate into separate directories, then runs only `trusted-base/tools/maintenance/verify-maintenance-diff.mjs`. Candidate code is inert input.

The validator binds repository, event, base and head identity; derives the complete diff from Git; rejects rename escapes, unsafe paths, non-regular modes, symlinks, gitlinks, binary/invalid UTF-8 and oversized content; and enforces a closed path/operation allowlist.

The repository ruleset requires the strict `Merge authority audit / protected-base validate` status from GitHub Actions and Merge Queue. The retained `.github/workflows/merge-group-gate.yml` emits an additional `atlas-gate` check for merge groups. It runs the same protected-base maintenance validator and no test or candidate executable; `atlas-gate` is not the configured required status during maintenance.

## Completed cutover

1. Stage A merged the independent protected maintenance validator and repointed the organization-required audit to it.
2. Protected-main readback confirmed Stage A was active.
3. Stage B archived every suspended workflow byte-for-byte under `docs/maintenance/suspended-workflows/` and left only the audit, minimal MQ gate and terminal branch lifecycle active.
4. The #140 prompt/AGENTS/governance cleanup proceeds through the resulting maintenance path.
5. Test restoration remains a later #315 phase. Each group must return incrementally in shadow mode and become blocking only after real canaries.

## Frozen scope

Product/runtime files, publication roots and inputs, deployment behavior, active workflow additions, the maintenance validator and its template are frozen. `docs/**` is not a blanket exception. Automatic Synology publication/deployment is suspended in Stage B.

No direct merge, ruleset bypass, fabricated success, candidate code execution or unprotected transition interval is authorized.

## Current state

Stages A and B are integrated on protected `main`. Twenty-five old workflows are preserved byte-for-byte under `docs/maintenance/suspended-workflows/`. The active workflow inventory is exactly `.github/workflows/merge-authority-audit.yml`, `.github/workflows/merge-group-gate.yml`, and `.github/workflows/terminal-branch-lifecycle.yml`.

The maintenance validator, test/deployment suspension and current required-status configuration remain authoritative until a later #315 phase explicitly changes them through the applicable protected path.
