# ATLAS-VERIFICATION-RACE-FAULT

ALIAS: `ATLAS-VERIFY-RACE-FAULT`
EFFORT: **High**
MODE: autonomous implementation + verification + PR delivery; do not stop at audit.

Parent authority: `Oteryn/Oteryn-Atlas#85`.
Start only from refreshed merged `main` containing PR #87 foundation work.

Preflight: read root `AGENTS.md`, #85 and `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`; inspect current resilience/runtime/network tests and overlapping PRs; create/reuse one child Issue, one isolated branch/worktree and one PR; record exact base SHA.

Required scenarios:
- delayed semantic range/chunk completion during rapid pan/zoom;
- reordered independent request completion;
- controlled abort/supersession without expected `AbortError` leaking into fail-closed;
- rapid NPC/monster toggles while fetch/render work is in flight;
- resize during pending fetch/render;
- history/reload around in-flight operations;
- required product failures remain deterministic fail-closed;
- optional product failures remain isolated and truthful;
- malformed/stale/version-mismatched products cannot leave stale rendering.

Use bounded Playwright network-edge injection, committed-generation waits, zero retries, zero arbitrary sleeps and no broad allowlists. Every failure must identify the first bad request/action/generation and every reproduced runtime defect must get a permanent regression before its fix.

Primary ownership: `e2e/tests/resilience-*.spec.mjs`, new `e2e/tests/race-*.spec.mjs`, narrowly scoped `e2e/support/fault-*.mjs`. Avoid workflow/performance/visual ownership unless required by a reproduced defect.

Done only when applicable Node + Playwright suites pass on exact final head, `git diff --check` is clean, PR reports exact SHA/evidence and links the child Issue plus #85. Do not merge/close #85; integrator owns fan-in.
