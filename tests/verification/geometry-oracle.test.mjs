import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  compareCreatureAnchors,
  projectWithCommittedRenderer,
} from '../../e2e/support/geometry-oracle.mjs';

const renderer = {
  generation: 10,
  transform: {
    floor: -7, centerTileX: 100, centerTileY: 200, zoom: 2, dpr: 2,
    framebufferWidth: 2880, framebufferHeight: 1800,
    cssViewportWidth: 1440, cssViewportHeight: 900,
    scaleDevicePixelsPerWorldUnit: 4,
  },
};

function creature(screenX = 784, screenY = 514) {
  return {
    generation: 3, baseGenerationAtStart: 10, baseGenerationAtCommit: 10,
    view: { x: 100, y: 200, floor: -7, zoom: 2 },
    canvas: { width: 1440, height: 900, dpr: 2 },
    anchors: [{ id: 'npc:x', kind: 'npc', floor: -7, x: 101, y: 201, screenX, screenY }],
  };
}

test('independent renderer oracle projects from actual WebGL uniform evidence', () => {
  assert.deepEqual(projectWithCommittedRenderer(renderer.transform, { x: 101, y: 201, floor: -7 }), { x: 784, y: 514 });
});

test('geometry comparison accepts aligned overlay and reports synchronized generations', () => {
  const result = compareCreatureAnchors(renderer, creature());
  assert.equal(result.synchronizedGeneration, true);
  assert.equal(result.maxDriftPx, 0);
  assert.equal(result.samples.length, 1);
});

test('geometry oracle rejects controlled translation mutant', () => {
  const result = compareCreatureAnchors(renderer, creature(787, 512));
  assert.equal(result.synchronizedGeneration, true);
  assert(result.maxDriftPx > 3.5);
  assert.throws(() => result.assertWithin(0.25), /drift/i);
});

test('geometry oracle rejects overlay commits straddling a newer base frame', () => {
  const stale = { ...creature(), baseGenerationAtCommit: 11 };
  const result = compareCreatureAnchors(renderer, stale);
  assert.equal(result.synchronizedGeneration, false);
  assert.throws(() => result.assertWithin(0.25), /generation/i);
});

test('desktop continuous-pan geometry oracle aligns base and creature before logging', () => {
  const source = readFileSync(new URL('../../e2e/tests/geometry-desktop.spec.mjs', import.meta.url), 'utf8');
  const start = source.indexOf("test('NPC overlay never commits independently");
  const align = source.indexOf('await waitForCreatureAlignedToBase(page, true);', start);
  const install = source.indexOf('await installGeometryEventLog(page);', start);
  assert.ok(start >= 0 && install > start, 'continuous-pan geometry test must remain inspectable');
  assert.ok(align > start && align < install, 'continuous-pan geometry log must start only after exact creature/base alignment');
});
