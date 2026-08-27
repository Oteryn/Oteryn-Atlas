# Atlas E2E Phase F shadow/backtest preparation

Lifecycle: `Oteryn/Oteryn-Atlas#179`

Status: **PREPARATION / SHADOW ONLY — SELECTIVE EXECUTION DISABLED**

## Exact admission state

- protected `main` resolved before mutation: `0afd5183c68b3f388861bb48599b9aa7c6f5a94b` (`#208` merged bootstrap controller)
- Lane D implementation base: draft Phase-D integration `#213@d3eaf133a4835e3b9f21eb7ba56fe699db38740b`
- current policy-v2 source observed: `#209@a4e85d1d599be58f35e9b67e66c4011f08556e12`
- historical Phase E head observed: `#195@10d482a1a9edb94ce90b281a2823c7a32fbbece5`
- historical Phase F head observed: `#200@88f3b2b8b1e36c03bb86be6102006ac148f8d5ea`
- dedicated Lane D branch: `feat/issue-179-phase-f-shadow-backtest`

The branch is intentionally based on current final-D integration interfaces instead of the historical #200 implementation. It does not activate #200 and does not choose a worker/shard policy before Phase E is rebuilt on final protected Phase D.

## What this lane adds

- `tools/verification/shadow-backtest.mjs` — exact stable-ID false-negative/over-selection classifier, exact hosted full-safety equality assertion, caller-bounded matrix-cardinality guard.
- `tools/verification/run-shadow-backtest.mjs` — deterministic offline corpus runner which composes the existing `buildVerificationPlan()` interface without changing the protected planner.
- `tools/verification/shadow-backtest-corpus.json` — versioned historical/synthetic corpus covering a verified regression, the complete regression PR diff, rename union, multi-domain escalation, unknown runtime, verification governance and a specialist real-FullWorld capability case.
- `tools/verification/selector-escape.mjs` + `selector-escape-state.json` — durable append-only miss feedback and widening-only fallback. The committed state has `selectiveExecutionEnabled=false` and `escapeActive=false`.
- `tools/verification/shadow-fan-in-negative-fixtures.json` — cancelled, stale-head, duplicate, missing and unexpected stable-ID inputs for the current protected fan-in interface.
- permanent `node:test` coverage for the above plus a current-policy integration test.

## Full-safe versus specialist identity

`tools/verification/full-safety-net-stable-ids.json` is the exact ordinary hosted functional safety net. It is **not** the universe of every specialist stable ID. The shadow evaluator therefore records specialist IDs as an explicit additional set.

A full-safe fallback is widening-only:

`effective fallback = hosted full-safety stable IDs ∪ already-required specialist stable IDs`

This prevents `force-full` or `SELECTOR_ESCAPE` from accidentally dropping a selected `real_fullworld`/specialist obligation.

## Historical regression provenance

The first permanent historical regression is merged PR `#88`, head `03bb3e6cb082dd29dad7261a61e0030e4c846f9d`, which fixed NPC/monster overlay drift during continuous pan.

The corpus stores two forms deliberately:

1. `historical-pr-88-runtime-pan-regression` — only the exact production runtime path `web/fullworld-creatures.mjs`, so current selector coverage of the bug surface is measured without test/governance bootstrap.
2. `historical-pr-88-complete-diff-governance` — all four PR paths, including changed Playwright specs, which must fail closed to a `full` profile.

The required regression truth ID is:

`desktop-chromium::e2e/tests/creatures-desktop.spec.mjs::desktop creature overlay repaints in the same turn as continuous pan`

## Matrix guard boundary

No shard/worker/cardinality threshold is chosen here. `evaluateMatrixCardinality()` requires `maxCombinations` from a future measured Phase E policy and fails closed above that supplied bound. This preserves the rule that Lane D cannot invent final execution shape before Phase E evidence exists.

## Verification performed before GitHub publication

TDD RED was observed for each newly implemented module before production code was added.

Current narrow local result before publication:

- Lane D unit/fixture tests: `18/18 PASS`, `0 fail`, `0 skip`
- `node --check` on `shadow-backtest.mjs`, `selector-escape.mjs`, `run-shadow-backtest.mjs`: PASS

The current-policy integration test and the complete repository `tests/verification/*.test.mjs` suite must run on the actual GitHub branch because the execution container does not contain the full repository checkout. Exact-head CI evidence must be recorded after publication; this paragraph is not a completion claim.

## Mandatory rerun after final Phase E

Before any coordinator cutover decision:

1. resolve final protected Phase D merge SHA and rebuilt Phase E exact head/policy digest;
2. rerun this corpus through the final protected planner/catalog/manifest/stable-ID census;
3. append every discovered selector miss as a permanent corpus regression and activate `SELECTOR_ESCAPE` feedback for any proven miss;
4. run live shadow comparison beside the complete current-main GitHub-hosted functional safety net;
5. verify `force-full` and escape widen hosted full-safe **and preserve specialist obligations**;
6. apply the measured Phase E matrix-cardinality limit and prove small targeted plans are not slowed by needless fan-out;
7. rerun stale/cancelled exact-head fan-in negatives against the final protected fan-in;
8. require zero unexplained false negatives before selective savings can become authoritative.

Only the lifecycle coordinator may rebuild/merge #200 or approve cutover. This Lane D branch alone cannot close #179.
