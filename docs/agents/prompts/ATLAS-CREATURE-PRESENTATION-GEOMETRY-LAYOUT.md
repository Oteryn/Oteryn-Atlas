# ATLAS-CREATURE-PRESENTATION-GEOMETRY-LAYOUT

ALIAS:
`ATLAS-CREATURE-PRESENTATION-GEOMETRY-LAYOUT`

MODE:
Autonomous focused implementation + deterministic verification + handoff.

DO NOT STOP AT AUDIT OR PLANNING.

Parent lifecycle authority: `Oteryn/Oteryn-Atlas#115`.
Read first:
- root `AGENTS.md`;
- `docs/agents/prompts/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
- `docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
- `docs/agents/prompts/ATLAS-CREATURE-PRESENTATION-PARALLEL-AGENT-SUITE.md`.

## Mission

Build the reusable **pure CSS-pixel creature presentation geometry and label-layout core** for every published NPC and monster. This worker does not wire the module into the shared FullWorld runtime; the integration coordinator owns that fan-in.

Albinius, Eremo and any other named creature are test fixtures only. Never branch production behavior on creature names, IDs or coordinates.

Oteryn-Game remains authoritative. Do not mutate Oteryn-Game and do not invent creature facts.

## Mandatory preflight

1. Refresh GitHub and resolve the exact current `main` SHA.
2. Recheck Issue #115 and Issue #113. If #113 has merged, note any canonical presentation/hit-test geometry seam the integrator should reuse; do not take over #113 interaction ownership.
3. Create a dedicated branch/worktree from refreshed `main`, recommended branch `work/115-presentation-geometry-layout`.
4. Read current `web/fullworld-creatures.mjs`, `src/browser/creature-render-diagnostics.mjs`, animation runtime geometry contracts, and relevant tests before designing the pure API.
5. Record the starting SHA in the final handoff.

## Owned files

Preferred production file:
- create `src/browser/creature-presentation-layout.mjs`.

Preferred deterministic test file:
- create `tests/creature-presentation-layout.mjs`.

You may add a narrowly scoped test helper under `tests/support/` only if required. Do not edit shared runtime integration files.

## Forbidden shared edits

Do NOT modify:
- `web/fullworld-creatures.mjs`;
- `web/fullworld-app.mjs`;
- `web/fullworld.css`;
- `src/browser/creature-render-diagnostics.mjs`;
- `src/layers/minimap-lod.mjs`;
- `src/browser/npc-markers.mjs`;
- any Oteryn-Game file.

If integration needs a change in one of those files, document the exact requested change for the integrator.

## Required pure contracts

Implement focused immutable helpers covering these semantics. Follow existing repository naming conventions; if you choose a different exported name, keep the same responsibility and document the final API in handoff.

### 1. Presentation bounds

Provide a helper equivalent to:

```js
creaturePresentationBounds({
  screenAnchor,
  zoom,
  bitmap,
  displacement,
  fallbackSize,
  viewport,
})
```

It must calculate the actual committed creature visual footprint in **CSS pixels** using the existing renderer formula:

```text
left = anchorX - (bitmapWidth - 32 + displacementX) * zoom
top  = anchorY - (bitmapHeight - 32 + displacementY) * zoom
width  = bitmapWidth * zoom
height = bitmapHeight * zoom
```

When pixel presentation is unavailable, use a deterministic factual-marker fallback rectangle. Return raw and viewport-clipped rectangles without mutating world data. DPR must not be an input to CSS-pixel geometry.

### 2. Deterministic bounded label text

Provide a pure ellipsis helper using an injected text-measure oracle. It must:
- preserve the full factual source string;
- return a display string that fits the supplied maximum width;
- use deterministic `…` truncation;
- handle names that already fit, tiny widths and empty strings;
- never depend on host font rasterization in unit tests.

### 3. Candidate anchors

Generate a small deterministic ordered candidate set relative to presentation bounds, such as above-center first with bounded alternatives. The candidate set must be stable for identical inputs and must not move the factual creature anchor.

### 4. Collision / occupancy solver

Provide deterministic screen-space placement that accepts:
- viewport rectangle;
- reserved rectangles;
- candidate label/badge rectangles;
- priority metadata.

Priority contract:
1. selected;
2. hovered;
3. NPC label;
4. monster label;
5. secondary badge information.

The solver must keep accepted rectangles inside the viewport tolerance, avoid reserved rectangles, suppress lower-priority items when no candidate fits, and remain deterministic for identical inputs.

### 5. Layout cache key

Provide a stable layout-key helper based only on true layout dependencies: committed transform/view, viewport, visible record identities plus stable presentation geometry, filter, effective presentation state, selected/hover identity, reserved rectangles and font-metrics key.

**Logical animation time, animation frame index and bitmap content ID MUST NOT be key dependencies when stable geometry is unchanged.**

## Mandatory TDD

Use Superpowers TDD or equivalent strict RED -> GREEN -> REFACTOR.

Before production code, write deterministic tests that fail for the missing feature and capture the RED output. Required cases:
- 32x32 no-displacement bounds;
- wider/taller bitmap bounds;
- positive Game-owned displacement;
- fallback marker bounds;
- clipping at each viewport edge;
- same CSS-pixel result under hypothetical DPR 1 and DPR 2 inputs at the caller level;
- long-name ellipsis with injected metrics;
- stable candidate ordering;
- collision priority and deterministic suppression;
- reserved rectangle avoidance;
- selected beats hovered/NPC/monster/secondary badge;
- layout key changes on camera/viewport/filter/effective-mode/selection/reserved-rect/font changes;
- layout key does **not** change for animation logical-time-only changes.

Do not write production code until the first relevant test has been observed failing for the expected reason.

## Verification

Run the focused test file and any existing deterministic suites directly affected by imports. The branch must be green for all production behavior this worker owns.

Do not run or publish the full Molehill browser gate; the integration coordinator owns exact-final-head browser qualification.

## Handoff

Push the worker branch. Do not open a PR to `main` and do not merge anything.

Return:
- starting `main` SHA;
- branch name;
- final commit SHA;
- changed files;
- exact RED command and expected failure summary;
- exact GREEN command and pass count;
- exported API names and value shapes;
- any integration request for shared runtime files;
- explicit statement that no named-creature exception and no Oteryn-Game mutation was introduced.