import { canonicalJsonBytes, sha256ContentId } from '../browser/loader.mjs';

const WORLD_PROFILE = 'oteryn-atlas-overview-world-v0';
const FLOOR_PROFILE = 'oteryn-atlas-overview-floor-v0';
const CHUNK_PROFILE = 'oteryn-atlas-overview-chunk-v0';
const WORLD_DOMAIN = 'OTERYN-ATLAS-OVERVIEW-WORLD-V0\0';
const FLOOR_DOMAIN = 'OTERYN-ATLAS-OVERVIEW-FLOOR-V0\0';
const MAX_WORLD_BYTES = 512 * 1024;
const MAX_FLOOR_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_BYTES = 512 * 1024;

export class OverviewLoadError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new OverviewLoadError(message);
}

function safeRelativePath(path) {
  requireValue(typeof path === 'string' && path.length > 0, 'overview path missing');
  requireValue(!path.startsWith('/') && !path.includes('\\'), 'unsafe overview path');
  const parts = path.split('/');
  requireValue(!parts.some((part) => part === '..' || part === '.' || part === ''), 'unsafe overview path');
  return path;
}

function joinBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export async function computeOverviewRoot(value, domain) {
  const core = { ...value };
  delete core.rootContentId;
  const prefix = new TextEncoder().encode(domain);
  return sha256ContentId(joinBytes(prefix, canonicalJsonBytes(core)));
}

async function readBounded(response, limit, label) {
  requireValue(response?.ok, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared !== null && declared !== undefined) requireValue(Number(declared) <= limit, `${label} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= limit, `${label} bytes exceed limit`);
  return bytes;
}

function decodeCanonical(bytes, label) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new OverviewLoadError(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
  const canonical = canonicalJsonBytes(value);
  requireValue(canonical.byteLength === bytes.byteLength && canonical.every((byte, index) => byte === bytes[index]), `${label} is not canonical JSON`);
  return value;
}

function validateCounts(value, keys, label) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), `${label} counts missing`);
  for (const key of keys) requireValue(Number.isSafeInteger(value[key]) && value[key] >= 0, `${label} invalid count ${key}`);
}

export function validateOverviewWorld(world) {
  requireValue(world?.profile === WORLD_PROFILE, 'unsupported overview world profile');
  requireValue(Number.isSafeInteger(world.cellSizeTiles) && world.cellSizeTiles > 0, 'invalid overview cell size');
  requireValue(world.source?.authority === 'Oteryn/Oteryn-Game', 'overview Game authority missing');
  requireValue(world.semantics?.walkability === 'NOT_CLAIMED', 'overview must not claim walkability');
  requireValue(world.semantics?.collision === 'NOT_CLAIMED', 'overview must not claim collision');
  requireValue(world.semantics?.terrainClassification === 'NOT_CLAIMED', 'overview must not claim terrain classification');
  requireValue(Array.isArray(world.floors) && world.floors.length > 0, 'overview floors missing');
  validateCounts(world.counts, ['cells', 'chunks', 'floors', 'resolvedPrimitives', 'tiles'], 'world');
  const floors = new Set();
  for (const entry of world.floors) {
    requireValue(Number.isSafeInteger(entry.floor) && !floors.has(entry.floor), 'invalid or duplicate overview floor');
    floors.add(entry.floor);
    safeRelativePath(entry.path);
    requireValue(typeof entry.rootContentId === 'string' && entry.rootContentId.startsWith('sha256:'), 'invalid overview floor root');
  }
  requireValue(world.counts.floors === world.floors.length, 'overview floor count mismatch');
  return world;
}

export function validateOverviewFloor(floor, world, expectedEntry) {
  requireValue(floor?.profile === FLOOR_PROFILE, 'unsupported overview floor profile');
  requireValue(floor.floor === expectedEntry.floor, 'overview floor identity mismatch');
  requireValue(floor.rootContentId === expectedEntry.rootContentId, 'overview floor root linkage mismatch');
  requireValue(floor.cellSizeTiles === world.cellSizeTiles, 'overview floor cell size mismatch');
  requireValue(floor.sourceFingerprint === world.source.sourceFingerprint, 'overview floor source fingerprint mismatch');
  requireValue(Array.isArray(floor.chunks), 'overview floor chunks missing');
  validateCounts(floor.counts, ['cells', 'chunks', 'resolvedPrimitives', 'tiles'], `floor ${floor.floor}`);
  const addresses = new Set();
  for (const entry of floor.chunks) {
    const logical = entry.logicalAddress;
    requireValue(logical?.floor === floor.floor && Number.isSafeInteger(logical.region_x) && Number.isSafeInteger(logical.region_y), 'invalid overview chunk logical address');
    const key = `${logical.floor}:${logical.region_x}:${logical.region_y}`;
    requireValue(!addresses.has(key), 'duplicate overview chunk logical address');
    addresses.add(key);
    safeRelativePath(entry.path);
    requireValue(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_CHUNK_BYTES, 'invalid overview chunk bytes');
    requireValue(typeof entry.contentId === 'string' && entry.contentId.startsWith('sha256:'), 'invalid overview chunk content id');
    requireValue(typeof entry.sourceContentId === 'string' && entry.sourceContentId.startsWith('sha256:'), 'invalid overview source content id');
  }
  requireValue(floor.counts.chunks === floor.chunks.length, 'overview floor chunk count mismatch');
  return floor;
}

export function validateOverviewChunk(chunk, world, floor, entry) {
  requireValue(chunk?.profile === CHUNK_PROFILE, 'unsupported overview chunk profile');
  requireValue(JSON.stringify(chunk.logicalAddress) === JSON.stringify(entry.logicalAddress), 'overview chunk logical identity mismatch');
  requireValue(chunk.sourceContentId === entry.sourceContentId, 'overview chunk source linkage mismatch');
  requireValue(chunk.sourceFingerprint === world.source.sourceFingerprint, 'overview chunk source fingerprint mismatch');
  requireValue(chunk.cellSizeTiles === world.cellSizeTiles, 'overview chunk cell size mismatch');
  requireValue(Array.isArray(chunk.cells), 'overview chunk cells missing');
  validateCounts(chunk.counts, ['cells', 'resolvedPrimitives', 'tiles'], 'chunk');
  let last = null;
  let tiles = 0;
  let primitives = 0;
  for (const cell of chunk.cells) {
    requireValue(Number.isSafeInteger(cell.cell_x) && Number.isSafeInteger(cell.cell_y), 'invalid overview cell coordinate');
    requireValue(Number.isSafeInteger(cell.tiles) && cell.tiles > 0, 'invalid overview cell tile count');
    requireValue(Number.isSafeInteger(cell.resolvedPrimitives) && cell.resolvedPrimitives >= 0, 'invalid overview cell primitive count');
    const coord = [cell.cell_x, cell.cell_y];
    requireValue(last === null || coord[0] > last[0] || (coord[0] === last[0] && coord[1] > last[1]), 'duplicate or unsorted overview cells');
    last = coord;
    tiles += cell.tiles;
    primitives += cell.resolvedPrimitives;
  }
  requireValue(chunk.counts.cells === chunk.cells.length && chunk.counts.tiles === tiles && chunk.counts.resolvedPrimitives === primitives, 'overview chunk count mismatch');
  requireValue(JSON.stringify(chunk.counts) === JSON.stringify(entry.counts), 'overview chunk/index count mismatch');
  return chunk;
}

export async function loadOverviewWorld(url, expected, fetcher = fetch) {
  requireValue(expected && typeof expected === 'object', 'trusted overview expectations required');
  requireValue(typeof expected.rootContentId === 'string' && /^sha256:[0-9a-f]{64}$/.test(expected.rootContentId), 'trusted overview root required');
  requireValue(typeof expected.sourcePublicationRoot === 'string' && /^sha256:[0-9a-f]{64}$/.test(expected.sourcePublicationRoot), 'trusted source publication root required');
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBounded(response, MAX_WORLD_BYTES, 'overview world');
  const world = validateOverviewWorld(decodeCanonical(bytes, 'overview world'));
  requireValue(world.rootContentId === await computeOverviewRoot(world, WORLD_DOMAIN), 'overview world root mismatch');
  requireValue(world.rootContentId === expected.rootContentId, 'overview world root does not match trusted root');
  requireValue(world.source.publicationRoot === expected.sourcePublicationRoot, 'overview source publication root does not match trusted root');
  return world;
}

export async function loadOverviewFloor(baseUrl, world, entry, fetcher = fetch) {
  const url = new URL(safeRelativePath(entry.path), baseUrl).toString();
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBounded(response, MAX_FLOOR_BYTES, 'overview floor');
  const floor = validateOverviewFloor(decodeCanonical(bytes, 'overview floor'), world, entry);
  requireValue(floor.rootContentId === await computeOverviewRoot(floor, FLOOR_DOMAIN), 'overview floor root mismatch');
  return floor;
}

export async function loadOverviewChunk(baseUrl, world, floor, entry, fetcher = fetch) {
  const url = new URL(safeRelativePath(entry.path), baseUrl).toString();
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBounded(response, MAX_CHUNK_BYTES, 'overview chunk');
  requireValue(bytes.byteLength === entry.bytes, 'overview chunk byte count mismatch');
  requireValue(await sha256ContentId(bytes) === entry.contentId, 'overview chunk content identity mismatch');
  return validateOverviewChunk(decodeCanonical(bytes, 'overview chunk'), world, floor, entry);
}

export function queryOverviewCells(chunk, tileBounds) {
  requireValue(tileBounds && Number.isFinite(tileBounds.x_min) && Number.isFinite(tileBounds.x_max_exclusive) && Number.isFinite(tileBounds.y_min) && Number.isFinite(tileBounds.y_max_exclusive), 'invalid overview query bounds');
  const size = chunk.cellSizeTiles;
  return chunk.cells.filter((cell) => {
    const x0 = cell.cell_x * size;
    const y0 = cell.cell_y * size;
    return x0 < tileBounds.x_max_exclusive && x0 + size > tileBounds.x_min && y0 < tileBounds.y_max_exclusive && y0 + size > tileBounds.y_min;
  });
}

export const overviewProfiles = Object.freeze({ world: WORLD_PROFILE, floor: FLOOR_PROFILE, chunk: CHUNK_PROFILE });
export const overviewDomains = Object.freeze({ world: WORLD_DOMAIN, floor: FLOOR_DOMAIN });
