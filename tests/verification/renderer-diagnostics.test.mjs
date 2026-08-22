import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createRendererDiagnosticSnapshot } from '../../src/browser/renderer-diagnostics.mjs';

const transform = {
  floor: -7, centerTileX: 32369, centerTileY: 32241, zoom: 2, dpr: 1,
  framebufferWidth: 1440, framebufferHeight: 900,
  cssViewportWidth: 1440, cssViewportHeight: 900,
  scaleDevicePixelsPerWorldUnit: 2,
};

test('renderer diagnostic snapshot is bounded, serializable and deeply immutable', () => {
  const snapshot = createRendererDiagnosticSnapshot({
    generation: 9,
    transform,
    backend: 'WebGL2-instanced-buckets',
    drawCalls: 1,
    visiblePrimitives: 44,
    retainedPrimitives: 55,
    anchors: Array.from({ length: 40 }, (_, index) => ({ id: `tile:${index}`, floor: -7, x: 32360 + index, y: 32240 })),
  });
  assert.equal(snapshot.generation, 9);
  assert.equal(snapshot.anchors.length, 24);
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.transform));
  assert(Object.isFrozen(snapshot.anchors));
  assert(Object.isFrozen(snapshot.anchors[0]));
  assert.doesNotThrow(() => JSON.stringify(snapshot));
  assert.throws(() => { snapshot.transform.zoom = 99; }, TypeError);
});

test('renderer diagnostic snapshot rejects invalid committed evidence', () => {
  assert.throws(() => createRendererDiagnosticSnapshot({ generation: 0, transform }), /generation/i);
  assert.throws(() => createRendererDiagnosticSnapshot({ generation: 1, transform: { ...transform, zoom: Number.NaN } }), /transform/i);
});

test('FullWorld source publishes read-only committed renderer diagnostics', async () => {
  const renderer = await readFile(new URL('../../src/browser/fullworld-webgl.mjs', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../web/fullworld-app.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /generation/);
  assert.match(renderer, /scaleDevicePixelsPerWorldUnit/);
  assert.match(app, /__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__/);
  assert.match(app, /oteryn-atlas-render-committed/);
});