# ATLAS-UI-SHELL-DESIGN-SYSTEM

ALIAS:
`ATLAS-UI-SHELL-DESIGN-SYSTEM`

MODE:
Autonomous isolated implementation worker — Production UI Shell V1 Lane B.

## Mission

Implement only the semantic Production UI Shell design-system stylesheet and its deterministic style contract.

This lane creates reusable product primitives/tokens behind an isolated stylesheet. It does not wire shared FullWorld markup, does not edit global shared hot files, does not open/merge a PR to protected `main`, and does not mutate Oteryn-Game.

## Required authority

Before mutation, resolve from GitHub:
- current protected Atlas `main` and `AGENTS.md`;
- parent programme #185;
- current implementation Issue and active task packet on coordinator branch `feat/atlas-production-ui-shell-v1`;
- merged design and implementation plan;
- exact worker branch assigned to Lane B.

If the task packet/implementation Issue/worker branch is absent, Lane B is not assigned, or the coordinator gate is not open, return `WAITING_COORDINATOR` and make no mutation.

## Authorized branch and paths

Expected worker branch:

`work/atlas-ui-shell-design-system`

Authorized mutable paths:
- `web/product-shell.css`
- `tests/product-shell-style-contract.mjs`

Forbidden unless explicitly transferred in the task packet:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css`
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- other lane files
- shared visual-review manifests/E2E orchestration

## Stable token interface

Define semantic tokens with stable names at minimum:

```css
:root {
  --surface-canvas: #05080d;
  --surface-shell: #080d14;
  --surface-panel: #0b111a;
  --surface-raised: #101925;
  --surface-hover: rgba(255,255,255,.045);
  --surface-selected: rgba(75,163,255,.14);
  --text-primary: #dbe7f3;
  --text-secondary: #aebfd0;
  --text-muted: #75879b;
  --text-disabled: #536170;
  --brand-accent: #d3a95e;
  --interaction-accent: #4ba3ff;
  --state-success: #61d2a1;
  --state-warning: #e7b865;
  --state-error: #ff7d88;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --radius-sm: 6px;
  --radius-md: 9px;
  --radius-lg: 12px;
}
```

Exact visual values may be tuned by integrated real-browser qualification, but token names and semantic separation remain stable unless coordinator records a reviewed interface revision.

Required reusable classes include at least:
- `.product-nav`
- `.product-context-panel`
- `.product-analysis-panel`
- `.product-card`
- `.product-tab`
- `.product-empty`
- `.product-unavailable`
- `.map-hud`
- `.developer-drawer`

## Required semantics

- Brand gold/amber and interaction blue remain distinct meanings.
- Success/warning/error are semantic state tokens, not arbitrary decoration.
- Primary product body/control text targets approximately 12–14px.
- 10–11px is compact metadata only.
- Essential user meaning must not rely on 8–9px text.
- Every icon-only/focusable primitive must have a visible `:focus-visible` presentation hook.
- Motion/transition helpers must respect reduced-motion preference.
- Important selected/disabled/error/partial states cannot be color-only; CSS must support text/icon/aria-visible presentation by consuming components.
- Do not introduce external art/assets or framework dependencies.
- Do not rewrite existing renderer/canvas CSS or change map geometry in this lane.

## TDD execution

1. Create `tests/product-shell-style-contract.mjs` first and observe RED because `web/product-shell.css` does not exist/does not satisfy the contract.
2. Test required token names, distinct brand/interaction variables, focus-visible rules, reduced-motion handling, stable primitive class names and absence of essential 8–9px product typography in owned stylesheet.
3. Implement the minimal isolated token/primitives sheet.
4. Run:

```text
node --test tests/product-shell-style-contract.mjs
```

5. Keep visual tuning bounded; integrated Lane G owns final real-browser visual acceptance.

## Completion handoff

Commit/push only to the authorized worker branch and verify remote head.

Return:
- `lane: B`
- admission/main SHA
- implementation Issue
- branch and exact head SHA
- exact changed files
- stable token/class interface
- RED result
- GREEN result
- unresolved risks
- confirmation no forbidden path was edited

Do not merge to coordinator branch or `main`; `ATLAS-UI-SHELL-INTEGRATOR` owns integration.