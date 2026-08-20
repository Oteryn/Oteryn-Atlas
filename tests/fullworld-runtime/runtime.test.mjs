import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  PUBLICATION_DOMAIN,
  RUNTIME_WORLD_DOMAIN,
  SEMANTIC_DOMAIN,
  SemanticRangeStore,
  decodeSemanticGroup,
  loadFullWorldPublication,
  loadRuntimeWorld,
  loadSemanticWorld,
  parseFullWorldViewState,
  rootedContentId,
  selectRuntimeGroups,
  serializeFullWorldViewState,
} from '../../src/browser/fullworld.mjs';
import {
  PIXEL_HASH_DOMAIN,
  PIXEL_PROFILE,
  PIXEL_ROOT_DOMAIN,
  loadFullWorldPixelCatalog,
  loadVerifiedPixelPack,
  requiredPixelPacks,
} from '../../src/browser/fullworld-pixels.mjs';
import { canonicalJsonBytes, sha256ContentId } from '../../src/browser/loader.mjs';
import {
  RUNTIME_PIXEL_BUCKET_DOMAIN,
  loadRuntimePixelBuckets,
  loadVerifiedPixelBucket,
  loadVerifiedPixelBundle,
  requiredRuntimePixelBuckets,
} from '../../src/browser/fullworld-pixel-buckets.mjs';

const sha = (pair) => `sha256:${pair.repeat(32)}`;
const sourceFingerprint = sha('11');
const publicationRootPlaceholder = sha('22');
const semanticRootPlaceholder = sha('33');
const pixelRootPlaceholder = sha('44');

function response(bytes, status = 200, headers = {}) {
  return new Response(bytes, { status, headers: { 'content-length': String(bytes.byteLength), ...headers } });
}

function runtimeWorldCore() {
  const floors = Array.from({ length: 16 }, (_, index) => {
    const floor = index - 15;
    return {
      bounds: { x_max_exclusive: 34000, x_min: 1000, y_max_exclusive: 33000, y_min: 1000 },
      bytes: 100,
      counts: { chunks: 1, groups: 1, resolvedPrimitives: 1, sourceBytes: 100, tiles: 1 },
      floor,
      path: `floors/f${floor}.json`,
      rootContentId: sha('55'),
      sourceFloorRoot: sha('66'),
    };
  });
  return {
    counts: { floors: 16, groups: 16, resolvedPrimitives: 16, shards: 16, sourceBytes: 1600, tiles: 16 },
    floors,
    profile: 'oteryn-atlas-fullworld-runtime-index-v0',
    regionSpan: 256,
    rowGroupSpan: 4,
    source: {
      authority: 'Oteryn/Oteryn-Game',
      gameSha: 'a'.repeat(40),
      pixelRoot: pixelRootPlaceholder,
      publicationRoot: publicationRootPlaceholder,
      semanticRoot: semanticRootPlaceholder,
      sourceFingerprint,
    },
    visualBounds: {
      maxDxUnits: 0,
      maxDyUnits: 0,
      maxHeightUnits: 64,
      maxWidthUnits: 64,
      minDxUnits: -32,
      minDyUnits: -24,
      overscanTiles: { bottom: 0, left: 2, right: 0, top: 2 },
    },
  };
}

function semanticRecord(x = 32360, y = 32230) {
  return {
    position: { floor: -7, x, y },
    presentation: [{
      appearance_source_id: 100,
      canonical_entity_id: null,
      entity_identity_state: 'UNRESOLVED',
      export_record_id: 'presentation:test',
      presentation_order: { order: 0, plane: 0 },
      resolved_primitives: [{
        displacement: { dx_units: 0, dy_units: 0 },
        frame_group_id: 2,
        frame_group_type: 2,
        height_units: 32,
        layer_index: 0,
        pattern: { x: 0, y: 0, z: 0 },
        phase: 0,
        source_profile_id: 'oteryn-atlas-15-32-appearance-spatial-v1',
        sprite_source_id: 1,
        visual_coverage_offsets: [{ dx_tiles: 0, dy_tiles: 0 }],
        width_units: 32,
      }],
      source_role: 'ground',
    }],
    record_type: 'tile',
    source_position: { legacy_x: x, legacy_y: y, legacy_z: 7 },
    tile_record_id: 'tile:test',
  };
}

test('full-world deep link round-trips floor, layer and static animation state', () => {
  const world = runtimeWorldCore();
  const state = parseFullWorldViewState('?x=32360.125&y=32230.5&floor=-7&zoom=1.25&layers=minimap-overview&animation=off', world);
  assert.deepEqual(state, { animation: 'off', floor: -7, overview: true, x: 32360.125, y: 32230.5, zoom: 1.25 });
  const serialized = serializeFullWorldViewState(state, world);
  assert.equal(serialized, '?x=32360.125&y=32230.5&floor=-7&zoom=1.25&layers=minimap-overview&animation=off');
  assert.throws(() => parseFullWorldViewState('?floor=1', world), /not exported/);
  assert.throws(() => parseFullWorldViewState('?floor=-7&x=999&y=32230', world), /outside exported floor bounds/);
  assert.throws(() => parseFullWorldViewState('?floor=-7&layers=npcs', world), /not enabled/);
  assert.throws(() => parseFullWorldViewState('?floor=-7&animation=on', world), /not yet supported/);
});

test('runtime spatial index selects only intersecting authenticated row groups', () => {
  const floor = {
    regionSpan: 256,
    chunks: [
      { logicalAddress: { floor: -7, region_x: 126, region_y: 125 }, groups: [{ yMin: 32000, yMaxExclusive: 32004 }, { yMin: 32004, yMaxExclusive: 32008 }] },
      { logicalAddress: { floor: -7, region_x: 127, region_y: 125 }, groups: [{ yMin: 32000, yMaxExclusive: 32004 }] },
    ],
  };
  const selected = selectRuntimeGroups(floor, { x_min: 32260, x_max_exclusive: 32270, y_min: 32003, y_max_exclusive: 32005 });
  assert.equal(selected.length, 2);
  assert.deepEqual(selected.map((entry) => entry.group.yMin), [32000, 32004]);
});

test('authenticated semantic range decodes exact G3 record and rejects corruption', async () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(semanticRecord())}\n`);
  const contentId = await sha256ContentId(bytes);
  const chunk = { bytes: bytes.byteLength, contentId, logicalAddress: { floor: -7, region_x: 126, region_y: 125 }, path: 'chunks/a.jsonl' };
  const group = { bytes: bytes.byteLength, contentId, offset: 0, resolvedPrimitives: 1, tiles: 1, yMin: 32228, yMaxExclusive: 32232 };
  const expected = { chunk, floor: -7, group, regionSpan: 256, visualBounds: runtimeWorldCore().visualBounds };
  const decoded = decodeSemanticGroup(bytes, expected);
  assert.equal(decoded[0].tileRecordId, 'tile:test');
  assert.equal(decoded[0].provenance.authenticatedGroupContentId, contentId);

  const fetcher = async () => response(bytes, 206, { 'content-range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` });
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), { fetcher, cacheByteBudget: 1024 * 1024 });
  const loaded = await store.loadGroup(-7, chunk, group);
  assert.equal(loaded.length, 1);
  assert.equal(store.stats().rangeRequests, 1);
  await store.loadGroup(-7, chunk, group);
  assert.equal(store.stats().rangeRequests, 1, 'second load must hit bounded authenticated cache');

  const corrupt = bytes.slice();
  corrupt[10] ^= 1;
  const badStore = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), {
    fetcher: async () => response(corrupt, 206, { 'content-range': `bytes 0-${corrupt.byteLength - 1}/${corrupt.byteLength}` }),
  });
  await assert.rejects(() => badStore.loadGroup(-7, chunk, group), /identity mismatch/);
});

test('trusted full-world publication and runtime roots fail closed', async () => {
  const pubCore = {
    pixels: { path: 'pixels/manifest.json', rootContentId: pixelRootPlaceholder },
    profile: 'oteryn-atlas-fullworld-publication-v0',
    semantic: { path: 'semantic/world.json', rootContentId: semanticRootPlaceholder },
    serializerStatus: 'PROVISIONAL_NOT_FROZEN',
    source: { authority: 'Oteryn/Oteryn-Game', gameSha: 'a'.repeat(40) },
  };
  const publication = { ...pubCore, rootContentId: await rootedContentId(PUBLICATION_DOMAIN, pubCore) };
  const trust = { pixelRoot: pixelRootPlaceholder, publicationRoot: publication.rootContentId, semanticRoot: semanticRootPlaceholder };
  const pubBytes = canonicalJsonBytes(publication);
  const loaded = await loadFullWorldPublication('https://atlas.example/publication/', trust, async () => response(pubBytes));
  assert.equal(loaded.rootContentId, publication.rootContentId);
  await assert.rejects(() => loadFullWorldPublication('https://atlas.example/publication/', { ...trust, publicationRoot: sha('00') }, async () => response(pubBytes)), /trusted root mismatch/);

  const runtimeCore = runtimeWorldCore();
  runtimeCore.source.publicationRoot = publication.rootContentId;
  const runtime = { ...runtimeCore, rootContentId: await rootedContentId(RUNTIME_WORLD_DOMAIN, runtimeCore) };
  const runtimeBytes = canonicalJsonBytes(runtime);
  const runtimeTrust = { ...trust, publicationRoot: publication.rootContentId, runtimeIndexRoot: runtime.rootContentId, sourceFingerprint };
  const loadedRuntime = await loadRuntimeWorld('https://atlas.example/runtime/', runtimeTrust, async () => response(runtimeBytes));
  assert.equal(loadedRuntime.floors.length, 16);
});

test('semantic world trusted identity accepts exact 16-floor census and rejects forged root', async () => {
  const floors = Array.from({ length: 16 }, (_, index) => ({ floor: index - 15, path: `floors/f${index - 15}.json`, rootContentId: sha('77') }));
  const core = {
    counts: { bytes: 16, floors: 16, resolvedPrimitives: 16, shards: 16, tiles: 16, uniqueSpriteRefs: 1 },
    fabricRoot: sha('88'),
    floors,
    profile: 'oteryn-atlas-fullworld-semantic-publication-v0',
    sourceFingerprint,
  };
  const world = { ...core, rootContentId: await rootedContentId(SEMANTIC_DOMAIN, core) };
  const publication = { semantic: { path: 'semantic/world.json', rootContentId: world.rootContentId } };
  const trust = { semanticRoot: world.rootContentId, sourceFingerprint };
  const bytes = canonicalJsonBytes(world);
  assert.equal((await loadSemanticWorld('https://atlas.example/publication/', publication, trust, async () => response(bytes))).counts.floors, 16);
  const forged = { ...world, rootContentId: sha('00') };
  await assert.rejects(() => loadSemanticWorld('https://atlas.example/publication/', { semantic: { path: 'semantic/world.json', rootContentId: forged.rootContentId } }, { ...trust, semanticRoot: forged.rootContentId }, async () => response(canonicalJsonBytes(forged))), /root mismatch/);
});

test('pixel manifest maps sprite to exact verified pack and rejects pack corruption', async () => {
  const packBytes = new Uint8Array([1, 2, 3, 4]);
  const packSha = (await sha256ContentId(packBytes)).slice(7);
  const blobId = sha('99');
  const core = {
    assetZipSha256: 'a'.repeat(64),
    blobs: [{ bytes: 4, contentId: blobId, height: 1, offset: 0, pack: 0, width: 1 }],
    counts: { dedupeBytesSaved: 0, rawBytesAfterDedupe: 4, rawBytesBeforeDedupe: 4, spriteRefs: 1, uniquePixelBlobs: 1 },
    packs: [{ bytes: 4, identityAuthority: false, path: 'packs/pack-0000.rgba', sha256: packSha }],
    pixelHashDomain: PIXEL_HASH_DOMAIN,
    profile: PIXEL_PROFILE,
    runtimePlacement: { identityAuthority: false },
    spriteIndex: { '1': { contentId: blobId, height: 1, width: 1 } },
  };
  const manifest = { ...core, rootContentId: await rootedContentId(PIXEL_ROOT_DOMAIN, core) };
  const manifestBytes = canonicalJsonBytes(manifest);
  const publication = { pixels: { path: 'pixels/manifest.json', rootContentId: manifest.rootContentId } };
  const trust = { pixelRoot: manifest.rootContentId };
  const fetcher = async (url) => String(url).endsWith('manifest.json') ? response(manifestBytes) : response(packBytes);
  const catalog = await loadFullWorldPixelCatalog('https://atlas.example/publication/', publication, trust, fetcher);
  assert.deepEqual(requiredPixelPacks([{ primitive: { spriteSourceId: 1 } }], catalog), [0]);
  assert.deepEqual([...await loadVerifiedPixelPack(catalog, 0, fetcher)], [1, 2, 3, 4]);
  const corrupt = new Uint8Array([1, 2, 3, 5]);
  await assert.rejects(() => loadVerifiedPixelPack(catalog, 0, async () => response(corrupt)), /SHA-256 mismatch/);
});

test('runtime pixel bucket catalog verifies trusted root and selects only required stable bucket', async () => {
  const raw = new Uint8Array([1, 2, 3, 4]);
  const bucketId = await sha256ContentId(raw);
  const blobId = sha('99');
  const core = {
    blobIndex: { [blobId]: { bucket: '99', bytes: 4, height: 1, offset: 0, width: 1 } },
    bucketNibbles: 2,
    buckets: [{ blobCount: 1, bucket: '99', bytes: 4, contentId: bucketId, identityAuthority: false, path: 'buckets/99.rgba', sha256: bucketId.slice(7) }],
    counts: { blobs: 1, buckets: 1, bytes: 4 },
    localMaxBundle: { path: 'local-max/all-pixels.rgba', bytes: 4, sha256: bucketId.slice(7), contentId: bucketId, identityAuthority: false, bucketOffsets: [{ bucket: '99', offset: 0, bytes: 4 }] },
    identityAuthority: false,
    profile: 'oteryn-atlas-runtime-pixel-buckets-v0',
    source: { authority: 'Oteryn/Oteryn-Game', pixelRoot: pixelRootPlaceholder, publicationRoot: publicationRootPlaceholder },
  };
  const prefix = new TextEncoder().encode(RUNTIME_PIXEL_BUCKET_DOMAIN);
  const bytes = canonicalJsonBytes(core);
  const joined = new Uint8Array(prefix.length + bytes.length); joined.set(prefix); joined.set(bytes, prefix.length);
  const manifest = { ...core, rootContentId: await sha256ContentId(joined) };
  const manifestBytes = canonicalJsonBytes(manifest);
  const trust = { pixelBucketRoot: manifest.rootContentId, pixelRoot: pixelRootPlaceholder, publicationRoot: publicationRootPlaceholder };
  const fetcher = async (url) => String(url).endsWith('manifest.json') ? response(manifestBytes) : response(raw);
  const runtimeCatalog = await loadRuntimePixelBuckets('https://atlas.example/runtime-pixels/', trust, fetcher);
  const sourceCatalog = { sprites: new Map([[1, { contentId: blobId, height: 1, width: 1 }]]) };
  assert.deepEqual(requiredRuntimePixelBuckets([{ primitive: { spriteSourceId: 1 } }], sourceCatalog, runtimeCatalog), ['99']);
  assert.deepEqual([...await loadVerifiedPixelBucket(runtimeCatalog, '99', fetcher)], [1, 2, 3, 4]);
  assert.deepEqual([...await loadVerifiedPixelBundle(runtimeCatalog, fetcher)], [1, 2, 3, 4]);
  await assert.rejects(() => loadVerifiedPixelBucket(runtimeCatalog, '99', async () => response(new Uint8Array([1, 2, 3, 5]))), /identity mismatch/);
});

test('runtime-index Python builder self-test is part of browser contract CI', () => {
  execFileSync('python', ['tests/fullworld-runtime/runtime_index_self_test.py'], { cwd: process.cwd(), stdio: 'pipe' });
});

test('large semantic chunks fail closed when HTTP byte ranges are not supported', async () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(semanticRecord())}\n`);
  const groupId = await sha256ContentId(bytes);
  const chunk = {
    bytes: 9 * 1024 * 1024,
    contentId: sha('aa'),
    logicalAddress: { floor: -7, region_x: 126, region_y: 125 },
    path: 'chunks/large.jsonl',
  };
  const group = {
    bytes: bytes.byteLength,
    contentId: groupId,
    offset: 0,
    resolvedPrimitives: 1,
    tiles: 1,
    yMin: 32228,
    yMaxExclusive: 32232,
  };
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), {
    fetcher: async () => response(bytes, 200),
  });
  await assert.rejects(() => store.loadGroup(-7, chunk, group), /must support HTTP byte ranges/);
});

test('incremental content graph self-test proves selective invalidation', () => {
  execFileSync('python', ['tests/fullworld-runtime/incremental_content_graph_self_test.py'], { cwd: process.cwd(), stdio: 'pipe' });
});
