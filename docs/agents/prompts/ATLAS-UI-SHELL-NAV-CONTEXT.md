# ATLAS-UI-SHELL-NAV-CONTEXT

ALIAS:
`ATLAS-UI-SHELL-NAV-CONTEXT`

MODE:
Autonomous isolated implementation worker — Production UI Shell V1 Lane C.

## Mission

Implement only the global product navigation model and contextual left-panel composition adapter for Production UI Shell V1.

Lane C consumes the accepted Lane A capability/state interfaces. It must reuse existing search/filter/domain controls rather than create new datasets, duplicate handlers or fork domain state.

## Required authority

Before mutation, resolve from GitHub:
- current protected Atlas `main` and `AGENTS.md`;
- parent programme #185;
- current implementation Issue and active task packet on `feat/atlas-production-ui-shell-v1`;
- merged design/plan;
- accepted Lane A worker SHA/interface recorded by the integrator;
- exact worker branch assigned to Lane C.

If Lane A has not been accepted/frozen by the integrator, the task packet does not release Wave 2, or the worker branch is absent, return `WAITING_WAVE_1` and make no mutation.

## Authorized branch and paths

Expected branch:

`work/atlas-ui-shell-nav-context`

Authorized mutable paths:
- `src/browser/product-navigation.mjs`
- `src/browser/context-panel-model.mjs`
- `web/fullworld-context-panel.mjs`
- `tests/product-navigation.mjs`
- `tests/context-panel-model.mjs`

Forbidden unless the active task packet explicitly transfers ownership:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css`
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- Lane A capability/state files
- existing domain search/filter business-logic files
- other lane files
- shared E2E/visual manifests

## Stable interfaces

Follow the exact interface signatures frozen by the merged plan/task packet. Expected public surface:

```js
export function buildProductNavigation({ context, capabilities }) {}
export function buildContextPanelModel({ context, capabilities, selection }) {}
export function mountContextPanel({ host, context, controls, onContextAction }) {}
```

If current-main plan/task packet uses a narrower equivalent, follow the recorded interface exactly and report it.

## Required product model

Global navigation order is exactly:
1. `World`
2. `Creatures`
3. `NPCs`
4. `Items / Farm`
5. `Hunts`

Availability comes only from accepted Lane A capability state.

Required behavior:
- World is the default available context when validated map capability exists.
- Creatures/NPCs become selectable only when their capability is available.
- Items/Farm may be selectable in truthful `partial` mode when custom-kill support exists while item/task facts do not.
- Hunts remains disabled/unavailable without an accepted Hunt product.
- Disabled entries are visibly/semantically disabled; do not route into empty fake products.
- Active entry is deterministic and suitable for `aria-current`/selected semantics.
- Normal-user copy does not expose Issue/PR numbers or engineering lifecycle prose.

## Left contextual panel semantics

- World context adopts existing layer/floor/view/region controls when available.
- Creatures context adopts existing creature search/filter controls and result/navigation actions.
- NPC context reuses existing NPC search/role filters.
- Items/Farm adopts existing truthful Farm/custom-kill controls; full item/task facts remain capability-gated.
- Hunts shows an unavailable/empty model until accepted Hunt products exist; no fake Hunt filters/results.
- `mountContextPanel()` receives existing DOM controls through dependency injection and moves/adopts them; it does not reimplement their domain handlers.
- No second search index or product dataset may be created just for shell chrome.

## TDD execution

1. Write `tests/product-navigation.mjs` first.
2. RED cases: stable order, active context, disabled/unavailable entries, Farm partial, Hunts unavailable, no issue-number status copy.
3. Implement minimal pure navigation model.
4. Write `tests/context-panel-model.mjs` RED cases for World/Creatures/NPCs/Farm/Hunts model selection and capability gating.
5. Implement minimal context-panel model.
6. Implement isolated DOM adoption adapter; do not wire shared FullWorld markup.
7. Run:

```text
node --test tests/product-navigation.mjs tests/context-panel-model.mjs
```

8. Run Lane A tests against the exact accepted Lane A interface if the coordinator makes those files available in the worker integration base.

Do not mutate shared hot files to make the UI visible; integrator owns final wiring.

## Completion handoff

Commit/push only to the Lane C worker branch and verify remote head.

Return:
- `lane: C`
- admission/main SHA
- implementation Issue
- accepted Lane A SHA consumed
- branch/head
- exact changed files
- public interfaces
- RED/GREEN results
- unresolved risks
- confirmation no forbidden path was edited

Do not merge to coordinator branch or protected `main`.