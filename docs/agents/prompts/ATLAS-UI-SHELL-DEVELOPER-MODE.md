# ATLAS-UI-SHELL-DEVELOPER-MODE

ALIAS:
`ATLAS-UI-SHELL-DEVELOPER-MODE`

MODE:
Autonomous isolated implementation worker — Production UI Shell V1 Lane F.

## Mission

Implement only the read-only Developer Mode diagnostics model and isolated panel adapter for Production UI Shell V1.

The product goal is to preserve current technical diagnostics/provenance while removing them from permanent normal-user chrome. This lane does not change runtime authority or diagnostic production semantics.

## Required authority

Before mutation, resolve from GitHub:
- current protected Atlas `main` and `AGENTS.md`;
- parent programme #185;
- current implementation Issue and active task packet on `feat/atlas-production-ui-shell-v1`;
- merged design/plan;
- exact worker branch assigned to Lane F.

If the task packet/worker branch is missing or Lane F is not released, return `WAITING_COORDINATOR` with evidence and make no mutation.

## Authorized branch and paths

Expected branch:

`work/atlas-ui-shell-developer-mode`

Authorized mutable paths:
- `src/browser/developer-diagnostics.mjs`
- `web/fullworld-developer-panel.mjs`
- `tests/developer-diagnostics.mjs`

Forbidden unless explicitly transferred:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css`
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- runtime diagnostic producers outside these owned adapter/model files
- other lane files
- shared E2E/visual manifests

## Stable interfaces

```js
export function buildDeveloperDiagnostics(snapshot) {}
export function mountDeveloperPanel({ host, getSnapshot, provenanceHost }) {}
```

## Required semantics

- The model is read-only.
- Missing measured values remain `null`/unavailable; never coerce missing metrics to `0`.
- Do not fabricate FPS, cache counts, draw calls, memory, publication roots, render times or success states.
- Preserve truthful current metrics such as backend, loaded/visible chunks, range/cache metrics, pixel/texture metrics, visible primitives, draw calls, measured render values and publication/provenance roots only when supplied by existing runtime diagnostics.
- Stable row/group ordering is deterministic.
- Developer Mode must not mutate map/product state, inject fake data, bypass loaders or become a test backdoor.
- Advanced provenance may be adopted/moved into the panel by dependency injection, but this lane must not rewrite provenance authority.
- Normal product visibility/removal of the old persistent diagnostics strip is coordinator-owned shared composition, not this worker's job.

## TDD execution

1. Write `tests/developer-diagnostics.mjs` first.
2. RED cases must include:
   - missing metric stays unavailable/null rather than zero;
   - stable group/row ordering;
   - malformed numeric input fails closed/omits the value;
   - diagnostics are immutable/read-only presentation data;
   - panel adapter has no mutation hooks/test injection paths.
3. Observe RED for missing API.
4. Implement the minimal model.
5. Implement the isolated DOM panel adapter using `getSnapshot()` and optional existing provenance host.
6. Run:

```text
node --test tests/developer-diagnostics.mjs
```

7. If current-main diagnostic tests exist for the consumed snapshot format, run them read-only; do not change their producer semantics in this lane.

## Completion handoff

Commit/push only to the authorized Lane F branch and verify remote head.

Return:
- `lane: F`
- admission/main SHA
- implementation Issue
- branch/head SHA
- exact changed files
- exported interfaces
- RED/GREEN results
- any consumed diagnostic-shape assumptions
- unresolved risks
- confirmation no forbidden path was edited

Do not merge to coordinator branch or protected `main`.