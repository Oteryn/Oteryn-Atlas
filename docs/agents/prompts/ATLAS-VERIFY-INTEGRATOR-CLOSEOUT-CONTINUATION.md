# ATLAS-VERIFY-INTEGRATOR-CLOSEOUT-CONTINUATION

ALIAS: `ATLAS-VERIFY-INTEGRATOR-CLOSEOUT-CONTINUATION`
EFFORT: **XHigh**
MODE: autonomous programme recovery + integration + exact-head qualification + lifecycle closeout.

Continue the existing `Oteryn/Oteryn-Atlas#85` verification programme. Do not create a replacement verification programme and do not declare completion early.

Read first:
- `AGENTS.md`;
- `docs/agents/prompts/ATLAS-VERIFICATION-INTEGRATION-COORDINATOR.md`;
- `docs/agents/tasks/active/ATLAS-VERIFY-INTEGRATOR-CLOSEOUT.md`;
- `docs/superpowers/plans/2026-08-24-atlas-verify-integrator-closeout-continuation.md`;
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`;
- live GitHub Issue #85, #105, #109, #111, #121 and live PR #126/#118 plus any newer overlapping verification PR.

GitHub is authority. Refresh `main`, all relevant heads, checks and review state before any mutation. The checkpoint's last known main is `319d85c36ffa626403adf2b701748c13eac1592b`, but never assume it is still current.
## Critical current facts

- PR #112 / Issue #108 is already merged into main; its merge SHA is `319d85c36ffa626403adf2b701748c13eac1592b` and the required exact-head Playwright gate is now 50 scenarios.
- PR #126 remains the active #109/#105 shell repair. Its pre-handoff code head was `c73d3ffe6dfb92e9848538cd3dafa1e62ca81739`, based on an older main, so refresh/rebase before qualification.
- #126 TDD is valid: RED `8d68cf4` proves `shell: pwsh` is unsupported; GREEN changes only four Molehill steps to `shell: powershell`; full deterministic matrix was 183/183 PASS.
- DO NOT publish `atlas-local-e2e` for `c73d3ff`: its isolated run produced 47/48, retries=0.
- Failed scenario: stress seed `133`, action index 7, pan `dx=-32, dy=-78`, HTTP 502 for pixel bucket `12.rgba`.
- Nginx recorded `connect() failed (111: Connection refused)` to the Windows-local forwarder; Synology was not the source of that 502. Why the forwarder disappeared remains UNKNOWN.
- PR #118 / Issue #111 remains required parent-programme work and includes machine-wide serialization plus reviewed user-facing visual acceptance.
- Issue #121 explicitly has #85 as parent and remains open for Firefox/WebKit real-browser depth.

Preserve failed evidence. Do not rerun until green without classifying the forwarder interruption.
## Execution contract

1. Refresh and rebase PR #126 onto current main. Preserve its TDD shell fix and regression.
2. Reproduce/classify the local publication-forwarder interruption only under a serialized, ownership-safe Molehill run. If reproducible, add a permanent regression before any fix. If external interruption is proven, record that evidence explicitly.
3. Qualify the exact final #126 head with the repository's current full Playwright count, workers=1, retries=0. Publish `atlas-local-e2e` only through the repository publisher after exact all-pass evidence.
4. Require exact-head `atlas-gate`, `provenance-gate`, applicable CodeQL/security, clean diff and full review; then squash merge and delete the branch. Keep #109 open until post-merge nightly/live acceptance.
5. Finish PR #118 / Issue #111 on current main with its required reviewed visual evidence and protected gates.
6. Finish Issue #121 Firefox/WebKit depth with real pinned-engine execution, representative desktop/mobile-like journeys and zero retries. Do not manufacture engine support.
7. After the final verification-related merge, freeze one exact current main SHA. Require post-merge CI/provenance/security, Synology Live Acceptance and live `X-Oteryn-Atlas-Revision` equality on that same SHA.
8. Run `Verification Nightly Depth` on the same SHA and require deterministic + Molehill browser-depth SUCCESS. Preserve seeds `133`, `1096043585`, `2779096485`, `3735928559` and machine-readable evidence.
9. Close #109/#105 only after their acceptance is proven. Add line-by-line terminal evidence to #85 and close #85 only when every applicable DoD item and parent verification follow-up is terminal.

Never weaken assertions, retries, timeouts, tolerances, allowlists, provenance, runner identity, branch protection or deployment authority. Never mutate Oteryn-Game for this task. Stop only for a genuine blocker requiring owner action; otherwise continue autonomously to terminal closure.