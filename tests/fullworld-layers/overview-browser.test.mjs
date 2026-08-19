import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJsonBytes, sha256ContentId } from '../../src/browser/loader.mjs';
import {
  computeOverviewRoot,
  loadOverviewChunk,
  loadOverviewFloor,
  loadOverviewWorld,
  overviewDomains,
  queryOverviewCells,
} from '../../src/layers/overview.mjs';

async function fixture() {
  const sourceFingerprint = `sha256:${'11'.repeat(32)}`;
  const chunk = {
    cellSizeTiles: 16,
    cells: [
      { cell_x: 2, cell_y: 3, resolvedPrimitives: 4, tiles: 5 },
      { cell_x: 3, cell_y: 3, resolvedPrimitives: 1, tiles: 2 },
    ],
    counts: { cells: 2, resolvedPrimitives: 5, tiles: 7 },
    logicalAddress: { floor: -7, region_x: 0, region_y: 0 },
    profile: 'oteryn-atlas-overview-chunk-v0',
    sourceContentId: `sha256:${'22'.repeat(32)}`,
    sourceFingerprint,
  };
  const chunkBytes = canonicalJsonBytes(chunk);
  const chunkEntry = {
    bytes: chunkBytes.byteLength,
    cellBounds: { cell_x_min: 2, cell_x_max_exclusive: 4, cell_y_min: 3, cell_y_max_exclusive: 4 },
    contentId: await sha256ContentId(chunkBytes),
    counts: chunk.counts,
    logicalAddress: chunk.logicalAddress,
    path: 'chunks/a.json',
    sourceContentId: chunk.sourceContentId,
  };
  const floor = {
    bounds: { x_max_exclusive: 64, x_min: 0, y_max_exclusive: 64, y_min: 0 },
    cellSizeTiles: 16,
    chunks: [chunkEntry],
    counts: { cells: 2, chunks: 1, resolvedPrimitives: 5, tiles: 7 },
    floor: -7,
    profile: 'oteryn-atlas-overview-floor-v0',
    sourceFingerprint,
    sourceFloorRoot: `sha256:${'33'.repeat(32)}`,
  };
  floor.rootContentId = await computeOverviewRoot(floor, overviewDomains.floor);
  const floorBytes = canonicalJsonBytes(floor);
  const world = {
    cellSizeTiles: 16,
    counts: { cells: 2, chunks: 1, floors: 1, resolvedPrimitives: 5, tiles: 7 },
    floors: [{ bytes: floorBytes.byteLength, counts: floor.counts, floor: -7, path: 'floors/f-7.json', rootContentId: floor.rootContentId, sourceFloorRoot: floor.sourceFloorRoot }],
    profile: 'oteryn-atlas-overview-world-v0',
    semantics: { collision: 'NOT_CLAIMED', meaning: 'semantic tile presence density only', terrainClassification: 'NOT_CLAIMED', walkability: 'NOT_CLAIMED' },
    source: { authority: 'Oteryn/Oteryn-Game', gameSha: 'a'.repeat(40), publicationRoot: `sha256:${'44'.repeat(32)}`, semanticRoot: `sha256:${'55'.repeat(32)}`, sourceFingerprint },
  };
  world.rootContentId = await computeOverviewRoot(world, overviewDomains.world);
  return { chunk, chunkBytes, floor, floorBytes, world, worldBytes: canonicalJsonBytes(world) };
}

function fetcherFor(map) {
  return async (url) => {
    const bytes = map.get(String(url));
    if (!bytes) return new Response('missing', { status: 404 });
    return new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.byteLength) } });
  };
}

test('overview loader verifies world/floor/chunk and supports viewport query', async () => {
  const f = await fixture();
  const base = 'https://atlas.example/layers/overview/';
  const fetcher = fetcherFor(new Map([
    [`${base}world.json`, f.worldBytes],
    [`${base}floors/f-7.json`, f.floorBytes],
    [`${base}chunks/a.json`, f.chunkBytes],
  ]));
  const world = await loadOverviewWorld(`${base}world.json`, { rootContentId: f.world.rootContentId, sourcePublicationRoot: f.world.source.publicationRoot }, fetcher);
  const floor = await loadOverviewFloor(base, world, world.floors[0], fetcher);
  const chunk = await loadOverviewChunk(base, world, floor, floor.chunks[0], fetcher);
  assert.deepEqual(queryOverviewCells(chunk, { x_min: 32, x_max_exclusive: 48, y_min: 48, y_max_exclusive: 64 }), [f.chunk.cells[0]]);
});

test('overview world rejects an untrusted overview root', async () => {
  const f = await fixture();
  const base = 'https://atlas.example/layers/overview/';
  const fetcher = fetcherFor(new Map([[`${base}world.json`, f.worldBytes]]));
  await assert.rejects(
    () => loadOverviewWorld(`${base}world.json`, { rootContentId: `sha256:${'00'.repeat(32)}`, sourcePublicationRoot: f.world.source.publicationRoot }, fetcher),
    /does not match trusted root/,
  );
});

test('overview world rejects an untrusted source publication root', async () => {
  const f = await fixture();
  const base = 'https://atlas.example/layers/overview/';
  const fetcher = fetcherFor(new Map([[`${base}world.json`, f.worldBytes]]));
  await assert.rejects(
    () => loadOverviewWorld(`${base}world.json`, { rootContentId: f.world.rootContentId, sourcePublicationRoot: `sha256:${'00'.repeat(32)}` }, fetcher),
    /source publication root does not match trusted root/,
  );
});

test('overview chunk corruption fails closed', async () => {
  const f = await fixture();
  const base = 'https://atlas.example/layers/overview/';
  const corrupt = new Uint8Array([...f.chunkBytes, 0x20]);
  const fetcher = fetcherFor(new Map([[`${base}chunks/a.json`, corrupt]]));
  await assert.rejects(() => loadOverviewChunk(base, f.world, f.floor, f.floor.chunks[0], fetcher), /byte count mismatch|content identity mismatch/);
});
