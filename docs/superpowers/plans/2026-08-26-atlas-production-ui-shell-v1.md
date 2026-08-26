# Atlas Production UI Shell V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default technical/debugger-oriented FullWorld shell with a production, map-dominant Oteryn Atlas shell while preserving the verified renderer, map/URL state, creature interaction geometry, Game→Atlas authority boundaries and all truthful capability semantics.

**Architecture:** One coordinator owns the canonical implementation branch and shared FullWorld composition files. Independent worker lanes build focused pure modules/styles/tests in two parallel waves: first Capability+Shell State, Design System, Map HUD and Developer Mode; then Navigation+Left Context and Right Context/Inspector. The coordinator integrates those outputs into the shared shell, after which one integrated responsive/accessibility/visual lane qualifies the frozen candidate.

**Tech Stack:** JavaScript ES modules, `node:test`, HTML/CSS, existing WebGL2 FullWorld renderer, existing Canvas overlays, Playwright/Chromium, current Atlas Molehill `e2e/run.ps1` slot pool, protected GitHub CI/provenance gates and merged-main Synology Live Acceptance.

**Spec:** `docs/superpowers/specs/2026-08-26-atlas-production-ui-shell-v1-design.md`

## Global Constraints

- Lifecycle authority is `Oteryn/Oteryn-Atlas#185` and execution alias is `ATLAS-PRODUCTION-UI-SHELL-V1`.
- Refresh protected `main`, root/nearer `AGENTS.md`, PR #162, PR #170, Issue #117, Game #75 and all overlapping open PRs before product mutation. Planning-time SHAs are evidence only.
- Shared `web/fullworld*` mutation does not begin from a stale or competing ownership state. #162 and #170 must be terminally resolved or explicitly reconciled before their shared surfaces are owned by this programme.
- Oteryn-Game remains canonical World/Content/gameplay-fact authority. Atlas remains a derived read model. No browser legacy/wiki fallback and no invented facts.
- Do not rewrite the renderer, create a second Atlas app or migrate framework as part of V1.
- Preserve existing camera, floor, pan/zoom, view-mode, deep-link, creature selection/hit testing and presentation geometry contracts.
- Preserve `creature=` selection authority, merged `inspector=` authority if #170 lands, existing Farm state ownership and future Hunt ownership. Shell state may only own top-level product context not already represented elsewhere.
- Unsupported modules are disabled/unavailable through real capability state; no Issue/PR numbers appear as normal user-facing feature status.
- Every production-code change follows observed RED → GREEN → REFACTOR. Do not hide deterministic failures with retries, sleeps, larger tolerances or broad allowlists.
- One mutable path has one active owner. Worker branches/worktrees are isolated. Workers do not open/merge PRs to `main`; the coordinator owns the one implementation PR.
- Coordinator-owned shared hot files by default: `web/fullworld.html`, `web/fullworld.css`, `web/style.css` when used for global composition, `web/fullworld-app.mjs`, `web/fullworld-mobile.mjs`, shared E2E orchestration/configuration and formal visual-review manifests.
- Heavy Molehill qualification uses the current repository-selected `e2e/run.ps1` capacity only. At the planning baseline the measured safe default is 2 isolated concurrent full gates; re-resolve the live policy at execution time.
- Final qualification is exact-final-head on one frozen integrated candidate. Any code-changing update invalidates evidence bound to the prior head.

---

### Task 0: Coordinator preflight, ownership freeze and implementation task packet

**Files:**
- Create: `docs/agents/tasks/active/ATLAS-PRODUCTION-UI-SHELL-V1.md`
- No runtime files modified in this task.

**Interfaces:**
- Consumes: current protected `main`, current `AGENTS.md`, lifecycle #185, terminal/reconciled #162/#170 state, current verification policy.
- Produces: exact `admission_main_sha`, `integration_main_sha`, coordinator branch, worker branch/path ownership table, current capability/dependency snapshot and explicit launch gate for Tasks 1–6.

- [ ] **Step 1: Resolve GitHub authority.** Fetch current protected `main`, branch protection, #185, #162, #170, #117, Game #75, all open PRs touching `web/fullworld*`, `src/browser/**`, `e2e/**` or verification policy, and current `AGENTS.md`.
- [ ] **Step 2: Enforce the shared-surface gate.** If #162 or #170 still actively owns shared runtime/UI paths, do not start competing shared-file work. Record `WAITING_EXTERNAL` and release workers until those lifecycles become terminal or explicit ownership reconciliation is documented.
- [ ] **Step 3: Create coordinator branch after the gate is satisfied.** Branch name: `feat/atlas-production-ui-shell-v1`, from the exact refreshed `main` SHA. Create one writable coordinator worktree.
- [ ] **Step 4: Write the active task packet.** It must include exact SHAs, branch names, lane ownership, forbidden hot files, current heavy-E2E capacity and the integration order below. Example ownership section:

```yaml
programme: ATLAS-PRODUCTION-UI-SHELL-V1
issue: 185
coordinator_branch: feat/atlas-production-ui-shell-v1
parallel_wave_1:
  - lane: A
    branch: work/185-capability-shell-state
    owns:
      - src/browser/product-capabilities.mjs
      - src/browser/product-shell-state.mjs
      - tests/product-capabilities.mjs
      - tests/product-shell-state.mjs
  - lane: B
    branch: work/185-design-system
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

- [ ] **Step 5: Validate no duplicate ownership.** Programmatically or manually verify each mutable path appears in at most one active lane and every shared hot file remains coordinator-owned.
- [ ] **Step 6: Commit/push the packet.** Record exact coordinator head and remote readback before dispatching workers.

---

### Task 1 — Lane A: Capability registry and shell state

**Files:**
- Create: `src/browser/product-capabilities.mjs`
- Create: `src/browser/product-shell-state.mjs`
- Create: `tests/product-capabilities.mjs`
- Create: `tests/product-shell-state.mjs`

**Interfaces:**
- Consumes: validated readiness snapshots supplied by existing runtime modules; current query string; existing `creature=` and Farm state presence.
- Produces:

```js
export function buildProductCapabilities(input) {}
export function capabilityAvailable(capabilities, id) {}
export function parseProductShellState(search, capabilities) {}
export function serializeProductShellState(state, search) {}
export function resolveProductContext({ search, capabilities }) {}
```

Capability IDs for V1 are exactly `world`, `creatures`, `npcs`, `farm`, `creatureGameplay`, `hunts`, `liveState`, `developer`.

Capability states are exactly `loading`, `available`, `partial`, `unavailable`, `error`. Trust classes exposed to presentation are exactly `verified`, `measured`, `estimate`, `unknown` where applicable.

- [ ] **Step 1: Write RED capability tests.** Cover world available/error, creature unavailable on invalid search product, Farm `partial` when custom-kill is usable but item/task facts are absent, gameplay availability only from a validated gameplay product, Hunts unavailable without accepted Hunt product, Live state unavailable without genuine source, and error fail-closed behavior.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductCapabilities } from '../src/browser/product-capabilities.mjs';

test('farm is partial when custom kill works but item/task facts do not', () => {
  const caps = buildProductCapabilities({
    world: { state: 'available' },
    creatures: { state: 'available' },
    farm: { customKill: true, itemTask: false },
  });
  assert.equal(caps.farm.state, 'partial');
  assert.equal(caps.farm.features.customKill, true);
  assert.equal(caps.farm.features.itemTask, false);
});
```

- [ ] **Step 2: Run RED.** `node --test tests/product-capabilities.mjs`; expected failure: missing module/export.
- [ ] **Step 3: Implement immutable capability mapping.** No Issue numbers or guessed fallback facts in returned user-facing reasons.

```js
const STATES = new Set(['loading', 'available', 'partial', 'unavailable', 'error']);
function frozenCapability(state, features = {}, trust = 'unknown') {
  if (!STATES.has(state)) throw new Error(`invalid capability state: ${state}`);
  return Object.freeze({ state, trust, features: Object.freeze({ ...features }) });
}

export function buildProductCapabilities(input = {}) {
  const worldState = input.world?.state ?? 'loading';
  const creaturesReady = input.creatures?.state === 'available';
  const farmCustom = input.farm?.customKill === true;
  const farmFacts = input.farm?.itemTask === true;
  return Object.freeze({
    world: frozenCapability(worldState),
    creatures: frozenCapability(creaturesReady ? 'available' : 'unavailable'),
    npcs: frozenCapability(creaturesReady && input.creatures?.npcs !== false ? 'available' : 'unavailable'),
    farm: frozenCapability(farmFacts ? 'available' : farmCustom ? 'partial' : 'unavailable', { customKill: farmCustom, itemTask: farmFacts }, farmFacts ? 'verified' : farmCustom ? 'estimate' : 'unknown'),
    creatureGameplay: frozenCapability(input.gameplay?.state === 'available' ? 'available' : 'unavailable'),
    hunts: frozenCapability(input.hunts?.state === 'available' ? 'available' : 'unavailable'),
    liveState: frozenCapability(input.liveState?.state === 'available' ? 'available' : 'unavailable'),
    developer: frozenCapability('available'),
  });
}
```

- [ ] **Step 4: Write RED shell-state/history tests.** Define `product=` as the only new V1 shell query parameter. Values: `world|creatures|npcs|farm|hunts`. `creature=` with no explicit `product=` resolves to `creatures`; active existing Farm state with no explicit product resolves to `farm`; unavailable requested contexts fail closed to `world`; unrelated existing query params are preserved.

```js
test('creature deep link implies creatures without duplicating creature state', () => {
  const caps = buildProductCapabilities({ world: { state: 'available' }, creatures: { state: 'available' } });
  const state = resolveProductContext({ search: '?creature=monster-entity:abc', capabilities: caps });
  assert.equal(state.context, 'creatures');
});
```

- [ ] **Step 5: Run shell-state RED.** `node --test tests/product-shell-state.mjs`; expected missing API failures.
- [ ] **Step 6: Implement parse/serialize/context resolution.** Never rewrite `creature=`, `inspector=` or existing Farm fields. Preserve unknown unrelated query parameters.
- [ ] **Step 7: Run GREEN.** `node --test tests/product-capabilities.mjs tests/product-shell-state.mjs`; require zero failures.
- [ ] **Step 8: Commit/push lane A.** Branch `work/185-capability-shell-state`. Hand off exact SHA, exported signatures and RED/GREEN commands to coordinator.

---

### Task 2 — Lane B: Production design system tokens and primitives

**Files:**
- Create: `web/product-shell.css`
- Create: `tests/product-shell-style-contract.mjs`

**Interfaces:**
- Consumes: existing dark Atlas palette and approved design spec.
- Produces: semantic CSS tokens and reusable classes only. It does not edit shared HTML or current global CSS files.

Required token surface:

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

Exact tuned values may be adjusted by the integrated visual qualification, but token names and semantic separation are stable interfaces.

- [ ] **Step 1: Write RED style contract.** Read `web/product-shell.css` and assert every required token exists, body/product text classes do not use essential 8–9px type, focus-visible rules exist, and brand/interaction accents are distinct variables.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../web/product-shell.css', import.meta.url), 'utf8');
test('production shell exposes semantic surface and interaction tokens', () => {
  for (const token of ['--surface-shell', '--surface-panel', '--text-primary', '--brand-accent', '--interaction-accent']) {
    assert.match(css, new RegExp(token.replace('--', '--')));
  }
});
```

- [ ] **Step 2: Run RED.** `node --test tests/product-shell-style-contract.mjs`; expected missing-file failure.
- [ ] **Step 3: Implement the token sheet and isolated primitives.** Include `.product-nav`, `.product-context-panel`, `.product-analysis-panel`, `.product-card`, `.product-tab`, `.product-empty`, `.product-unavailable`, `.map-hud`, `.developer-drawer`, visible `:focus-visible` treatment and reduced-motion-safe transitions.
- [ ] **Step 4: Keep normal product copy readable.** Primary body/control text 12–14px; 10–11px metadata only; 8–9px never carries essential meaning.
- [ ] **Step 5: Run GREEN.** `node --test tests/product-shell-style-contract.mjs`; require zero failures.
- [ ] **Step 6: Commit/push lane B.** Branch `work/185-design-system`; no edits to shared hot files.

---

### Task 3 — Lane D: Map HUD model and isolated adapter

**Files:**
- Create: `src/browser/map-hud-model.mjs`
- Create: `web/fullworld-map-hud.mjs`
- Create: `tests/map-hud-model.mjs`

**Interfaces:**
- Consumes: existing zoom/floor/view/layer DOM elements and read-only current values supplied by coordinator wiring.
- Produces:

```js
export function buildMapHudModel({ zoom, floor, viewMode, floorAvailable, layerPanelAvailable }) {}
export function mountMapHud({ host, controls }) {}
```

`mountMapHud()` moves/adopts existing control nodes; it does not clone handlers or own camera/floor state.

- [ ] **Step 1: Write RED pure-model tests.** Cover zoom label, floor unavailable state, AUTO/MINIMAP/CLASSIC/MAP, layer shortcut availability and immutable output.
- [ ] **Step 2: Run RED.** `node --test tests/map-hud-model.mjs`; expected missing export.
- [ ] **Step 3: Implement `buildMapHudModel()`.** It may format presentation state but must not calculate camera transforms or AUTO thresholds.

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

- [ ] **Step 4: Implement isolated DOM adoption adapter.** `mountMapHud()` accepts actual existing control elements via dependency injection and appends them into named HUD slots. It must not attach duplicate click/change handlers.
- [ ] **Step 5: Add a source contract in the test.** Assert adapter code does not import renderer/camera modules or define zoom/floor mutation logic.
- [ ] **Step 6: Run GREEN.** `node --test tests/map-hud-model.mjs`; require zero failures.
- [ ] **Step 7: Commit/push lane D.** Branch `work/185-map-hud`; coordinator later supplies host and existing controls.

---

### Task 4 — Lane F: Developer Mode diagnostics surface

**Files:**
- Create: `src/browser/developer-diagnostics.mjs`
- Create: `web/fullworld-developer-panel.mjs`
- Create: `tests/developer-diagnostics.mjs`

**Interfaces:**
- Consumes: read-only existing diagnostics snapshot and advanced provenance rows.
- Produces:

```js
export function buildDeveloperDiagnostics(snapshot) {}
export function mountDeveloperPanel({ host, getSnapshot, provenanceHost }) {}
```

The developer panel must not mutate product/runtime state, inject test data or become an alternate authority.

- [ ] **Step 1: Write RED diagnostics-model tests.** Require only truthful supplied values; `null`/missing stays unavailable rather than becoming `0`; stable display order; no fabricated FPS/cache-hit metric.

```js
test('missing heap metric stays unavailable rather than zero', () => {
  const rows = buildDeveloperDiagnostics({ backend: 'webgl2', heap: null });
  assert.equal(rows.find((row) => row.id === 'heap').value, null);
});
```

- [ ] **Step 2: Run RED.** `node --test tests/developer-diagnostics.mjs`; expected missing export.
- [ ] **Step 3: Implement immutable diagnostics rows.** IDs at minimum preserve existing backend/chunks/groups/cache/pixelBuckets/gpuPixels/visible/drawCalls/render/heap meaning where data is actually present.
- [ ] **Step 4: Implement on-demand panel adapter.** Use an actual dialog/drawer landmark, close button, Escape/backdrop contract and injected `getSnapshot()`; no permanent map-height reservation.
- [ ] **Step 5: Add source contract.** Assert no write to `globalThis.__OTERYN_*` product state and no timer polling faster than existing diagnostic update cadence; prefer update event/callback from coordinator.
- [ ] **Step 6: Run GREEN.** `node --test tests/developer-diagnostics.mjs`; require zero failures.
- [ ] **Step 7: Commit/push lane F.** Branch `work/185-developer-mode`.

---

### Task 5 — Lane C: Global navigation and contextual left-panel model

**Files:**
- Create: `src/browser/product-navigation.mjs`
- Create: `src/browser/context-panel-model.mjs`
- Create: `web/fullworld-context-panel.mjs`
- Create: `tests/product-navigation.mjs`
- Create: `tests/context-panel-model.mjs`

**Interfaces:**
- Consumes: Lane A `buildProductCapabilities()` output and shell context; existing verified search/filter/control DOM nodes supplied later by coordinator.
- Produces:

```js
export function buildProductNavigation({ capabilities, activeContext }) {}
export function buildContextPanelModel({ context, capabilities }) {}
export function mountContextPanel({ navHost, panelHost, model, controls }) {}
```

Navigation order is exactly `world`, `creatures`, `npcs`, `farm`, `hunts`. Developer Mode is not a normal product nav destination.

- [ ] **Step 1: Consume lane A exact reviewed commit and rerun its tests.** Do not copy/rewrite Lane A interfaces.
- [ ] **Step 2: Write RED navigation tests.** Assert active context, `aria-current` model, unavailable Hunt, partial Farm, no fake enabled Items/Hunts entry, deterministic order.

```js
test('unavailable hunts remains visible but disabled', () => {
  const nav = buildProductNavigation({ capabilities: caps, activeContext: 'world' });
  const hunts = nav.find((entry) => entry.id === 'hunts');
  assert.equal(hunts.enabled, false);
});
```

- [ ] **Step 3: Run RED.** `node --test tests/product-navigation.mjs`; expected missing feature failure.
- [ ] **Step 4: Implement pure navigation model.** User-facing labels: `World`, `Creatures`, `NPCs`, `Items / Farm`, `Hunts`. No Issue references.
- [ ] **Step 5: Write RED context-panel tests.** World requests view/layers/floor/regions controls; Creatures requests creature search/filter controls; NPCs requests NPC/role controls; Farm requests custom kill and item/task sections with truthful partial state; Hunts requests an unavailable explanation until capability exists.
- [ ] **Step 6: Implement model and isolated DOM adapter.** Adapter accepts existing controls by key and places/adopts them; it must not create duplicate search datasets or domain handlers.
- [ ] **Step 7: Run GREEN.** `node --test tests/product-navigation.mjs tests/context-panel-model.mjs tests/product-capabilities.mjs tests/product-shell-state.mjs`.
- [ ] **Step 8: Commit/push lane C.** Branch `work/185-navigation-context`; hand off Lane A dependency SHA.

---

### Task 6 — Lane E: Product-first right context and inspector routing

**Files:**
- Create: `src/browser/inspector-context-model.mjs`
- Create: `web/fullworld-inspector-shell.mjs`
- Create: `tests/inspector-context-model.mjs`

**Interfaces:**
- Consumes: Lane A capabilities, current tile/creature selection, merged/reconciled #170 inspector state/API if present, existing Semantic/provenance content host.
- Produces:

```js
export function buildInspectorContext({ selection, capabilities, requestedTab }) {}
export function mountInspectorShell({ host, tabsHost, contentHosts, model }) {}
```

For a supported creature with gameplay capability, tab order is `gameplay`, `semantic`, `liveState`, `provenance`; Gameplay is default; Live state disabled unless genuine capability exists. For tile/no creature selection, factual details/Semantic remain first and provenance stays advanced.

- [ ] **Step 1: Verify #170 terminal/reconciled contract.** Record exact merged/current paths and `inspector=` semantics. If #170 is still active over these files, remain `WAITING_EXTERNAL` rather than implementing a competing inspector.
- [ ] **Step 2: Write RED model tests.** Cover creature Gameplay default, explicit Semantic restoration, disabled Live state, provenance reachable but non-default, no-selection useful empty state and PARTIAL gameplay subsection preservation.

```js
test('gameplay is default only when verified gameplay capability exists', () => {
  const model = buildInspectorContext({
    selection: { kind: 'creature', entityId: 'monster-entity:abc' },
    capabilities: capsWithGameplay,
  });
  assert.equal(model.activeTab, 'gameplay');
  assert.equal(model.tabs[0].id, 'gameplay');
});
```

- [ ] **Step 3: Run RED.** `node --test tests/inspector-context-model.mjs`; expected missing export.
- [ ] **Step 4: Implement pure tab/context routing.** Do not fetch/parse gameplay data; reuse #170 consumer/state. Do not repair unresolved item identity by display name.
- [ ] **Step 5: Implement isolated shell adapter.** It receives content hosts from existing modules and toggles presentation/accessibility state only.
- [ ] **Step 6: Run GREEN plus #170 regressions.** Run `node --test tests/inspector-context-model.mjs` and every current merged gameplay/creature inspector test discovered from CI/current #170 merge.
- [ ] **Step 7: Commit/push lane E.** Branch `work/185-right-context-inspector`.

---

### Task 7: Coordinator integrates waves into shared FullWorld shell

**Files:**
- Modify: `web/fullworld.html`
- Modify: `web/fullworld.css`
- Modify: `web/style.css` only when legacy global rules cannot be safely superseded by `web/product-shell.css`
- Modify: `web/fullworld-app.mjs`
- Modify: `web/fullworld-mobile.mjs`
- Modify: `web/fullworld-farm-explorer.mjs` only to remove stale engineering lifecycle presentation and expose truthful readiness through Lane A; do not change estimator semantics.
- Consume: all reviewed files/commits from Tasks 1–6.
- Test/modify as necessary: existing `tests/gui-contract.mjs`, existing FullWorld/mobile/creature/Farm deterministic tests.

**Interfaces:**
- Consumes: exact reviewed lane SHAs and their public APIs.
- Produces: one integrated production shell DOM, preserved existing runtime IDs/handlers, one capability snapshot adapter, product-first panels, map HUD and on-demand Developer Mode.

- [ ] **Step 1: Refresh integration `main`.** Normal non-force merge-up per current `AGENTS.md`. Record `integration_main_sha`; reconcile only current authority/contract changes.
- [ ] **Step 2: Review each worker full diff before integration.** Reject shared hot-file edits, duplicate state ownership, external data fallback or interface drift. Rerun every lane deterministic test on its exact handoff SHA.
- [ ] **Step 3: Integrate reviewed worker commits in dependency order.** A → B → D/F → C/E. Preserve worker history on task branch until final squash merge.
- [ ] **Step 4: Write/activate an integrated RED shell contract before changing shared markup.** Extend `tests/gui-contract.mjs` or add `tests/production-shell-contract.mjs` if the existing file is too broad. Required initial assertions: global product nav landmark exists, default diagnostics strip is not visible, map stage remains present, old essential IDs still exist, no normal-user `G3|G4 PROVEN|UPSTREAM_BLOCKED|VERIFYING ROOTS|DETAIL STREAM` text in default shell.
- [ ] **Step 5: Run integrated RED.** `node --test tests/gui-contract.mjs tests/production-shell-contract.mjs` using only files that exist after Step 4; expected product-shell assertions fail on old composition.
- [ ] **Step 6: Recompose `web/fullworld.html`.** Target semantic skeleton:

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

Keep existing map canvases, quick-card IDs, search/control IDs and product module hooks unless a current merged contract explicitly changes them.
- [ ] **Step 7: Load `web/product-shell.css` after existing styles.** Migrate global shell layout to semantic tokens and remove permanent diagnostics row from normal layout without deleting the read-only diagnostic values.
- [ ] **Step 8: Add one capability snapshot bridge.** `web/fullworld-app.mjs` or a focused new coordinator-owned adapter gathers truthful readiness from existing verified globals/modules and calls Lane A. Do not let `product-capabilities.mjs` parse low-level data itself.
- [ ] **Step 9: Wire shell history.** Product nav changes only `product=` through Lane A serializer; `popstate` restores context; `creature=` or active Farm deep links infer compatible context when `product=` is absent. Existing domain state stays unchanged.
- [ ] **Step 10: Wire Map HUD by adopting existing controls.** Existing zoom/floor/view handlers remain the only mutation path.
- [ ] **Step 11: Wire contextual left panel.** Existing World/creature/NPC/Farm controls are moved/adopted into their context slots. Unsupported Item/Hunt sections show concise unavailable product copy, not engineering lifecycle prose.
- [ ] **Step 12: Wire right inspector shell.** Reuse merged #170 Gameplay/Semantic state and current technical content. Provenance becomes advanced, not deleted.
- [ ] **Step 13: Wire Developer Mode.** Existing diagnostics become on-demand and do not consume permanent map height. Developer surface remains read-only.
- [ ] **Step 14: Remove stale lifecycle copy.** In Farm and other default product surfaces, replace Issue-owned/debug status prose with capability-driven user copy while preserving advanced capability IDs/provenance separately.
- [ ] **Step 15: Run integrated deterministic GREEN.** At minimum run all new tests plus current GUI, FullWorld, mobile, search, creature, Farm and gameplay tests selected by current `.github/workflows/ci.yml`. Require zero failures.
- [ ] **Step 16: Commit/push coordinator integration.** Record exact head before Lane G starts.

---

### Task 8 — Lane G: Responsive, accessibility and independent browser acceptance

**Files:**
- Create: `e2e/tests/production-ui-shell.spec.mjs`
- Create: `tests/production-shell-accessibility-contract.mjs`
- Modify: new lane-owned shell modules/styles from Tasks 1–6 only if coordinator grants ownership for a specific defect.
- Shared hot-file fixes are returned as failing evidence to coordinator unless ownership is explicitly transferred.

**Interfaces:**
- Consumes: integrated coordinator candidate.
- Produces: independent deterministic accessibility contracts, exact browser journeys and visual evidence requirements.

- [ ] **Step 1: Write deterministic accessibility contracts.** Assert semantic nav/main/aside landmarks, accessible icon control names, active/expanded/disabled states, focus-visible styling, normal product copy size contract and no color-only trust state.
- [ ] **Step 2: Run RED if any integrated requirement is missing.** `node --test tests/production-shell-accessibility-contract.mjs`; coordinator fixes observed defects with retained regression.
- [ ] **Step 3: Add desktop Playwright journeys.** Cover World default, nav context changes, global search, pan/zoom/floor/view, creature quick card → Details → Gameplay/Semantic, NPC filters, Farm custom-kill partial state, left/right panel close/reopen, Developer Mode, back/forward/reload and no console/page/network failures.
- [ ] **Step 4: Add mobile journeys.** Full map primary viewport, compact product navigation, context drawer/sheet, details sheet, quick card coexistence, Escape/backdrop/focus return and minimum current accepted touch-target reachability.
- [ ] **Step 5: Add geometry regressions.** Compare world-anchored creature/map positions before/after opening/closing panels and viewport resize at DPR 1/2; no hit-test drift or duplicate camera state.
- [ ] **Step 6: Define required full-frame evidence in current visual-review mechanism.** Required frames: clean World default, World context open, creature Gameplay, Semantic/Provenance, Farm partial, Developer Mode, mobile default, mobile context, mobile details.
- [ ] **Step 7: Run focused browser acceptance via current repository command.** Use the exact current Docker/Playwright invocation documented by `e2e/README.md`/`e2e/run.ps1`; retries remain 0. Retain first failures.
- [ ] **Step 8: Commit/push lane G tests/evidence definitions.** Return exact SHA and every observed product defect; do not self-edit coordinator hot files without transfer.

---

### Task 9: Final integration, frozen-candidate qualification, protected merge and live acceptance

**Files:**
- Consume Lane G tests.
- Modify implementation/tests only when a reproduced final-head defect requires a TDD fix.
- Update `docs/agents/tasks/active/ATLAS-PRODUCTION-UI-SHELL-V1.md` with final evidence, then archive it according to current task-lifecycle conventions after terminal completion.

**Interfaces:**
- Consumes: exact integrated candidate containing all accepted lane commits and browser contracts.
- Produces: one protected implementation PR, exact-head evidence, squash merge, branch cleanup and merged-main live acceptance.

- [ ] **Step 1: Integrate/review Lane G.** Rerun all deterministic tests and review the complete changed-file set/full diff.
- [ ] **Step 2: Freeze candidate SHA.** Record `candidate_sha`; no code-changing commit is allowed without invalidating subsequent final evidence.
- [ ] **Step 3: Run complete deterministic/hosted verification selected by current CI.** Require zero failures; do not rely only on focused lane tests.
- [ ] **Step 4: Run exact-head Molehill full qualification through `e2e/run.ps1`.** Obey current slot capacity, unique Compose/artifact/forwarder isolation, current workers/retries policy and exact candidate revision checks.
- [ ] **Step 5: Actually open/review every required full-frame screenshot.** Create/update the current digest-bound visual review evidence only after human/agent visual inspection. No auto-approval of unopened images.
- [ ] **Step 6: Publish exact-head local status only through the current repository-approved publisher after browser and visual success.** Do not reuse stale evidence.
- [ ] **Step 7: Open/refresh the one #185 implementation PR to `main`.** Include admission/integration/candidate SHAs, worker SHAs, changed-file list, capability semantics, exact deterministic/browser/visual results and known unavailable Item/Hunt capabilities.
- [ ] **Step 8: Require every protected check.** At minimum current `atlas-gate` and `provenance-gate`, plus all currently required CodeQL/specialized checks. Resolve all review threads.
- [ ] **Step 9: Requalify after any code change.** New head = new candidate; rerun all invalidated proof.
- [ ] **Step 10: Squash merge with expected-head fencing.** Do not bypass protection. Delete completed worker/coordinator branches when current policy permits.
- [ ] **Step 11: Verify resulting protected `main` SHA and Issue #185 lifecycle state.** The docs/programme issue may already be closed separately; implementation completion must be recorded against the actual implementation lifecycle created by the prompt if #185 is docs-only terminal.
- [ ] **Step 12: Require merged-main Synology Live Acceptance on the exact resulting `main` SHA.** Verify container/header revision identity and bounded desktop/mobile product smoke. Do not deploy a task branch.
- [ ] **Step 13: Terminal audit.** Confirm production default no longer exposes the old engineering dashboard as normal UI, developer diagnostics remain reachable/read-only, deep links/history work, renderer/interaction authority is unchanged, and unsupported Farm/Hunt/Live features remain truthful.

## Parallel launch order

After Task 0 passes its dependency/ownership gate:

1. Launch Tasks **1, 2, 3 and 4** concurrently on four isolated worker branches/worktrees.
2. Coordinator reviews Lane A first and freezes its public interfaces.
3. Launch Tasks **5 and 6** concurrently after Lane A is accepted and #170 inspector ownership is terminal/reconciled.
4. Coordinator executes Task **7** alone over the reviewed worker outputs and owns all shared hot-file wiring.
5. Launch Task **8** against the integrated coordinator candidate as an independent verification/polish lane.
6. Coordinator executes Task **9** alone.

Do not increase parallelism by allowing multiple workers to edit coordinator-owned shared hot files. Reduce parallelism if fresh post-#162/#170 ownership proves two lanes are not actually independent.

## Worker handoff contract

Every worker returns exactly:

```text
Lane: <A-G>
Admission main: <sha>
Worker branch: <branch>
Worker head: <sha>
Changed files: <exact list>
Interfaces produced: <exact exported names/signatures>
Tests:
- <command> — <exact result>
RED evidence: <commit/result>
GREEN evidence: <commit/result>
Unresolved risks/blockers: <none or exact list>
Ownership violations: none
```

Coordinator rejects a handoff that does not identify the exact head, edits forbidden shared paths, changes domain authority, lacks retained RED evidence for new production behavior, or reports only vague "tests pass" claims.

## Completion criterion

Do not claim `ATLAS-PRODUCTION-UI-SHELL-V1` shipped until the protected implementation is squash-merged, exact merged-main live acceptance passes, and the live default user surface is visually/product-wise production-oriented while all prior verified renderer/state/provenance guarantees remain intact.