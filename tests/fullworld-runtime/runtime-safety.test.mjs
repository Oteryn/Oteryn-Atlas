import assert from 'node:assert/strict';
import test from 'node:test';

import { loadChunk, loadManifest, sha256ContentId } from '../../src/browser/loader.mjs';
import { FullWorldError, SemanticRangeStore, safeRelativePath } from '../../src/browser/fullworld.mjs';
import { loadVerifiedPixelBucket } from '../../src/browser/fullworld-pixel-buckets.mjs';
import { loadVerifiedPixelPack } from '../../src/browser/fullworld-pixels.mjs';
import { VerifiedContentCache } from '../../src/browser/verified-content-cache.mjs';

const sha = (pair) => `sha256:${pair.repeat(32)}`;

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

function runtimeWorldCore() {
  return {
    regionSpan: 256,
    rowGroupSpan: 4,
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

function response(bytes, status = 200, headers = {}) {
  return new Response(bytes, { status, headers });
}

async function semanticFixture() {
  const bytes = new TextEncoder().encode(`${JSON.stringify(semanticRecord())}\n`);
  const contentId = await sha256ContentId(bytes);
  const chunk = {
    bytes: bytes.byteLength,
    contentId,
    logicalAddress: { floor: -7, region_x: 126, region_y: 125 },
    path: 'chunks/a.jsonl',
  };
  const group = {
    bytes: bytes.byteLength,
    contentId,
    offset: 0,
    resolvedPrimitives: 1,
    tiles: 1,
    yMin: 32228,
    yMaxExclusive: 32232,
  };
  return { bytes, chunk, group };
}

test('F05 bounded loader consumes the stream and never falls back to unbounded arrayBuffer', async () => {
  let arrayBufferCalled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(200 * 1024));
      controller.enqueue(new Uint8Array(100 * 1024));
      controller.close();
    },
  });
  const oversized = {
    ok: true,
    status: 200,
    headers: new Headers(),
    body,
    async arrayBuffer() {
      arrayBufferCalled = true;
      throw new Error('unbounded arrayBuffer must not be called');
    },
  };
  await assert.rejects(() => loadManifest('https://atlas.example/manifest.json', async () => oversized), /manifest bytes exceed proof limit/);
  assert.equal(arrayBufferCalled, false);
});

test('F08 loader rejects encoded traversal before invoking the fetcher', async () => {
  let fetches = 0;
  const entry = { bytes: 1, contentId: sha('11'), path: '%2e%2e/escape.json' };
  await assert.rejects(
    () => loadChunk('https://atlas.example/data/', entry, {}, async () => { fetches += 1; return response(new Uint8Array([0])); }),
    /unsafe|confined|relative path/i,
  );
  assert.equal(fetches, 0);
});

test('F08 generic loader rejects scheme-like path before invoking the fetcher', async () => {
  let fetches = 0;
  const entry = { bytes: 1, contentId: sha('11'), path: 'http:evil.example/escape.json' };
  await assert.rejects(
    () => loadChunk('http://atlas.example/data/', entry, {}, async () => { fetches += 1; return response(new Uint8Array([0])); }),
    /unsafe|relative path/i,
  );
  assert.equal(fetches, 0);
});

test('F08 full-world path validation rejects encoded and scheme escapes', () => {
  assert.throws(() => safeRelativePath('%2e%2e/escape.json'), /unsafe path/);
  assert.throws(() => safeRelativePath('safe/%2fescape.json'), /unsafe path/);
  assert.throws(() => safeRelativePath('http:evil.example/escape.json'), /unsafe path/);
  assert.equal(safeRelativePath('chunks/f-7/a.jsonl'), 'chunks/f-7/a.jsonl');
});

test('F04 VerifiedContentCache treats CacheStorage failures as optimization misses', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const contentId = await sha256ContentId(bytes);
  const cache = new VerifiedContentCache({
    cacheStorage: { async open() { throw new Error('cache storage unavailable'); } },
    enabled: true,
    maxEntryBytes: 1024,
  });
  assert.equal(await cache.get(contentId, bytes.byteLength), null);
  assert.equal(await cache.put(contentId, bytes), false);
  assert.equal(cache.stats().errors, 2);
});

test('F04 semantic store falls back to verified network bytes when persistent get fails', async () => {
  const { bytes, chunk, group } = await semanticFixture();
  let fetches = 0;
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), {
    persistentCache: { async get() { throw new Error('cache read failed'); }, async put() { return true; } },
    fetcher: async () => {
      fetches += 1;
      return response(bytes, 206, { 'content-range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` });
    },
  });
  const tiles = await store.loadGroup(-7, chunk, group);
  assert.equal(tiles[0].x, 32360);
  assert.equal(fetches, 1);
  assert.equal(store.stats().persistentErrors, 1);
});

test('F04 semantic store ignores persistent put failures after verified network retrieval', async () => {
  const { bytes, chunk, group } = await semanticFixture();
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), {
    persistentCache: { async get() { return null; }, async put() { throw new Error('cache write failed'); } },
    fetcher: async () => response(bytes, 206, { 'content-range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` }),
  });
  const tiles = await store.loadGroup(-7, chunk, group);
  assert.equal(tiles[0].x, 32360);
  assert.equal(store.stats().persistentErrors, 1);
});

test('F04 corrupt persistent bytes are rejected and replaced by verified network bytes', async () => {
  const { bytes, chunk, group } = await semanticFixture();
  const corrupt = new TextEncoder().encode(`${JSON.stringify(semanticRecord(32361))}\n`);
  assert.equal(corrupt.byteLength, bytes.byteLength, 'fixture requires equal byte length');
  let fetches = 0;
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), {
    persistentCache: { async get() { return corrupt; }, async put() { return true; } },
    fetcher: async () => {
      fetches += 1;
      return response(bytes, 206, { 'content-range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` });
    },
  });
  const tiles = await store.loadGroup(-7, chunk, group);
  assert.equal(tiles[0].x, 32360);
  assert.equal(fetches, 1);
  assert.equal(store.stats().persistentErrors, 1);
});

test('F04 pixel-pack cache failure degrades to digest-verified network retrieval', async () => {
  const bytes = new Uint8Array([9, 8, 7, 6]);
  const contentId = await sha256ContentId(bytes);
  let fetches = 0;
  const catalog = {
    packs: [{ bytes: bytes.byteLength, path: 'packs/a.bin', sha256: contentId.slice(7) }],
    pixelBaseUrl: new URL('https://atlas.example/pixels/'),
  };
  const loaded = await loadVerifiedPixelPack(catalog, 0, async () => {
    fetches += 1;
    return response(bytes, 200, { 'content-length': String(bytes.byteLength) });
  }, {
    persistentCache: {
      async get() { throw new Error('cache read failed'); },
      async put() { throw new Error('cache write failed'); },
    },
  });
  assert.deepEqual([...loaded], [...bytes]);
  assert.equal(fetches, 1);
});

test('F04 pixel-bucket corrupt cache bytes degrade to digest-verified network retrieval', async () => {
  const bytes = new Uint8Array([4, 3, 2, 1]);
  const contentId = await sha256ContentId(bytes);
  let fetches = 0;
  const catalog = {
    baseUrl: new URL('https://atlas.example/runtime-pixels/'),
    buckets: new Map([['a', { bytes: bytes.byteLength, contentId, path: 'buckets/a.bin' }]]),
  };
  const loaded = await loadVerifiedPixelBucket(catalog, 'a', async () => {
    fetches += 1;
    return response(bytes, 200, { 'content-length': String(bytes.byteLength) });
  }, {
    persistentCache: {
      async get() { return new Uint8Array([4, 3, 2, 0]); },
      async put() { throw new Error('cache write failed'); },
    },
    timeoutMs: 1_000,
  });
  assert.deepEqual([...loaded], [...bytes]);
  assert.equal(fetches, 1);
});

test('F07 same-key concurrent semantic loads share one in-flight retrieval', async () => {
  const { bytes, chunk, group } = await semanticFixture();
  let fetches = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), {
    fetcher: async () => {
      fetches += 1;
      await gate;
      return response(bytes, 206, { 'content-range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` });
    },
  });
  const first = store.loadGroup(-7, chunk, group);
  const second = store.loadGroup(-7, chunk, group);
  await Promise.resolve();
  assert.equal(fetches, 1);
  release();
  const [left, right] = await Promise.all([first, second]);
  assert.strictEqual(left, right);
  assert.equal(store.stats().rangeRequests, 1);
  assert.equal(store.stats().inflightHits, 1);
});

test('F07 replacing the same cache key does not double-account resident bytes', () => {
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), { cacheByteBudget: 1024 });
  const group = { bytes: 64 };
  store.remember('same-key', group, Object.freeze([]));
  store.remember('same-key', group, Object.freeze([]));
  assert.equal(store.stats().cacheBytes, 64);
  assert.equal(store.stats().cachedGroups, 1);
});

test('F08 trusted URL confinement rejects normalized escape even when text looks relative', async () => {
  const { bytes, chunk, group } = await semanticFixture();
  const escaped = { ...chunk, path: '%2e%2e/outside.jsonl' };
  let fetches = 0;
  const store = new SemanticRangeStore('https://atlas.example/semantic/', runtimeWorldCore(), {
    fetcher: async () => { fetches += 1; return response(bytes, 206, { 'content-range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` }); },
  });
  await assert.rejects(() => store.loadGroup(-7, escaped, group), FullWorldError);
  assert.equal(fetches, 0);
});
