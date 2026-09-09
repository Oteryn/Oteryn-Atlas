import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { bytesDigest } from '../../tools/verification/anti-loop-common.mjs';
import { canonicalJson } from '../../tools/verification/verification-plan-schema.mjs';
import {
  verifyCompleteProductArtifacts,
  verifyMinimapArtifacts,
  verifyPixelBucketArtifacts,
  verifyRuntimeIndexArtifacts,
} from '../../tools/verification/verify-complete-product-artifacts.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const domain = {
  publication: 'OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0',
  semanticWorld: 'OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0',
  semanticFloor: 'OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0',
  pixelWorld: 'OTERYN-ATLAS-FULLWORLD-PIXEL-STORE-V0\0',
  pixelBlob: 'OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0',
  minimapWorld: 'OTERYN-ATLAS-VISUAL-MINIMAP-WORLD-V0\0',
  minimapFloor: 'OTERYN-ATLAS-VISUAL-MINIMAP-FLOOR-V0\0',
};
const canonical = (value) => Buffer.from(`${canonicalJson(value)}\n`);
function rooted(prefix, value) { const core = structuredClone(value); delete core.rootContentId; return bytesDigest(Buffer.concat([Buffer.from(prefix), canonical(core)])); }
function write(root, relative, bytes) { const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); }
function writeJson(root, relative, value) { write(root, relative, canonical(value)); }

function publicationFixture(root) {
  const publicationRoot = path.join(root, 'publication'); fs.mkdirSync(publicationRoot);
  const record = {
    position: { floor: -7, x: 1, y: 1 },
    presentation: [
      { resolved_primitives: [
        { displacement: { dx_units: -32, dy_units: -24 }, height_units: 64, sprite_source_id: 101, width_units: 64 },
        { sprite_source_id: 102 },
      ] },
      { resolved_primitives: [{ sprite_source_id: 103 }] },
    ],
    record_type: 'tile',
  };
  const chunkRaw = canonical(record); const chunkId = bytesDigest(chunkRaw); write(publicationRoot, 'semantic/chunks/one.jsonl', chunkRaw);
  const fingerprint = `sha256:${'11'.repeat(32)}`;
  const chunk = { bytes: chunkRaw.byteLength, contentId: chunkId, logicalAddress: { floor: -7, region_x: 0, region_y: 0 }, path: 'chunks/one.jsonl', resolvedPrimitives: 3, tiles: 1 };
  const floorCore = { bounds: { x_max_exclusive: 256, x_min: 0, y_max_exclusive: 256, y_min: 0 }, chunks: [chunk], counts: { bytes: chunkRaw.byteLength, resolvedPrimitives: 3, tiles: 1 }, floor: -7, profile: 'oteryn-atlas-fullworld-semantic-publication-v0', sourceFingerprint: fingerprint };
  const floor = { ...floorCore, rootContentId: rooted(domain.semanticFloor, floorCore) }; writeJson(publicationRoot, 'semantic/floors/f-7.json', floor);
  const semanticCore = { counts: { bytes: chunkRaw.byteLength, floors: 1, resolvedPrimitives: 3, shards: 1, tiles: 1, uniqueSpriteRefs: 3 }, fabricRoot: `sha256:${'22'.repeat(32)}`, floors: [{ counts: floor.counts, floor: -7, path: 'floors/f-7.json', rootContentId: floor.rootContentId }], profile: 'oteryn-atlas-fullworld-semantic-publication-v0', sourceFingerprint: fingerprint };
  const semantic = { ...semanticCore, rootContentId: rooted(domain.semanticWorld, semanticCore) }; writeJson(publicationRoot, 'semantic/world.json', semantic);

  const sourcePixels = new Map([
    ['101', { width: 2, height: 1, rgba: Buffer.from([255, 0, 0, 255, 0, 0, 255, 127]) }],
    ['102', { width: 1, height: 1, rgba: Buffer.from([0, 255, 0, 128]) }],
    ['103', { width: 1, height: 1, rgba: Buffer.from([200, 100, 50, 128]) }],
  ]);
  const byContent = new Map(); const spriteIndex = {};
  for (const [spriteId, sprite] of sourcePixels) {
    const dimensions = Buffer.alloc(4); dimensions.writeUInt16BE(sprite.width, 0); dimensions.writeUInt16BE(sprite.height, 2);
    const contentId = bytesDigest(Buffer.concat([Buffer.from(domain.pixelBlob), dimensions, sprite.rgba])); byContent.set(contentId, sprite); spriteIndex[spriteId] = { contentId, width: sprite.width, height: sprite.height };
  }
  const blobs = []; const packParts = []; let offset = 0;
  for (const [contentId, sprite] of [...byContent].sort(([left], [right]) => left.localeCompare(right))) {
    blobs.push({ bytes: sprite.rgba.byteLength, contentId, height: sprite.height, offset, pack: 0, width: sprite.width }); packParts.push(sprite.rgba); offset += sprite.rgba.byteLength;
  }
  const rgba = Buffer.concat(packParts); write(publicationRoot, 'pixels/packs/pack-0000.rgba', rgba);
  const pixelCore = {
    assetZipSha256: 'a'.repeat(64),
    blobs,
    counts: { dedupeBytesSaved: 0, rawBytesAfterDedupe: rgba.byteLength, rawBytesBeforeDedupe: rgba.byteLength, spriteRefs: 3, uniquePixelBlobs: 3 },
    packs: [{ bytes: rgba.byteLength, identityAuthority: false, path: 'packs/pack-0000.rgba', sha256: crypto.createHash('sha256').update(rgba).digest('hex') }],
    pixelHashDomain: domain.pixelBlob.slice(0, -1),
    profile: 'oteryn-atlas-fullworld-pixel-publication-v0',
    runtimePlacement: { identityAuthority: false },
    spriteIndex,
  };
  const pixels = { ...pixelCore, rootContentId: rooted(domain.pixelWorld, pixelCore) }; writeJson(publicationRoot, 'pixels/manifest.json', pixels);
  const publicationCore = { pixels: { path: 'pixels/manifest.json', rootContentId: pixels.rootContentId }, profile: 'oteryn-atlas-fullworld-publication-v0', semantic: { path: 'semantic/world.json', rootContentId: semantic.rootContentId }, serializerStatus: 'PROVISIONAL_NOT_FROZEN', source: { authority: 'Oteryn/Oteryn-Game', gameSha: 'b'.repeat(40) } };
  const publication = { ...publicationCore, rootContentId: rooted(domain.publication, publicationCore) }; writeJson(publicationRoot, 'publication.json', publication);
  writeJson(publicationRoot, 'build-evidence.json', { counts: semantic.counts, elapsedSeconds: 0, outputPath: publicationRoot, pixelCounts: pixels.counts, pixelRoot: pixels.rootContentId, publicationRoot: publication.rootContentId, semanticRoot: semantic.rootContentId });
  return { publicationRoot, publication, pixels };
}

function updateBuildEvidence(fixture) {
  const evidencePath = path.join(fixture.publicationRoot, 'build-evidence.json'); const evidence = JSON.parse(fs.readFileSync(evidencePath)); const publication = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'publication.json'))); const semantic = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'semantic/world.json'))); const pixels = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'pixels/manifest.json')));
  evidence.counts = semantic.counts; evidence.pixelCounts = pixels.counts; evidence.pixelRoot = pixels.rootContentId; evidence.publicationRoot = publication.rootContentId; evidence.semanticRoot = semantic.rootContentId; writeJson(fixture.publicationRoot, 'build-evidence.json', evidence);
}

function reanchorPublicationPixels(fixture, spriteId, mutate) {
  const manifestPath = path.join(fixture.publicationRoot, 'pixels/manifest.json'); const pixels = JSON.parse(fs.readFileSync(manifestPath)); const pack = fs.readFileSync(path.join(fixture.publicationRoot, 'pixels/packs/pack-0000.rgba'));
  const sourceByContent = new Map(pixels.blobs.map((blob) => [blob.contentId, { width: blob.width, height: blob.height, rgba: Buffer.from(pack.subarray(blob.offset, blob.offset + blob.bytes)) }]));
  const oldId = pixels.spriteIndex[spriteId].contentId; sourceByContent.get(oldId).rgba = mutate(Buffer.from(sourceByContent.get(oldId).rgba));
  const replacement = new Map();
  for (const [contentId, blob] of sourceByContent) { const dimensions = Buffer.alloc(4); dimensions.writeUInt16BE(blob.width, 0); dimensions.writeUInt16BE(blob.height, 2); replacement.set(contentId, bytesDigest(Buffer.concat([Buffer.from(domain.pixelBlob), dimensions, blob.rgba]))); }
  for (const descriptor of Object.values(pixels.spriteIndex)) descriptor.contentId = replacement.get(descriptor.contentId);
  const rebuilt = [...sourceByContent].map(([oldContentId, blob]) => ({ ...blob, contentId: replacement.get(oldContentId) })).sort((left, right) => left.contentId.localeCompare(right.contentId));
  const parts = []; let offset = 0; pixels.blobs = rebuilt.map((blob) => { parts.push(blob.rgba); const entry = { bytes: blob.rgba.byteLength, contentId: blob.contentId, height: blob.height, offset, pack: 0, width: blob.width }; offset += blob.rgba.byteLength; return entry; });
  const rebuiltPack = Buffer.concat(parts); write(fixture.publicationRoot, 'pixels/packs/pack-0000.rgba', rebuiltPack); pixels.packs[0].bytes = rebuiltPack.byteLength; pixels.packs[0].sha256 = crypto.createHash('sha256').update(rebuiltPack).digest('hex'); pixels.rootContentId = rooted(domain.pixelWorld, pixels); writeJson(fixture.publicationRoot, 'pixels/manifest.json', pixels);
  const publication = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'publication.json'))); publication.pixels.rootContentId = pixels.rootContentId; publication.rootContentId = rooted(domain.publication, publication); writeJson(fixture.publicationRoot, 'publication.json', publication); fixture.expectedPublicationRoot = publication.rootContentId;
  updateBuildEvidence(fixture);
  const minimap = JSON.parse(fs.readFileSync(path.join(fixture.minimapRoot, 'world.json'))); minimap.source.pixelRoot = pixels.rootContentId; minimap.source.publicationRoot = publication.rootContentId; minimap.rootContentId = rooted(domain.minimapWorld, minimap); writeJson(fixture.minimapRoot, 'world.json', minimap); fixture.expectedMinimapRoot = minimap.rootContentId;
}

function reanchorSemanticChunk(fixture, mutate) {
  const chunkPath = path.join(fixture.publicationRoot, 'semantic/chunks/one.jsonl'); const record = JSON.parse(fs.readFileSync(chunkPath, 'utf8')); reanchorSemanticChunkRaw(fixture, canonical(mutate(record)));
}

function reanchorSemanticChunkRaw(fixture, chunkRaw) {
  const chunkPath = path.join(fixture.publicationRoot, 'semantic/chunks/one.jsonl'); fs.writeFileSync(chunkPath, chunkRaw);
  const floorPath = path.join(fixture.publicationRoot, 'semantic/floors/f-7.json'); const floor = JSON.parse(fs.readFileSync(floorPath)); floor.chunks[0].bytes = chunkRaw.byteLength; floor.chunks[0].contentId = bytesDigest(chunkRaw); floor.counts.bytes = chunkRaw.byteLength; floor.rootContentId = rooted(domain.semanticFloor, floor); writeJson(fixture.publicationRoot, 'semantic/floors/f-7.json', floor);
  const semantic = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'semantic/world.json'))); semantic.floors[0].counts = floor.counts; semantic.floors[0].rootContentId = floor.rootContentId; semantic.counts.bytes = chunkRaw.byteLength; semantic.rootContentId = rooted(domain.semanticWorld, semantic); writeJson(fixture.publicationRoot, 'semantic/world.json', semantic);
  const publication = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'publication.json'))); publication.semantic.rootContentId = semantic.rootContentId; publication.rootContentId = rooted(domain.publication, publication); writeJson(fixture.publicationRoot, 'publication.json', publication); fixture.expectedPublicationRoot = publication.rootContentId;
  updateBuildEvidence(fixture);
  const minimapFloor = JSON.parse(fs.readFileSync(path.join(fixture.minimapRoot, 'floors/f-7.json'))); minimapFloor.sourceFloorRoot = floor.rootContentId; minimapFloor.chunks[0].sourceContentId = floor.chunks[0].contentId; minimapFloor.rootContentId = rooted(domain.minimapFloor, minimapFloor); writeJson(fixture.minimapRoot, 'floors/f-7.json', minimapFloor);
  const minimap = JSON.parse(fs.readFileSync(path.join(fixture.minimapRoot, 'world.json'))); minimap.floors[0].rootContentId = minimapFloor.rootContentId; minimap.source.semanticRoot = semantic.rootContentId; minimap.source.publicationRoot = publication.rootContentId; minimap.rootContentId = rooted(domain.minimapWorld, minimap); writeJson(fixture.minimapRoot, 'world.json', minimap); fixture.expectedMinimapRoot = minimap.rootContentId;
}

function reanchorSemanticCensus(fixture, mutate) {
  const semantic = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'semantic/world.json'))); mutate(semantic.counts); semantic.rootContentId = rooted(domain.semanticWorld, semantic); writeJson(fixture.publicationRoot, 'semantic/world.json', semantic);
  const publication = JSON.parse(fs.readFileSync(path.join(fixture.publicationRoot, 'publication.json'))); publication.semantic.rootContentId = semantic.rootContentId; publication.rootContentId = rooted(domain.publication, publication); writeJson(fixture.publicationRoot, 'publication.json', publication); fixture.expectedPublicationRoot = publication.rootContentId;
  updateBuildEvidence(fixture);
  const minimap = JSON.parse(fs.readFileSync(path.join(fixture.minimapRoot, 'world.json'))); minimap.source.semanticRoot = semantic.rootContentId; minimap.source.publicationRoot = publication.rootContentId; minimap.rootContentId = rooted(domain.minimapWorld, minimap); writeJson(fixture.minimapRoot, 'world.json', minimap); fixture.expectedMinimapRoot = minimap.rootContentId;
}

function builtFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-complete-artifact-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = publicationFixture(root); const runtimeIndexRoot = path.join(root, 'runtime-index'); const pixelBucketsRoot = path.join(root, 'pixel-buckets'); const minimapRoot = path.join(root, 'minimap');
  execFileSync('python3', ['tools/fullworld-runtime/build_runtime_index.py', '--publication', source.publicationRoot, '--output', runtimeIndexRoot, '--expected-publication-root', source.publication.rootContentId], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('python3', ['tools/fullworld-runtime/build_pixel_buckets.py', '--publication', source.publicationRoot, '--output', pixelBucketsRoot, '--expected-publication-root', source.publication.rootContentId, '--expected-pixel-root', source.pixels.rootContentId], { cwd: repoRoot, stdio: 'pipe' });
  execFileSync('python3', ['tools/fullworld-minimap/build_minimap.py', '--publication', source.publicationRoot, '--output', minimapRoot, '--workers', '1'], { cwd: repoRoot, stdio: 'pipe' });
  const runtime = JSON.parse(fs.readFileSync(path.join(runtimeIndexRoot, 'world.json'))); const buckets = JSON.parse(fs.readFileSync(path.join(pixelBucketsRoot, 'manifest.json'))); const minimap = JSON.parse(fs.readFileSync(path.join(minimapRoot, 'world.json')));
  return { ...source, runtimeIndexRoot, pixelBucketsRoot, minimapRoot, expectedPublicationRoot: source.publication.rootContentId, expectedRuntimeIndexRoot: runtime.rootContentId, expectedPixelBucketRoot: buckets.rootContentId, expectedMinimapRoot: minimap.rootContentId };
}

test('three independent modes inspect complete raw fixture artifacts and emit distinct receipts', (t) => {
  const f = builtFixture(t);
  const runtime = verifyRuntimeIndexArtifacts(f); const pixels = verifyPixelBucketArtifacts(f); const minimap = verifyMinimapArtifacts(f);
  assert.equal(runtime.result, 'PASS'); assert.equal(runtime.counts.shards, 1); assert.equal(runtime.counts.tiles, 1);
  assert.equal(pixels.result, 'PASS'); assert.deepEqual(pixels.counts, { blobs: 3, buckets: 3, bytes: 16 });
  assert.equal(minimap.result, 'PASS'); assert.equal(minimap.counts.chunks, 1);
  assert.equal(minimap.pixelDerivation, 'independently-recomputed-from-verified-semantic-and-rgba-source-bytes');
  assert.equal(new Set([runtime.receiptDigest, pixels.receiptDigest, minimap.receiptDigest]).size, 3);
  const suite = verifyCompleteProductArtifacts({ ...f, mode: 'all' }); assert.equal(suite.result, 'PASS'); assert.equal(suite.receiptDigests.length, 3);
});

test('runtime index verification rejects raw mutation, missing closure, and extra artifacts', (t) => {
  const rawMutation = builtFixture(t); fs.appendFileSync(path.join(rawMutation.runtimeIndexRoot, 'floors/f-7.json'), ' ');
  assert.throws(() => verifyRuntimeIndexArtifacts(rawMutation), /canonical|identity/);
  const missing = builtFixture(t); fs.rmSync(path.join(missing.runtimeIndexRoot, 'floors/f-7.json'));
  assert.throws(() => verifyRuntimeIndexArtifacts(missing), /missing/);
  const extra = builtFixture(t); write(extra.runtimeIndexRoot, 'stale.json', Buffer.from('{}\n'));
  assert.throws(() => verifyRuntimeIndexArtifacts(extra), /file closure mismatch/);
});

test('pixel bucket verification rejects corrupted bucket and local-max bytes', (t) => {
  const bucket = builtFixture(t); const bucketPath = path.join(bucket.pixelBucketsRoot, 'buckets', fs.readdirSync(path.join(bucket.pixelBucketsRoot, 'buckets'))[0]); fs.writeFileSync(bucketPath, Buffer.from([10, 20, 31, 255]));
  assert.throws(() => verifyPixelBucketArtifacts(bucket), /byte identity|blob bytes/);
  const bundle = builtFixture(t); fs.appendFileSync(path.join(bundle.pixelBucketsRoot, 'local-max/all-pixels.rgba'), Buffer.from([0]));
  assert.throws(() => verifyPixelBucketArtifacts(bundle), /bundle identity/);
});

test('minimap verification rejects corrupt PNG bytes and source coverage omission', (t) => {
  const corrupt = builtFixture(t); const png = path.join(corrupt.minimapRoot, 'tiles/f-7/rx0_ry0.png'); const raw = fs.readFileSync(png); raw[raw.length - 1] ^= 1; fs.writeFileSync(png, raw);
  assert.throws(() => verifyMinimapArtifacts(corrupt), /byte identity|PNG/);
  const missing = builtFixture(t); fs.rmSync(path.join(missing.minimapRoot, 'tiles/f-7/rx0_ry0.png'));
  assert.throws(() => verifyMinimapArtifacts(missing), /missing/);

});

test('minimap oracle rejects re-rooted source pixel and presentation-order mutations', (t) => {
  const pixelMutation = builtFixture(t); reanchorPublicationPixels(pixelMutation, '101', (rgba) => { rgba[0] = 1; return rgba; });
  assert.throws(() => verifyMinimapArtifacts(pixelMutation), /pixel derivation mismatch/);

  const orderMutation = builtFixture(t); reanchorSemanticChunk(orderMutation, (record) => { record.presentation.reverse(); return record; });
  assert.throws(() => verifyMinimapArtifacts(orderMutation), /pixel derivation mismatch/);
});

test('semantic source parser rejects re-rooted blank and noncanonical physical records', (t) => {
  const blank = builtFixture(t); const blankRaw = fs.readFileSync(path.join(blank.publicationRoot, 'semantic/chunks/one.jsonl')); reanchorSemanticChunkRaw(blank, Buffer.concat([blankRaw, Buffer.from('\n')]));
  assert.throws(() => verifyMinimapArtifacts(blank), /empty records/);

  const noncanonical = builtFixture(t); const record = JSON.parse(fs.readFileSync(path.join(noncanonical.publicationRoot, 'semantic/chunks/one.jsonl'), 'utf8')); reanchorSemanticChunkRaw(noncanonical, Buffer.from(`${JSON.stringify(record)} \n`));
  assert.throws(() => verifyMinimapArtifacts(noncanonical), /not canonical JSON/);
});

test('verification rejects wrong roots, re-rooted census lies, symlinks, and source extras', (t) => {
  const wrongRoot = builtFixture(t); wrongRoot.expectedMinimapRoot = `sha256:${'0'.repeat(64)}`;
  assert.throws(() => verifyMinimapArtifacts(wrongRoot), /minimap world root/);

  const census = builtFixture(t); reanchorSemanticCensus(census, (counts) => { counts.tiles += 1; });
  assert.throws(() => verifyMinimapArtifacts(census), /semantic world tiles census/);

  const symlink = builtFixture(t); fs.symlinkSync(path.join(symlink.minimapRoot, 'world.json'), path.join(symlink.minimapRoot, 'alias.json'));
  assert.throws(() => verifyMinimapArtifacts(symlink), /contains symlink/);

  const sourceExtra = builtFixture(t); write(sourceExtra.publicationRoot, 'unclaimed.bin', Buffer.from([0]));
  assert.throws(() => verifyPixelBucketArtifacts(sourceExtra), /publication file closure/);

  const emptyDirectory = builtFixture(t); fs.mkdirSync(path.join(emptyDirectory.runtimeIndexRoot, 'unclaimed'));
  assert.throws(() => verifyRuntimeIndexArtifacts(emptyDirectory), /runtime index directory closure/);
});
