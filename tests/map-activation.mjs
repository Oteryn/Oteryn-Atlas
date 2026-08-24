import assert from 'node:assert/strict';
import test from 'node:test';

import { dispatchMapActivation } from '../src/browser/map-activation.mjs';

test('map activation is cancelable and preserves one frozen detail payload', () => {
  const target = new EventTarget();
  let observed = null;
  target.addEventListener('oteryn-atlas-map-activate', (event) => {
    observed = event.detail;
    event.preventDefault();
  });
  const detail = {
    cssX: 14, cssY: 22, worldX: 100.25, worldY: 200.75,
    floor: -7, pointerType: 'touch', rendererGeneration: 19,
    view: { x: 100, y: 200, floor: -7, zoom: 2 },
  };
  assert.equal(dispatchMapActivation(target, detail), true);
  assert.deepEqual(observed, detail);
  assert(Object.isFrozen(observed));
  assert(Object.isFrozen(observed.view));
});

test('unclaimed activation returns false', () => {
  const target = new EventTarget();
  assert.equal(dispatchMapActivation(target, {
    cssX: 1, cssY: 2, worldX: 3, worldY: 4, floor: 0,
    pointerType: 'mouse', rendererGeneration: 1,
    view: { x: 3, y: 4, floor: 0, zoom: 1 },
  }), false);
});
