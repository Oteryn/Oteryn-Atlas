# ATLAS-VERIFICATION-INTEGRATOR-CLOSEOUT

ALIAS: `ATLAS-VERIFY-INTEGRATOR-CLOSEOUT`
EFFORT: **XHigh**
MODE: autonomous implementation + verification + integration + merge + post-merge closeout.

DO NOT STOP AT AUDIT, STATUS REPORT OR PLANNING.

Repository: `https://github.com/Oteryn/Oteryn-Atlas`
Parent lifecycle authority: `Oteryn/Oteryn-Atlas#85`
Integration PR to finish: `Oteryn/Oteryn-Atlas#98`
Existing PR branch: `agent/atlas-verify-ci-nightly-01`
Handoff working branch: `handoff/atlas-verify-integrator-closeout`
Handoff task: `docs/agents/tasks/active/ATLAS-VERIFY-INTEGRATOR-CLOSEOUT.md`
Handoff tag: `atlas-verify-integrator-handoff-2026-08-23`

## Start

Use GitHub-first refresh before any mutation. Read root `AGENTS.md`, Issue #85, PR #98, `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`, `docs/agents/prompts/ATLAS-VERIFICATION-INTEGRATION-COORDINATOR.md`, and the handoff task above.

Resolve the current remote `main`, PR #98 head and handoff tag. The last fully qualified implementation head before handoff metadata was `2b7a409bd825b123afb724f4c73b936892039499`, but do not assume it is still current.

Inspect all current diff/check/review state. Preserve concurrent work; never force-push over a newer remote head.

## Already verified; do not waste time re-proving on NAS

Exact `2b7a409...` passed 156/156 deterministic Node/contract/property tests and 48/48 Docker Playwright tests on Molehill-PC, one worker, retries=0, in 13.4m. Provenance passed 144 rows.

The semantic deep-link reload/history defect found by the expanded E2E suite was fixed in `web/fullworld-app.mjs`; keep that regression and fix.
GitHub run `32641628301`, job `97199484776`, proved the current placement problem: the same full browser gate on `oteryn-synology-atlas` exceeded the 30-minute timeout and caused `atlas-gate` to fail. Do not rerun the full heavy suite on Synology as the solution.

## Required execution architecture

Heavy browser compute must execute on **Molehill-PC / Docker Desktop**:
- required PR Playwright qualification;
- performance, stress, soak, visual and render depth;
- scheduled/manual browser-depth/nightly matrices.

Keep existing lightweight GitHub-hosted checks where they are. Keep Synology as deployment/live-acceptance authority and for lightweight checks only.

Register a dedicated Windows x64 GitHub Actions runner if it is not currently registered:
- runner name `oteryn-molehill-atlas`;
- organization runner group `atlas-runners`;
- custom label `oteryn-atlas-pc`.

Never expose registration tokens or credentials in logs or commits. Verify the official runner package/digest if a fresh package is required.

The existing package directory `C:\Users\barte\oteryn-actions-runner-atlas-local` may be reused only after inspecting it; the handoff state had no `.runner` or `.credentials` files.

## TDD handoff

A draft contract is saved at:
`docs/agents/tasks/active/ATLAS-VERIFY-INTEGRATOR-PC-RUNNER-CONTRACT.test.mjs`

First move/copy it to:
`tests/verification/pc-heavy-runner-contract.test.mjs`

Run that focused test and verify it fails for the expected reason on the current NAS-routed workflows. Only then implement the smallest correct runner/workflow change and make the contract GREEN.
## Implementation constraints

Do not weaken `atlas-gate`, `provenance-gate`, CodeQL/security, exact-head checkout, Game authority, provenance, test retries, tolerances, failure classifications or allowlists.

The heavy runner must bind evidence to the exact candidate SHA and must not deploy.

Prefer minimal repository-owned Windows helpers for the PC path. If Docker Desktop cannot reliably reach `192.168.1.2:8097` directly from containers, a bounded host-side transport/relay through Windows is permitted only as test transport. It must preserve original HTTP semantics including byte ranges, must not retry or fabricate success, must not become content authority, and must be regression-tested.

Do not modify `synology-live-acceptance.yml` to use the PC runner. Synology remains the live acceptance/deployment boundary.

Update workflow/provenance records if workflow blobs tracked by extraction provenance change. Run the provenance verifier after every such mutation.

## Exact final PR qualification

On one final PR #98 head SHA, independently verify all of the following before merge:
- full deterministic Node/contract/property fan-in;
- full Docker Playwright matrix on Molehill-PC, currently 48 scenarios, one worker, retries=0;
- geometry/framebuffer/render, race/fault, performance/soak, stress, visual/a11y and mobile coverage included by the matrix;
- focused PC-runner workflow contracts;
- extraction provenance verifier;
- workflow/YAML/PowerShell syntax as applicable;
- `git diff --check origin/main...HEAD`;
- full diff review and all review threads resolved;
- exact-head GitHub `atlas-gate`, `provenance-gate` and applicable CodeQL/security checks GREEN.

Do not merge based only on historical `2b7a409...` evidence if the final head differs; rerun the exact-final-head qualification on Molehill-PC.
## Merge and terminal closeout

When PR #98 is fully green, squash-merge it according to repository policy. Record the exact merged `main` SHA.

After merge:
1. verify exact merged-main CI and provenance;
2. run/prove one scheduled or manual `Verification Nightly Depth` execution with heavy browser depth on Molehill-PC;
3. let the existing trusted Synology main-only deployment/live acceptance path run;
4. verify the served Atlas revision/container/header equals the exact merged `main` SHA, not a stale revision;
5. record final test counts, run IDs, artifact paths and SHAs in Issue #85;
6. close #85 only after every applicable acceptance checkbox is evidenced.

If a new reproducible product defect appears, create a permanent failing regression first, fix it, and rerun exact-head qualification. If an infrastructure problem appears, prove it independently and do not mask it with retries or weakened assertions.

Do not stop after preparing commits or after merge. Continue autonomously through post-merge nightly/live acceptance and Issue #85 terminal closeout unless a genuinely external credential/permission boundary makes further mutation impossible.

## Final response contract

Report only verified facts: final PR head, merge SHA, test counts, GitHub run IDs, nightly result, live served revision, Issue #85 state, and any real remaining blocker. Do not claim completion without direct evidence.

