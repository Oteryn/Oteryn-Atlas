import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../web/fullworld-app.mjs', import.meta.url), 'utf8');
const creatureSource = await readFile(new URL('../web/fullworld-creatures.mjs', import.meta.url), 'utf8');
const overlayWorkflow = await readFile(new URL('../.github/workflows/creature-overlays.yml', import.meta.url), 'utf8');

test('FullWorld publishes the canonical effective presentation signal without replacing the view seam', () => {
  assert.match(appSource, /__OTERYN_ATLAS_EFFECTIVE_PRESENTATION__/);
  assert.match(appSource, /effectivePresentation/);
  assert.match(appSource, /lodBlend\(view\.zoom, view\.mode, detailReady\)/);
  assert.match(appSource, /__OTERYN_ATLAS_VIEW__ = snapshot/);
});

test('creature presentation uses a separate pointer-transparent canvas and versioned styles', () => {
  assert.match(creatureSource, /creature-presentation-overlay/);
  assert.match(creatureSource, /presentationCanvas/);
  assert.match(creatureSource, /pointerEvents = 'none'/);
  assert.match(creatureSource, /NPC_MARKER_STYLE = 'functional-icons-v2'/);
  assert.match(creatureSource, /LABEL_STYLE = 'creature-labels-v1'/);
  assert.doesNotMatch(creatureSource, /fillText\(record\.name/);
});

test('shared runtime consumes canonical geometry, LOD, bounded layout and factual badge slots', () => {
  assert.match(creatureSource, /creaturePresentationBounds/);
  assert.match(creatureSource, /creaturePresentationLod/);
  assert.match(creatureSource, /createCreaturePresentationLayoutKey/);
  assert.match(creatureSource, /solveCreaturePresentationLayout/);
  assert.match(creatureSource, /npcBadgeSlots/);
  assert.match(creatureSource, /npcBadgePrimitive/);
  assert.match(creatureSource, /relativeVisibleRects/);
  assert.match(creatureSource, /presentationBackingStore/);
});

test('creature overlay compatibility gate expects v2 factual icon presentation', () => {
  assert.match(overlayWorkflow, /functional-icons-v2/);
  assert.doesNotMatch(overlayWorkflow, /functional-icons-v1/);
});
