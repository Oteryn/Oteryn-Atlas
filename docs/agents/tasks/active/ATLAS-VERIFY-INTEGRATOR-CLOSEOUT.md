# ATLAS-VERIFY-INTEGRATOR-CLOSEOUT â€” HANDOFF

Status date: 2026-08-23
Parent authority: `Oteryn/Oteryn-Atlas#85`
Integration PR: `Oteryn/Oteryn-Atlas#98`
Current PR branch: `agent/atlas-verify-ci-nightly-01`
Handoff working branch: `handoff/atlas-verify-integrator-closeout`
Verified implementation head before handoff metadata: `2b7a409bd825b123afb724f4c73b936892039499`
Handoff tag: `atlas-verify-integrator-handoff-2026-08-23`

## Verified work already complete

- Exact `2b7a409...` deterministic Node/contract/property fan-in: **156/156 PASS**.
- Exact `2b7a409...` full Docker Playwright on Molehill-PC: **48/48 PASS**, one worker, retries=0, 13.4 minutes.
- Local browser evidence: `artifacts/e2e/atlas-integrator-pc-final-2b7a409/summary.json` with exact revision, 48 scenarios and max retry 0.
- Extraction provenance verifier: **PASS, 144 rows**.
- CodeQL, Extraction Provenance, Docker E2E Harness, Creature overlays and all lightweight CI jobs on the PR head were green before the NAS browser timeout.
- A real semantic deep-link regression was found and fixed in `web/fullworld-app.mjs`: `search -> navigate -> reload -> history` now preserves the semantic selection.
- That regression was RED before the fix, **1/1 PASS** after the fix, and passed again inside the full 48-test matrix.

## Current blocker

GitHub run `32641628301`, job `97199484776` (`Full Docker Playwright qualification`) ran the full browser suite on `oteryn-synology-atlas` and was killed by the workflow timeout after about **30m26s**. `atlas-gate` therefore failed although the exact same candidate passed 48/48 on Molehill-PC in 13.4m.

This is an execution-placement problem, not an unresolved product-test failure.
## Required execution split

Heavy compute belongs on **Molehill-PC / Docker Desktop**:
- full required Playwright;
- performance/stress/soak/visual/render depth;
- scheduled browser-depth/nightly browser matrices.

Keep lightweight hosted checks where they already work. Keep **Synology** for deployment/live acceptance and lightweight checks only; do not run the full heavy browser matrix there again.

The Windows runner is currently **not registered**. A prior temporary `oteryn-molehill-atlas` runner was deliberately removed after the execution model was corrected. The package directory `C:\Users\barte\oteryn-actions-runner-atlas-local` exists but has no `.runner` / `.credentials` registration state.

Expected durable runner identity:
- name: `oteryn-molehill-atlas`;
- organization runner group: `atlas-runners`;
- custom label: `oteryn-atlas-pc`;
- OS: Windows x64.

## Draft regression/contract already prepared

`docs/agents/tasks/active/ATLAS-VERIFY-INTEGRATOR-PC-RUNNER-CONTRACT.test.mjs`

This file is intentionally outside `tests/verification/` so this handoff checkpoint does not intentionally break CI. The finishing agent must first copy/move it to `tests/verification/pc-heavy-runner-contract.test.mjs`, run it, and confirm the expected RED state before implementing the runner/workflow split.

The draft contract requires the heavy PR and nightly browser jobs to be pinned to Molehill-PC while `synology-live-acceptance.yml` remains Synology-owned.
## Remaining closeout sequence

1. Refresh GitHub-first state for `main`, PR #98 and Issue #85. Do not trust stale SHAs.
2. Restore the draft PC-runner contract into `tests/verification/` and prove RED.
3. Register Molehill-PC as the dedicated heavy Atlas GitHub Actions runner.
4. Implement minimal Windows runner helpers and workflow routing for required/nightly heavy browser work.
5. Do not weaken retries, tolerances, allowlists, authority, provenance or security gates.
6. If Docker Desktop direct container-to-LAN routing remains unreliable, use only a bounded host transport/relay; it must not become data authority and must not add retries.
7. Re-run focused contracts, provenance and `git diff --check`.
8. On one exact final PR head, run the full 48-test Playwright matrix on Molehill-PC with one worker and retries=0 plus the complete Node fan-in.
9. Push the exact head, require green `atlas-gate`, `provenance-gate` and applicable CodeQL/security checks, and review the full diff/threads.
10. Squash-merge PR #98 according to repository policy.
11. On exact merged `main`, verify CI/provenance and run one manual/scheduled nightly proof with heavy browser depth on Molehill-PC.
12. Run Synology live acceptance only after merged-main exists; verify served/container/header revision equals exact merged `main` SHA.
13. Add terminal evidence to #85 and close it only when its Definition of Done is evidenced line-by-line.

## Do not redo

- Do not repeat the already-green 48-test heavy qualification on Synology.
- Do not recreate a second verification platform or replace Playwright/node:test.
- Do not revert `2b7a409...` semantic deep-link fix.
- Do not force-push over concurrent work; refresh and reconcile first.
- Do not close #85 before merged-main nightly/live exact-revision proof.

Finishing-agent prompt: `docs/agents/prompts/ATLAS-VERIFICATION-INTEGRATOR-CLOSEOUT.md`.

