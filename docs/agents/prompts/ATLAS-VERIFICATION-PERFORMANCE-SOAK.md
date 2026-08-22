# ATLAS-VERIFICATION-PERFORMANCE-SOAK

ALIAS: `ATLAS-VERIFY-PERF-SOAK`
EFFORT: **XHigh**
MODE: autonomous performance/stability implementation + evidence + PR delivery.

Parent authority: `Oteryn/Oteryn-Atlas#85`. Start from refreshed merged `main` containing PR #87.

Preflight: read `AGENTS.md`, #85 and the verification-platform design; create/reuse one child Issue, isolated branch/worktree and PR; record exact base SHA.

Implement normalized deterministic workloads for repeated pan/zoom, creature layer enable/disable, mode/floor transitions where factual records exist, responsive resize cycles and animation on/off comparison where available.

Collect bounded evidence: scenario duration, render/update samples, frame intervals/late frames where stable, visible/drawn records, retained chunk/group/cache counts, request count/bytes, and reliable JS heap/browser memory signals. Compare before/after state in bounded soak loops for stale duplication or monotonic growth.

Budget policy:
- enforce existing structural budgets immediately: draw-call target, max loaded chunks/groups and GPU allocation;
- new timing/heap thresholds require repeated baseline evidence with provenance before blocking;
- never hide variance with retries, broad exclusions or large tolerances.

Primary ownership: new `e2e/tests/performance-desktop.spec.mjs`, `e2e/tests/soak-desktop.spec.mjs`, `e2e/support/performance.mjs` or equivalent, and machine-readable performance artifacts. Avoid CI workflow ownership; the CI worker consumes your commands/artifacts.

Done only when the workload is replayable, structural budgets fail correctly under controlled violations, soak detects injected unbounded growth, exact-head applicable suites pass, `git diff --check` is clean and the PR reports exact SHA/artifact evidence. Do not merge/close #85.
