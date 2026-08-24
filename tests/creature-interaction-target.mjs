import assert from 'node:assert/strict';
import test from 'node:test';

import { createCreatureInteractionTarget } from '../src/browser/creature-interaction-target.mjs';

const record = {
  record_id: 'npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  entity_id: 'npc-entity:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  kind: 'npc',
  position: { x: 100, y: 100, floor: -7 },
};
const view = { x: 100, y: 100, floor: -7, zoom: 1 };
const viewport = { width: 200, height: 120 };

test('committed pixel target uses canonical geometry plus bounded auxiliary hit rects', () => {
  const target = createCreatureInteractionTarget({
    record, view, viewport,
    presentation: { kind: 'pixel', bitmapWidth: 32, bitmapHeight: 32, displacement: { x: 0, y: 0 }, contentId: 'sha256:frame' },
    auxiliaryRects: [{ x: 108, y: 52, width: 16, height: 16 }],
    drawOrder: 7, baseGeneration: 11, creatureGeneration: 4,
  });
  assert.equal(target.generationKey, '11:4');
  assert.deepEqual(target.worldAnchor, record.position);
  assert.deepEqual(target.hitRects, [
    { x: 100, y: 60, width: 32, height: 32 },
    { x: 108, y: 52, width: 16, height: 16 },
  ]);
  assert(target.assistRect.width >= 44 && target.assistRect.height >= 44);
  assert.equal(target.drawOrder, 7);
});

test('marker target stays CSS-pixel bounded and fails closed on wrong floor', () => {
  const marker = createCreatureInteractionTarget({
    record: { ...record, kind: 'monster', record_id: 'monster:cccccccccccccccccccccccccccccccc' },
    view, viewport,
    presentation: { kind: 'marker', width: 12, height: 12 },
    drawOrder: 1, baseGeneration: 11, creatureGeneration: 4,
  });
  assert.deepEqual(marker.presentationRect, { x: 94, y: 54, width: 12, height: 12 });
  assert.deepEqual(marker.hitRects, [marker.presentationRect]);
  assert(Object.isFrozen(marker));
  assert(Object.isFrozen(marker.worldAnchor));

  assert.equal(createCreatureInteractionTarget({
    record: { ...record, position: { ...record.position, floor: -6 } },
    view, viewport,
    presentation: { kind: 'marker', width: 12, height: 12 },
    drawOrder: 1, baseGeneration: 11, creatureGeneration: 4,
  }), null);
});
