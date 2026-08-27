import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { loadAnimationRuntime } from '../../src/browser/animation-runtime.mjs';
import { ancillarySourceExpectations, resolveQualificationManifestTrust } from '../../src/browser/fullworld-trust.mjs';

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const fixtureTrust = resolveQualificationManifestTrust({
  fixtureId: 'atlas-qualification-world-v2', dataCapability: 'qualification_fixture',
  publicationRoot: hash('1'), semanticRoot: hash('2'), pixelRoot: hash('3'), overviewRoot: hash('4'),
  minimapRoot: hash('5'), runtimeIndexRoot: hash('6'), pixelBucketRoot: hash('7'), sourceFingerprint: hash('8'), productDigest: hash('9'),
});
const expected = ancillarySourceExpectations(fixtureTrust).animation;
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function fixtureFiles(source = expected) {
  const programs = Buffer.from(JSON.stringify({
    profile: 'oteryn-atlas-animation-runtime-v1', object_programs: [], creature_programs: [], sprite_index: {}, blob_index: {},
  }));
  const manifest = Buffer.from(JSON.stringify({
    profile: 'oteryn-atlas-animation-runtime-v1', identityAuthority: false,
    source: { game_sha: source.gameSha, appearance_product_root: source.appearanceProductRoot, outfit_spatial_product_root: source.outfitSpatialProductRoot },
    buckets: [], programs: { path: 'programs.json', bytes: programs.length, digest: digest(programs) },
  }));
  return new Map([['/animation/manifest.json', manifest], ['/animation/programs.json', programs]]);
}
function fetcher(files) {
  return async (url) => {
    const bytes = files.get(new URL(url).pathname);
    return bytes ? { ok: true, status: 200, headers: { get: () => String(bytes.length) }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
      : { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
  };
}
test('animation loader accepts fixture-owned source only with explicit qualification expectations', async () => {
  const runtime = await loadAnimationRuntime(new URL('https://fixture.test/animation/'), fetcher(fixtureFiles()), expected);
  assert.equal(runtime.manifest.source.game_sha, 'fixture');
  assert.equal(runtime.manifest.source.appearance_product_root, fixtureTrust.pixelRoot);
  assert.equal(runtime.manifest.source.outfit_spatial_product_root, fixtureTrust.semanticRoot);
});

test('animation production default rejects fixture-owned source', async () => {
  await assert.rejects(
    () => loadAnimationRuntime(new URL('https://fixture.test/animation/'), fetcher(fixtureFiles())),
    /Game SHA mismatch|product root mismatch/i,
  );
});

test('animation explicit expectations fail closed on mismatched fixture root', async () => {
  await assert.rejects(
    () => loadAnimationRuntime(new URL('https://fixture.test/animation/'), fetcher(fixtureFiles()), { ...expected, appearanceProductRoot: hash('a') }),
    /product root mismatch/i,
  );
});
