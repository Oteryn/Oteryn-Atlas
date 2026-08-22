# ATLAS-VERIFICATION-INTEGRATION-COORDINATOR

ALIAS: `ATLAS-VERIFY-INTEGRATOR`
EFFORT: **XHigh**
MODE: autonomous programme integration + review + final qualification + closeout.

Parent lifecycle authority: `Oteryn/Oteryn-Atlas#85`. Start from refreshed `main` after PR #87 foundation is merged.

Coordinate these workers: `ATLAS-VERIFY-RACE-FAULT` (High), `ATLAS-VERIFY-PERF-SOAK` (XHigh), `ATLAS-VERIFY-VISUAL-A11Y` (High), `ATLAS-VERIFY-CI-NIGHTLY` (XHigh).

Read `AGENTS.md`, #85, `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`, the parallel-suite prompt and every worker PR/diff/check result. Record exact integration base SHA.

Never trust worker completion claims without inspecting the diff and rerunning applicable tests. Merge worker PRs only when their exact heads are green and authority/provenance boundaries remain intact. Resolve conflicts in an integration branch, never by weakening assertions, tolerances, allowlists or required checks.

Every newly discovered reproducible defect must receive a permanent regression before its fix.

Final acceptance on one exact final head must prove: all deterministic Node/contract/property tests; full Docker Playwright with zero retries; geometry + framebuffer/render + fixed stress regressions; race/fault suite; accepted performance/soak checks; adopted stable visual/a11y checks; `git diff --check`; full diff review; required `atlas-gate`, `provenance-gate` and applicable security checks.

Then merge according to repository policy. Only after merged-main exists, observe/run Synology live acceptance and verify container/header revision equals exact merged `main` SHA. A stale deployment is failure.

You are the only agent authorized by this prompt to declare #85 complete. Close it only when its Definition of Done is line-by-line evidenced, with exact SHAs, worker PRs, test counts, seeds/artifact paths and any explicitly deferred non-applicable item justified technically.
