# ATLAS-VERIFICATION-PARALLEL-AGENT-SUITE

Parent lifecycle authority: `Oteryn/Oteryn-Atlas#85`.
Foundation delivery: PR #87 lineage.
Foundation checkpoint evidence: `92df1eca0f71f9a4843fccd76af88c915399f05e`.

After PR #87 is merged, every agent MUST refresh `main` and use the exact merged `main` SHA as its real base. The checkpoint SHA is provenance evidence only.

Parallel workers:
- `ATLAS-VERIFY-RACE-FAULT` — High — in-flight race/fault/network verification.
- `ATLAS-VERIFY-PERF-SOAK` — XHigh — performance, stability, bounded soak/leak evidence.
- `ATLAS-VERIFY-VISUAL-A11Y` — High — targeted visual and accessibility/input verification.
- `ATLAS-VERIFY-CI-NIGHTLY` — XHigh — exact-head CI fan-in, scheduled depth, artifact publication.

Integration owner:
- `ATLAS-VERIFY-INTEGRATOR` — XHigh — review, merge ordering, exact-final-head and live closeout.

Isolation rules:
- each worker creates/reuses one child Issue linked to #85;
- each worker uses its own branch/worktree and PR from refreshed `main`;
- no shared writable worktree and no unreviewed cherry-picks;
- production edits require a reproducing test first;
- every reproducible defect leaves a permanent deterministic regression;
- no task-branch live deployment.

Shared authority: root `AGENTS.md`, `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`, the comprehensive platform prompt, existing `node:test`, Docker Playwright, renderer diagnostics, geometry/framebuffer oracles and seeded replay harness.
