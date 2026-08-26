# ATLAS-UI-SHELL-MAP-HUD

ALIAS:
`ATLAS-UI-SHELL-MAP-HUD`

MODE:
Autonomous isolated implementation worker — Production UI Shell V1 Lane D.

## Mission

Implement only the map-HUD presentation model and isolated DOM-adoption adapter for Production UI Shell V1.

The lane relocates presentation of existing map controls; it must not create a second camera, floor, zoom, view-mode, layer or minimap state system.

## Required authority

Before mutation, resolve from GitHub:
- current protected Atlas `main` and `AGENTS.md`;
- parent programme #185;
- current implementation Issue and active task packet on `feat/atlas-production-ui-shell-v1`;
- merged design/plan;
- exact worker branch assigned to Lane D.

If the implementation task packet/branch is missing or Lane D is not released by the coordinator, return `WAITING_COORDINATOR` and make no mutation.

## Authorized branch and paths

Expected branch:

`work/atlas-ui-shell-map-hud`

Authorized mutable paths:
- `src/browser/map-hud-model.mjs`
- `web/fullworld-map-hud.mjs`
- `tests/map-hud-model.mjs`

Forbidden unless task packet explicitly transfers ownership:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css`
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- renderer/camera/floor core modules
- other lane files
- shared E2E/visual manifests

## Stable interfaces

```js
export function buildMapHudModel({
  zoom,
  floor,
  viewMode,
  floorAvailable,
  layerPanelAvailable,
}) {}

export function mountMapHud({ host, controls }) {}
```

## Required semantics

- `buildMapHudModel()` formats presentation state only.
- It does not calculate camera transforms or AUTO thresholds.
- Supported view-mode presentation follows the current runtime's actual modes; do not invent or redefine mode semantics.
- `mountMapHud()` adopts/moves existing control nodes passed by dependency injection.
- It must not clone or replace their existing event handlers.
- It must not create duplicate zoom/floor/view/layer state.
- Existing URL/deep-link behavior remains owned by current runtime.
- Existing minimap/runtime geometry remains untouched.
- If a required control is absent/unavailable, expose truthful unavailable presentation rather than inventing a fallback handler.

Target model example:

```js
export function buildMapHudModel({ zoom, floor, viewMode, floorAvailable = true, layerPanelAvailable = true }) {
  return Object.freeze({
    zoomLabel: `${Math.round(Number(zoom) * 100)}%`,
    floorLabel: floorAvailable ? `F ${floor}` : 'Floor unavailable',
    viewMode,
    floorAvailable,
    layerPanelAvailable,
  });
}
```

## TDD execution

1. Write `tests/map-hud-model.mjs` first.
2. RED cases: zoom label, unavailable floor, all current view modes, layer shortcut state and immutable result.
3. Observe RED for missing API.
4. Implement pure model minimally.
5. Implement DOM-adoption adapter with injected existing nodes.
6. Add a source-contract assertion that owned adapter code does not import renderer/camera mutation modules or define duplicate zoom/floor state/thresholds.
7. Run:

```text
node --test tests/map-hud-model.mjs
```

8. Run adjacent current-main view/floor tests if they exercise the public seams without requiring forbidden shared-file edits.

Do not fix unrelated renderer/view failures in this lane; return them to coordinator with evidence.

## Completion handoff

Commit/push only to the Lane D worker branch and verify remote head.

Return:
- `lane: D`
- admission/main SHA
- implementation Issue
- exact branch/head
- changed-file list
- interface signatures
- RED result
- GREEN result
- source-contract result
- blockers/risks
- confirmation no forbidden path was edited

Do not merge to coordinator branch or protected `main`.