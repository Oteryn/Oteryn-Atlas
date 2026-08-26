# Atlas Production UI Shell V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default technical/debugger-oriented FullWorld shell with a production, map-dominant Oteryn Atlas shell while preserving the verified renderer, map/URL state, creature interaction geometry, Game→Atlas authority boundaries and truthful capability semantics.

**Architecture:** The merged programme package in Issue #185 is planning authority only. At execution time one coordinator creates a fresh implementation Issue and one canonical implementation branch. Independent workers build focused modules/styles/tests in two parallel waves: first Capability+Shell State, Design System, Map HUD and Developer Mode; then Navigation+Left Context and Right Context/Inspector. The coordinator alone wires shared FullWorld hot files, then an independent responsive/accessibility/browser lane qualifies the integrated candidate.

**Tech Stack:** JavaScript ES modules, `node:test`, HTML/CSS, existing WebGL2 FullWorld renderer, existing Canvas overlays, Playwright/Chromium, current Atlas Molehill `e2e/run.ps1` slot pool, protected GitHub CI/provenance gates and merged-main Synology Live Acceptance.

**Spec:** `docs/superpowers/specs/2026-08-26-atlas-production-ui-shell-v1-design.md`

## Global Constraints

- Programme/design authority: `Oteryn/Oteryn-Atlas#185`. Runtime implementation MUST create a new substantial-work implementation Issue after this docs package is merged; #185 does not itself authorize runtime mutation.
- Execution alias: `ATLAS-PRODUCTION-UI-SHELL-V1`.
- Refresh protected `main`, root/nearer `AGENTS.md`, PR #162, PR #170, Issue #117, Game #75 and material overlapping PRs before product mutation. Planning-time SHAs are evidence only.
- Shared `web/fullworld*` mutation does not begin while #162 or #170 still has unresolved ownership of the same surfaces. Wait or explicitly reconcile terminal ownership; do not fork their state/geometry/data seams.
- Oteryn-Game remains canonical World/Content/gameplay-fact authority. Atlas remains a derived read model. No browser legacy/wiki fallback and no invented facts.
- Do not rewrite the renderer, create a second Atlas app or migrate UI framework in V1.
- Preserve existing camera, floor, pan/zoom, view mode, deep links, `creature=` selection, current Farm state, canonical creature hit testing and presentation geometry. Preserve merged `inspector=` semantics if #170 lands.
- Shell state may own only top-level product context. Unsupported modules are disabled/unavailable through real capability state; Issue/PR numbers never appear as ordinary user-facing feature status.
- Every production-code change follows observed RED → GREEN → REFACTOR. No retries, arbitrary sleeps, larger tolerances or broad allowlists to hide deterministic failures.
- One mutable path has one active owner. Worker branches/worktrees are isolated. Workers do not open or merge PRs to `main`; the coordinator owns the one implementation PR.
- Coordinator-owned hot files by default: `web/fullworld.html`, `web/fullworld.css`, `web/style.css` when used for global composition, `web/fullworld-app.mjs`, `web/fullworld-mobile.mjs`, shared E2E orchestration/configuration and formal visual-review manifests.
- Heavy Molehill qualification uses only current repository-selected `e2e/run.ps1` capacity. Planning baseline safe default is 2 isolated concurrent full gates; re-resolve the live policy at execution time.
- Final qualification is exact-final-head on one frozen integrated candidate. A code-changing update invalidates evidence bound to the prior head.

---

### Task 0: Coordinator preflight, implementation Issue and ownership freeze

**Files:**
- Create: `docs/agents/tasks/active/ATLAS-PRODUCTION-UI-SHELL-V1.md`
- No runtime file changes.

**Interfaces:**
- Consumes: merged current-main spec/plan/prompt, current `AGENTS.md`, current #162/#170/#117/Game#75 state and current verification policy.
- Produces: new implementation Issue number, exact `admission_main_sha`, coordinator branch, worker branch/path ownership table, dependency snapshot and launch gate for Tasks 1–6.

- [ ] **Step 1: Prove the programme package is on protected `main`.** Resolve current `main` and verify the spec, this plan and `docs/agents/prompts/ATLAS-PRODUCTION-UI-SHELL-V1.md` are all present there. Never implement from the docs branch.
- [ ] **Step 2: Resolve current overlap.** Fetch #162, #170, #117, Game #75, current branch protection, current `AGENTS.md` and open PRs touching `web/fullworld*`, `src/browser/**`, `e2e/**` or verification policy.
- [ ] **Step 3: Enforce the shared-surface gate.** If #162 or #170 is still active on overlapping shared runtime/UI files, report `WAITING_EXTERNAL`, release workers and do not create competing runtime edits. Resume only after terminal state or explicit ownership reconciliation is verified.
- [ ] **Step 4: Create a fresh implementation Issue.** Title: `feat(ui): implement Production UI Shell V1`. Body must reference #185, current main SHA, terminal/reconciled #162/#170 state, parallel topology, no Game authority change and the exact Definition of Done from the spec.
- [ ] **Step 5: Create coordinator branch.** `feat/atlas-production-ui-shell-v1` from exact refreshed `main`; one writable coordinator worktree only.
- [ ] **Step 6: Write active task packet.** It must record the returned implementation Issue number, exact SHAs, branch names, ownership and forbidden hot files. Use this shape:

```yaml
programme: ATLAS-PRODUCTION-UI-SHELL-V1
parent_programme_issue: 185
implementation_issue: <actual GitHub issue number returned in Step 4>
coordinator_branch: feat/atlas-production-ui-shell-v1
parallel_wave_1:
  - lane: A
    branch: work/atlas-ui-shell-capability-state
    owns:
      - src/browser/product-capabilities.mjs
      - src/browser/product-shell-state.mjs
      - tests/product-capabilities.mjs
      - tests/product-shell-state.mjs
  - lane: B
    branch: work/atlas-ui-shell-design-system
    owns:
      - web/product-shell.css
      - tests/product-shell-style-contract.mjs
shared_hot_files:
  owner: coordinator
  paths:
    - web/fullworld.html
    - web/fullworld.css
    - web/fullworld-app.mjs
    - web/fullworld-mobile.mjs
```

- [ ] **Step 7: Validate ownership.** Every mutable path appears in at most one active lane; every shared hot file remains coordinator-owned.
- [ ] **Step 8: Commit/push task packet and verify remote head.** Only then dispatch workers.

---

### Task 1 — Lane A: Capability registry and top-level shell state

**Files:**
- Create: `src/browser/product-capabilities.mjs`
- Create: `src/browser/product-shell-state.mjs`
- Create: `tests/product-capabilities.mjs`
- Create: `tests/product-shell-state.mjs`

**Interfaces:**

```js
export function buildProductCapabilities(input) {}
export function capabilityAvailable(capabilities, id) {}
export function parseProductShellState(search, capabilities) {}
export function serializeProductShellState(state, search) {}
export function resolveProductContext({ search, capabilities }) {}
```

V1 capability IDs: `world`, `creatures`, `npcs`, `farm`, `creatureGameplay`, `hunts`, `liveState`, `developer`.
States: `loading`, `available`, `partial`, `unavailable`, `error`. Presentation trust classes: `verified`, `measured`, `estimate`, `unknown`.

- [ ] **Step 1: Write capability RED tests.** Cover world error/available, creature fail-closed, Farm `partial` when custom kill works but item/task facts are absent, gameplay only from validated gameplay product, Hunts unavailable without accepted product, Live state unavailable without genuine source.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductCapabilities } from '../src/browser/product-capabilities.mjs';

test('farm is partial when custom kill works but item/task facts do not', () => {
  const caps = buildProductCapabilities({
    world: { state: 'available' },
    creatures: { state: 'available', npcs: true },
    farm: { customKill: true, itemTask: false },
  });
  assert.equal(caps.farm.state, 'partial');
  assert.equal(caps.farm.features.customKill, true);
  assert.equal(caps.farm.features.itemTask, false);
});
```

- [ ] **Step 2: Run RED.** `node --test tests/product-capabilities.mjs`; expected missing module/export failure.
- [ ] **Step 3: Implement immutable mapping.** Missing/invalid inputs fail closed. Returned normal-user reason strings contain no Issue numbers.

```js
const STATES = new Set(['loading', 'available', 'partial', 'unavailable', 'error']);
function cap(state, features = {}, trust = 'unknown') {
  if (!STATES.has(state)) throw new Error(`invalid capability state: ${state}`);
  return Object.freeze({ state, trust, features: Object.freeze({ ...features }) });
}

export function buildProductCapabilities(input = {}) {
  const world = input.world?.state ?? 'loading';
  const creaturesReady = input.creatures?.state === 'available';
  const farmCustom = input.farm?.customKill === true;
  const farmFacts = input.farm?.itemTask === true;
  return Object.freeze({
    world: cap(world),
    creatures: cap(creaturesReady ? 'available' : 'unavailable'),
    npcs: cap(creaturesReady && input.creatures?.npcs === true ? 'available' : 'unavailable'),
    farm: cap(farmFacts ? 'available' : farmCustom ? 'partial' : 'unavailable', { customKill: farmCustom, itemTask: farmFacts }, farmFacts ? 'verified' : farmCustom ? 'estimate' : 'unknown'),
    creatureGameplay: cap(input.gameplay?.state === 'available' ? 'available' : 'unavailable'),
    hunts: cap(input.hunts?.state === 'available' ? 'available' : 'unavailable'),
    liveState: cap(input.liveState?.state === 'available' ? 'available' : 'unavailable'),
    developer: cap('available'),
  });
}
```

- [ ] **Step 4: Write shell-state RED tests.** New shell parameter is exactly `product=world|creatures|npcs|farm|hunts`. `creature=` with no `product=` implies `creatures`; active existing Farm state with no product implies `farm`; unavailable requested contexts fall back to `world`; unrelated query params are preserved.

```js
test('creature deep link implies creatures without rewriting creature state', () => {
  const caps = buildProductCapabilities({ world: { state: 'available' }, creatures: { state: 'available', npcs: true } });
  const state = resolveProductContext({ search: '?creature=monster-entity:abc', capabilities: caps });
  assert.equal(state.context, 'creatures');
});
```

- [ ] **Step 5: Run RED.** `node --test tests/product-shell-state.mjs`.
- [ ] **Step 6: Implement parse/serialize/context resolution.** Never rewrite `creature=`, `inspector=` or existing Farm fields.
- [ ] **Step 7: Run GREEN.** `node --test tests/product-capabilities.mjs tests/product-shell-state.mjs`.
- [ ] **Step 8: Commit/push.** Branch `work/atlas-ui-shell-capability-state`; return exact SHA/interfaces/tests.

---

### Task 2 — Lane B: Production design system

**Files:**
- Create: `web/product-shell.css`
- Create: `tests/product-shell-style-contract.mjs`

**Interfaces:** semantic CSS tokens and isolated production-shell classes only; no shared HTML/global CSS edits.

Required stable token names:

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
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --radius-sm: 6px; --radius-md: 9px; --radius-lg: 12px;
}
```

- [ ] **Step 1: Write RED style contract.** Assert required token names, distinct brand/interaction variables, focus-visible treatment, reduced-motion handling and no essential product text at 8–9px.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../web/product-shell.css', import.meta.url), 'utf8');
test('semantic shell tokens exist', () => {
  for (const token of ['--surface-shell','--surface-panel','--text-primary','--brand-accent','--interaction-accent']) assert.ok(css.includes(token));
});
```

- [ ] **Step 2: Run RED.** `node --test tests/product-shell-style-contract.mjs`; expected missing-file failure.
- [ ] **Step 3: Implement tokens and isolated primitives.** Include `.product-nav`, `.product-context-panel`, `.product-analysis-panel`, `.product-card`, `.product-tab`, `.product-empty`, `.product-unavailable`, `.map-hud`, `.developer-drawer`, visible `:focus-visible`, safe reduced-motion transitions. Primary product body/control text 12–14px; 10–11px metadata only.
- [ ] **Step 4: Run GREEN.** `node --test tests/product-shell-style-contract.mjs`.
- [ ] **Step 5: Commit/push.** Branch `work/atlas-ui-shell-design-system`.

---

### Task 3 — Lane D: Map HUD model and adapter

**Files:**
- Create: `src/browser/map-hud-model.mjs`
- Create: `web/fullworld-map-hud.mjs`
- Create: `tests/map-hud-model.mjs`

**Interfaces:**

```js
export function buildMapHudModel({ zoom, floor, viewMode, floorAvailable, layerPanelAvailable }) {}
export function mountMapHud({ host, controls }) {}
```

`mountMapHud()` adopts/moves existing controls; it must not attach duplicate handlers or own camera/floor state.

- [ ] **Step 1: Write RED model tests.** Cover zoom label, unavailable floor, all current view modes, layer shortcut and immutable result.
- [ ] **Step 2: Run RED.** `node --test tests/map-hud-model.mjs`.
- [ ] **Step 3: Implement pure model.** It formats presentation only and does not calculate transforms/AUTO thresholds.

```js
export function buildMapHudModel({ zoom, floor, viewMode, floorAvailable = true, layerPanelAvailable = true }) {
  return Object.freeze({
    zoomLabel: `${Math.round(Number(zoom) * 100)}%`,
    floorLabel: floorAvailable ? `F ${floor}` : 'Floor unavailable',
    viewMode, floorAvailable, layerPanelAvailable,
  });
}
```

- [ ] **Step 4: Implement DOM adoption adapter by dependency injection.** Append the existing passed control nodes into HUD slots; no cloned event logic.
- [ ] **Step 5: Add source contract.** Test the adapter does not import renderer/camera mutation modules or define duplicate zoom/floor state.
- [ ] **Step 6: Run GREEN.** `node --test tests/map-hud-model.mjs`.
- [ ] **Step 7: Commit/push.** Branch `work/atlas-ui-shell-map-hud`.

---

### Task 4 — Lane F: Developer Mode

**Files:**
- Create: `src/browser/developer-diagnostics.mjs`
- Create: `web/fullworld-developer-panel.mjs`
- Create: `tests/developer-diagnostics.mjs`

**Interfaces:**

```js
export function buildDeveloperDiagnostics(snapshot) {}
export function mountDeveloperPanel({ host, getSnapshot, provenanceHost }) {}
```

- [ ] **Step 1: Write RED diagnostics tests.** Missing metric stays `null`, not `0`; stable row order; no fabricated FPS/cache-hit values.

```js
test('missing heap metric stays unavailable', () => {
  const rows = buildDeveloperDiagnostics({ backend: 'webgl2', heap: null });
  assert.equal(rows.find((row) => row.id === 'heap').value, null);
});
```

- [ ] **Step 2: Run RED.** `node --test tests/developer-diagnostics.mjs`.
- [ ] **Step 3: Implement immutable rows.** Preserve existing backend/chunks/groups/cache/pixelBuckets/gpuPixels/visible/drawCalls/render/heap meaning only where supplied.
- [ ] **Step 4: Implement on-demand drawer/dialog adapter.** Close button + Escape/backdrop/focus return; read-only `getSnapshot()`; no permanent map-height reservation and no alternate runtime authority.
- [ ] **Step 5: Add source contract.** No writes to `globalThis.__OTERYN_*` product state; no aggressive polling loop.
- [ ] **Step 6: Run GREEN.** `node --test tests/developer-diagnostics.mjs`.
- [ ] **Step 7: Commit/push.** Branch `work/atlas-ui-shell-developer-mode`.

---

### Task 5 — Lane C: Global navigation and contextual left panel

**Files:**
- Create: `src/browser/product-navigation.mjs`
- Create: `src/browser/context-panel-model.mjs`
- Create: `web/fullworld-context-panel.mjs`
- Create: `tests/product-navigation.mjs`
- Create: `tests/context-panel-model.mjs`

**Interfaces:**

```js
export function buildProductNavigation({ capabilities, activeContext }) {}
export function buildContextPanelModel({ context, capabilities }) {}
export function mountContextPanel({ navHost, panelHost, model, controls }) {}
```

Navigation order: `world`, `creatures`, `npcs`, `farm`, `hunts`. Developer Mode is not normal product navigation.

- [ ] **Step 1: Consume/review Lane A commit and rerun its tests.** Do not copy its interfaces.
- [ ] **Step 2: Write RED navigation tests.** Active context, deterministic order, unavailable Hunt disabled, partial Farm truthful, `aria-current` model.

```js
test('unavailable hunts stays visible but disabled', () => {
  const nav = buildProductNavigation({ capabilities: caps, activeContext: 'world' });
  assert.equal(nav.find((entry) => entry.id === 'hunts').enabled, false);
});
```

- [ ] **Step 3: Run RED.** `node --test tests/product-navigation.mjs`.
- [ ] **Step 4: Implement pure nav model.** User labels: `World`, `Creatures`, `NPCs`, `Items / Farm`, `Hunts`; no Issue references.
- [ ] **Step 5: Write RED context tests.** World requests view/layers/floor/regions; Creatures creature search/filter; NPCs NPC/role controls; Farm custom kill plus gated item/task content; Hunts concise unavailable state until capability exists.
- [ ] **Step 6: Implement model and DOM adoption adapter.** Existing controls/datasets/handlers are supplied by coordinator and reused.
- [ ] **Step 7: Run GREEN.** `node --test tests/product-navigation.mjs tests/context-panel-model.mjs tests/product-capabilities.mjs tests/product-shell-state.mjs`.
- [ ] **Step 8: Commit/push.** Branch `work/atlas-ui-shell-navigation-context`.

---

### Task 6 — Lane E: Product-first right context / inspector

**Files:**
- Create: `src/browser/inspector-context-model.mjs`
- Create: `web/fullworld-inspector-shell.mjs`
- Create: `tests/inspector-context-model.mjs`

**Interfaces:**

```js
export function buildInspectorContext({ selection, capabilities, requestedTab }) {}
export function mountInspectorShell({ host, tabsHost, contentHosts, model }) {}
```

Supported creature tab order when gameplay exists: `gameplay`, `semantic`, `liveState`, `provenance`; Gameplay default, Live state disabled until genuine capability. Tile/no-creature keeps factual details/Semantic first and provenance advanced.

- [ ] **Step 1: Re-resolve #170.** Record exact merged/current `inspector=` API and paths. If #170 is still active on these surfaces, remain `WAITING_EXTERNAL` instead of implementing a competing inspector.
- [ ] **Step 2: Write RED model tests.** Gameplay default only when capability exists, explicit Semantic restoration, Live disabled, provenance reachable/non-default, useful no-selection state and PARTIAL gameplay preservation.

```js
test('verified gameplay becomes creature default', () => {
  const model = buildInspectorContext({ selection: { kind: 'creature', entityId: 'monster-entity:abc' }, capabilities: capsWithGameplay });
  assert.equal(model.activeTab, 'gameplay');
  assert.equal(model.tabs[0].id, 'gameplay');
});
```

- [ ] **Step 3: Run RED.** `node --test tests/inspector-context-model.mjs`.
- [ ] **Step 4: Implement pure routing.** Do not fetch/parse gameplay data; reuse #170 consumer/state and never repair item identity by display name.
- [ ] **Step 5: Implement presentation adapter.** Receives existing content hosts; toggles layout/a11y only.
- [ ] **Step 6: Run GREEN and current gameplay/inspector regressions.** Use `node --test tests/inspector-context-model.mjs` plus exact merged gameplay tests discovered from current CI.
- [ ] **Step 7: Commit/push.** Branch `work/atlas-ui-shell-right-context`.

---

### Task 7: Coordinator shared-file integration

**Files:**
- Modify: `web/fullworld.html`
- Modify: `web/fullworld.css`
- Modify: `web/style.css` only when existing global rules cannot be safely superseded by `web/product-shell.css`
- Modify: `web/fullworld-app.mjs`
- Modify: `web/fullworld-mobile.mjs`
- Modify: `web/fullworld-farm-explorer.mjs` only for stale lifecycle-facing presentation/readiness wiring; estimator semantics stay unchanged.
- Create or modify: `tests/production-shell-contract.mjs`
- Preserve/update as required: current `tests/gui-contract.mjs` and current FullWorld/mobile/creature/Farm/gameplay tests.

**Interfaces:** consumes exact reviewed lane SHAs and produces one integrated product shell without duplicate domain state.

- [ ] **Step 1: Refresh current `main` and normal non-force merge-up.** Record exact `integration_main_sha`; reload changed instructions/contracts.
- [ ] **Step 2: Review each worker full diff.** Reject forbidden hot-file edits, duplicate state, external fallback or interface drift. Rerun lane tests.
- [ ] **Step 3: Integrate in dependency order.** A → B → D/F → C/E.
- [ ] **Step 4: Write integrated RED shell contract before markup changes.** Require product nav landmark, map stage, preserved essential runtime IDs, diagnostics not permanently visible, and default shell free of engineering labels such as `G4 PROVEN`, `UPSTREAM_BLOCKED`, `VERIFYING ROOTS`, `DETAIL STREAM`.
- [ ] **Step 5: Run RED.** `node --test tests/production-shell-contract.mjs tests/gui-contract.mjs`; old composition must fail new product-shell assertions.
- [ ] **Step 6: Recompose shared HTML.** Use this semantic target while preserving existing map canvases, quick-card IDs, existing search/control IDs and runtime hooks:

```html
<header class="product-topbar" aria-label="Oteryn Atlas application bar">...</header>
<div class="product-workspace">
  <nav id="product-navigation" class="product-nav" aria-label="Atlas sections"></nav>
  <aside id="product-context-panel" class="product-context-panel" aria-label="Current Atlas tools"></aside>
  <section class="map-stage fullworld-stage">...</section>
  <aside id="product-analysis-panel" class="product-analysis-panel" aria-label="Atlas details"></aside>
</div>
<div id="developer-panel-host"></div>
```

- [ ] **Step 7: Load `web/product-shell.css` after existing styles.** Move global shell layout to semantic tokens; normal map stage no longer reserves permanent diagnostics height.
- [ ] **Step 8: Build one truthful capability bridge.** Existing verified module/global readiness is gathered in coordinator wiring and passed to Lane A; the pure capability module never parses low-level products itself.
- [ ] **Step 9: Wire history.** Product nav modifies only `product=` via Lane A; `popstate` restores context. Existing `creature=`, `inspector=` and Farm state stay authoritative.
- [ ] **Step 10: Adopt existing zoom/floor/view/layer controls into Map HUD.** No duplicate handlers/state.
- [ ] **Step 11: Adopt existing World/creature/NPC/Farm controls into contextual left panel.** Unsupported Item/Hunt states use concise product copy.
- [ ] **Step 12: Wire right inspector shell.** Reuse merged #170 Gameplay/Semantic state if present; provenance remains accessible advanced content.
- [ ] **Step 13: Wire Developer Mode.** Existing diagnostics remain truthful/read-only and on-demand.
- [ ] **Step 14: Remove stale lifecycle copy from default UI.** Farm/custom kill semantics stay intact; only readiness presentation changes.
- [ ] **Step 15: Run complete deterministic GREEN.** All new tests plus current GUI, FullWorld, mobile, search, creature, Farm and gameplay tests selected by current CI must pass.
- [ ] **Step 16: Commit/push integrated coordinator head.** Record exact SHA before browser lane.

---

### Task 8 — Lane G: Responsive/accessibility/browser acceptance

**Files:**
- Create: `e2e/tests/production-ui-shell.spec.mjs`
- Create: `tests/production-shell-accessibility-contract.mjs`
- Modify only lane-owned new modules/styles when coordinator explicitly grants ownership for a reproduced defect; shared hot-file defects are returned to coordinator.

- [ ] **Step 1: Add deterministic a11y contracts.** Landmarks, accessible icon labels, active/expanded/disabled semantics, focus-visible, readable product text and no color-only trust state.
- [ ] **Step 2: Run deterministic contract and retain RED for defects.** `node --test tests/production-shell-accessibility-contract.mjs`.
- [ ] **Step 3: Add desktop Playwright journeys.** World default; context switches; global search; pan/zoom/floor/view; creature quick card → Details → Gameplay/Semantic; NPC filters; Farm custom-kill partial state; left/right panels; Developer Mode; back/forward/reload; zero console/page/network failures.
- [ ] **Step 4: Add mobile journeys.** Full map primary viewport, compact navigation, context drawer/sheet, details sheet, quick-card coexistence, Escape/backdrop/focus return, current accepted touch-target reachability.
- [ ] **Step 5: Add geometry regressions.** World-anchored map/creature position before/after panels and resize at DPR1/2; no hit-test drift or duplicate camera state.
- [ ] **Step 6: Require visual frames.** Clean World; World context open; creature Gameplay; Semantic/Provenance; Farm partial; Developer Mode; mobile default; mobile context; mobile details.
- [ ] **Step 7: Run focused browser acceptance using current `e2e/README.md`/`e2e/run.ps1` command.** Retries remain 0; first failures stay visible.
- [ ] **Step 8: Commit/push lane G tests/evidence definitions.** Return exact SHA and observed defects.

---

### Task 9: Frozen candidate, protected implementation merge and live acceptance

**Files:**
- Consume Lane G tests.
- Modify implementation/tests only for reproduced final-head defects with retained TDD regression.
- Update/archive the active implementation task packet according to current repository lifecycle rules.

- [ ] **Step 1: Integrate/review Lane G.** Rerun deterministic tests and inspect complete changed-file set/full diff.
- [ ] **Step 2: Freeze `candidate_sha`.** Any code-changing update creates a new candidate and invalidates dependent evidence.
- [ ] **Step 3: Run complete hosted/deterministic verification selected by current CI.** Require zero failures.
- [ ] **Step 4: Run exact-head Molehill full qualification through current `e2e/run.ps1`.** Obey current slot capacity, isolated Compose/artifact/forwarder identities, worker/retry policy and exact-revision probes.
- [ ] **Step 5: Actually open/review every required full-frame screenshot.** Only then create/update digest-bound visual review evidence.
- [ ] **Step 6: Publish exact-head local status only through the repository-approved publisher after browser+visual success.** No stale evidence reuse.
- [ ] **Step 7: Open/update the single implementation PR for the fresh implementation Issue.** Include parent #185, admission/integration/candidate SHAs, worker SHAs, exact changed files, capability semantics and exact test/browser/visual results.
- [ ] **Step 8: Require every protected check and resolve review threads.** At minimum current `atlas-gate` and `provenance-gate`, plus all current required/specialized checks.
- [ ] **Step 9: Requalify after any code-changing review fix.** New head = new candidate.
- [ ] **Step 10: Squash merge with expected-head fencing.** Never bypass branch protection. Delete completed branches when policy permits.
- [ ] **Step 11: Verify fresh implementation Issue closes only when its Definition of Done is met.** Parent programme #185 remains historical planning authority and may already be closed by the docs merge.
- [ ] **Step 12: Require merged-main Synology Live Acceptance on exact resulting protected `main` SHA.** Verify container/header revision identity and bounded desktop/mobile product smoke; never deploy a task branch.
- [ ] **Step 13: Terminal audit.** Default live UI is product-oriented; map remains dominant; Developer Mode is reachable/read-only; deep links/history work; renderer/interaction authority is unchanged; unsupported Farm/Hunt/Live functions remain truthful.

## Parallel launch order

After Task 0 passes:

1. Run Tasks **1, 2, 3, 4** concurrently on isolated workers.
2. Coordinator accepts/fixes Lane A interface first.
3. Run Tasks **5 and 6** concurrently after Lane A is stable and #170 is terminal/reconciled.
4. Coordinator alone runs Task **7**.
5. Independent Lane G runs Task **8** against integrated head.
6. Coordinator alone runs Task **9**.

Reduce parallelism if fresh ownership proves lanes are not independent. Never increase it by allowing concurrent shared-hot-file edits.

## Worker handoff contract

Every worker returns exactly:

```text
Lane: <A-G>
Admission main: <sha>
Worker branch: <branch>
Worker head: <sha>
Changed files: <exact list>
Interfaces produced: <exact signatures>
Tests:
- <command> — <exact result>
RED evidence: <exact commit/result>
GREEN evidence: <exact commit/result>
Unresolved risks/blockers: <none or exact list>
Ownership violations: none
```

Coordinator rejects vague test claims, missing exact head, forbidden-path edits, duplicate authority/state, missing RED evidence for new production behavior or incompatible interfaces.

## Completion criterion

Do not claim `ATLAS-PRODUCTION-UI-SHELL-V1` shipped until the fresh implementation Issue is protected-squash-merged, merged-main live acceptance passes, and the live default surface is production-oriented while every prior verified renderer/state/provenance guarantee remains intact.