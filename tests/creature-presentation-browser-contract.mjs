import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { LABEL_STYLE, NPC_MARKER_STYLE } from '../src/browser/creature-presentation-controller.mjs';
import { NPC_BADGE_STYLE, NPC_BADGE_PRIMITIVE_IDS, npcBadgePrimitive } from '../src/browser/npc-badge-primitives.mjs';

const appSource = await readFile(new URL('../web/fullworld-app.mjs', import.meta.url), 'utf8');
const creatureSource = await readFile(new URL('../web/fullworld-creatures.mjs', import.meta.url), 'utf8');
const controllerSource = await readFile(new URL('../src/browser/creature-presentation-controller.mjs', import.meta.url), 'utf8');
const badgePrimitiveSource = await readFile(new URL('../src/browser/npc-badge-primitives.mjs', import.meta.url), 'utf8');

test('creature runtime consumes canonical FullWorld LOD inputs without replacing the view seam', () => {
  assert.match(appSource, /__OTERYN_ATLAS_VIEW__ = snapshot/);
  assert.match(appSource, /__OTERYN_ATLAS_EFFECTIVE_PRESENTATION__/);
  assert.match(appSource, /lodBlend\(view\.zoom, view\.mode, detailReady\)/);
  assert.match(appSource, /detail: \{ view: snapshot, effectivePresentation, detailReady, detailStreaming \}/);
  assert.equal((appSource.match(/detailReady = false;\s*publishView\(\);/g) ?? []).length, 2);
  assert.match(creatureSource, /__OTERYN_ATLAS_EFFECTIVE_PRESENTATION__/);
  assert.match(creatureSource, /effectivePresentation/);
  assert.match(controllerSource, /effectivePresentation = null/);
  assert.match(controllerSource, /resolveCreatureEffectivePresentation\(\{ view, effectivePresentation, detailReady \}\)/);
});

test('creature presentation uses a separate pointer-transparent controller canvas and versioned styles', () => {
  assert.match(creatureSource, /createCreaturePresentationController/);
  assert.doesNotMatch(creatureSource, /fillText\(record\.name/);
  assert.match(controllerSource, /creature-presentation-overlay/);
  assert.match(controllerSource, /presentationCanvas/);
  assert.match(controllerSource, /pointerEvents\s*:\s*'none'/);
  assert.match(controllerSource, /NPC_MARKER_STYLE\s*=\s*NPC_BADGE_STYLE/);
  assert.match(badgePrimitiveSource, /NPC_BADGE_STYLE\s*=\s*'functional-icons-v2'/);
  assert.match(controllerSource, /LABEL_STYLE\s*=\s*'creature-labels-v1'/);
});

test('shared runtime reuses canonical #113 presentation rectangles and worker seams', () => {
  assert.match(controllerSource, /presentationRect/);
  assert.doesNotMatch(controllerSource, /creaturePresentationBounds/);
  assert.match(controllerSource, /creaturePresentationLod/);
  assert.match(controllerSource, /createCreaturePresentationLayoutKey/);
  assert.match(controllerSource, /solveCreaturePresentationLayout/);
  assert.match(controllerSource, /npcBadgeSlots/);
  assert.match(controllerSource, /npcBadgePrimitive/);
  assert.match(controllerSource, /relativeVisibleRects/);
  assert.match(controllerSource, /presentationBackingStore/);
});

test('current creature controller and factual primitives share the v2 presentation contract', () => {
  // Runtime compatibility is owned by these production exports. This does not
  // claim that the retired overlay workflow is present or qualified.
  assert.equal(NPC_BADGE_STYLE, 'functional-icons-v2');
  assert.equal(NPC_MARKER_STYLE, NPC_BADGE_STYLE);
  assert.equal(LABEL_STYLE, 'creature-labels-v1');
  assert.notEqual(NPC_MARKER_STYLE, 'functional-icons-v1');
  assert.ok(NPC_BADGE_PRIMITIVE_IDS.length > 0);
  for (const id of NPC_BADGE_PRIMITIVE_IDS) {
    const primitive = npcBadgePrimitive(id);
    assert.equal(primitive.id, id);
    assert.ok(primitive.rects.length > 0, id);
    assert.ok(Object.isFrozen(primitive));
  }
});
