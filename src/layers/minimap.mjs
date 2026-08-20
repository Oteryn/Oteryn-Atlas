import { canonicalJsonBytes, sha256ContentId } from '../browser/loader.mjs';

const WORLD_PROFILE = 'oteryn-atlas-visual-minimap-world-v0';
const FLOOR_PROFILE = 'oteryn-atlas-visual-minimap-floor-v0';
const WORLD_DOMAIN = 'OTERYN-ATLAS-VISUAL-MINIMAP-WORLD-V0\0';
const FLOOR_DOMAIN = 'OTERYN-ATLAS-VISUAL-MINIMAP-FLOOR-V0\0';
const MAX_WORLD_BYTES = 512 * 1024;
const MAX_FLOOR_BYTES = 4 * 1024 * 1024;
const MAX_TILE_BYTES = 512 * 1024;

export class MinimapLoadError extends Error {}
const requireValue = (condition, message) => { if (!condition) throw new MinimapLoadError(message); };
const isHash = (value) => typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);

function safePath(path) {
  requireValue(typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\'), 'unsafe minimap path');
  requireValue(!path.split('/').some((part) => !part || part === '.' || part === '..'), 'unsafe minimap path');
  return path;
}

async function rooted(value, domain) {
  const core = { ...value }; delete core.rootContentId;
  const prefix = new TextEncoder().encode(domain);
  const body = canonicalJsonBytes(core);
  const joined = new Uint8Array(prefix.length + body.length); joined.set(prefix); joined.set(body, prefix.length);
  return sha256ContentId(joined);
}
async function fetchCanonical(url, limit, label, fetcher = fetch) {
  const response = await fetcher(url, { cache: 'no-store' });
  requireValue(response?.ok, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) requireValue(Number(declared) <= limit, `${label} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= limit, `${label} bytes exceed limit`);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new MinimapLoadError(`${label} JSON failure: ${error.message}`); }
  const canonical = canonicalJsonBytes(value);
  requireValue(canonical.byteLength === bytes.byteLength && canonical.every((byte, index) => byte === bytes[index]), `${label} is not canonical JSON`);
  return value;
}

export async function loadMinimapWorld(baseUrl, expected, fetcher = fetch) {
  requireValue(isHash(expected?.rootContentId) && isHash(expected?.publicationRoot) && isHash(expected?.pixelRoot), 'trusted minimap roots required');
  const world = await fetchCanonical(new URL('world.json', baseUrl), MAX_WORLD_BYTES, 'minimap world', fetcher);
  requireValue(world.profile === WORLD_PROFILE && world.pixelPerWorldTile === 1 && world.regionSpan === 256, 'unsupported minimap world profile');
  requireValue(world.source?.authority === 'Oteryn/Oteryn-Game', 'minimap Game authority missing');
  requireValue(world.source.publicationRoot === expected.publicationRoot && world.source.pixelRoot === expected.pixelRoot, 'minimap source root mismatch');
  requireValue(world.semantics?.terrainClassification === 'NOT_CLAIMED' && world.semantics?.walkability === 'NOT_CLAIMED', 'minimap must not claim gameplay semantics');
  requireValue(world.rootContentId === await rooted(world, WORLD_DOMAIN) && world.rootContentId === expected.rootContentId, 'minimap world trusted root mismatch');
  requireValue(Array.isArray(world.floors) && world.floors.length === 16 && world.counts?.floors === 16, 'minimap floor census mismatch');
  return world;
}
export async function loadMinimapFloor(baseUrl, world, entry, fetcher = fetch) {
  const floor = await fetchCanonical(new URL(safePath(entry.path), baseUrl), MAX_FLOOR_BYTES, `minimap floor ${entry.floor}`, fetcher);
  requireValue(floor.profile === FLOOR_PROFILE && floor.floor === entry.floor, 'minimap floor identity mismatch');
  requireValue(floor.rootContentId === entry.rootContentId && floor.rootContentId === await rooted(floor, FLOOR_DOMAIN), 'minimap floor root mismatch');
  requireValue(floor.regionSpan === world.regionSpan && floor.pixelPerWorldTile === world.pixelPerWorldTile, 'minimap floor geometry mismatch');
  requireValue(Array.isArray(floor.chunks) && floor.counts?.chunks === floor.chunks.length, 'minimap floor chunk count mismatch');
  const seen = new Set();
  for (const chunk of floor.chunks) {
    const logical = chunk.logicalAddress;
    requireValue(logical?.floor === floor.floor && Number.isSafeInteger(logical.region_x) && Number.isSafeInteger(logical.region_y), 'invalid minimap logical address');
    const key = `${logical.region_x}:${logical.region_y}`;
    requireValue(!seen.has(key), 'duplicate minimap logical address'); seen.add(key);
    requireValue(isHash(chunk.contentId) && isHash(chunk.sourceContentId), 'invalid minimap content identity');
    requireValue(Number.isSafeInteger(chunk.bytes) && chunk.bytes > 0 && chunk.bytes <= MAX_TILE_BYTES, 'invalid minimap tile bytes');
    safePath(chunk.path);
  }
  return floor;
}

export function selectMinimapChunks(floor, bounds) {
  const span = floor.regionSpan;
  return floor.chunks.filter((entry) => {
    const x0 = entry.logicalAddress.region_x * span;
    const y0 = entry.logicalAddress.region_y * span;
    return x0 < bounds.x_max_exclusive && x0 + span > bounds.x_min && y0 < bounds.y_max_exclusive && y0 + span > bounds.y_min;
  });
}
export async function loadVerifiedMinimapTile(baseUrl, entry, fetcher = fetch, decoder = null) {
  const response = await fetcher(new URL(safePath(entry.path), baseUrl), { cache: 'force-cache' });
  requireValue(response?.ok, `minimap tile fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) requireValue(Number(declared) === entry.bytes, 'minimap tile declared byte mismatch');
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength === entry.bytes && bytes.byteLength <= MAX_TILE_BYTES, 'minimap tile byte mismatch');
  requireValue(await sha256ContentId(bytes) === entry.contentId, 'minimap tile identity mismatch');
  requireValue(bytes.length >= 24 && bytes[0] === 0x89 && new TextDecoder().decode(bytes.subarray(1, 4)) === 'PNG', 'minimap tile is not PNG');
  if (!decoder) return bytes;
  return decoder(bytes, entry);
}

export const minimapProfiles = Object.freeze({ world: WORLD_PROFILE, floor: FLOOR_PROFILE });
export const minimapDomains = Object.freeze({ world: WORLD_DOMAIN, floor: FLOOR_DOMAIN });
