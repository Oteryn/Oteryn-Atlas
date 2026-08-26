# Atlas Production UI Shell V1 design

Alias: `ATLAS-PRODUCTION-UI-SHELL-V1`

Lifecycle authority: `Oteryn/Oteryn-Atlas#185`.

Status: OWNER-APPROVED DIRECTION, DESIGN SPECIFICATION. This document defines the product-shell architecture only. It does not authorize runtime implementation or deployment by itself.

## 1. Objective

Move Oteryn Atlas from its current technically correct, verification-oriented FullWorld interface to a production user-facing application shell without rewriting the verified map renderer, changing Game/Atlas authority boundaries, inventing unavailable product facts, or replacing established interaction/state contracts.

The target is a dark, map-dominant Oteryn product in which ordinary users primarily see world exploration and gameplay information while technical provenance and runtime diagnostics remain available through an advanced/developer surface.

The approved desktop composition is:

```text
+--------------------------------------------------------------------------------+
| OTERYN ATLAS | context/breadcrumb | global search | X/Y/F | settings/profile   |
+------+--------------------+-----------------------------+-----------------------+
|      |                    |                             |                       |
| NAV  | CONTEXT PANEL      |        MAP SURFACE          | CONTEXT / ANALYSIS    |
| RAIL |                    |                             | PANEL                 |
|      | search / filters   | WebGL + semantic overlays   | Gameplay / Details    |
|      | lists / explorer   | map HUD + minimap           | Farm / Hunt analysis  |
|      |                    |                             | Semantic / Provenance  |
+------+--------------------+-----------------------------+-----------------------+
| optional compact product status                         | Developer Mode entry  |
+--------------------------------------------------------------------------------+
```

The shell is an evolution of the existing `web/fullworld.html` application, not a second Atlas application and not a framework rewrite.

## 2. Verified planning baseline

Planning allocation was performed against protected Atlas `main@abb799b5bb0905c8f2e8b57e67950334db39d5f7` on 2026-08-26.

That exact revision completed Synology Live Acceptance run `32953008242` successfully. The production baseline therefore includes a verified FullWorld renderer, map/minimap modes, semantic search, desktop/mobile controls, creature overlays, direct creature interaction, creature quick cards, labels/NPC functional badges, URL/deep-link state, Farm Explorer custom-kill estimate scaffolding, diagnostics and provenance surfaces.

At planning time the following overlapping work is active and must be re-resolved before implementation mutation:

- Atlas PR #162 — `feat(atlas): animate creatures walking in place`; shared creature runtime/presentation work, draft/in progress.
- Atlas PR #170 — `feat(atlas): implement Creature Gameplay Profiles`; adds `Gameplay | Semantic | Live state`, Game-derived NPC trade/services/travel and monster loot/stats/resistances/spawns, draft/in progress.
- Atlas PR #182 — governance-only root `AGENTS.md` work; no runtime UI scope, but implementation agents must always reload the then-current root instructions.
- Atlas Issue #117 — Hunt Intelligence future product surface and consumer of this shell architecture.
- Oteryn-Game Issue #75 — Game-owned item/drop/task farm-intelligence export remains open; complete Item Explorer facts are therefore not currently product-authorized.

Implementation must refresh all of those states. Historical SHAs and statuses in this design are evidence for the design decision, not permission to pin stale implementation bases.

## 3. Current-state audit

### 3.1 What is strong and should be preserved

The current Atlas already has mature foundations that should not be reimplemented:

- WebGL/full-world map rendering and verified publication loading;
- deterministic camera, floor and URL/deep-link state;
- AUTO / MINIMAP / CLASSIC / MAP view behavior;
- semantic search and coordinate navigation;
- map selection and direct creature activation;
- canonical creature presentation bounds, hit testing and quick-card interaction;
- bounded creature rendering and semantic overlays;
- desktop/mobile drawers and touch reachability;
- extensive deterministic, browser, visual and live-acceptance verification;
- fail-closed provenance and capability behavior.

A production redesign must treat these as established application services rather than styling details to replace.

### 3.2 Why the current shell still feels technical

The primary `web/fullworld.html` surface exposes implementation and verification vocabulary directly to ordinary users, including examples such as:

- `FULL-WORLD VERIFIED RUNTIME · G5`;
- `G3`, `G4 PROVEN`, `DIAGNOSTIC`;
- `UPSTREAM_BLOCKED`, `PRESENTATION DEPENDENCY`;
- `VERIFYING ROOTS`, `DETAIL STREAM`;
- `Inspector & provenance` and `ROOTS` as the default right-panel framing;
- persistent bottom diagnostics for backend, chunks, range groups/cache, pixel buckets, GPU pixels, visible primitives, draw calls, render metrics and JS heap.

This information is valuable for verification and operation, but its permanent presence makes the application read as an engineering console.

### 3.3 Information architecture problem

The current left rail combines unrelated concerns in one scrolling column:

- view-mode controls;
- semantic layers;
- Item & Task Explorer;
- Area/Subarea capability state;
- animation;
- floor controls;
- technical overview/minimap.

That architecture does not scale cleanly to Creature Gameplay Profiles, a complete Item Explorer, Hunt Intelligence, bookmarks/notes and later product modules. It also gives unavailable technical capability explanations the same visual priority as actual user tasks.

### 3.4 Layout and typography problem

At the audited main the desktop shell reserves approximately `252px` for the left rail and `360px` for the inspector, while the map stage additionally reserves a 29px status row plus persistent diagnostics. Many metadata labels use 8–11px type.

This is efficient for debugging but not ideal for a polished product. The production shell should increase normal readable product typography, reduce permanent chrome and let the map reclaim vertical space.

### 3.5 Capability/status coupling problem

Some product copy is currently hard-coded to engineering lifecycle details. For example Farm Explorer describes presentation enrichment as dependency-owned by #115 even though the presentation work has since merged. Runtime product UI must never require manual issue-number copy edits to remain truthful.

Capability availability must instead be driven by a product-facing capability registry derived from real runtime/publication state.

## 4. Architecture decision

### 4.1 Selected approach: production shell over existing FullWorld runtime

Retain the current FullWorld application and renderer while introducing a product-shell layer with five responsibilities:

1. global navigation and product context;
2. contextual left-panel composition;
3. map HUD composition around the unchanged map/runtime surface;
4. contextual right-panel composition;
5. product-facing capability/state translation plus optional developer surfaces.

The shell must consume existing runtime/state seams. It must not become world/content authority and must not duplicate map, creature, search or URL state.

### 4.2 Rejected approach: CSS-only facelift

A CSS-only redesign would improve appearance but preserve the central structural problem: unrelated controls and products would still be stacked into one rail, diagnostics would still dominate the layout, and future Hunt/Item/Gameplay modules would continue competing for the same surface.

### 4.3 Rejected approach: framework/application rewrite

A React/Vue/Svelte or second-page rewrite is not justified for V1. It would duplicate or destabilize map state, deep links, event seams, mobile behavior and browser verification without creating proportional user value.

Existing ES modules remain the implementation baseline. New modules may be introduced to isolate shell state and rendering responsibilities.

## 5. Product information architecture

### 5.1 Global navigation rail

Desktop uses one narrow persistent global rail, target width approximately 64–72 CSS pixels. It changes the user's product context; it does not host detailed filters.

Initial navigation model:

- `World` — always available when the FullWorld base map is verified;
- `Creatures` — available when the creature catalog/placement capability is available;
- `NPCs` — available when factual NPC placement/search data is available;
- `Items / Farm` — visible but capability-gated; full item mode unavailable until an accepted farm-intelligence product exists; custom creature kill-target mode may remain available where truthful;
- `Hunts` — unavailable until accepted Hunt Intelligence products are present;
- `Bookmarks` / `Notes` — only if/when an existing accepted local/product state contract supports them; V1 must not invent a persistence backend.

The shell must not ship empty functional-looking top-level products merely because a visual mock-up contains them.

Navigation uses icon + accessible label. The currently active context is visually unambiguous and exposed through `aria-current` or equivalent semantics.

### 5.2 Contextual left panel

The left panel changes with the selected global context. Target desktop width is approximately 280–320 CSS pixels, responsive to available space.

Examples:

- World: layers, floor, view mode, region controls when available;
- Creatures: creature search, type/role filters and visible result/navigation controls;
- NPCs: NPC search and authoritative role filters;
- Items / Farm: item/task search when supported, source-creature or custom-kill inputs, map visualization controls;
- Hunts: future Hunt Finder filters and result list.

The panel is one composition surface, not multiple independently scrolling sidebars.

### 5.3 Dominant map surface

The map remains the application center and largest visual region.

Existing base and overlay canvases, coordinate transforms, map activation, creature interaction and rendering authority are preserved. The production shell may relocate existing controls around the map but must not create a second camera, floor, selection or hit-test system.

### 5.4 Contextual right panel

The right panel becomes the user-facing details/analysis surface. Target desktop width is approximately 340–380 CSS pixels.

The right panel is context-sensitive:

- tile/world selection: factual map details first, technical stack/provenance secondary;
- creature selection: Gameplay first once Creature Gameplay Profiles is merged, then Semantic, with Live state disabled unless genuine live authority exists;
- farm context: verified item/source/task facts separated from estimates;
- hunt context: future Overview/Performance/Route/Requirements etc. as defined by Hunt Intelligence;
- no selection: useful context/empty state rather than raw roots by default.

The current technical inspector remains available through an advanced/provenance tab rather than being deleted.

### 5.5 Top application bar

Target height is approximately 56 CSS pixels on desktop, with responsive reduction on mobile.

Primary responsibilities:

- Oteryn Atlas brand;
- compact context/breadcrumb title where useful;
- global semantic/coordinate search;
- current X/Y/floor display with copy/deep-link affordance;
- settings/developer entry.

Zoom controls move from the primary topbar to the map HUD unless real-browser qualification proves the existing placement is materially better for a supported viewport.

Do not add a second full top navigation row if the global rail already owns product navigation.

## 6. Map HUD

Map-specific controls should live visually on or immediately around the map rather than occupying unrelated product panels.

The HUD may include:

- zoom in/out and current zoom;
- floor selector/up/down;
- view mode (AUTO/MINIMAP/CLASSIC/MAP) in a compact menu or segmented control;
- layer/filter shortcut that opens the current World/context layer panel;
- current cursor coordinate feedback;
- compact minimap/navigation overview when supported by existing verified products.

Runtime verification badges such as `VERIFYING ROOTS` and `DETAIL STREAM` must not remain permanent normal-user furniture. The shell should translate them into concise product loading/error states and expose detailed runtime state in Developer Mode.

## 7. Product vs developer surfaces

### 7.1 Default product surface

Default copy answers user questions:

- what am I looking at?;
- what can I search/filter?;
- what factual information is available?;
- what is unavailable?;
- which value is verified, measured or estimated?;
- what can I do next?

It should not require knowledge of Game/Atlas issue numbers, compiler generations, pixel buckets or semantic roots.

### 7.2 Advanced provenance

Provenance remains reachable from contextual details, for example through a `Technical` / `Provenance` tab or an overflow action.

It may expose exact record/entity IDs, source revision, contract/capability ID, semantic digest, completeness state and publication roots where already available.

### 7.3 Developer Mode

Developer Mode preserves read-only diagnostics needed for verification and operations:

- renderer/backend;
- loaded/visible chunks;
- range groups/cache;
- pixel/texture store metrics;
- visible primitives;
- draw calls;
- measured render/frame values when truly collected;
- runtime/publication roots and relevant debugging state.

V1 default: Developer Mode is hidden from normal product layout and opened through Settings/Developer or an explicit developer URL state. It must not change runtime authority or enable test-only mutation.

A persistent 88–132px diagnostics strip is removed from the normal desktop product layout.

## 8. Capability registry

Introduce one product-facing capability model instead of embedding engineering lifecycle prose throughout HTML.

The registry is a presentation/readiness seam. It consumes verified runtime/publication facts from existing modules and converts them to a small stable vocabulary such as:

- `available`;
- `partial`;
- `unavailable`;
- `loading`;
- `error`.

It must also preserve trust semantics needed by product components, including distinctions such as verified fact, measured value, estimate and unknown/unavailable where applicable.

The registry does not infer facts. A capability is active only when its real underlying Atlas/Game product passes its existing validation.

Examples:

- World map: available when the FullWorld publication activates successfully;
- Creatures: available only when static creature/search products validate;
- Creature Gameplay: available only when the accepted gameplay-profile product validates;
- Item facts/tasks: unavailable while Game #75 or accepted successor publication is absent;
- Hunt Intelligence: unavailable until accepted Hunt products exist;
- Live state: unavailable until a genuine live-state source exists.

Issue/PR numbers must never be displayed as the reason a product feature is unavailable.

## 9. Design system

The current variables are expanded into semantic product tokens rather than replaced with arbitrary per-component colors.

### 9.1 Surface tokens

Define at least:

- `--surface-canvas` — page/map surrounding background;
- `--surface-shell` — top/rail chrome;
- `--surface-panel` — primary side panels;
- `--surface-raised` — cards/popovers;
- `--surface-hover` and `--surface-selected`.

### 9.2 Text tokens

Define at least:

- `--text-primary`;
- `--text-secondary`;
- `--text-muted`;
- `--text-disabled`.

Normal product body text should generally resolve to approximately 12–14 CSS pixels. 10–11px is reserved for compact metadata. 8–9px must not carry essential user meaning.

### 9.3 Accent and semantic tokens

Use separate meanings:

- Oteryn brand gold/amber — brand identity and restrained intelligence/map emphasis;
- interaction blue — focus, selection, links and active controls;
- success/verified green — successful/verified state where such a label is useful;
- warning/partial amber — incomplete/limited state;
- danger/error red — failure;
- estimate accent — clearly separate from verified facts where analytics/estimator surfaces require it.

Do not make all interactive state gold. Brand and interaction meanings remain distinct.

### 9.4 Geometry tokens

Create shared spacing, radius, border and elevation tokens so cards, controls, tabs and drawers stop defining near-duplicate values independently.

The exact token values are selected during implementation from real-browser visual qualification, but implementation must use a small coherent scale rather than ad hoc values.

## 10. Component architecture

The implementation plan should prefer small ES modules with explicit responsibilities. Candidate boundaries are:

### Product shell controller

Owns active top-level product context and composition events. It does not own world/map state.

### Navigation model

Builds visible/disabled navigation entries exclusively from the capability registry and static shell metadata.

### Context panel controller

Mounts the appropriate existing/new control composition for the active product context. It must reuse underlying search/filter modules rather than duplicate their business logic.

### Inspector/context controller

Routes selection/context to Gameplay, Semantic, Farm/Hunt analysis or advanced provenance views. It must reuse existing `creature=` / `inspector=` state contracts when present.

### Map HUD controller

Binds existing zoom/floor/view/layer actions to a new compact presentation without creating duplicate state.

### Developer panel

Reads existing truthful diagnostics and presents them on demand. No mutation/test injection surface.

### Capability registry

Collects verified readiness from existing runtime products and emits stable product-facing capability state.

Exact filenames are an implementation-plan decision after #162/#170 integration is refreshed. The design intentionally avoids locking stale line numbers or module paths before those active PRs settle.

## 11. State and URL ownership

Existing durable FullWorld query/deep-link parameters remain authoritative for camera, floor, view mode, creature selection, Farm state and other already-shipped behavior.

The shell may add a compact product-context parameter only if necessary for reload/back/forward restoration. It must not encode the same state twice.

Rules:

- map state remains owned by existing map/runtime modules;
- `creature=` remains concrete creature selection authority;
- `inspector=` from Creature Gameplay Profiles, if merged, remains inspector-mode authority;
- Farm state remains owned by `farm-state.mjs` or its merged successor;
- future Hunt state is owned by the Hunt programme;
- shell state owns only top-level product/navigation presentation not already represented elsewhere.

Back/forward and reload must restore a coherent product context from durable domain state. For example a `creature=` deep link should open a compatible creature/details context rather than requiring an unrelated manual navigation click.

## 12. Search model

There remains one global search entry point.

Global search may route results into the appropriate product context:

- coordinate/town/waypoint -> World;
- NPC/monster -> Creatures/NPC context plus existing selection/inspector;
- item/task -> Items/Farm only when authoritative search records exist;
- hunt -> Hunts only when authoritative Hunt records exist.

Do not create independent search indexes solely to satisfy navigation chrome.

Context panels may provide filtered search input, but should reuse the accepted underlying search datasets and selection actions.

## 13. Farm Explorer integration

The shell must distinguish the already-shipped custom kill estimator from the still-unavailable complete item/task intelligence product.

While the accepted Game farm-intelligence publication is absent:

- do not display fabricated item cards, drop percentages, task requirements or named `Best places`;
- keep truthful custom creature kill-target functionality available if its dependencies validate;
- present the full Item/Farm module as partially available or capability-limited rather than as an engineering `UPSTREAM_BLOCKED` debug block;
- explain missing capability in user language and make provenance details available separately.

When a compatible future farm publication becomes available, the existing Farm Explorer specification remains authoritative for probability semantics, expected/P50/P80/P95 outputs, KPH/time-base semantics and ranking labels.

The visual mock-up's `Fast / Typical / Conservative`, generic average drop chance and unlabeled `Best Places` are not normative data semantics.

## 14. Creature Gameplay Profiles integration

PR #170 is a hard integration dependency for shared inspector composition if it merges before implementation.

The production shell must preserve its intended product hierarchy:

`Gameplay | Semantic | Live state`

with Gameplay default for supported creature selections, Semantic always accessible, and Live state unavailable/disabled until real live authority exists.

The shell should make Gameplay feel native rather than append it to the old provenance-first inspector.

NPC examples: Sells, Buys, Services, Travel, Locations when the accepted Game product proves them.

Monster examples: Loot, Stats, Resistances/Immunities, Spawns when proven.

Do not create another gameplay-data consumer or item identity repair path.

## 15. Hunt Intelligence integration seam

Issue #117 must be able to integrate without another shell redesign.

Reserve product-shell extension points for:

- Hunt Finder context panel;
- Hunt detail/analysis right panel;
- map overlays/routes/entrances;
- Compare Hunts;
- measured/estimated performance blocks with trust labels.

Do not implement unavailable Hunt facts in Production Shell V1. The shell only supplies layout/state/component integration seams.

## 16. Responsive architecture

### 16.1 Desktop

Target composition:

- 56px topbar;
- 64–72px nav rail;
- 280–320px left context panel when open;
- dominant flexible map;
- 340–380px right context panel when open;
- no permanent full-width diagnostics strip.

Panels may collapse independently to preserve map area on narrower desktop/tablet widths.

### 16.2 Tablet

The global rail remains compact where practical. Context panels become overlay drawers or mutually exclusive side sheets based on measured available width.

The map must never be reduced to a narrow unusable strip merely to keep both panels permanently visible.

### 16.3 Mobile

Reuse the proven drawer/bottom-sheet interaction principles already shipped:

- map occupies the full primary viewport;
- product navigation is reachable through a compact menu/rail-equivalent;
- left context becomes a drawer/sheet;
- right details become a drawer/bottom sheet;
- map quick card continues to work without introducing a second modal stack;
- all primary touch targets remain at least the repository's current accepted mobile reachability size;
- safe-area insets and topmost Escape/backdrop/focus behavior remain correct.

The redesign must not build a second independent mobile navigation system for Farm/Hunts/Gameplay.

## 17. Loading, empty, unavailable and error states

Every product module needs user-facing states separate from low-level diagnostics.

### Loading

Show concise progress such as `Loading map…`, `Loading creature details…` or skeleton/progress treatment where bounded and truthful. Detailed root/range verification is Developer Mode information.

### Empty

Examples: `No creatures match these filters`, `Select a creature on the map`, `No results on this floor`.

### Unavailable

Explain what the user cannot use without implementation-centric issue references. Example: `Item drop data is not available in this Atlas release.` Advanced provenance can show the absent capability/contract.

### Partial

Keep factual available subsections visible and label missing subsections clearly. Do not collapse PARTIAL into either success or total error.

### Error

A failed optional product capability should fail that capability closed while preserving unrelated map functionality. Full publication/renderer integrity failures continue following existing fail-closed behavior.

## 18. Accessibility

Production Shell V1 must preserve and improve the current browser interaction contract.

Requirements:

- semantic landmarks for topbar/nav/main/context panels;
- accessible names for icon-only controls;
- visible keyboard focus that uses design-system tokens;
- correct active/selected/expanded/disabled semantics;
- predictable Escape/backdrop dismissal order;
- focus return after drawers/dialogs close;
- keyboard reachable global navigation and search;
- touch targets compatible with existing accepted mobile sizing;
- important state is never conveyed by color alone;
- product text remains readable without relying on 8–9px labels.

No formal WCAG conformance level is claimed by this design without a dedicated audit.

## 19. Migration strategy

Implementation must be incremental so current runtime functionality stays testable throughout.

### Phase 0 — exact integration preflight

Refresh protected main, root instructions, #162, #170, #117, Game #75 and all overlapping PRs. Do not mutate shared runtime files from a stale base.

If #162/#170 are still active and own the same `web/fullworld*` surfaces, implementation waits or explicitly reconciles ownership before mutation. Documentation/pure shell logic that is genuinely disjoint may proceed only if current repository concurrency rules allow it.

### Phase 1 — design tokens and shell scaffolding

Introduce the production token system and structural shell containers while preserving existing DOM IDs/events required by runtime and tests.

No user-visible feature semantics change in this phase.

### Phase 2 — navigation and capability registry

Add the global navigation model, capability registry and product-context state. Existing controls remain functional through the new composition.

### Phase 3 — map HUD and World context

Move zoom/floor/view/layer presentation into map HUD/World context while preserving existing handlers and URL behavior.

### Phase 4 — contextual inspector/product panels

Recompose tile/creature details around product-first tabs, incorporating merged Creature Gameplay Profiles if available and retaining technical/provenance access.

### Phase 5 — Farm/extension integration

Move custom kill/farm surfaces into the Items/Farm context. Keep unsupported item/task functions truthfully gated. Establish extension seams needed by Hunt Intelligence without implementing Hunt facts.

### Phase 6 — Developer Mode and diagnostics cleanup

Move persistent diagnostics/runtime roots into on-demand Developer Mode and reduce default product status to minimal actionable state.

### Phase 7 — responsive/accessibility polish and final qualification

Complete tablet/mobile drawers/sheets, keyboard/focus behavior, visual consistency and full acceptance.

Implementation may combine phases into fewer PRs only if the final execution plan demonstrates conflict-safe ownership and independently reviewable/testable boundaries.

## 20. Verification architecture

Because the eventual implementation is user-visible and touches primary FullWorld layout, it requires the complete current repository-selected UI verification stack.

At minimum:

### Deterministic/unit/contract tests

- capability registry mapping and fail-closed states;
- shell/context state parsing and history behavior;
- navigation availability/selection;
- no duplicate map/creature/domain state ownership;
- product/developer visibility rules;
- compatibility with existing URL parameters;
- unsupported product modules remain unavailable.

### Browser desktop journeys

Cover at least:

- World load -> search -> navigation -> pan/zoom/floor/view mode;
- creature direct click -> quick card -> Details -> Gameplay/Semantic when gameplay capability exists;
- NPC role/filter interaction;
- Items/Farm custom kill flow with unsupported item facts represented correctly;
- open/close left and right panels while continuing to use map controls;
- Developer Mode open/close with truthful diagnostics;
- reload/back/forward/deep-link restoration;
- loading/empty/error/partial states;
- no page/console/network failures.

### Browser mobile journeys

Cover equivalent high-value flows with drawers/sheets, touch map navigation, focus/backdrop/Escape semantics and no persistent map compression.

### Visual-user acceptance

Capture and actually review exact-head representative full frames, including:

- clean World map default;
- World with left context open;
- creature Gameplay details;
- Semantic/Provenance advanced view;
- Farm partial/unavailable state;
- Developer Mode;
- mobile default map;
- mobile context drawer;
- mobile details sheet.

Targeted visual baselines may be added where stable, but broad screenshot similarity is not the only correctness oracle.

### Geometry/render regressions

The shell must prove that moving controls/panels does not alter map/creature world anchoring, hit testing, DPR behavior, viewport resize handling or canonical creature presentation geometry.

### Performance

Measure the redesign's effect on map viewport size, layout work and interaction responsiveness. Do not invent new thresholds; use current repository evidence/budgets and record regressions if discovered.

### Final lifecycle

Use current `e2e/run.ps1` Molehill qualification rules, current exact-head CI including `atlas-gate` and `provenance-gate`, full changed-file/diff review, protected squash merge, branch cleanup and merged-main Synology Live Acceptance before claiming shipped completion.

## 21. Concurrency and dependency rules

The implementation agent must treat active shared-surface PRs as real concurrency constraints.

Specifically:

- do not duplicate or overwrite #162 animation runtime/presentation work;
- do not duplicate or overwrite #170 gameplay inspector/state/data-consumer work;
- if either PR merges, refresh and consume its merged contracts;
- if either is abandoned/superseded, verify the terminal state and current main before assuming ownership;
- do not use textual conflict avoidance as permission to create competing state/geometry systems;
- future #117 Hunt work should consume shell extension points rather than fork the application shell.

The docs-only programme package may merge independently because it does not mutate runtime/UI implementation paths.

### 21.1 Parallel execution topology

The eventual implementation is explicitly designed for bounded multi-agent execution. Parallelism is allowed only across independently owned domains with stable interfaces; it is not permission for multiple workers to edit the same shell hot files concurrently.

One coordinator owns the canonical implementation branch, integration order, shared-file composition, candidate freeze and final protected PR lifecycle. Subordinate agents work on isolated worker branches/worktrees and return reviewed commits/evidence to the coordinator. Subordinate workers must never merge directly to protected `main` and must not share writable worktrees.

Before dispatching implementation lanes, the coordinator must complete Phase 0 and freeze the current cross-lane interface contract after resolving the terminal/reconciled state of #162 and #170. Shared runtime/UI mutation must not begin while those lifecycles still have unresolved ownership over the same `web/fullworld*` surfaces unless ownership is explicitly transferred or the implementation plan proves the lane is disjoint.

#### Parallel lanes

The implementation plan should decompose the work into these ownership domains, adjusting exact filenames only after the Phase 0 refresh:

| Lane | Primary responsibility | May run in parallel | Hard dependencies |
| --- | --- | --- | --- |
| A — Capability + shell state | product capability registry, top-level product-context state, stable readiness/trust vocabulary | yes | Phase 0 interface freeze |
| B — Design system | semantic tokens, typography, surfaces, spacing/radius/elevation and reusable presentation primitives | yes | Phase 0 interface freeze |
| C — Navigation + left context | global rail, context navigation model and contextual left-panel composition using existing search/filter services | yes, after A contract | A public interfaces |
| D — Map HUD | presentation adapters for zoom/floor/view/layer controls and minimap placement; no renderer/camera duplication | yes | Phase 0 interface freeze |
| E — Right context / inspector | product-first right panel, Gameplay/Semantic/Provenance composition and selection routing | yes, after #170 contract is terminal/reconciled | A interfaces and merged/reconciled Gameplay inspector contract |
| F — Developer Mode | on-demand read-only diagnostics/provenance surface and removal of permanent debug chrome from the product composition | yes | Phase 0 interface freeze |
| G — Responsive/a11y/visual acceptance | integrated tablet/mobile behavior, focus/dismissal semantics, final user journeys and formal visual evidence | later integration wave | integrated A–F candidate |

A, B, D and F are the preferred first parallel wave because they can be implemented behind new focused modules/primitives without independently owning the same product composition. C and E form the second wave after their upstream interfaces are fixed. G is not an independent early lane; it qualifies and polishes the integrated shell.

#### Shared hot-file ownership

The following file families are shared composition surfaces and are coordinator/integration-owned unless the implementation plan explicitly narrows ownership to a non-overlapping region with an executable contract:

- `web/fullworld.html`;
- `web/fullworld.css`;
- `web/style.css` when used as global shell composition rather than a new isolated token file;
- `web/fullworld-app.mjs`;
- `web/fullworld-mobile.mjs`;
- primary E2E orchestration/configuration and shared visual-acceptance manifests.

Parallel lanes should prefer creating focused new modules/styles/tests and exposing explicit APIs/events. The coordinator performs the final wiring into shared hot files after reviewing each lane. A worker that discovers it must modify another lane's owned file or a coordinator-owned hot file must stop that mutation and request ownership reconciliation rather than editing opportunistically.

Creature renderer/geometry files remain outside Production Shell lane ownership unless the implementation plan proves a shell regression requires a bounded compatibility fix. In particular, no lane may use the redesign to reimplement #113 hit testing, #115 presentation bounds/labels/badges, #162 animation semantics or #170 gameplay data authority.

#### Worker contract

Every parallel worker receives a self-contained prompt containing:

- exact admission/integration `main` SHA and current root/nearer instructions;
- exact lane-owned paths and explicit forbidden shared paths;
- public interfaces it consumes and must produce;
- lane-specific deterministic tests and acceptance evidence;
- requirement to preserve unrelated work and avoid force-push/reset of shared history;
- required return package: commit SHA(s), changed-file list, interface summary, tests executed with exact results, and unresolved risks/blockers.

The coordinator must review each lane's full diff and interface output before integration. A passing lane-local test is not permission to integrate an incompatible interface.

#### Integration waves

The intended execution order is:

```text
Phase 0: refresh main + #162/#170 + freeze shell interfaces
                     |
      +--------------+--------------+--------------+
      |              |              |              |
   Lane A         Lane B         Lane D         Lane F
      |              |              |              |
      +----------- first parallel wave -----------+
                     |
             stable A interfaces
                 /       \
              Lane C    Lane E
                 \       /
              second parallel wave
                     |
          coordinator shared-file wiring
                     |
                   Lane G
                     |
        candidate freeze + full qualification
```

The implementation plan may reduce the number of live workers when actual post-#162/#170 file ownership proves less independent than this design. It must not increase parallelism by allowing concurrent edits to the same mutable state or hot files.

#### Testing concurrency

Targeted deterministic/unit tests may run concurrently per lane when they do not share mutable fixtures or generated output directories.

Heavy Molehill browser qualification remains governed by the live repository contract. At the planning baseline `e2e/run.ps1` has a measured safe default of **2 concurrent isolated heavy E2E slots**. No coordinator or worker may exceed the current repository-selected capacity, bypass the slot pool, share Compose/origin/artifact state, or interpret a third experimental slot as safe default capacity.

Full final qualification is performed against one frozen integrated candidate. Lane-local heavy E2E results are supporting evidence only and never substitute for exact-final-head integration qualification. Any post-freeze code change creates a new candidate and invalidates final qualification evidence that depended on the prior head.

#### Merge and completion authority

Only the coordinator may declare the integrated implementation ready for protected merge. Readiness requires:

- every accepted lane commit present in the canonical implementation head;
- no unresolved worker ownership/interface conflict;
- complete changed-file and full-diff review;
- exact-final-head deterministic/browser/visual/accessibility/geometry/applicable performance evidence;
- required `atlas-local-e2e`, `atlas-gate` and `provenance-gate` success under the then-current repository policy;
- actual visual-frame review;
- expected-head squash merge and branch cleanup;
- merged-main Synology Live Acceptance on the resulting protected `main` SHA.

This topology is a speed optimization with isolation, not a relaxation of final integration authority or verification depth.

## 22. Non-goals

Production UI Shell V1 does not itself:

- rewrite the renderer;
- migrate Atlas to a UI framework;
- create a second page/application for Item Explorer or Hunts;
- change Game-owned facts or producer contracts;
- implement Game #75 farm intelligence;
- implement Hunt Intelligence metrics/data;
- invent Quests/Analytics/Market/profile systems;
- add account persistence;
- infer walkability, collision, quest state, boss status, live occupancy or gameplay facts from pixels/names;
- remove provenance or diagnostics;
- weaken tests, rights/provenance gates or live-deployment policy.

## 23. Definition of done for the eventual implementation

The Production UI Shell implementation is complete only when all of the following are true:

- default desktop/mobile Atlas presents a polished product shell rather than an engineering dashboard;
- the map remains the dominant surface and current FullWorld renderer/state behavior remains correct;
- one global navigation rail and one contextual left panel replace the monolithic mixed-purpose control rail;
- the right panel is product-first and preserves advanced Semantic/Provenance access;
- Creature Gameplay Profiles, if merged, appears natively with Gameplay default and no duplicate consumer/state model;
- Item/Farm surfaces truthfully distinguish available custom-kill behavior from unavailable item/task intelligence;
- Hunt Intelligence has a clear extension seam without fake Hunt data;
- capability availability is derived from verified runtime/publication state rather than hard-coded Issue lifecycle prose;
- persistent normal-user diagnostics are removed from the default layout and remain available through read-only Developer Mode;
- design-system typography/colors/spacing/components are coherent and accessible;
- desktop/tablet/mobile layouts keep the map usable and controls reachable;
- reload/history/deep links remain deterministic;
- no Game/legacy/browser authority boundary is weakened;
- exact-final-head deterministic, browser, geometry, visual, accessibility and applicable performance verification passes with repository-required retries/worker policy;
- required visual frames are actually reviewed;
- protected PR is squash-merged and branch cleaned;
- merged-main Synology Live Acceptance passes on the exact resulting main SHA.

## 24. Next design-lifecycle steps

This design must receive owner review before an implementation plan is written.

After owner approval of this committed design, write:

`docs/superpowers/plans/2026-08-26-atlas-production-ui-shell-v1.md`

Then, after plan review/self-review, write the autonomous execution prompt:

`docs/agents/prompts/ATLAS-PRODUCTION-UI-SHELL-V1.md`

The final execution alias remains:

`ATLAS-PRODUCTION-UI-SHELL-V1`