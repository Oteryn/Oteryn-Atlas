# ATLAS-UI-SHELL-INSPECTOR

ALIAS:
`ATLAS-UI-SHELL-INSPECTOR`

MODE:
Autonomous isolated implementation worker — Production UI Shell V1 Lane E.

## Mission

Implement only the product-first right-context/inspector model and isolated shell adapter for Production UI Shell V1.

Lane E must consume the terminal/reconciled Creature Gameplay Profiles contract if available. It must never create a second gameplay-data consumer, duplicate `inspector=` state, repair identities by display name, or infer unavailable facts.

## Required authority

Before mutation, resolve from GitHub:
- current protected Atlas `main` and `AGENTS.md`;
- parent programme #185;
- current implementation Issue and active task packet on `feat/atlas-production-ui-shell-v1`;
- merged design/plan;
- accepted Lane A capability interface;
- exact terminal/reconciled #170 / Issue #165 state and merged inspector/gameplay files if landed;
- exact Lane E worker branch.

If #170 ownership is still active/unresolved, Wave 2 is not released for Lane E, the task packet does not record the accepted gameplay/inspector contract, or the worker branch is absent, return `WAITING_GAMEPLAY_CONTRACT` and make no mutation.

## Authorized branch and paths

Expected branch:

`work/atlas-ui-shell-inspector`

Authorized mutable paths:
- `src/browser/inspector-context-model.mjs`
- `web/fullworld-inspector-shell.mjs`
- `tests/inspector-context-model.mjs`

Forbidden unless task packet explicitly transfers ownership:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css`
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- merged #170 gameplay consumer/state/model/publication files
- creature hit-test/selection/presentation files
- other lane files
- shared E2E/visual manifests

## Stable interface

Expected public surface:

```js
export function buildInspectorContextModel({
  productContext,
  selection,
  capabilities,
  gameplay,
  semantic,
  provenance,
}) {}

export function mountInspectorShell({ host, model, existingPanels, onTab }) {}
```

Use the exact current-main/active-task-packet signature if the integrator freezes a reviewed refinement.

## Required semantics

For verified creature selection with merged gameplay capability, product hierarchy is:

`Gameplay | Semantic | Live state | Provenance`

Rules:
- Gameplay is default when verified gameplay data exists.
- Semantic remains available and preserves its existing factual/technical content.
- Live state remains disabled/unavailable until genuine live authority exists.
- Provenance is advanced/secondary, not deleted.
- `inspector=` remains owned by the merged gameplay/inspector state contract; this lane does not invent a competing tab URL parameter.
- NPC Gameplay may expose only proven Sells/Buys/Services/Travel/Locations sections from the accepted Game-derived product.
- Monster Gameplay may expose only proven Loot/Stats/Resistances-or-Immunities/Spawns sections.
- PARTIAL completeness stays partial; missing sections remain unavailable rather than fabricated.
- World/tile selection shows factual map details first and advanced technical/provenance second.
- Farm/Hunt analysis contexts expose integration seams only when the corresponding accepted products exist; no fake item/Hunt facts.
- No-selection state is useful product copy, not raw roots/debug output.
- The DOM adapter adopts/reframes existing inspector/gameplay/semantic/provenance hosts by dependency injection; it does not duplicate their data fetching or handlers.

## TDD execution

1. Create `tests/inspector-context-model.mjs` first.
2. RED cases must cover:
   - creature with gameplay -> Gameplay default;
   - creature without gameplay -> truthful Semantic/details fallback;
   - Live state disabled without genuine source;
   - PARTIAL gameplay preserved;
   - provenance reachable but secondary;
   - world/tile/no-selection contexts;
   - no invented Farm/Hunt facts;
   - model immutability and no issue-number status copy.
3. Observe RED for missing API.
4. Implement minimal pure model using accepted Lane A capability state and merged #170 public seams.
5. Implement isolated DOM adoption shell with injected existing panel hosts/actions.
6. Run:

```text
node --test tests/inspector-context-model.mjs
```

7. Run current merged #170 inspector/gameplay deterministic tests unchanged where applicable. A failure caused by an authoritative contract mismatch is a blocker to report, not permission to rewrite #170-owned files.

## Completion handoff

Commit/push only to the Lane E worker branch and verify remote head.

Return:
- `lane: E`
- admission/main SHA
- implementation Issue
- accepted Lane A SHA
- terminal/reconciled #170 evidence and consumed interface
- branch/head
- exact changed files
- public interfaces
- RED/GREEN and adjacent #170 test results
- unresolved risks
- confirmation no forbidden path was edited

Do not merge to coordinator branch or protected `main`.