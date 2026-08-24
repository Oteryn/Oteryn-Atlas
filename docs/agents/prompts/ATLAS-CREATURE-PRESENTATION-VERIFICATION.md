# ATLAS-CREATURE-PRESENTATION-VERIFICATION

ALIAS:
`ATLAS-CREATURE-PRESENTATION-VERIFICATION`

MODE:
Autonomous independent RED verification-contract authoring + handoff.

DO NOT IMPLEMENT RUNTIME PRODUCT CODE.

Parent lifecycle authority: `Oteryn/Oteryn-Atlas#115`.
Read first:
- root `AGENTS.md`;
- `docs/agents/prompts/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
- `docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
- `docs/agents/prompts/ATLAS-CREATURE-PRESENTATION-PARALLEL-AGENT-SUITE.md`;
- current verification policy under Issue #85 and visual acceptance under #111.

## Mission

Create an independent, generic acceptance contract for the final creature-label and NPC-badge system. This worker contributes **tests/evidence harness only**. It must prove behavior for the full published population through generic contracts and representative real-data fixtures, never by teaching production code about named creatures.

The branch is allowed to remain RED because runtime implementation is intentionally owned by other workers/integrator. The handoff must clearly distinguish expected missing-feature failures from unrelated baseline regressions.

## Mandatory preflight

1. Refresh GitHub and resolve exact current `main`.
2. Recheck Issue #115, Issue #113, #111 and #85.
3. Inspect the current exact-head Playwright/Chromium harness after #112/#127 and reuse existing runner conventions rather than creating a second browser stack.
4. Revalidate current Game-derived acceptance records before pinning them in test fixtures. Planning anchors were Albinius (two roles) and Eremo (>3 roles), but use only records that are still factual in the exact current publication.
5. Identify at least one real long-name NPC or monster and at least one dense creature scene from the accepted publication.
6. Create isolated branch/worktree from refreshed `main`, recommended `work/115-creature-presentation-verification`.

## Owned files

Prefer new, isolated verification files to avoid conflicts with runtime workers, for example:
- `tests/creature-presentation-contract.mjs` for pure/versioned diagnostic expectations that do not duplicate worker-owned unit tests;
- `e2e/tests/creature-presentation.spec.mjs` for browser acceptance;
- a narrowly scoped support fixture under `e2e/support/` only when needed.

You may extend a verification manifest/README only if current-main harness requires registration. Do not edit product runtime modules.

## Forbidden product edits

Do NOT modify:
- `web/fullworld-creatures.mjs`;
- `web/fullworld-app.mjs`;
- `web/fullworld.css`;
- `src/browser/*.mjs` production modules;
- `src/layers/minimap-lod.mjs`;
- any Oteryn-Game file.

If testability requires a product diagnostic seam, specify the exact requested field/API in handoff instead of implementing it.

## Required deterministic/diagnostic contracts

Cover the final versioned diagnostics expected by #115:
- `labelStyle = creature-labels-v1`;
- `npcMarkerStyle = functional-icons-v2`;
- labels considered/drawn/suppressed counts;
- `drawnNpcBadges` total badge-slot count;
- compatibility `drawnNpcIcons` meaning: NPC records rendering at least one badge, not total badge count;
- effective mode/LOD representation;
- label layout generation/key;
- bounded CSS-pixel presentation/label/badge rectangles;
- linkage to the same committed renderer/base generation/transform.

Assert bounded arrays/snapshots rather than unbounded per-creature dumps.

## Required browser scenarios

Use real accepted publication records and generic selectors/diagnostics. At minimum cover:
- mixed NPC + monster scene;
- several nearby NPCs;
- one revalidated two-role NPC;
- one revalidated >3-role NPC with exact overflow count;
- active factual role filter that would otherwise hide the filtered role in overflow;
- dense monster scene and deterministic suppression;
- one real long name near a viewport edge with visible ellipsis/bounds;
- map far, medium and close presentation;
- forced minimap sparse behavior;
- forced classic sparse behavior;
- auto in effective minimap and effective detail/transition states;
- technical overview non-wall-of-text behavior;
- selected `creature=` deep-link and reload promotion;
- #113 hover/card coexistence only if #113 has actually merged by execution time;
- pan, zoom and floor change recomputation;
- animation off/on where logical animation frame progression does not increment label-layout generation when geometry/layout dependencies are unchanged;
- NPC role filter persistence;
- DPR 1 desktop and DPR 2/mobile geometry sanity;
- desktop and mobile HUD/reserved-rectangle non-occlusion;
- zero unexpected page/runtime/console errors attributable to the feature.

Do not assert exact anti-aliased glyph pixels. Prefer semantic diagnostics plus bounded screenshots for visual review.

## Visual evidence law

Screenshots/artifacts are evidence only if actually reviewed. The final integrator must inspect the rendered result, not merely assert that a PNG file exists.

Design stable screenshot names for the important scenes, including multi-role overflow, dense collision, long-name edge, minimap/classic sparse, map detail and mobile DPR2.

## RED requirement

Run the new focused deterministic/browser contract against the current implementation before any #115 runtime integration and record the expected failures. Confirm failures are due to missing `creature-labels-v1` / `functional-icons-v2` behavior, not fixture mistakes, publication outages or unrelated regressions.

If the external publication returns transient 5xx/connection failures, retain that evidence separately and do not misclassify it as a product RED assertion.

## Handoff

Push the verification branch. Do not open a PR to `main` and do not merge anything.

Return:
- starting `main` SHA;
- branch/final commit SHA;
- changed files;
- revalidated factual fixture IDs/names/roles/positions used only by tests;
- exact RED commands and expected-failure list;
- any unrelated baseline/external-publication failures separately classified;
- exact diagnostic fields/runtime seams required from the integrator;
- screenshot/evidence cases to inspect on final head;
- explicit confirmation that no runtime production code and no Oteryn-Game data were changed.