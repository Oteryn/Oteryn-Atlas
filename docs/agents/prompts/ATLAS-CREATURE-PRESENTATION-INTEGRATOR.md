# ATLAS-CREATURE-PRESENTATION-INTEGRATOR

ALIAS:
`ATLAS-CREATURE-PRESENTATION-INTEGRATOR`

MODE:
Autonomous integration + shared-runtime implementation + verification + protected-branch closeout.

DO NOT START UNTIL THE FOUR WORKER HANDOFF BRANCHES EXIST.
DO NOT STOP AT REVIEW OR PLANNING.

Parent lifecycle authority: `Oteryn/Oteryn-Atlas#115`.
Canonical implementation contract: `docs/agents/prompts/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`.
Parallel suite: `docs/agents/prompts/ATLAS-CREATURE-PRESENTATION-PARALLEL-AGENT-SUITE.md`.

Expected worker aliases:
- `ATLAS-CREATURE-PRESENTATION-GEOMETRY-LAYOUT`;
- `ATLAS-NPC-FUNCTIONAL-BADGES-V2`;
- `ATLAS-CREATURE-PRESENTATION-LOD`;
- `ATLAS-CREATURE-PRESENTATION-VERIFICATION`.

## Mission

Integrate the worker outputs into the single canonical #115 implementation branch and deliver one generic polished presentation system for **all published NPCs and monsters**. Own every shared runtime seam, final visual tuning, diagnostics, exact-head browser qualification and the one PR to protected `main`.

Named real creatures are acceptance fixtures only. Reject any worker code that branches on a creature name, ID, coordinate or other fixture-specific value.

Oteryn-Game remains canonical World/Content authority and MUST NOT be mutated.

## Mandatory GitHub-first refresh

Before mutation:
1. resolve exact current `main` from GitHub;
2. read root `AGENTS.md`, Issue #115, #113, #111 and #85;
3. confirm the parallel-suite prompts are on `main`;
4. inspect all four worker branches and their final commit SHAs;
5. inspect changed-file lists and diffs, not just worker summaries;
6. recheck active branches/PRs touching `web/fullworld-creatures.mjs`, FullWorld view/LOD, diagnostics or E2E;
7. revalidate current Game-derived acceptance anchors/fixtures;
8. create/reuse the single integration branch from refreshed `main`, recommended `feat/issue-115-creature-label-badge-ux`.

If `main` advanced after workers started, do not reset `main` backward. Integrate worker changes onto refreshed current main and resolve drift explicitly.

## Worker review gate

For each worker:
- confirm its branch starts from a legitimate Atlas main lineage;
- inspect full diff;
- verify it touched only its owned files or has a justified documented exception;
- rerun its focused deterministic tests before accepting production code;
- confirm TDD RED evidence exists for production behavior;
- reject creature-specific production exceptions, copied/proprietary art, Game fact invention, duplicated AUTO thresholds and shared-runtime ownership violations.

Do not trust a worker's “done” statement without fresh verification.

## Fan-in order

Integrate in this logical order after review:
1. geometry/layout pure core;
2. NPC multi-role/badge pure core;
3. creature LOD pure core;
4. independent verification contracts;
5. shared runtime wiring and diagnostics by the integrator.

Use reviewed cherry-picks, branch merges or equivalent repository-safe integration. Record consumed worker commit SHAs in the final PR. Do not create separate worker PRs to `main`.

## Shared runtime ownership

The integrator is the only role in this suite allowed to edit shared integration files including as needed:
- `web/fullworld-creatures.mjs`;
- `web/fullworld-app.mjs`;
- `web/fullworld.css`;
- `src/browser/creature-render-diagnostics.mjs`;
- E2E registration/support files shared by the harness.

Avoid unrelated refactors.

## Required runtime implementation

### Separate sprite and presentation lifetimes

Preserve the existing creature sprite/animation Canvas behavior and introduce/reuse a separate `pointer-events:none` presentation Canvas for labels/badges unless current #113 has already established a canonical composed overlay seam that should be reused.

Animation frame updates may redraw creature sprites, but must not call `measureText`, regenerate candidates or rerun collision layout when only logical animation time changed and stable geometry/layout dependencies did not.

### Canonical geometry

Use the worker's CSS-pixel presentation-bounds seam for:
- label anchoring;
- badge anchoring;
- presentation diagnostics;
- future/current #113 geometry reuse.

Do not independently recompute a second raw tile-anchor geometry for labels/badges.

### Label renderer

Replace raw creature-name `fillText` presentation with one bounded Canvas primitive using:
- explicit Atlas-aligned font contract;
- compact dark translucent background;
- restrained 1 CSS-pixel outline/border/shadow;
- subtle NPC vs monster accents;
- deterministic ellipsis/max width;
- deterministic candidate placement/collision suppression;
- no DOM-per-creature nodes.

Keep full factual names unchanged in search/inspector/card data.

### NPC badges v2

Consume the worker's truthful badge slots and integer-grid primitives. Draw all supported 1-3 roles, and bounded overflow for >3 roles, preserving active factual filter visibility. `+N` must equal hidden factual role count.

No emoji, copied Tibia/CipSoft pixel art or external role artwork.

### Effective LOD signal

Expose a read-only effective presentation signal from the existing canonical `lodBlend()` decision if the creature layer cannot already consume one. Preserve existing `__OTERYN_ATLAS_VIEW__` and event compatibility.

Do not duplicate AUTO/minimap thresholds in the creature module.

### Reserved rectangles

Collect actual visible map-frame UI rectangles from the current DOM (runtime/detail badges, cursor coordinate and #113 card when present) and translate them into the same CSS-pixel coordinate space used by layout. Do not hard-code device-specific HUD positions when reliable DOM geometry exists.

### DPR

Keep Canvas backing-store scaling and CSS-pixel presentation geometry separate. Verify DPR 1 and DPR 2 and prevent double scaling.

## Diagnostics contract

Extend/version diagnostics truthfully with at least:
- `labelStyle: 'creature-labels-v1'`;
- `npcMarkerStyle: 'functional-icons-v2'`;
- labels considered/drawn/suppressed;
- `drawnNpcBadges`;
- compatible `drawnNpcIcons` = number of NPC records with at least one rendered badge;
- effective mode/LOD representation;
- label-layout generation/key;
- bounded CSS-pixel presentation/label/badge rectangles;
- committed renderer/base generation/transform linkage.

Keep diagnostic arrays bounded.

## #113 coexistence

Refresh #113 immediately before integration.
- If still unmerged: keep #115 presentation-only. No click/tap handlers, hover ownership or contextual card implementation.
- If merged: reuse its canonical selection/hover/presentation geometry and reserve card rectangle; do not create competing state.

Existing `creature=` deep-link selection remains canonical either way.

## TDD during integration

Worker production modules already require RED -> GREEN. For every new shared-runtime behavior implemented by the integrator, add/activate the corresponding failing deterministic/browser contract first and observe the expected failure before writing the runtime fix.

In particular prove:
- versioned diagnostics;
- separate presentation Canvas/lifetime;
- layout-generation non-churn across animation-only frames;
- canonical effective LOD signal wiring;
- reserved HUD rectangle handling;
- DPR1/DPR2 CSS-pixel invariants.

## Real-browser acceptance

Run the current repository-prescribed pinned Chromium/Molehill exact-head suite with workers/retries exactly as required by current #85/#111 policy. Include the independent verification worker scenarios and current required baseline scenarios.

At minimum inspect screenshots for:
- mixed NPC/monster;
- nearby NPCs;
- revalidated two-role NPC;
- revalidated >3-role NPC overflow;
- active-filter-hidden-role promotion;
- dense monsters;
- real long name at edge;
- map far/medium/close;
- minimap/classic sparse;
- auto effective states;
- overview;
- selected deep link/reload;
- #113 coexistence if merged;
- animation on/off without layout churn;
- DPR1 desktop and DPR2/mobile;
- HUD/card non-occlusion.

A generated screenshot is not acceptance until it is actually reviewed.

External publication 5xx/connection failures must be retained and classified separately from product regressions; never erase or misreport failed runs.

## Final verification and PR

Before claiming completion:
1. run all focused Node/deterministic tests for new modules;
2. run repository deterministic/semantic suites required by current CI;
3. run exact-head browser qualification required by current policy;
4. publish any required local exact-head status using the current-main publisher only after the successful exact-head run;
5. inspect `git diff`/changed-file set against refreshed main;
6. open the **single** #115 implementation PR to `main`, recording start SHA, worker commit SHAs and revalidated real-data fixtures;
7. wait for required `atlas-gate` and `provenance-gate` plus all current required checks;
8. resolve review threads and requalify exact head after any code-changing update;
9. squash merge only when mergeable and all required gates are green;
10. close #115 only after merged-main verification satisfies the Issue definition of done.

Do not bypass branch protection, force required statuses or hide failed evidence.

## Deployment boundary

This prompt does **not** grant production/live deployment authority. Do not deploy Synology/live production unless separate explicit owner authorization exists at execution time.

## Final report

Report:
- final base and merged SHA;
- consumed worker branch/commit SHAs;
- final changed-file list;
- deterministic and browser verification commands/results;
- inspected visual evidence summary;
- exact required GitHub gate results;
- PR number and squash merge SHA;
- #115 final state;
- deployment state/authorization boundary;
- confirmation that the implementation is generic for all published NPCs/monsters and no Oteryn-Game mutation occurred.