# ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX

ALIAS:
`ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX`

MODE:
Autonomous implementation + verification + integration + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement and fully verify the creature label and NPC role badge redesign defined by Issue #115 and the current-main design packet:

`docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`

## Repositories

Primary repository:
`https://github.com/Oteryn/Oteryn-Atlas`

Canonical Game/World authority:
`https://github.com/Oteryn/Oteryn-Game`

Oteryn-Game is authoritative for creature identity, placement, outfit/presentation facts and NPC role semantics. Atlas is presentation/read-model code and must not invent new Game-owned facts.

## Mandatory GitHub-first preflight

Before any product mutation:

1. Refresh `Oteryn/Oteryn-Atlas` and resolve the exact current `main` SHA from GitHub.
2. Read root `AGENTS.md` and any nearer instructions for touched paths.
3. Read Issue #115 in full.
4. Read the current-main version of:
   - `docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
   - this prompt.
5. Confirm the design/prompt have landed on `main`. If they exist only on an unmerged docs PR, do not start ordinary product mutation from that docs branch; report the lifecycle blocker unless the owner explicitly authorizes an exception.
6. Read the canonical shipped NPC baseline:
   - Issue #64;
   - merged PR #83;
   - `src/browser/npc-markers.mjs`;
   - `tests/npc-markers.mjs`;
   - `tests/creature-index-roles.py`.
7. Do not use Issue #61 as the shipped baseline. It is historical/overlapping context; #64 + PR #83 define the currently shipped NPC role/icon/filter implementation.
8. Read current creature/runtime code and applicable tests, including:
   - `web/fullworld-creatures.mjs`;
   - `web/fullworld-app.mjs`;
   - `web/fullworld-minimap.mjs`;
   - `web/fullworld.css`;
   - `e2e/tests/creatures-desktop.spec.mjs`;
   - applicable mobile/visual acceptance specs;
   - renderer/creature diagnostics helpers.
9. Refresh Issue #113 and every active branch/PR touching creature interaction/rendering. A planning review observed branch `feat/issue-113-creature-cards`; do not assume that state is still current.
10. Refresh #111 and #85 to discover the current visual-user acceptance and exact-head verification path.
11. Revalidate factual real-data acceptance anchors from the exact current Game-derived publication. Planning anchors were:
   - Albinius `npc:994e4a2decd5f718ccbc37c1d94bbbeb` with roles `shop`, `quest`;
   - Eremo `npc:d6f7fbe1e22b73f3b04a708fd0a219a5` with roles `travel`, `shop`, `quest`, `blessing`, `trainer`.
12. Record the exact starting `main` SHA and any revalidated factual acceptance record IDs in the implementation PR.

## Work boundary

Use Issue #115 as lifecycle authority.

Work on one dedicated implementation branch from refreshed `main` and open one implementation PR. Never implement ordinary product changes on the docs planning branch and never push ordinary implementation directly to `main`.

This is a presentation-layer/runtime redesign. Preserve factual creature world coordinates, floors, identity, role semantics, animation data, authority digests and Game->Atlas trust boundaries.

Do not add:

- new NPC role inference;
- monster HP/XP/loot/profit/difficulty facts;
- browser parsing of legacy OTBM/Canary/Crystal sources;
- copied Tibia/CipSoft icon artwork;
- fake production creature records for visual acceptance;
- DOM-per-creature rendering;
- a second creature selection/deep-link model;
- a second independent AUTO/minimap threshold owned by the creature module.

## Required implementation

### A. Canonical creature presentation bounds

Before building label placement, create or reuse one canonical pure geometry seam for committed creature presentation bounds in CSS pixels.

It must account for:

- the factual world anchor transformed through the committed renderer view;
- actual rendered creature bitmap width/height where pixel presentation exists;
- Game-owned displacement from the creature frame program;
- deterministic marker bounds for factual fallback presentation;
- viewport clipping/bounds;
- CSS-pixel geometry independent of Canvas backing-store DPR.

Do not continue to treat raw `tileX/tileY` as the complete visual footprint of a rendered creature.

The same presentation-bounds seam must be reusable by:

- creature label placement;
- NPC role badge placement;
- read-only renderer diagnostics;
- #113 hit testing/context-card anchoring if that work has landed or later consumes the seam.

Never write presentation rectangles back into factual world state.

### B. Separate layout lifetime from animation-frame lifetime

Do not run `measureText`, label candidate generation or collision solving on every creature animation frame unless an actual layout dependency changed.

Preferred implementation:

- retain the existing creature sprite/marker Canvas;
- introduce a separate `pointer-events:none` label/badge Canvas above it; or
- if #113 has already established a canonical composed overlay pipeline, reuse it rather than adding a competing third presentation system.

Whichever path is chosen, cache/recompute label layout only when dependencies change, including as applicable:

- committed camera transform;
- viewport dimensions;
- visible creature identity set;
- NPC role/filter state;
- effective FullWorld presentation mode/LOD;
- selected creature;
- canonical hover state from #113;
- reserved HUD/context-card rectangles;
- resolved label font/text metrics key.

Logical animation time alone must not invalidate layout.

Expose a truthful read-only layout-generation diagnostic so deterministic/browser tests can prove this invariant.

### C. Dedicated creature label renderer

Replace direct raw `fillText(record.name, ...)` presentation with a reusable Canvas label renderer.

Required visual behavior:

- compact translucent high-contrast background;
- restrained 1 CSS-pixel border/outline and shadow;
- compact padding;
- deterministic placement relative to canonical presentation bounds;
- subtle NPC vs monster accents;
- no huge opaque panels;
- no DOM node per creature.

NPC label:

- neutral dark base;
- white/off-white text;
- restrained gold/teal accent.

Monster label:

- same base language;
- subtle burgundy/red accent only;
- no fabricated danger tier/difficulty color scale.

### D. Bounded long-name policy

Implement named constants/helpers for label maximum width by LOD/mode.

- labels must remain bounded inside the map viewport apart from a small documented edge tolerance;
- visually truncate with deterministic ellipsis when necessary;
- preserve the full factual name in search/inspector and #113 card when available;
- do not mutate factual names.

Tune exact width constants from real-browser evidence, then freeze them with deterministic tests.

### E. Explicit font/text-metrics contract

Do not leave label geometry dependent on incidental `12px sans-serif` defaults.

- define/derive one explicit Canvas font contract aligned with Atlas UI typography;
- layout and draw must use the same font specification;
- pure layout tests must use an injected/stable text-metrics oracle rather than assuming host font rasterization is an independent oracle;
- pinned Chromium visual acceptance validates actual rendered typography.

### F. Preserve and verify the existing DPR model

The existing creature overlay already uses DPR-aware backing dimensions and CSS-pixel drawing.

Preserve that model:

- backing Canvas dimensions may scale by DPR;
- presentation bounds, label rectangles, collision geometry and diagnostics remain in CSS pixels;
- 1 CSS-pixel borders remain visually correct after scaling;
- do not apply DPR twice;
- explicitly test DPR 1 and DPR 2.

### G. `functional-icons-v2` pixel-grid role badges

Replace the current visually heavy single role icon with compact original Oteryn-designed multi-role badges.

Supported factual role mappings:

- `bank` -> coin / stacked-coin primitive;
- `travel` -> compass / directional primitive;
- `shop` -> bag / pouch primitive;
- `quest` -> scroll / exclamation primitive;
- `blessing` -> star / halo primitive;
- `trainer` -> book / training primitive;
- `other` -> neutral NPC primitive only when factual metadata resolves to no supported role.

Icon requirements:

- no emoji;
- no copied Tibia/CipSoft art;
- repository-owned programmatic primitives/assets only;
- final visual language should use integer-grid pixel primitives (`fillRect`, small pixel/offscreen grid + nearest-neighbor scaling) rather than anti-aliased vector arcs as the main style;
- badges remain smaller and less visually dominant than the NPC sprite.

### H. Truthful multi-role badge selection

Preserve canonical factual role order from `src/browser/npc-markers.mjs`.

Required base behavior:

- 0 supported roles -> neutral `other` presentation;
- 1-3 roles -> show all factual roles in canonical order;
- >3 roles -> at most 3 badge slots; normally first 2 factual roles plus `+N` overflow.

Preserve the semantic advantage of the existing `npcRoleGlyph(record, selectedFilter)` behavior:

- filtering never rewrites the canonical role list;
- if an active factual `npcRole` filter belongs to the NPC, that role must remain explicitly visible;
- if the active filtered role would otherwise be hidden by overflow, show the first canonical role, the active filtered role, then `+N`;
- `+N` must equal exactly the number of factual roles hidden from that bounded row.

Add deterministic tests using a >3-role factual shape. Revalidate Eremo or another current production-derived >3-role NPC for browser acceptance.

### I. Mode-aware LOD, not zoom-only LOD

Implement named presentation helpers driven by effective mode + zoom + interaction promotion.

Required intent:

- forced `minimap`: extremely sparse creature annotation; suppress ordinary full name labels;
- forced `classic`: same sparse annotation class as minimap because CLASSIC is a minimap presentation variant;
- `map`: normal far/medium/close creature label LOD;
- `auto`: follow the product's actual effective minimap/detail decision; do not duplicate a second independent AUTO threshold in `fullworld-creatures.mjs`;
- technical overview must not become a wall of creature labels;
- existing URL-selected creature may receive bounded label promotion even before #113 merges;
- #113 hovered creature may receive bounded promotion when canonical hover state exists.

If effective AUTO presentation is not currently exposed to the creature layer, add a truthful read-only presentation signal derived from the existing canonical LOD policy rather than hard-coding another threshold.

Tune exact zoom/LOD constants only from real Chromium evidence, then pin them with deterministic tests.

### J. Collision, viewport and reserved HUD/card rectangles

Implement deterministic bounded screen-space occupancy for visible label/badge rectangles.

Priority:

1. selected creature;
2. hovered creature;
3. NPC label;
4. monster label;
5. secondary badge information.

Rules:

- never move creature sprite/world anchors to solve UI collision;
- use a small deterministic ordered set of candidate label anchors around canonical creature presentation bounds;
- suppress lower-priority presentation when no acceptable anchor exists;
- avoid already accepted higher-priority label/badge rectangles;
- accept `reservedRects` for visible map-frame UI such as runtime/detail badges, cursor coordinates and #113 contextual cards;
- keep accepted rectangles inside viewport bounds/tolerance;
- operate only on the visible bounded creature set;
- use bounded O(n) spatial bucketing or O(n log n) behavior, not whole-world quadratic work.

### K. Versioned diagnostics and compatibility

Do not silently redefine existing diagnostics.

Add/extend read-only diagnostics with versioned presentation identity, for example:

- `labelStyle: creature-labels-v1`;
- `npcMarkerStyle: functional-icons-v2`;
- labels considered/drawn/suppressed;
- `drawnNpcBadges`;
- label/badge CSS-pixel rectangles needed for deterministic probes;
- effective label LOD/mode;
- label-layout generation/key;
- committed renderer transform linkage;
- canonical creature presentation bounds.

Preserve `drawnNpcIcons` during migration with a documented compatibility meaning, such as number of NPC records that rendered at least one badge. Do not redefine it as total badge count.

No test hook may mutate state, inject fake records, bypass loading or become alternate authority.

### L. Interaction compatibility with #113

Issue #113 owns direct creature click/tap, hit testing, hover and contextual creature cards.

Use existing `state.selectedId` / URL `creature=` for selection promotion now.

If #113 has merged or exposes a stable branch API:

- consume its canonical hover/selection state;
- reuse its committed hit-target/presentation geometry if it already establishes the canonical seam;
- ensure quick-card anchoring and label placement agree on the same creature presentation bounds;
- include the card rectangle in reserved collision regions where appropriate;
- do not create a second selection/deep-link model.

If #113 is still unmerged:

- keep #115 presentation-only;
- structure and test the common geometry seam so #113 can consume it later;
- do not add independent label click handlers merely to pre-empt #113.

Badges must not become the sole carrier of role information. Textual roles remain available in search/inspector and later the #113 card.

## TDD requirements

Follow root `AGENTS.md` and #85. Add failing deterministic tests before the corresponding implementation logic.

Required test coverage includes:

- canonical creature presentation bounds for verified pixel presentation;
- canonical bounds for factual marker fallback;
- displacement-aware bounds;
- CSS-pixel geometry invariant across DPR 1/2;
- LOD classification for `map`, `minimap`, `classic`, effective `auto` and overview behavior;
- selected promotion;
- hovered promotion when #113 exists;
- canonical role ordering;
- 1, 2 and 3 role badge rows;
- >3 overflow behavior;
- active filtered role forced visible under overflow;
- exact overflow hidden-role count;
- unknown/ambiguous role fallback;
- long-name deterministic truncation/bounds;
- deterministic alternate anchors;
- collision priority and suppression;
- viewport-edge containment;
- reserved HUD/card rectangle avoidance;
- layout-cache key/invalidation behavior;
- animation logical-time-only changes do not increment label-layout generation;
- versioned diagnostic compatibility, including preserved `drawnNpcIcons` meaning.

Keep expected-value oracles independent from the implementation path under test.

## Runtime and browser acceptance

Run real pinned Chromium against production-derived/committed Atlas data. Do not fake Game facts for screenshots.

At minimum cover:

- desktop mixed NPC + monster scene;
- desktop several nearby NPCs;
- revalidated Albinius or another factual two-role NPC;
- revalidated Eremo or another factual >3-role NPC;
- active filter where the filtered role would otherwise be overflow-hidden;
- dense monster scene;
- a real long creature/NPC name near viewport edge;
- `map` far, medium and close zoom;
- forced `minimap`;
- forced `classic`;
- `auto` on both effective presentation sides;
- technical overview behavior;
- selected `creature=` promotion and reload/deep-link persistence;
- #113 hover/card coexistence if available;
- pan/zoom alignment;
- floor change;
- animation OFF and ON;
- proof that animation frames do not churn label layout when dependencies are unchanged;
- NPC category filters and URL persistence;
- DPR 1 and DPR 2;
- desktop and mobile viewport readability;
- HUD/card non-occlusion;
- no console/page/runtime errors.

Use the current #111/#85 evidence framework. Actually inspect generated screenshots/artifacts; successful exit codes alone are not visual acceptance.

## Performance acceptance

This change is performance-sensitive because labels are screen-space overlays over animated creatures.

Prove at minimum:

- visible-set-only layout work;
- no whole-world text measurement/collision pass;
- no unnecessary label-layout generation during animation-only frame advances;
- bounded layout/collision data structures;
- no DOM-per-creature growth;
- no regression in existing creature pan/animation responsiveness under the required browser matrix.

Do not invent arbitrary pass thresholds if the repository already defines applicable performance budgets. Use current #85/platform policy and record measured evidence.

## Required checks before merge

1. Review the complete changed-file set.
2. Review the full diff on the exact final head.
3. Run targeted deterministic tests.
4. Run the complete applicable deterministic repository suite.
5. Run the full required Docker Playwright Chromium PR gate on Molehill-PC with retries disabled.
6. Generate and inspect visual-user acceptance evidence under #111/#85.
7. Verify no unexpected runtime/network/console errors.
8. Push the implementation branch and open/update the PR referencing #115.
9. If #113 changes while this work is active, refresh/reconcile instead of duplicating its interaction geometry/state.
10. Wait for exact-final-head GitHub checks, including required `atlas-gate` and `provenance-gate`.
11. Resolve all material review threads.
12. Squash merge only when the exact final head is green and reviewed.
13. Delete the completed implementation branch.
14. Close Issue #115 only when merged-main state satisfies the definition of done.

## Live deployment boundary

Do not treat product implementation merge as automatic authorization to mutate live deployment.

If the owner explicitly authorizes live deployment/acceptance under repository policy:

- deploy only exact merged `main`;
- verify container revision label and `X-Oteryn-Atlas-Revision` header match that merged SHA;
- run Synology merged-main desktop/mobile live acceptance only after exact revision identity is proven.

Otherwise report live deployment as outside the authorized scope.

## Acceptance quality bar

The result must look like a finished game-atlas UI rather than a diagnostic overlay.

Names must remain readable against light and dark map content without dominating the scene.

NPC badges must communicate factual function at a glance, remain truthful for multi-role NPCs and use an original Oteryn pixel-grid visual language.

Dense scenes must degrade gracefully through mode-aware LOD/collision suppression instead of becoming a wall of text/icons.

Labels and quick-card/hit-test geometry must converge on one canonical creature presentation-bounds seam.

Animation must not cause label-layout churn simply because a sprite frame changed.

## Final report

Report `FACT`, `INFERENCE`, `UNKNOWN`, and `RECOMMENDATION` separately where applicable.

Include:

- exact starting `main` SHA;
- canonical shipped baseline references used (#64 / PR #83);
- #113 state and whether integration was required;
- revalidated factual acceptance record IDs/roles;
- final implementation branch head SHA;
- implementation PR number/URL;
- full changed-file list;
- exact deterministic tests run/results;
- exact Docker Playwright command/matrix/result;
- DPR profiles verified;
- mode/LOD states verified;
- animation-layout-churn evidence;
- visual acceptance artifacts actually reviewed;
- exact CI run/check results;
- squash merge SHA;
- branch cleanup result;
- Issue #115 closeout state;
- whether live deployment/acceptance was explicitly authorized and, if so, exact merged-main deployment identity/evidence.

Do not claim completion before all required verification and merge conditions are directly confirmed.