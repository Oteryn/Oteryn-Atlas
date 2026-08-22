import assert from 'node:assert/strict';
import test from 'node:test';

import { createCreatureRenderSnapshot } from '../../src/browser/creature-render-diagnostics.mjs';

test('creature render snapshot captures actual committed screen anchors immutably', () => {
  const snapshot = createCreatureRenderSnapshot({
    generation: 4,
    baseGenerationAtStart: 11,
    baseGenerationAtCommit: 12,
    view: { x: 32369, y: 32241, floor: -7, zoom: 2 },
    canvas: { width: 1440, height: 900, dpr: 1 },
    anchors: Array.from({ length: 30 }, (_, index) => ({
      id: `npc:${String(index).padStart(32, '0')}`,
      kind: 'npc', floor: -7, x: 32369 + index, y: 32241,
      screenX: 720 + index * 64, screenY: 450,
    })),
  });
  assert.equal(snapshot.generation, 4);
  assert.equal(snapshot.baseGenerationAtStart, 11);
  assert.equal(snapshot.baseGenerationAtCommit, 12);
  assert.equal(snapshot.anchors.length, 24);
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.view));
  assert(Object.isFrozen(snapshot.anchors[0]));
  assert.throws(() => { snapshot.anchors[0].screenX = 0; }, TypeError);
});

test('creature render snapshot rejects non-factual or non-finite evidence', () => {
  const base = {
    generation: 1, baseGenerationAtStart: 1, baseGenerationAtCommit: 1,
    view: { x: 1, y: 2, floor: -7, zoom: 2 },
    canvas: { width: 100, height: 100, dpr: 1 }, anchors: [],
  };
  assert.throws(() => createCreatureRenderSnapshot({ ...base, generation: 0 }), /generation/i);
  assert.throws(() => createCreatureRenderSnapshot({ ...base, view: { ...base.view, x: NaN } }), /view/i);
  assert.throws(() => createCreatureRenderSnapshot({ ...base, anchors: [{ id: 'x', kind: 'npc', floor: -7, x: 1, y: 2, screenX: Infinity, screenY: 2 }] }), /anchor/i);
});