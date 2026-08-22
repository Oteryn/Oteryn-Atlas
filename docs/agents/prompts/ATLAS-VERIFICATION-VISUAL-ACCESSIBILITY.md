# ATLAS-VERIFICATION-VISUAL-ACCESSIBILITY

ALIAS: `ATLAS-VERIFY-VISUAL-A11Y`
EFFORT: **High**
MODE: autonomous targeted visual/accessibility verification + PR delivery.

Parent authority: `Oteryn/Oteryn-Atlas#85`. Start from refreshed merged `main` containing PR #87.

Preflight: read `AGENTS.md`, #85, verification design and current mobile/desktop Playwright specs; create/reuse one child Issue and one isolated branch/worktree/PR; record exact base SHA.

Add only high-signal visual regression that complements, never replaces, geometry/framebuffer oracles. Candidate surfaces: critical desktop/mobile controls, deterministic NPC/monster crop, inspector state, loading/fail-closed state, and a small map crop only when pinned capture mode is stable.

Baseline rules: record browser container/version, viewport, DPR, locale/timezone and provenance; freeze animation only when semantically valid; never auto-accept new baselines; failures emit expected/actual/diff; reject broad full-page snapshots dominated by fonts or unrelated raster differences.

Accessibility/input coverage must include accessible names, truthful disabled/hidden state, keyboard activation/Escape, focus reachability for critical responsive drawers, touch-enabled controls and no unreachable core controls at supported widths.

An automated accessibility engine may be added only if pinned and demonstrably useful; do not claim formal WCAG conformance from automated scans.

Primary ownership: new `e2e/tests/visual-*.spec.mjs`, `e2e/tests/accessibility-*.spec.mjs`, and `e2e/baselines/**` only for stable reviewed baselines. Avoid core runtime/workflow edits unless a deterministic regression proves a defect.

Done only after repeat execution demonstrates stable signal, artifacts are bounded, exact-head applicable suite passes, `git diff --check` is clean and PR links #85 plus its child Issue. Do not merge/close #85.
