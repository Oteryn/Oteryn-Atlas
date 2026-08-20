import { canonicalJsonBytes, sha256ContentId } from './loader.mjs';

export const PUBLICATION_PROFILE = 'oteryn-atlas-fullworld-publication-v0';
export const SEMANTIC_PROFILE = 'oteryn-atlas-fullworld-semantic-publication-v0';
export const RUNTIME_WORLD_PROFILE = 'oteryn-atlas-fullworld-runtime-index-v0';
export const RUNTIME_FLOOR_PROFILE = 'oteryn-atlas-fullworld-runtime-floor-index-v0';
export const PUBLICATION_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0';
export const SEMANTIC_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0';
export const FLOOR_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0';
export const RUNTIME_WORLD_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-WORLD-V0\0';
export const RUNTIME_FLOOR_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-FLOOR-V0\0';
const MAX_PUBLICATION_BYTES = 512 * 1024;
const MAX_WORLD_BYTES = 512 * 1024;
const MAX_FLOOR_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_CHUNK_BYTES = 96 * 1024 * 1024;
const MAX_GROUP_BYTES = 8 * 1024 * 1024;
const APPEARANCE_PROFILE = 'oteryn-atlas-15-32-appearance-spatial-v1';

export class FullWorldError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new FullWorldError(message);
}

function isSha256(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

export function safeRelativePath(path) {
  requireValue(typeof path === 'string' && path.length > 0, 'path missing');
  requireValue(!path.startsWith('/') && !path.includes('\\'), 'unsafe path');
  const parts = path.split('/');
  requireValue(!parts.some((part) => part === '' || part === '.' || part === '..'), 'unsafe path');
  return path;
}

function concatBytes(a, b) {
  const value = new Uint8Array(a.byteLength + b.byteLength);
  value.set(a, 0);
  value.set(b, a.byteLength);
  return value;
}

export async function rootedContentId(domain, value) {
  const core = { ...value };
  delete core.rootContentId;
  return sha256ContentId(concatBytes(new TextEncoder().encode(domain), canonicalJsonBytes(core)));
}

async function readBounded(response, maxBytes, label, expectedBytes = null) {
  requireValue(response?.ok, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) requireValue(Number(declared) <= maxBytes, `${label} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= maxBytes, `${label} bytes exceed limit`);
  if (expectedBytes != null) requireValue(bytes.byteLength === expectedBytes, `${label} byte count mismatch`);
  return bytes;
}

function decodeCanonical(bytes, label) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new FullWorldError(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
  const canonical = canonicalJsonBytes(value);
  requireValue(canonical.byteLength === bytes.byteLength && canonical.every((byte, index) => byte === bytes[index]), `${label} is not canonical JSON`);
  return value;
}

async function fetchCanonical(url, maxBytes, label, fetcher = fetch) {
  const response = await fetcher(url, { cache: 'no-store' });
  return decodeCanonical(await readBounded(response, maxBytes, label), label);
}

function validateCounts(counts, keys, label) {
  requireValue(counts && typeof counts === 'object' && !Array.isArray(counts), `${label} counts missing`);
  for (const key of keys) requireValue(Number.isSafeInteger(counts[key]) && counts[key] >= 0, `${label} count ${key} invalid`);
}

export async function loadFullWorldPublication(baseUrl, trust, fetcher = fetch) {
  requireValue(isSha256(trust?.publicationRoot) && isSha256(trust?.semanticRoot) && isSha256(trust?.pixelRoot), 'trusted publication roots required');
  const publication = await fetchCanonical(new URL('publication.json', baseUrl), MAX_PUBLICATION_BYTES, 'publication', fetcher);
  requireValue(publication.profile === PUBLICATION_PROFILE, 'unsupported publication profile');
  requireValue(publication.source?.authority === 'Oteryn/Oteryn-Game', 'Game authority missing');
  requireValue(publication.rootContentId === await rootedContentId(PUBLICATION_DOMAIN, publication), 'publication root mismatch');
  requireValue(publication.rootContentId === trust.publicationRoot, 'publication trusted root mismatch');
  requireValue(publication.semantic?.rootContentId === trust.semanticRoot, 'semantic trusted root linkage mismatch');
  requireValue(publication.pixels?.rootContentId === trust.pixelRoot, 'pixel trusted root linkage mismatch');
  safeRelativePath(publication.semantic.path);
  safeRelativePath(publication.pixels.path);
  return publication;
}

export async function loadSemanticWorld(publicationBaseUrl, publication, trust, fetcher = fetch) {
  const url = new URL(safeRelativePath(publication.semantic.path), publicationBaseUrl);
  const world = await fetchCanonical(url, MAX_WORLD_BYTES, 'semantic world', fetcher);
  requireValue(world.profile === SEMANTIC_PROFILE, 'unsupported semantic world profile');
  requireValue(world.rootContentId === await rootedContentId(SEMANTIC_DOMAIN, world), 'semantic world root mismatch');
  requireValue(world.rootContentId === publication.semantic.rootContentId && world.rootContentId === trust.semanticRoot, 'semantic world trusted root mismatch');
  requireValue(world.sourceFingerprint === trust.sourceFingerprint, 'semantic source fingerprint mismatch');
  requireValue(Array.isArray(world.floors) && world.floors.length === 16, 'semantic floor census mismatch');
  validateCounts(world.counts, ['bytes', 'floors', 'resolvedPrimitives', 'shards', 'tiles', 'uniqueSpriteRefs'], 'semantic world');
  requireValue(world.counts.floors === world.floors.length, 'semantic floor count mismatch');
  const seen = new Set();
  for (const entry of world.floors) {
    requireValue(Number.isSafeInteger(entry.floor) && !seen.has(entry.floor), 'duplicate/invalid semantic floor');
    seen.add(entry.floor);
    safeRelativePath(entry.path);
    requireValue(isSha256(entry.rootContentId), 'invalid semantic floor root');
  }
  return world;
}

export async function loadSemanticFloor(publicationBaseUrl, publication, world, floorEntry, fetcher = fetch) {
  const semanticBase = new URL('./', new URL(safeRelativePath(publication.semantic.path), publicationBaseUrl));
  const floor = await fetchCanonical(new URL(safeRelativePath(floorEntry.path), semanticBase), MAX_FLOOR_BYTES, `semantic floor ${floorEntry.floor}`, fetcher);
  requireValue(floor.profile === SEMANTIC_PROFILE, 'unsupported semantic floor profile');
  requireValue(floor.floor === floorEntry.floor, 'semantic floor identity mismatch');
  requireValue(floor.rootContentId === await rootedContentId(FLOOR_DOMAIN, floor), 'semantic floor root mismatch');
  requireValue(floor.rootContentId === floorEntry.rootContentId, 'semantic floor root linkage mismatch');
  requireValue(floor.sourceFingerprint === world.sourceFingerprint, 'semantic floor source fingerprint mismatch');
  validateBounds(floor.bounds, `semantic floor ${floor.floor}`);
  validateCounts(floor.counts, ['bytes', 'resolvedPrimitives', 'tiles'], `semantic floor ${floor.floor}`);
  requireValue(Array.isArray(floor.chunks), 'semantic chunks missing');
  return floor;
}

export async function loadRuntimeWorld(baseUrl, trust, fetcher = fetch) {
  requireValue(isSha256(trust?.runtimeIndexRoot), 'trusted runtime index root required');
  const world = await fetchCanonical(new URL('world.json', baseUrl), MAX_WORLD_BYTES, 'runtime index world', fetcher);
  requireValue(world.profile === RUNTIME_WORLD_PROFILE, 'unsupported runtime index profile');
  requireValue(world.rootContentId === await rootedContentId(RUNTIME_WORLD_DOMAIN, world), 'runtime index world root mismatch');
  requireValue(world.rootContentId === trust.runtimeIndexRoot, 'runtime index trusted root mismatch');
  requireValue(world.source?.publicationRoot === trust.publicationRoot && world.source?.semanticRoot === trust.semanticRoot && world.source?.pixelRoot === trust.pixelRoot, 'runtime index source roots mismatch');
  requireValue(world.source?.sourceFingerprint === trust.sourceFingerprint && world.source?.authority === 'Oteryn/Oteryn-Game', 'runtime index source identity mismatch');
  requireValue(Number.isSafeInteger(world.regionSpan) && world.regionSpan > 0 && Number.isSafeInteger(world.rowGroupSpan) && world.rowGroupSpan > 0, 'runtime index spans invalid');
  requireValue(Array.isArray(world.floors) && world.floors.length === 16, 'runtime index floor census mismatch');
  validateCounts(world.counts, ['floors', 'groups', 'resolvedPrimitives', 'shards', 'sourceBytes', 'tiles'], 'runtime index world');
  validateVisualBounds(world.visualBounds);
  return world;
}

export async function loadRuntimeFloor(baseUrl, runtimeWorld, floorEntry, fetcher = fetch) {
  const floor = await fetchCanonical(new URL(safeRelativePath(floorEntry.path), baseUrl), MAX_FLOOR_BYTES, `runtime floor ${floorEntry.floor}`, fetcher);
  requireValue(floor.profile === RUNTIME_FLOOR_PROFILE && floor.floor === floorEntry.floor, 'runtime floor identity mismatch');
  requireValue(floor.rootContentId === await rootedContentId(RUNTIME_FLOOR_DOMAIN, floor), 'runtime floor root mismatch');
  requireValue(floor.rootContentId === floorEntry.rootContentId, 'runtime floor root linkage mismatch');
  requireValue(floor.sourcePublicationRoot === runtimeWorld.source.publicationRoot && floor.sourceSemanticRoot === runtimeWorld.source.semanticRoot, 'runtime floor source roots mismatch');
  requireValue(floor.sourceFingerprint === runtimeWorld.source.sourceFingerprint, 'runtime floor source fingerprint mismatch');
  requireValue(floor.regionSpan === runtimeWorld.regionSpan && floor.rowGroupSpan === runtimeWorld.rowGroupSpan, 'runtime floor span mismatch');
  validateBounds(floor.bounds, `runtime floor ${floor.floor}`);
  requireValue(Array.isArray(floor.chunks), 'runtime floor chunk index missing');
  validateCounts(floor.counts, ['chunks', 'groups', 'resolvedPrimitives', 'sourceBytes', 'tiles'], `runtime floor ${floor.floor}`);
  let groups = 0;
  const addresses = new Set();
  for (const chunk of floor.chunks) {
    const logical = chunk.logicalAddress;
    requireValue(logical?.floor === floor.floor && Number.isSafeInteger(logical.region_x) && Number.isSafeInteger(logical.region_y), 'runtime chunk logical address invalid');
    const key = `${logical.floor}:${logical.region_x}:${logical.region_y}`;
    requireValue(!addresses.has(key), 'duplicate runtime chunk logical address');
    addresses.add(key);
    safeRelativePath(chunk.path);
    requireValue(isSha256(chunk.contentId) && Number.isSafeInteger(chunk.bytes) && chunk.bytes > 0 && chunk.bytes <= MAX_SOURCE_CHUNK_BYTES, 'runtime source chunk identity invalid');
    requireValue(Array.isArray(chunk.groups), 'runtime chunk groups missing');
    let previousEnd = -1;
    for (const group of chunk.groups) {
      requireValue(Number.isSafeInteger(group.offset) && Number.isSafeInteger(group.bytes) && group.offset >= 0 && group.bytes > 0 && group.bytes <= MAX_GROUP_BYTES, 'runtime group byte range invalid');
      requireValue(group.offset >= previousEnd && group.offset + group.bytes <= chunk.bytes, 'runtime group range overlaps/outside source chunk');
      previousEnd = group.offset + group.bytes;
      requireValue(isSha256(group.contentId), 'runtime group identity invalid');
      requireValue(Number.isSafeInteger(group.yMin) && Number.isSafeInteger(group.yMaxExclusive) && group.yMaxExclusive - group.yMin === floor.rowGroupSpan, 'runtime group y range invalid');
      groups += 1;
    }
  }
  requireValue(groups === floor.counts.groups && floor.chunks.length === floor.counts.chunks, 'runtime floor index count mismatch');
  return floor;
}

function validateVisualBounds(value) {
  requireValue(value && typeof value === 'object', 'runtime visual bounds missing');
  for (const key of ['maxWidthUnits', 'maxHeightUnits', 'minDxUnits', 'maxDxUnits', 'minDyUnits', 'maxDyUnits']) requireValue(Number.isSafeInteger(value[key]), `runtime visual bound ${key} invalid`);
  requireValue(value.maxWidthUnits >= 32 && value.maxHeightUnits >= 32, 'runtime visual dimensions invalid');
  const overscan = value.overscanTiles;
  for (const key of ['left', 'right', 'top', 'bottom']) requireValue(Number.isSafeInteger(overscan?.[key]) && overscan[key] >= 0, `runtime overscan ${key} invalid`);
}

export function validateBounds(bounds, label = 'bounds') {
  requireValue(bounds && Number.isSafeInteger(bounds.x_min) && Number.isSafeInteger(bounds.x_max_exclusive) && Number.isSafeInteger(bounds.y_min) && Number.isSafeInteger(bounds.y_max_exclusive), `${label} invalid`);
  requireValue(bounds.x_min < bounds.x_max_exclusive && bounds.y_min < bounds.y_max_exclusive, `${label} empty`);
  return bounds;
}

export function selectRuntimeGroups(runtimeFloor, tileBounds) {
  validateBoundsLike(tileBounds, 'viewport bounds');
  const span = runtimeFloor.regionSpan;
  const matches = [];
  for (const chunk of runtimeFloor.chunks) {
    const x0 = chunk.logicalAddress.region_x * span;
    const x1 = x0 + span;
    if (x0 >= tileBounds.x_max_exclusive || x1 <= tileBounds.x_min) continue;
    for (const group of chunk.groups) {
      if (group.yMin >= tileBounds.y_max_exclusive || group.yMaxExclusive <= tileBounds.y_min) continue;
      matches.push(Object.freeze({ chunk, group }));
    }
  }
  return matches;
}

function validateBoundsLike(bounds, label) {
  requireValue(bounds && Number.isFinite(bounds.x_min) && Number.isFinite(bounds.x_max_exclusive) && Number.isFinite(bounds.y_min) && Number.isFinite(bounds.y_max_exclusive), `${label} invalid`);
  requireValue(bounds.x_min < bounds.x_max_exclusive && bounds.y_min < bounds.y_max_exclusive, `${label} empty`);
}

export function viewportTileBounds(view, viewportWidth, viewportHeight, margin = 0, floorBounds = null) {
  requireValue(Number.isFinite(viewportWidth) && viewportWidth > 0 && Number.isFinite(viewportHeight) && viewportHeight > 0, 'viewport dimensions invalid');
  const tilePixels = 32 * view.zoom;
  const halfX = viewportWidth / (2 * tilePixels) + margin;
  const halfY = viewportHeight / (2 * tilePixels) + margin;
  const bounds = {
    x_min: view.x - halfX,
    x_max_exclusive: view.x + halfX,
    y_min: view.y - halfY,
    y_max_exclusive: view.y + halfY,
  };
  if (!floorBounds) return bounds;
  return {
    x_min: Math.max(floorBounds.x_min, bounds.x_min),
    x_max_exclusive: Math.min(floorBounds.x_max_exclusive, bounds.x_max_exclusive),
    y_min: Math.max(floorBounds.y_min, bounds.y_min),
    y_max_exclusive: Math.min(floorBounds.y_max_exclusive, bounds.y_max_exclusive),
  };
}

function safeInteger(value, label) {
  requireValue(Number.isSafeInteger(value), `${label} must be a safe integer`);
  return value;
}

function decodePrimitive(raw, visualBounds) {
  requireValue(raw && typeof raw === 'object' && !Array.isArray(raw), 'primitive must be an object');
  const spriteSourceId = safeInteger(raw.sprite_source_id, 'sprite_source_id');
  requireValue(spriteSourceId > 0, 'sprite_source_id must be positive');
  const widthUnits = safeInteger(raw.width_units, 'width_units');
  const heightUnits = safeInteger(raw.height_units, 'height_units');
  requireValue(widthUnits > 0 && heightUnits > 0 && widthUnits % 32 === 0 && heightUnits % 32 === 0, 'primitive dimensions invalid');
  requireValue(widthUnits <= visualBounds.maxWidthUnits && heightUnits <= visualBounds.maxHeightUnits, 'primitive dimensions exceed verified runtime bounds');
  const displacement = raw.displacement;
  requireValue(displacement && Number.isSafeInteger(displacement.dx_units) && Number.isSafeInteger(displacement.dy_units), 'primitive displacement invalid');
  requireValue(displacement.dx_units >= visualBounds.minDxUnits && displacement.dx_units <= visualBounds.maxDxUnits && displacement.dy_units >= visualBounds.minDyUnits && displacement.dy_units <= visualBounds.maxDyUnits, 'primitive displacement exceeds verified runtime bounds');
  requireValue(raw.source_profile_id === APPEARANCE_PROFILE, 'unexpected appearance spatial profile');
  requireValue(Number.isSafeInteger(raw.layer_index) && Number.isSafeInteger(raw.phase), 'primitive layer/phase invalid');
  const pattern = raw.pattern;
  requireValue(pattern && Number.isSafeInteger(pattern.x) && Number.isSafeInteger(pattern.y) && Number.isSafeInteger(pattern.z), 'primitive pattern invalid');
  requireValue(Array.isArray(raw.visual_coverage_offsets), 'primitive visual coverage missing');
  return Object.freeze({
    displacement: Object.freeze({ dxUnits: displacement.dx_units, dyUnits: displacement.dy_units }),
    frameGroupId: raw.frame_group_id,
    frameGroupType: raw.frame_group_type,
    heightUnits,
    layerIndex: raw.layer_index,
    pattern: Object.freeze({ x: pattern.x, y: pattern.y, z: pattern.z }),
    phase: raw.phase,
    spriteSourceId,
    widthUnits,
  });
}

function decodeTile(raw, expected) {
  requireValue(raw && typeof raw === 'object' && !Array.isArray(raw) && raw.record_type === 'tile', 'semantic record must be a tile');
  const position = raw.position;
  requireValue(position && position.floor === expected.floor && Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y), 'tile position invalid');
  requireValue(position.y >= expected.group.yMin && position.y < expected.group.yMaxExclusive, 'tile outside authenticated group y range');
  const x0 = expected.chunk.logicalAddress.region_x * expected.regionSpan;
  requireValue(position.x >= x0 && position.x < x0 + expected.regionSpan, 'tile outside authenticated chunk x range');
  const source = raw.source_position;
  requireValue(source?.legacy_x === position.x && source?.legacy_y === position.y && source?.legacy_z === -position.floor, 'tile source-coordinate provenance mismatch');
  requireValue(typeof raw.tile_record_id === 'string' && raw.tile_record_id.startsWith('tile:'), 'tile identity invalid');
  requireValue(Array.isArray(raw.presentation), 'tile presentation stack missing');
  const presentations = raw.presentation.map((entry, index) => {
    requireValue(entry && typeof entry === 'object' && typeof entry.export_record_id === 'string' && entry.export_record_id.startsWith('presentation:'), 'presentation identity invalid');
    requireValue(Number.isSafeInteger(entry.appearance_source_id), 'appearance_source_id invalid');
    requireValue(entry.presentation_order?.order === index && Number.isSafeInteger(entry.presentation_order?.plane), 'presentation order invalid');
    requireValue(entry.source_role === 'ground' || entry.source_role === 'tile_item', 'presentation source role invalid');
    requireValue(Array.isArray(entry.resolved_primitives), 'resolved primitive list missing');
    return Object.freeze({
      appearanceSourceId: entry.appearance_source_id,
      canonicalEntityId: entry.canonical_entity_id ?? null,
      identityState: String(entry.entity_identity_state ?? 'UNKNOWN'),
      presentationOrder: Object.freeze({ order: entry.presentation_order.order, plane: entry.presentation_order.plane }),
      primitives: Object.freeze(entry.resolved_primitives.map((primitive) => decodePrimitive(primitive, expected.visualBounds))),
      recordId: entry.export_record_id,
      role: entry.source_role,
    });
  });
  return Object.freeze({
    floor: position.floor,
    presentations: Object.freeze(presentations),
    provenance: Object.freeze({ authenticatedGroupContentId: expected.group.contentId, sourceChunkContentId: expected.chunk.contentId, sourceChunkPath: expected.chunk.path }),
    tileRecordId: raw.tile_record_id,
    x: position.x,
    y: position.y,
  });
}

export function decodeSemanticGroup(bytes, expected) {
  requireValue(bytes.byteLength === expected.group.bytes, 'semantic group byte count mismatch');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new FullWorldError(`semantic group UTF-8 failure: ${error.message}`);
  }
  requireValue(text.endsWith('\n'), 'semantic group is not newline terminated');
  const lines = text.slice(0, -1).split('\n');
  requireValue(lines.length === expected.group.tiles, 'semantic group tile count mismatch');
  let primitiveCount = 0;
  let previous = null;
  const tiles = lines.map((line) => {
    let raw;
    try { raw = JSON.parse(line); } catch (error) { throw new FullWorldError(`semantic group JSON failure: ${error.message}`); }
    const tile = decodeTile(raw, expected);
    const order = [tile.y, tile.x];
    if (previous) requireValue(order[0] > previous[0] || (order[0] === previous[0] && order[1] > previous[1]), 'semantic group tile order invalid');
    previous = order;
    for (const presentation of tile.presentations) primitiveCount += presentation.primitives.length;
    return tile;
  });
  requireValue(primitiveCount === expected.group.resolvedPrimitives, 'semantic group primitive count mismatch');
  return Object.freeze(tiles);
}

async function loadRangeBytes(url, chunk, group, fetcher, fullChunkCache, signal = null) {
  const cached = fullChunkCache.get(url);
  if (cached) return cached.subarray(group.offset, group.offset + group.bytes);
  const end = group.offset + group.bytes - 1;
  const response = await fetcher(url, { cache: 'no-store', headers: { Range: `bytes=${group.offset}-${end}` }, signal });
  if (response?.status === 206) {
    const contentRange = response.headers?.get?.('content-range');
    requireValue(contentRange === `bytes ${group.offset}-${end}/${chunk.bytes}`, 'semantic range Content-Range mismatch');
    return readBounded(response, MAX_GROUP_BYTES, 'semantic range', group.bytes);
  }
  if (response?.status === 200) {
    requireValue(chunk.bytes <= MAX_GROUP_BYTES, 'semantic server must support HTTP byte ranges for source chunks above 8 MiB');
    const bytes = await readBounded(response, MAX_SOURCE_CHUNK_BYTES, 'semantic full-chunk fallback', chunk.bytes);
    requireValue(await sha256ContentId(bytes) === chunk.contentId, 'semantic full-chunk fallback identity mismatch');
    fullChunkCache.clear();
    fullChunkCache.set(url, bytes);
    return bytes.subarray(group.offset, group.offset + group.bytes);
  }
  throw new FullWorldError(`semantic range fetch failed: ${response?.status ?? 'unknown'}`);
}

export class SemanticRangeStore {
  constructor(semanticBaseUrl, runtimeWorld, options = {}) {
    this.semanticBaseUrl = new URL(semanticBaseUrl);
    this.runtimeWorld = runtimeWorld;
    this.fetcher = options.fetcher ?? fetch;
    this.cacheByteBudget = options.cacheByteBudget ?? 24 * 1024 * 1024;
    this.persistentCache = options.persistentCache ?? null;
    this.cache = new Map();
    this.cacheBytes = 0;
    this.fullChunkCache = new Map();
    this.networkBytes = 0;
    this.rangeRequests = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.persistentHits = 0;
  }

  remember(key, group, tiles) {
    this.cache.set(key, { bytes: group.bytes, tiles });
    this.cacheBytes += group.bytes;
    while (this.cacheBytes > this.cacheByteBudget && this.cache.size > 1) {
      const oldestKey = this.cache.keys().next().value;
      const oldest = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.cacheBytes -= oldest.bytes;
    }
  }

  async loadGroup(floor, chunk, group, options = {}) {
    const key = `${chunk.contentId}:${group.offset}:${group.bytes}`;
    const existing = this.cache.get(key);
    if (existing) {
      this.cacheHits += 1;
      this.cache.delete(key);
      this.cache.set(key, existing);
      return existing.tiles;
    }
    this.cacheMisses += 1;

    let bytes = await this.persistentCache?.get?.(group.contentId, group.bytes) ?? null;
    if (bytes) this.persistentHits += 1;
    if (!bytes) {
      const url = new URL(safeRelativePath(chunk.path), this.semanticBaseUrl).toString();
      bytes = await loadRangeBytes(url, chunk, group, this.fetcher, this.fullChunkCache, options.signal ?? null);
      requireValue(bytes.byteLength === group.bytes, 'semantic authenticated range byte count mismatch');
      requireValue(await sha256ContentId(bytes) === group.contentId, 'semantic authenticated range identity mismatch');
      this.networkBytes += bytes.byteLength;
      this.rangeRequests += 1;
      await this.persistentCache?.put?.(group.contentId, bytes);
    }
    const tiles = decodeSemanticGroup(bytes, { chunk, floor, group, regionSpan: this.runtimeWorld.regionSpan, visualBounds: this.runtimeWorld.visualBounds });
    this.remember(key, group, tiles);
    return tiles;
  }

  clearForFloorChange() {
    this.cache.clear();
    this.cacheBytes = 0;
    this.fullChunkCache.clear();
  }

  stats() {
    return Object.freeze({
      cacheBytes: this.cacheBytes,
      cachedGroups: this.cache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      persistentHits: this.persistentHits,
      networkBytes: this.networkBytes,
      rangeRequests: this.rangeRequests,
    });
  }
}

export function filterTilesForBounds(tiles, bounds) {
  validateBoundsLike(bounds, 'retain bounds');
  return tiles.filter((tile) => tile.x >= bounds.x_min && tile.x < bounds.x_max_exclusive && tile.y >= bounds.y_min && tile.y < bounds.y_max_exclusive);
}

export function flattenRenderRecords(tiles) {
  const records = [];
  for (const tile of tiles) for (const presentation of tile.presentations) for (const primitive of presentation.primitives) {
    records.push(Object.freeze({ floor: tile.floor, presentation, primitive, tileRecordId: tile.tileRecordId, x: tile.x, y: tile.y }));
  }
  return records;
}

function floorMap(world) {
  return new Map(world.floors.map((entry) => [entry.floor, entry]));
}

function normalizeZoom(value) {
  requireValue(Number.isFinite(value) && value >= 0.125 && value <= 16, 'zoom outside full-world range');
  return Math.round(value * 10000) / 10000;
}

function normalizeCoordinate(value, min, maxExclusive, label) {
  requireValue(Number.isFinite(value), `${label} is not finite`);
  requireValue(value >= min && value < maxExclusive, `${label} is outside exported floor bounds`);
  return Math.round(value * 10000) / 10000;
}

export function parseFullWorldViewState(input, runtimeWorld) {
  const params = new URLSearchParams(String(input ?? '').replace(/^\?/, ''));
  const floors = floorMap(runtimeWorld);
  const defaultFloor = floors.has(-7) ? -7 : runtimeWorld.floors[0].floor;
  const floor = params.has('floor') ? Number(params.get('floor')) : defaultFloor;
  requireValue(Number.isSafeInteger(floor) && floors.has(floor), 'requested floor is not exported');
  const bounds = floors.get(floor).bounds;
  const defaultX = 32360 >= bounds.x_min && 32360 < bounds.x_max_exclusive ? 32360 : (bounds.x_min + bounds.x_max_exclusive) / 2;
  const defaultY = 32230 >= bounds.y_min && 32230 < bounds.y_max_exclusive ? 32230 : (bounds.y_min + bounds.y_max_exclusive) / 2;
  const x = normalizeCoordinate(params.has('x') ? Number(params.get('x')) : defaultX, bounds.x_min, bounds.x_max_exclusive, 'x');
  const y = normalizeCoordinate(params.has('y') ? Number(params.get('y')) : defaultY, bounds.y_min, bounds.y_max_exclusive, 'y');
  const zoom = normalizeZoom(params.has('zoom') ? Number(params.get('zoom')) : 2);
  const requestedLayers = (params.get('layers') ?? 'minimap-overview').split(',').filter(Boolean);
  requireValue(requestedLayers.every((layer) => layer === 'minimap-overview'), 'requested semantic layer is not enabled by the verified hand-off');
  const overview = requestedLayers.includes('minimap-overview');
  const animation = params.get('animation') ?? 'off';
  requireValue(animation === 'off', 'animation playback is not yet supported by authoritative metadata');
  return Object.freeze({ animation, floor, overview, x, y, zoom });
}

export function serializeFullWorldViewState(state, runtimeWorld) {
  const parsed = parseFullWorldViewState(`x=${state.x}&y=${state.y}&floor=${state.floor}&zoom=${state.zoom}&layers=${state.overview ? 'minimap-overview' : ''}&animation=${state.animation ?? 'off'}`, runtimeWorld);
  const params = new URLSearchParams();
  params.set('x', String(parsed.x));
  params.set('y', String(parsed.y));
  params.set('floor', String(parsed.floor));
  params.set('zoom', String(parsed.zoom));
  params.set('layers', parsed.overview ? 'minimap-overview' : '');
  params.set('animation', parsed.animation);
  return `?${params.toString()}`;
}

export function changeFloor(state, nextFloor, runtimeWorld) {
  const entry = floorMap(runtimeWorld).get(Number(nextFloor));
  requireValue(entry, 'requested floor is not exported');
  const x = Math.min(entry.bounds.x_max_exclusive - 0.0001, Math.max(entry.bounds.x_min, state.x));
  const y = Math.min(entry.bounds.y_max_exclusive - 0.0001, Math.max(entry.bounds.y_min, state.y));
  return parseFullWorldViewState(`x=${x}&y=${y}&floor=${entry.floor}&zoom=${state.zoom}&layers=${state.overview ? 'minimap-overview' : ''}&animation=off`, runtimeWorld);
}

export function parseCoordinateSearch(text, currentFloor, runtimeWorld) {
  const labelledX = String(text).match(/\bx\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  const labelledY = String(text).match(/\by\s*=?\s*(-?\d+(?:\.\d+)?)/i);
  const labelledFloor = String(text).match(/\b(?:floor|z)\s*=?\s*(-?\d+)/i);
  let x;
  let y;
  let floor = labelledFloor ? Number(labelledFloor[1]) : currentFloor;
  if (labelledX && labelledY) {
    x = Number(labelledX[1]);
    y = Number(labelledY[1]);
  } else {
    const values = String(text).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    requireValue(values.length >= 2, 'enter X and Y coordinates');
    [x, y] = values;
    if (values.length >= 3) floor = values[2];
  }
  const current = parseFullWorldViewState(`floor=${floor}&x=${x}&y=${y}&zoom=2&layers=minimap-overview&animation=off`, runtimeWorld);
  return Object.freeze({ floor: current.floor, x: current.x, y: current.y });
}
