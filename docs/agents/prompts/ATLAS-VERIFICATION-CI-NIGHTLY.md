# ATLAS-VERIFICATION-CI-NIGHTLY

ALIAS: `ATLAS-VERIFY-CI-NIGHTLY`
EFFORT: **XHigh**
MODE: autonomous CI integration + scheduled-depth implementation + PR delivery.

Parent authority: `Oteryn/Oteryn-Atlas#85`. Start from refreshed merged `main` containing PR #87.

Preflight: inspect branch protection/current required checks, `.github/workflows/**`, #85, `AGENTS.md`, verification design and active worker PRs; create/reuse one child Issue and one isolated branch/worktree/PR; record exact base SHA.

Integrate applicable verification into required exact-head fan-in without creating optional green badges: deterministic Node/contract/property tests, full applicable Docker Playwright, geometry/framebuffer regressions, fixed replayable stress smoke seeds, and stable performance/visual/a11y commands after those worker deliveries land.

Preserve existing `atlas-gate` and `provenance-gate`; exact PR head checkout, zero hidden retries, explicit machine-readable skip reasons and bounded summary/results/failure/action/performance/visual artifact publication are mandatory.

Scheduled/nightly depth: larger deterministic seed matrix, repeated critical scenarios for flakes/races, bounded soak/leak workload, useful extra viewport/DPR profiles, and mutation evaluation for critical pure coordinate/state logic only when bounded useful signal is demonstrated.

Never run live Synology deployment from a task branch. Merged-main live acceptance must continue to prove exact deployed revision.

Primary ownership: `.github/workflows/**` verification/fan-in/scheduled jobs, CI-facing artifact glue, and testing docs describing tiers/commands. Avoid production runtime changes.

Done only when required fan-in demonstrably includes the new applicable gates, scheduled jobs are bounded/replayable, exact-head workflow runs pass on the final PR head and no branch-protection/provenance rule is weakened. Do not close #85; integrator performs final programme acceptance.
