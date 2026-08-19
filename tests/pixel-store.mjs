import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sha256ContentId } from '../src/browser/loader.mjs';
import {
  computePixelRootContentId,
  pixelContentId,
  validatePixelManifest,
} from '../src/browser/pixels.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const proof = join(here, '..', 'web', 'proof');
const pixelDir = join(proof, 'pixels');

async function loadPixelFixture() {
  const manifest = JSON.parse(await readFile(join(pixelDir, 'manifest.json'), 'utf8'));
  const pack = new Uint8Array(await readFile(join(pixelDir, 'pack.rgba')));
  return { manifest, pack };
}
test('authorized pixel manifest and root identity verify exactly', async () => {
  const { manifest } = await loadPixelFixture();
  validatePixelManifest(manifest);
  assert.equal(
    await computePixelRootContentId(manifest),
    'sha256:91bbce72598fc3887d8e0d454d03d0aa5cc4d9ef0d30c3848e3ab1b711ede70a',
  );
});

test('pixel pack and every content-addressed blob verify', async () => {
  const { manifest, pack } = await loadPixelFixture();
  assert.equal(pack.byteLength, 7725056);
  assert.equal(
    await sha256ContentId(pack),
    'sha256:4f0b32786dc7601764c8a2596bc1ab49a24881d9778ecb4f54c894b113d84d62',
  );
  for (const entry of manifest.blobs) {
    const bytes = pack.subarray(entry.offset, entry.offset + entry.bytes);
    assert.equal(await pixelContentId(entry, bytes), entry.contentId);
  }
});
test('sprite index dedupe is deterministic and complete', async () => {
  const { manifest } = await loadPixelFixture();
  const spriteEntries = Object.values(manifest.spriteIndex);
  assert.equal(spriteEntries.length, 990);
  assert.equal(new Set(spriteEntries.map((entry) => entry.contentId)).size, 987);
  assert.equal(spriteEntries.length - new Set(spriteEntries.map((entry) => entry.contentId)).size, 3);
});

test('all semantic resolved primitives map to authorized pixel references', async () => {
  const { manifest: pixelManifest } = await loadPixelFixture();
  const semanticRoot = join(proof, 'semantic');
  const semanticManifest = JSON.parse(await readFile(join(semanticRoot, 'manifest.json'), 'utf8'));
  const authorized = new Set(Object.keys(pixelManifest.spriteIndex).map(Number));
  let primitives = 0;
  for (const entry of semanticManifest.chunks) {
    const chunk = JSON.parse(await readFile(join(semanticRoot, ...entry.path.split('/')), 'utf8'));
    for (const tile of chunk.tiles) for (const presentation of tile[7]) for (const primitive of presentation[6]) {
      primitives += 1;
      assert.ok(authorized.has(primitive[0]), `missing sprite ${primitive[0]}`);
    }
  }
  assert.equal(primitives, 39282);
});
test('missing sprite index entry fails closed', async () => {
  const { manifest } = await loadPixelFixture();
  const forged = structuredClone(manifest);
  delete forged.spriteIndex[Object.keys(forged.spriteIndex)[0]];
  assert.throws(() => validatePixelManifest(forged), /sprite index count mismatch/);
});

test('forged pixel bytes do not match content identity', async () => {
  const { manifest, pack } = await loadPixelFixture();
  const entry = manifest.blobs[0];
  const forged = pack.slice(entry.offset, entry.offset + entry.bytes);
  forged[0] ^= 0xff;
  assert.notEqual(await pixelContentId(entry, forged), entry.contentId);
});
