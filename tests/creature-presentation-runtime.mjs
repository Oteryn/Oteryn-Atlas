import assert from 'node:assert/strict';
import test from 'node:test';

import {
  presentationBackingStore,
  relativeVisibleRects,
  resolveCreatureEffectivePresentation,
} from '../src/browser/creature-presentation-runtime.mjs';

test('effective presentation delegates AUTO representation to canonical lodBlend inputs', () => {
  assert.deepEqual(resolveCreatureEffectivePresentation({
    view: { mode: 'auto', zoom: 0.3 }, detailReady: false,
  }), { requestedMode: 'auto', representation: 'minimap', detailReady: false });
  assert.deepEqual(resolveCreatureEffectivePresentation({
    view: { mode: 'auto', zoom: 0.44 }, detailReady: true,
  }), { requestedMode: 'auto', representation: 'transition', detailReady: true });
  assert.deepEqual(resolveCreatureEffectivePresentation({
    view: { mode: 'auto', zoom: 0.6 }, detailReady: true,
  }), { requestedMode: 'auto', representation: 'detail', detailReady: true });
});

test('published effective representation is consumed read-only when present', () => {
  const published = Object.freeze({ requestedMode: 'auto', representation: 'transition', detailReady: true });
  const actual = resolveCreatureEffectivePresentation({
    view: { mode: 'auto', zoom: 0.44 },
    effectivePresentation: published,
    detailReady: false,
  });
  assert.deepEqual(actual, published);
  assert.notEqual(actual, published);
  assert.equal(Object.isFrozen(actual), true);
});

test('forced modes remain canonical even if detail readiness is stale', () => {
  assert.equal(resolveCreatureEffectivePresentation({
    view: { mode: 'minimap', zoom: 16 }, detailReady: true,
  }).representation, 'minimap');
  assert.equal(resolveCreatureEffectivePresentation({
    view: { mode: 'classic', zoom: 16 }, detailReady: true,
  }).representation, 'classic');
  assert.equal(resolveCreatureEffectivePresentation({
    view: { mode: 'map', zoom: 0.125 }, detailReady: false,
  }).representation, 'minimap');
  assert.equal(resolveCreatureEffectivePresentation({
    view: { mode: 'map', zoom: 0.6 }, detailReady: false,
  }).representation, 'minimap-fallback');
});

test('presentation backing store scales pixels without changing CSS geometry', () => {
  assert.deepEqual(presentationBackingStore({ width: 641.5, height: 359.5, dpr: 1 }), {
    cssWidth: 641.5, cssHeight: 359.5, dpr: 1, width: 642, height: 360,
  });
  assert.deepEqual(presentationBackingStore({ width: 641.5, height: 359.5, dpr: 2 }), {
    cssWidth: 641.5, cssHeight: 359.5, dpr: 2, width: 1283, height: 719,
  });
  assert.deepEqual(presentationBackingStore({ width: 100, height: 50, dpr: 3 }), {
    cssWidth: 100, cssHeight: 50, dpr: 2, width: 200, height: 100,
  });
});

test('visible HUD and card rectangles translate into map-frame CSS pixels', () => {
  const frameRect = { left: 100, top: 40, width: 800, height: 600 };
  const rects = relativeVisibleRects({
    frameRect,
    entries: [
      { id: 'runtime', rect: { left: 112, top: 52, width: 120, height: 24 } },
      { id: 'detail', rect: { left: 700, top: 52, width: 150, height: 24 } },
      { id: 'cursor', rect: { left: 420, top: 600, width: 140, height: 22 } },
      { id: 'card', rect: { left: 610, top: 150, width: 240, height: 180 } },
      { id: 'hidden', hidden: true, rect: { left: 0, top: 0, width: 10, height: 10 } },
      { id: 'empty', rect: { left: 0, top: 0, width: 0, height: 10 } },
    ],
  });
  assert.deepEqual(rects, [
    { x: 12, y: 12, width: 120, height: 24 },
    { x: 600, y: 12, width: 150, height: 24 },
    { x: 320, y: 560, width: 140, height: 22 },
    { x: 510, y: 110, width: 240, height: 180 },
  ]);
  assert.equal(Object.isFrozen(rects), true);
  assert.equal(rects.every(Object.isFrozen), true);
});

test('runtime helpers reject malformed geometry instead of guessing', () => {
  assert.throws(() => presentationBackingStore({ width: 0, height: 20, dpr: 1 }), /backing store/);
  assert.throws(() => relativeVisibleRects({ frameRect: { left: 0, top: 0 }, entries: [] }), /frame rectangle/);
  assert.throws(() => resolveCreatureEffectivePresentation({ view: { mode: 'auto', zoom: 0 } }), /zoom/);
});
