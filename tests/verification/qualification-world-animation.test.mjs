import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildQualificationWorld, verifyQualificationWorld } from '../../tools/verification/qualification-world.mjs';
import { loadAnimationRuntime } from '../../src/browser/animation-runtime.mjs';
import { decodeSemanticGroup, flattenRenderRecords } from '../../src/browser/fullworld.mjs';
import { ancillarySourceExpectations, resolveQualificationManifestTrust } from '../../src/browser/fullworld-trust.mjs';

test('published qualification world objects play distinct real phases and restore their published static pixels', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-world-animation-'));
  const root = path.join(parent, 'world');
  try {
    const manifest = await buildQualificationWorld(root);
    assert.deepEqual(await verifyQualificationWorld(root), manifest);
    const json = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
    const fetcher = async (url) => new Response(fs.readFileSync(path.join(root, new URL(url).pathname)));
    const animation = await loadAnimationRuntime(new URL('https://fixture.invalid/animation/'), fetcher,
      ancillarySourceExpectations(resolveQualificationManifestTrust(manifest)).animation);
    const world = json('runtime-index/world.json');
    const floor = json('runtime-index/floors/f-7.json');
    const chunk = floor.chunks.find((value) => value.logicalAddress.region_x === 1008 && value.logicalAddress.region_y === 1004);
    const bytes = fs.readFileSync(path.join(root, 'publication/semantic', chunk.path));
    const records = flattenRenderRecords(decodeSemanticGroup(bytes, {
      chunk, group: chunk.groups[0], floor: -7, regionSpan: world.regionSpan, visualBounds: world.visualBounds,
    }));
    const animated = records.filter((record) => animation.hasObject(record));
    assert.ok(animated.length > 0, 'published playback scene must contain a real animated world object');
    for (const record of animated) {
      const initial = animation.objectFrame(record, 0);
      const next = animation.objectFrame(record, 120);
      const wrapped = animation.objectFrame(record, 240);
      assert.equal(initial.phase, 0);
      assert.equal(next.phase, 1);
      assert.equal(wrapped.phase, 0);
      assert.notEqual(next.contentId, initial.contentId);
      assert.equal(wrapped.contentId, initial.contentId);
      const initialPixels = await animation.bitmap(initial.contentId);
      const nextPixels = await animation.bitmap(next.contentId);
      assert.equal(initialPixels.width, 32);
      assert.equal(initialPixels.height, 32);
      assert.deepEqual(Buffer.from(initialPixels.rgba), fs.readFileSync(path.join(root, 'publication/pixels/packs/p0.rgba')),
        'phase zero must equal the independently published static pixel pack');
      assert.notDeepEqual(nextPixels.rgba, initialPixels.rgba);
      assert.ok([...initialPixels.rgba].filter((_, i) => i % 4 === 3).every((alpha) => alpha === 255));
      assert.ok([...nextPixels.rgba].filter((_, i) => i % 4 === 3).every((alpha) => alpha === 255));
      assert.deepEqual((await animation.bitmap(wrapped.contentId)).rgba, initialPixels.rgba);
    }
    assert.equal(animation.hasObject({ presentation: { appearanceSourceId: -1 } }), false);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
