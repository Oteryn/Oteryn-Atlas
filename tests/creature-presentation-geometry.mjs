import assert from 'node:assert/strict';
import test from 'node:test';

import { computeCreaturePresentationGeometry } from '../src/browser/creature-presentation-geometry.mjs';

const base = {
  record: { record_id: 'monster:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', position: { x: 101, y: 100, floor: -7 } },
  view: { x: 100, y: 100, floor: -7, zoom: 2 },
  viewport: { width: 400, height: 300 },
};

test('pixel geometry follows renderer bitmap and Game displacement in CSS pixels', () => {
  const result = computeCreaturePresentationGeometry({
    ...base,
    presentation: { kind: 'pixel', bitmapWidth: 64, bitmapHeight: 48, displacement: { x: 4, y: 6 }, contentId: 'sha256:abc' },
  });
  assert.deepEqual(result.anchor, { x: 264, y: 150 });
  assert.deepEqual(result.presentationRect, { x: 192, y: 106, width: 128, height: 96 });
  assert.deepEqual(result.visibleRect, result.presentationRect);
  assert.equal(result.presentationKind, 'pixel');
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.presentationRect));
});

test('marker geometry is clipped to viewport and is DPR-independent', () => {
  const input = {
    record: { record_id: 'npc:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', position: { x: 100, y: 100, floor: -7 } },
    view: { x: 100, y: 100, floor: -7, zoom: 1 },
    viewport: { width: 20, height: 20, dpr: 1 },
    presentation: { kind: 'marker', width: 30, height: 16 },
  };
  const one = computeCreaturePresentationGeometry(input);
  const two = computeCreaturePresentationGeometry({ ...input, viewport: { ...input.viewport, dpr: 2 } });
  assert.deepEqual(one.anchor, { x: 10, y: 10 });
  assert.deepEqual(one.presentationRect, { x: -5, y: 2, width: 30, height: 16 });
  assert.deepEqual(one.visibleRect, { x: 0, y: 2, width: 20, height: 16 });
  assert.deepEqual(two, one);
});

test('wrong floor and fully off-viewport presentations fail closed', () => {
  assert.equal(computeCreaturePresentationGeometry({
    ...base,
    record: { ...base.record, position: { ...base.record.position, floor: -6 } },
    presentation: { kind: 'marker', width: 8, height: 8 },
  }), null);
  assert.equal(computeCreaturePresentationGeometry({
    ...base,
    record: { ...base.record, position: { x: 1000, y: 1000, floor: -7 } },
    presentation: { kind: 'marker', width: 8, height: 8 },
  }), null);
});

test('pixel geometry key is phase-content invariant when dimensions and displacement are unchanged', () => {
  const first = computeCreaturePresentationGeometry({
    ...base,
    presentation: { kind: 'pixel', bitmapWidth: 64, bitmapHeight: 48, displacement: { x: 4, y: 6 }, contentId: 'sha256:first' },
  });
  const second = computeCreaturePresentationGeometry({
    ...base,
    presentation: { kind: 'pixel', bitmapWidth: 64, bitmapHeight: 48, displacement: { x: 4, y: 6 }, contentId: 'sha256:second' },
  });
  assert.equal(first.geometryKey, second.geometryKey);
});

test('rounded-square marker geometry can match Canvas icon pixel origin exactly', () => {
  const result = computeCreaturePresentationGeometry({
    record: { record_id: 'npc:cccccccccccccccccccccccccccccccc', position: { x: 100, y: 100, floor: -7 } },
    view: { x: 99.99, y: 100, floor: -7, zoom: 1 },
    viewport: { width: 200, height: 120 },
    presentation: { kind: 'marker', width: 13, height: 13, originRounding: 'nearest' },
  });
  assert(Math.abs(result.anchor.x - 100.32) < 1e-9);
  assert.equal(result.anchor.y, 60);
  assert.deepEqual(result.presentationRect, { x: 94, y: 54, width: 13, height: 13 });
});
