import assert from 'node:assert/strict';
import test from 'node:test';

import {
  screenToWorldTile,
  viewportTransform,
  worldTileToScreen,
} from '../../src/browser/viewport-transform.mjs';

const SEED = 0x41544c41;
function cases(seed = SEED, count = 256) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return Array.from({ length: count }, () => ({
    view: { x: 32000 + next() * 900, y: 32000 + next() * 900, floor: -Math.floor(next() * 16), zoom: 0.125 + next() * 15.875 },
    viewport: { width: 320 + Math.floor(next() * 1600), height: 240 + Math.floor(next() * 900), dpr: 1 + Math.floor(next() * 2) },
    point: { x: 32000 + next() * 900, y: 32000 + next() * 900 },
    pan: { x: (next() - 0.5) * 20, y: (next() - 0.5) * 20 },
  }));
}

function close(actual, expected, tolerance = 1e-8) {
  assert(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);
}

test(`viewport transform round-trips deterministic generated points seed=${SEED}`, () => {
  for (const sample of cases()) {
    const transform = viewportTransform(sample.view, sample.viewport);
    const screen = worldTileToScreen(transform, { ...sample.point, floor: sample.view.floor });
    const restored = screenToWorldTile(transform, screen);
    close(restored.x, sample.point.x);
    close(restored.y, sample.point.y);
    assert.equal(restored.floor, sample.view.floor);
  }
});

test('pan delta and inverse pan use an independent screen-space oracle', () => {
  for (const sample of cases(SEED ^ 0x85, 96)) {
    const before = viewportTransform(sample.view, sample.viewport);
    const after = viewportTransform({ ...sample.view, x: sample.view.x + sample.pan.x, y: sample.view.y + sample.pan.y }, sample.viewport);
    const p = { ...sample.point, floor: sample.view.floor };
    const a = worldTileToScreen(before, p);
    const b = worldTileToScreen(after, p);
    close(b.x - a.x, -sample.pan.x * 32 * sample.view.zoom);
    close(b.y - a.y, -sample.pan.y * 32 * sample.view.zoom);
  }
});

test('pointer-anchored zoom preserves the same independently recovered world point', () => {
  for (const sample of cases(SEED ^ 0x5a, 96)) {
    const oldTransform = viewportTransform(sample.view, sample.viewport);
    const anchor = { x: sample.viewport.width * 0.23, y: sample.viewport.height * 0.71 };
    const world = screenToWorldTile(oldTransform, anchor);
    const nextZoom = Math.min(16, sample.view.zoom * 1.12);
    const nextView = {
      ...sample.view,
      zoom: nextZoom,
      x: world.x - (anchor.x - sample.viewport.width / 2) / (32 * nextZoom),
      y: world.y - (anchor.y - sample.viewport.height / 2) / (32 * nextZoom),
    };
    const projected = worldTileToScreen(viewportTransform(nextView, sample.viewport), world);
    close(projected.x, anchor.x);
    close(projected.y, anchor.y);
  }
});

test('resize preserves camera center and floor isolation fails closed', () => {
  const view = { x: 32369.25, y: 32241.75, floor: -7, zoom: 2 };
  for (const viewport of [{ width: 390, height: 844, dpr: 2 }, { width: 844, height: 390, dpr: 2 }, { width: 1440, height: 900, dpr: 1 }]) {
    const transform = viewportTransform(view, viewport);
    assert.deepEqual(worldTileToScreen(transform, { x: view.x, y: view.y, floor: -7 }), { x: viewport.width / 2, y: viewport.height / 2 });
    assert.throws(() => worldTileToScreen(transform, { x: view.x, y: view.y, floor: -6 }), /floor/i);
  }
});

test('property oracle kills sign and scale mutants', () => {
  const sample = cases(SEED ^ 0x1234, 1)[0];
  const t = viewportTransform(sample.view, sample.viewport);
  const expected = {
    x: sample.viewport.width / 2 + (sample.point.x - sample.view.x) * 32 * sample.view.zoom,
    y: sample.viewport.height / 2 + (sample.point.y - sample.view.y) * 32 * sample.view.zoom,
  };
  const signMutant = { x: sample.viewport.width / 2 - (sample.point.x - sample.view.x) * 32 * sample.view.zoom, y: expected.y };
  const scaleMutant = { x: sample.viewport.width / 2 + (sample.point.x - sample.view.x) * 16 * sample.view.zoom, y: expected.y };
  const actual = worldTileToScreen(t, { ...sample.point, floor: sample.view.floor });
  close(actual.x, expected.x);
  assert(Math.abs(signMutant.x - expected.x) > 1);
  assert(Math.abs(scaleMutant.x - expected.x) > 1);
});
