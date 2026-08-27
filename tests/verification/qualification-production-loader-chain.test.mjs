import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  flattenRenderRecords,
  loadFullWorldPublication,
  loadRuntimeFloor,
  loadRuntimeWorld,
  loadSemanticFloor,
  loadSemanticWorld,
  selectRuntimeGroups,
  SemanticRangeStore,
} from '../../src/browser/fullworld.mjs';
import { loadFullWorldPixelCatalog, loadVerifiedPixelPack, requiredPixelPacks } from '../../src/browser/fullworld-pixels.mjs';
import { loadRuntimePixelBuckets, loadVerifiedPixelBucket, requiredRuntimePixelBuckets } from '../../src/browser/fullworld-pixel-buckets.mjs';
import { resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';
import { loadMinimapFloor, loadMinimapWorld, loadVerifiedMinimapTile, selectMinimapChunks } from '../../src/layers/minimap.mjs';
import { loadOverviewChunk, loadOverviewFloor, loadOverviewWorld } from '../../src/layers/overview.mjs';
import { buildQualificationWorld } from '../../tools/verification/qualification-world.mjs';

function response(bytes, status = 200, extraHeaders = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => ({ 'content-length': String(bytes.byteLength), ...extraHeaders })[name.toLowerCase()] ?? null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

function filesystemFetcher(root) {
  return async (input, options = {}) => {
    const url = new URL(input);
    if (!url.pathname.startsWith('/fullworld/')) return response(new Uint8Array(), 404);
    const relative = url.pathname.slice('/fullworld/'.length);
    const target = path.join(root, ...relative.split('/'));
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) return response(new Uint8Array(), 404);
    const bytes = fs.readFileSync(target);
    const range = options.headers?.Range ?? options.headers?.range;
    if (!range) return response(bytes);
    const match = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (!match) return response(new Uint8Array(), 416);
    const start = Number(match[1]);
    const end = Number(match[2]);
    const slice = bytes.subarray(start, end + 1);
    return response(slice, 206, { 'content-range': `bytes ${start}-${end}/${bytes.byteLength}` });
  };
}

test('qualification world traverses production manifests, floors, authenticated range, pixels and render records', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-chain-'));
  const root = path.join(temporary, 'fixture');
  try {
    const manifest = await buildQualificationWorld(root);
    const trust = resolveFullWorldTrust(manifest);
    const fetcher = filesystemFetcher(root);
    const publicationBase = new URL('https://qualification.invalid/fullworld/publication/');

    const publication = await loadFullWorldPublication(publicationBase, trust, fetcher);
    const semanticWorld = await loadSemanticWorld(publicationBase, publication, trust, fetcher);
    const semanticEntry = semanticWorld.floors.find((entry) => entry.floor === -7);
    const semanticFloor = await loadSemanticFloor(publicationBase, publication, semanticWorld, semanticEntry, fetcher);
    assert.equal(semanticFloor.chunks.length, 1);

    const runtimeBase = new URL('https://qualification.invalid/fullworld/runtime-index/');
    const runtimeWorld = await loadRuntimeWorld(runtimeBase, trust, fetcher);
    const runtimeEntry = runtimeWorld.floors.find((entry) => entry.floor === -7);
    const runtimeFloor = await loadRuntimeFloor(runtimeBase, runtimeWorld, runtimeEntry, fetcher);
    const selected = selectRuntimeGroups(runtimeFloor, { x_min: 32280, x_max_exclusive: 32281, y_min: 32155, y_max_exclusive: 32156 });
    assert.equal(selected.length, 1);

    const rangeStore = new SemanticRangeStore(new URL('semantic/', publicationBase), runtimeWorld, { fetcher });
    const tiles = await rangeStore.loadGroup(runtimeFloor, selected[0].chunk, selected[0].group);
    assert.equal(tiles.length, 1);
    assert.deepEqual(rangeStore.stats(), {
      cacheBytes: selected[0].group.bytes,
      cachedGroups: 1,
      cacheHits: 0,
      cacheMisses: 1,
      persistentHits: 0,
      networkBytes: selected[0].group.bytes,
      rangeRequests: 1,
    });
    const records = flattenRenderRecords(tiles);
    assert.equal(records.length, 1);
    assert.equal(records[0].primitive.spriteSourceId, 1);

    const pixels = await loadFullWorldPixelCatalog(publicationBase, publication, trust, fetcher);
    assert.deepEqual(requiredPixelPacks(records, pixels), [0]);
    const pixelPack = await loadVerifiedPixelPack(pixels, 0, fetcher);
    assert.equal(pixelPack.byteLength, 32 * 32 * 4);

    const bucketCatalog = await loadRuntimePixelBuckets(new URL('https://qualification.invalid/fullworld/pixel-buckets/'), trust, fetcher);
    const bucketIds = requiredRuntimePixelBuckets(records, pixels, bucketCatalog);
    assert.equal(bucketIds.length, 1);
    assert.equal((await loadVerifiedPixelBucket(bucketCatalog, bucketIds[0], fetcher)).byteLength, 32 * 32 * 4);

    const overviewBase = new URL('https://qualification.invalid/fullworld/overview/');
    const overviewWorld = await loadOverviewWorld(new URL('world.json', overviewBase), {
      rootContentId: trust.overviewRoot,
      sourcePublicationRoot: trust.publicationRoot,
    }, fetcher);
    const overviewEntry = overviewWorld.floors.find((entry) => entry.floor === -7);
    const overviewFloor = await loadOverviewFloor(overviewBase, overviewWorld, overviewEntry, fetcher);
    assert.equal(overviewFloor.chunks.length, 1);
    const overviewChunk = await loadOverviewChunk(overviewBase, overviewWorld, overviewFloor, overviewFloor.chunks[0], fetcher);
    assert.equal(overviewChunk.counts.tiles, 1);

    const minimapBase = new URL('https://qualification.invalid/fullworld/minimap/');
    const minimapWorld = await loadMinimapWorld(minimapBase, {
      rootContentId: trust.minimapRoot,
      publicationRoot: trust.publicationRoot,
      pixelRoot: trust.pixelRoot,
    }, fetcher);
    const minimapEntry = minimapWorld.floors.find((entry) => entry.floor === -7);
    const minimapFloor = await loadMinimapFloor(minimapBase, minimapWorld, minimapEntry, fetcher);
    const minimapChunks = selectMinimapChunks(minimapFloor, { x_min: 32280, x_max_exclusive: 32281, y_min: 32155, y_max_exclusive: 32156 });
    assert.equal(minimapChunks.length, 1);
    const png = await loadVerifiedMinimapTile(minimapBase, minimapChunks[0], fetcher);
    assert.equal(new TextDecoder().decode(png.subarray(1, 4)), 'PNG');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
