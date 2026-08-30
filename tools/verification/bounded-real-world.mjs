import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { loadAnimationRuntime } from '../../src/browser/animation-runtime.mjs';
import { validateCreatureGameplayManifest } from '../../src/browser/creature-gameplay-profiles.mjs';
import { validateCreaturePublicationSource } from '../../src/browser/creature-publication-source.mjs';
import { validateCreatureSearchCatalog, validateCreatureSearchRecords } from '../../src/browser/creature-search.mjs';
import { ancillarySourceExpectations, resolveBoundedRealManifestTrust } from '../../src/browser/fullworld-trust.mjs';
import { canonicalJsonBytes, sha256ContentId } from '../../src/browser/loader.mjs';
import { validateSemanticSearchIndex } from '../../src/browser/semantic-search.mjs';
import {
  FLOOR_DOMAIN, PUBLICATION_DOMAIN, PUBLICATION_PROFILE, RUNTIME_FLOOR_DOMAIN,
  RUNTIME_WORLD_DOMAIN, RUNTIME_WORLD_PROFILE, RUNTIME_FLOOR_PROFILE,
  SEMANTIC_DOMAIN, SEMANTIC_PROFILE, rootedContentId,
} from '../../src/browser/fullworld.mjs';
import { PIXEL_HASH_DOMAIN, PIXEL_PROFILE, PIXEL_ROOT_DOMAIN } from '../../src/browser/fullworld-pixels.mjs';
import { RUNTIME_PIXEL_BUCKET_DOMAIN, RUNTIME_PIXEL_BUCKET_PROFILE } from '../../src/browser/fullworld-pixel-buckets.mjs';
import { minimapDomains, minimapProfiles } from '../../src/layers/minimap.mjs';
import { computeOverviewRoot, overviewDomains, overviewProfiles } from '../../src/layers/overview.mjs';

export const BOUNDED_REAL_WORLD_ID = 'atlas-bounded-real-world-v1';
export const BOUNDED_REAL_SOURCE_CONTRACT = 'oteryn-atlas-bounded-real-runtime-v1';
export const BOUNDED_REAL_CREATURE_CAPABILITY = 'bounded-real-creatures-v1';
const BOUNDED_GAME_SHA = 'fixture';
const FLOORS = Object.freeze(Array.from({ length: 16 }, (_, index) => index - 15));
const INITIAL_ANCHOR = Object.freeze({ x: 32369, y: 32241, floor: -7 });
const TARGET_ENTITY_IDS = Object.freeze([
  'npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e',
  'monster-entity:80295e51265b3662bfbea2ea01ee3ccb',
  'npc-entity:0e7857888218c9081fabdb469aa9349b',
  'npc-entity:0c83ae18a907dc7e8f15c37c03e4f04c',
]);
const PIXEL_BYTES = 32 * 32 * 4;
const MINIMAP_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function sha(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function canonicalDigest(value) { return sha(canonicalJsonBytes(value)); }
async function domainRoot(domain, value) {
  const core = { ...value }; delete core.rootContentId;
  return sha256ContentId(Buffer.concat([Buffer.from(domain), Buffer.from(canonicalJsonBytes(core))]));
}
function writeJson(root, relative, value) {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, canonicalJsonBytes(value));
}
function writeBytes(root, relative, value) {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value);
}
function readJson(root, relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
function productEntries(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).replaceAll(path.sep, '/');
      if (entry.isDirectory()) walk(full);
      else if (relative !== 'bounded-real-manifest.json') {
        const bytes = fs.readFileSync(full); out.push({ path: relative, bytes: bytes.length, digest: sha(bytes) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
function fixturePixels() {
  const bytes = Buffer.alloc(PIXEL_BYTES);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const pixel = offset / 4; const x = pixel % 32; const y = Math.floor(pixel / 32);
    bytes[offset] = 40 + ((x * 5) % 160); bytes[offset + 1] = 70 + ((y * 3) % 150);
    bytes[offset + 2] = 120 + (((x + y) * 2) % 120); bytes[offset + 3] = 255;
  }
  return bytes;
}
function alignBounds(anchors, span) {
  const xs = anchors.map(({ x }) => x); const ys = anchors.map(({ y }) => y);
  const xMin = Math.floor(Math.min(...xs) / span) * span; const yMin = Math.floor(Math.min(...ys) / span) * span;
  return Object.freeze({ x_min: xMin, x_max_exclusive: (Math.floor(Math.max(...xs) / span) + 1) * span, y_min: yMin, y_max_exclusive: (Math.floor(Math.max(...ys) / span) + 1) * span });
}
function tileAt(anchor, ordinal) {
  return {
    record_type: 'tile', position: { ...anchor }, source_position: { legacy_x: anchor.x, legacy_y: anchor.y, legacy_z: -anchor.floor },
    tile_record_id: `tile:bounded-real-substrate-${ordinal}`,
    presentation: [{ export_record_id: `presentation:bounded-real-substrate-${ordinal}`, appearance_source_id: 1, entity_identity_state: 'UNRESOLVED', presentation_order: { order: 0, plane: 0 }, source_role: 'ground', resolved_primitives: [{ sprite_source_id: 1, width_units: 32, height_units: 32, displacement: { dx_units: 0, dy_units: 0 }, source_profile_id: 'oteryn-atlas-15-32-appearance-spatial-v1', layer_index: 0, phase: 0, pattern: { x: 0, y: 0, z: 0 }, visual_coverage_offsets: [0, 0] }] }],
  };
}
function stableAnchors(sourceRoot) {
  const catalog = readJson(sourceRoot, 'web/semantic-search/creatures.json');
  const selected = TARGET_ENTITY_IDS.map((entityId) => {
    const matches = catalog.records.filter((record) => record.entity_id === entityId);
    if (matches.length !== 1) throw new TypeError(`bounded-real target ${entityId} census is ${matches.length}, expected 1`);
    return matches[0];
  });
  const anchors = [INITIAL_ANCHOR, ...selected.map(({ position }) => position)];
  const unique = new Map(anchors.map((anchor) => [`${anchor.floor}:${anchor.x}:${anchor.y}`, Object.freeze({ ...anchor })]));
  return { catalog, selected, anchors: [...unique.values()].sort((a, b) => a.floor - b.floor || a.y - b.y || a.x - b.x) };
}
async function mapChunks(anchors) {
  const grouped = new Map();
  for (const anchor of anchors) {
    const region_x = Math.floor(anchor.x / 32); const region_y = Math.floor(anchor.y / 32); const key = `${anchor.floor}:${region_x}:${region_y}`;
    if (!grouped.has(key)) grouped.set(key, { floor: anchor.floor, region_x, region_y, anchors: [] });
    grouped.get(key).anchors.push(anchor);
  }
  const chunks = [];
  for (const group of [...grouped.values()].sort((a, b) => a.floor - b.floor || a.region_y - b.region_y || a.region_x - b.region_x)) {
    const rows = group.anchors.sort((a, b) => a.y - b.y || a.x - b.x).map((anchor, index) => Buffer.from(canonicalJsonBytes(tileAt(anchor, index))));
    const bytes = Buffer.concat(rows); let offset = 0; const ranges = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]; const anchor = group.anchors[index];
      ranges.push({ offset, bytes: row.length, contentId: await sha256ContentId(row), yMin: anchor.y, yMaxExclusive: anchor.y + 1, tiles: 1, resolvedPrimitives: 1 });
      offset += row.length;
    }
    chunks.push({ ...group, path: `chunks/f${group.floor}-r${group.region_x}-c${group.region_y}.jsonl`, bytes, contentId: await sha256ContentId(bytes), ranges });
  }
  return chunks;
}
async function buildPixelPublication(root) {
  const pixels = fixturePixels(); const pixelContentId = await sha256ContentId(pixels); const packSha = sha(pixels).slice('sha256:'.length);
  const core = { profile: PIXEL_PROFILE, pixelHashDomain: PIXEL_HASH_DOMAIN, runtimePlacement: { identityAuthority: false }, packs: [{ path: 'packs/p0.rgba', bytes: pixels.length, sha256: packSha, identityAuthority: false }], blobs: [{ contentId: pixelContentId, pack: 0, width: 32, height: 32, offset: 0, bytes: pixels.length }], spriteIndex: { '1': { contentId: pixelContentId, width: 32, height: 32 } }, counts: { spriteRefs: 1, uniquePixelBlobs: 1, rawBytesAfterDedupe: pixels.length } };
  const manifest = { ...core, rootContentId: await domainRoot(PIXEL_ROOT_DOMAIN, core) };
  writeJson(root, 'publication/pixels/manifest.json', manifest); writeBytes(root, 'publication/pixels/packs/p0.rgba', pixels);
  return { manifest, pixelContentId, pixels };
}
async function buildRuntimePixelBuckets(root, publicationRoot, pixelRoot, pixelContentId, pixels) {
  const bucket = pixelContentId.slice('sha256:'.length, 'sha256:'.length + 1); const bucketPath = `buckets/${bucket}.rgba`; const bundlePath = 'local-max.rgba';
  const contentId = await sha256ContentId(pixels); const sha256 = contentId.slice('sha256:'.length);
  const core = { profile: RUNTIME_PIXEL_BUCKET_PROFILE, identityAuthority: false, source: { authority: 'Oteryn/Oteryn-Game', publicationRoot, pixelRoot }, bucketNibbles: 1, buckets: [{ bucket, path: bucketPath, identityAuthority: false, bytes: pixels.length, contentId, sha256 }], localMaxBundle: { path: bundlePath, identityAuthority: false, bytes: pixels.length, contentId, sha256, bucketOffsets: [{ bucket, offset: 0, bytes: pixels.length }] }, blobIndex: { [pixelContentId]: { bucket, offset: 0, bytes: pixels.length, width: 32, height: 32 } }, counts: { buckets: 1, blobs: 1, bytes: pixels.length } };
  const manifest = { ...core, rootContentId: await domainRoot(RUNTIME_PIXEL_BUCKET_DOMAIN, core) };
  writeJson(root, 'pixel-buckets/manifest.json', manifest); writeBytes(root, `pixel-buckets/${bucketPath}`, pixels); writeBytes(root, `pixel-buckets/${bundlePath}`, pixels); return manifest;
}
async function buildAnimation(root, semanticRoot, pixelRoot, contentId, pixels) {
  const bucketId = 'br000'; const bucketPath = `buckets/${bucketId}.rgba`;
  const program = { profile: 'oteryn-atlas-animation-runtime-v1', object_programs: [], creature_programs: [], sprite_index: {}, blob_index: { [contentId]: { bucket: bucketId, bytes: pixels.length, height: 32, offset: 0, width: 32 } } };
  const programBytes = canonicalJsonBytes(program);
  const manifestCore = { profile: 'oteryn-atlas-animation-runtime-v1', identityAuthority: false, source: { game_sha: BOUNDED_GAME_SHA, fixture_id: BOUNDED_REAL_WORLD_ID, source_contract: BOUNDED_REAL_SOURCE_CONTRACT, appearance_product_root: pixelRoot, outfit_spatial_product_root: semanticRoot }, buckets: [{ id: bucketId, path: bucketPath, bytes: pixels.length, digest: sha(pixels) }], programs: { path: 'programs.json', bytes: programBytes.length, digest: sha(programBytes) } };
  const manifest = { ...manifestCore, rootContentId: canonicalDigest(manifestCore) };
  writeJson(root, 'animation/manifest.json', manifest); writeBytes(root, 'animation/programs.json', programBytes); writeBytes(root, `animation/${bucketPath}`, pixels); return manifest;
}
async function buildMap(root, anchors, pixel) {
  const chunks = await mapChunks(anchors); const bounds = alignBounds(anchors, 32); const sourceFingerprint = canonicalDigest({ fixtureId: BOUNDED_REAL_WORLD_ID, mapAuthority: false, anchors });
  for (const chunk of chunks) writeBytes(root, `publication/semantic/${chunk.path}`, chunk.bytes);
  const semanticFloors = [];
  for (const floor of FLOORS) {
    const floorChunks = chunks.filter((chunk) => chunk.floor === floor);
    const counts = { bytes: floorChunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0), resolvedPrimitives: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0), tiles: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0) };
    const semanticCore = { profile: SEMANTIC_PROFILE, floor, bounds, sourceFingerprint, chunks: floorChunks.map((chunk) => ({ logicalAddress: { floor, region_x: chunk.region_x, region_y: chunk.region_y }, contentId: chunk.contentId, bytes: chunk.bytes.length, tiles: chunk.anchors.length, resolvedPrimitives: chunk.anchors.length, path: chunk.path })), counts };
    const semantic = { ...semanticCore, rootContentId: await rootedContentId(FLOOR_DOMAIN, semanticCore) };
    writeJson(root, `publication/semantic/floors/f${floor}.json`, semantic); semanticFloors.push({ floor, path: `floors/f${floor}.json`, rootContentId: semantic.rootContentId, counts });
  }
  const semanticCore = { profile: SEMANTIC_PROFILE, fabricRoot: `bounded:${BOUNDED_REAL_WORLD_ID}`, sourceFingerprint, floors: semanticFloors, counts: { floors: FLOORS.length, shards: chunks.length, tiles: anchors.length, resolvedPrimitives: anchors.length, uniqueSpriteRefs: 1, bytes: chunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0) } };
  const semanticWorld = { ...semanticCore, rootContentId: await rootedContentId(SEMANTIC_DOMAIN, semanticCore) }; writeJson(root, 'publication/semantic/world.json', semanticWorld);
  const publicationCore = { profile: PUBLICATION_PROFILE, source: { authority: 'Oteryn/Oteryn-Game', handoffSha256: `bounded:${BOUNDED_REAL_WORLD_ID}`, fabricRoot: `bounded:${BOUNDED_REAL_WORLD_ID}`, sourceFingerprint, gameSha: BOUNDED_GAME_SHA, canonicalWorldId: null, canonicalWorldIdState: 'BOUNDED_SUBSTRATE_NOT_AUTHORITY' }, semantic: { path: 'semantic/world.json', rootContentId: semanticWorld.rootContentId }, pixels: { path: 'pixels/manifest.json', rootContentId: pixel.manifest.rootContentId }, serializerStatus: 'BOUNDED_REAL_WORLD_SUBSTRATE' };
  const publication = { ...publicationCore, rootContentId: await rootedContentId(PUBLICATION_DOMAIN, publicationCore) }; writeJson(root, 'publication/publication.json', publication);
  const runtimeWorldCore = { profile: RUNTIME_WORLD_PROFILE, source: { authority: 'Oteryn/Oteryn-Game', publicationRoot: publication.rootContentId, semanticRoot: semanticWorld.rootContentId, pixelRoot: pixel.manifest.rootContentId, sourceFingerprint }, regionSpan: 32, rowGroupSpan: 1, floors: [], counts: { floors: FLOORS.length, groups: anchors.length, resolvedPrimitives: anchors.length, shards: chunks.length, sourceBytes: chunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0), tiles: anchors.length }, visualBounds: { maxWidthUnits: 32, maxHeightUnits: 32, minDxUnits: 0, maxDxUnits: 0, minDyUnits: 0, maxDyUnits: 0, overscanTiles: { left: 0, right: 0, top: 0, bottom: 0 } } };
  for (const entry of semanticFloors) {
    const floorChunks = chunks.filter((chunk) => chunk.floor === entry.floor);
    const descriptors = floorChunks.map((chunk) => ({ logicalAddress: { floor: chunk.floor, region_x: chunk.region_x, region_y: chunk.region_y }, path: chunk.path, contentId: chunk.contentId, bytes: chunk.bytes.length, worldChunk: { identityAuthority: false, chunk_id: `bounded-${chunk.floor}-${chunk.region_x}-${chunk.region_y}`, floor: chunk.floor, bounds: { x_min: chunk.region_x * 32, x_max_exclusive: (chunk.region_x + 1) * 32, y_min: chunk.region_y * 32, y_max_exclusive: (chunk.region_y + 1) * 32 }, semantic_root: semanticWorld.rootContentId, pixel_root: pixel.manifest.rootContentId, content_hash: chunk.contentId, estimated_memory_cost: chunk.bytes.length, dependencies: [entry.rootContentId, semanticWorld.rootContentId, pixel.manifest.rootContentId] }, groups: chunk.ranges }));
    const counts = { chunks: descriptors.length, groups: descriptors.reduce((sum, chunk) => sum + chunk.groups.length, 0), resolvedPrimitives: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0), sourceBytes: floorChunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0), tiles: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0) };
    const core = { profile: RUNTIME_FLOOR_PROFILE, floor: entry.floor, sourcePublicationRoot: publication.rootContentId, sourceSemanticRoot: semanticWorld.rootContentId, sourceFloorRoot: entry.rootContentId, sourceFingerprint, regionSpan: 32, rowGroupSpan: 1, bounds, chunks: descriptors, counts };
    const runtimeFloor = { ...core, rootContentId: await rootedContentId(RUNTIME_FLOOR_DOMAIN, core) }; writeJson(root, `runtime-index/floors/f${entry.floor}.json`, runtimeFloor); runtimeWorldCore.floors.push({ floor: entry.floor, path: `floors/f${entry.floor}.json`, rootContentId: runtimeFloor.rootContentId, bounds });
  }
  const runtimeWorld = { ...runtimeWorldCore, rootContentId: await rootedContentId(RUNTIME_WORLD_DOMAIN, runtimeWorldCore) }; writeJson(root, 'runtime-index/world.json', runtimeWorld);
  return { chunks, bounds, sourceFingerprint, semanticFloors, semanticWorld, publication, runtimeWorld };
}
async function buildOverview(root, publicationRoot, map) {
  const floors = []; let totalCells = 0;
  for (const semanticEntry of map.semanticFloors) {
    const floorChunks = map.chunks.filter((chunk) => chunk.floor === semanticEntry.floor); const descriptors = [];
    for (const chunk of floorChunks) {
      const cells = chunk.anchors.map((anchor) => ({ cell_x: Math.floor(anchor.x / 8), cell_y: Math.floor(anchor.y / 8), tiles: 1, resolvedPrimitives: 1 })); totalCells += cells.length;
      const core = { profile: overviewProfiles.chunk, logicalAddress: { floor: chunk.floor, region_x: chunk.region_x, region_y: chunk.region_y }, sourceContentId: chunk.contentId, sourceFingerprint: map.sourceFingerprint, cellSizeTiles: 8, cells, counts: { cells: cells.length, resolvedPrimitives: cells.length, tiles: cells.length } };
      const bytes = canonicalJsonBytes(core); const relative = `chunks/f${chunk.floor}-r${chunk.region_x}-c${chunk.region_y}.json`; writeBytes(root, `overview/${relative}`, bytes);
      descriptors.push({ logicalAddress: core.logicalAddress, path: relative, bytes: bytes.length, contentId: await sha256ContentId(bytes), sourceContentId: chunk.contentId, counts: core.counts });
    }
    const floorCore = { profile: overviewProfiles.floor, floor: semanticEntry.floor, cellSizeTiles: 8, sourceFingerprint: map.sourceFingerprint, sourceFloorRoot: semanticEntry.rootContentId, bounds: map.bounds, chunks: descriptors, counts: { cells: descriptors.reduce((sum, entry) => sum + entry.counts.cells, 0), chunks: descriptors.length, resolvedPrimitives: descriptors.reduce((sum, entry) => sum + entry.counts.resolvedPrimitives, 0), tiles: descriptors.reduce((sum, entry) => sum + entry.counts.tiles, 0) } };
    const floorManifest = { ...floorCore, rootContentId: await computeOverviewRoot(floorCore, overviewDomains.floor) }; writeJson(root, `overview/floors/f${semanticEntry.floor}.json`, floorManifest); floors.push({ floor: semanticEntry.floor, path: `floors/f${semanticEntry.floor}.json`, rootContentId: floorManifest.rootContentId });
  }
  const worldCore = { profile: overviewProfiles.world, cellSizeTiles: 8, source: { authority: 'Oteryn/Oteryn-Game', publicationRoot, semanticRoot: map.semanticWorld.rootContentId, sourceFingerprint: map.sourceFingerprint }, semantics: { walkability: 'NOT_CLAIMED', collision: 'NOT_CLAIMED', terrainClassification: 'NOT_CLAIMED' }, floors, counts: { cells: totalCells, chunks: map.chunks.length, floors: FLOORS.length, resolvedPrimitives: map.runtimeWorld.counts.resolvedPrimitives, tiles: map.runtimeWorld.counts.tiles } };
  const world = { ...worldCore, rootContentId: await computeOverviewRoot(worldCore, overviewDomains.world) }; writeJson(root, 'overview/world.json', world); return world;
}
async function buildMinimap(root, publicationRoot, pixelRoot, anchors, map) {
  const tileContentId = await sha256ContentId(MINIMAP_PNG); const bounds = alignBounds(anchors, 256); const floors = []; let tileCount = 0;
  for (const floor of FLOORS) {
    const regions = new Map();
    for (const anchor of anchors.filter((entry) => entry.floor === floor)) regions.set(`${Math.floor(anchor.x / 256)}:${Math.floor(anchor.y / 256)}`, { region_x: Math.floor(anchor.x / 256), region_y: Math.floor(anchor.y / 256) });
    const chunks = [];
    for (const region of [...regions.values()].sort((a, b) => a.region_y - b.region_y || a.region_x - b.region_x)) {
      const relative = `tiles/f${floor}-r${region.region_x}-c${region.region_y}.png`; writeBytes(root, `minimap/${relative}`, MINIMAP_PNG); tileCount += 1;
      const sourceChunk = map.chunks.find((chunk) => chunk.floor === floor) ?? map.chunks[0]; chunks.push({ logicalAddress: { floor, ...region }, path: relative, bytes: MINIMAP_PNG.byteLength, contentId: tileContentId, sourceContentId: sourceChunk.contentId });
    }
    const floorCore = { profile: minimapProfiles.floor, floor, regionSpan: 256, pixelPerWorldTile: 1, bounds, chunks, counts: { chunks: chunks.length, tiles: chunks.length } };
    const floorManifest = { ...floorCore, rootContentId: await domainRoot(minimapDomains.floor, floorCore) }; writeJson(root, `minimap/floors/f${floor}.json`, floorManifest); floors.push({ floor, path: `floors/f${floor}.json`, rootContentId: floorManifest.rootContentId });
  }
  const worldCore = { profile: minimapProfiles.world, regionSpan: 256, pixelPerWorldTile: 1, source: { authority: 'Oteryn/Oteryn-Game', publicationRoot, pixelRoot }, semantics: { terrainClassification: 'NOT_CLAIMED', walkability: 'NOT_CLAIMED' }, floors, counts: { floors: FLOORS.length, chunks: tileCount, tiles: tileCount } };
  const world = { ...worldCore, rootContentId: await domainRoot(minimapDomains.world, worldCore) }; writeJson(root, 'minimap/world.json', world); return world;
}
async function buildCreatures(root, selected, catalog, semanticRoot, animation) {
  const grouped = new Map();
  for (const record of selected) {
    const chunk_x = Math.floor(record.position.x / 64); const chunk_y = Math.floor(record.position.y / 64); const key = `${record.position.floor}:${chunk_x}:${chunk_y}`;
    if (!grouped.has(key)) grouped.set(key, { floor: record.position.floor, chunk_x, chunk_y, records: [] });
    grouped.get(key).records.push({ ...record, name: record.label, presentation_resolution_state: 'FALLBACK_MARKER', presentation_fallback: 'factual-marker' });
  }
  const chunks = [];
  for (const group of [...grouped.values()].sort((a, b) => a.floor - b.floor || a.chunk_y - b.chunk_y || a.chunk_x - b.chunk_x)) {
    const value = { floor: group.floor, chunk_x: group.chunk_x, chunk_y: group.chunk_y, records: group.records.sort((a, b) => a.record_id.localeCompare(b.record_id)) }; const bytes = canonicalJsonBytes(value); const relative = `chunks/f${group.floor}/${group.chunk_x}_${group.chunk_y}.json`; writeBytes(root, `data/creatures/${relative}`, bytes); chunks.push({ floor: group.floor, chunk_x: group.chunk_x, chunk_y: group.chunk_y, path: relative, bytes: bytes.length, digest: sha(bytes), records: value.records.length });
  }
  const search = { records: selected }; const searchBytes = canonicalJsonBytes(search); writeBytes(root, 'data/creatures/search.json', searchBytes);
  const source = { contract_id: BOUNDED_REAL_SOURCE_CONTRACT, capability: BOUNDED_REAL_CREATURE_CAPABILITY, semantic_digest: catalog.source.semantic_digest, npc_role_schema_version: catalog.source.npc_role_schema_version, fixture_id: BOUNDED_REAL_WORLD_ID, appearance_product_root: animation.source.appearance_product_root, outfit_spatial_product_root: animation.source.outfit_spatial_product_root, coordinate_profile: catalog.source.coordinate_profile, semantic_revision: catalog.source.semantic_revision };
  const index = { schema_version: 1, source, chunk_size: 64, counts: { chunks: chunks.length, records: selected.length, search_records: selected.length }, search_path: 'search.json', search_bytes: searchBytes.length, search_digest: sha(searchBytes), chunks }; writeJson(root, 'data/creatures/index.json', index); return { index, search };
}
function copyRealAncillary(root, sourceRoot) {
  for (const relative of ['web/semantic-search/index.json', 'web/semantic-search/creatures.json']) writeBytes(root, relative, fs.readFileSync(path.join(sourceRoot, relative)));
  fs.cpSync(path.join(sourceRoot, 'web/creature-gameplay'), path.join(root, 'web/creature-gameplay'), { recursive: true, errorOnExist: true });
}
function boundedTrustDescriptor(manifest) {
  return Object.freeze({ marker: 'oteryn-atlas-bounded-real-trust-v1', fixtureId: manifest.fixtureId, dataCapability: manifest.dataCapability, publicationRoot: manifest.publicationRoot, semanticRoot: manifest.semanticRoot, pixelRoot: manifest.pixelRoot, overviewRoot: manifest.overviewRoot, minimapRoot: manifest.minimapRoot, runtimeIndexRoot: manifest.runtimeIndexRoot, pixelBucketRoot: manifest.pixelBucketRoot, sourceFingerprint: manifest.sourceFingerprint, productDigest: manifest.productDigest });
}
export async function buildBoundedRealWorld(destination, { sourceRoot } = {}) {
  if (!sourceRoot) throw new TypeError('bounded-real sourceRoot is required');
  const source = path.resolve(sourceRoot); const root = path.resolve(destination); if (fs.existsSync(root)) throw new TypeError('bounded-real destination already exists'); fs.mkdirSync(root, { recursive: true });
  const { catalog, selected, anchors } = stableAnchors(source); const pixel = await buildPixelPublication(root); const map = await buildMap(root, anchors, pixel); const pixelBuckets = await buildRuntimePixelBuckets(root, map.publication.rootContentId, pixel.manifest.rootContentId, pixel.pixelContentId, pixel.pixels); const overview = await buildOverview(root, map.publication.rootContentId, map); const minimap = await buildMinimap(root, map.publication.rootContentId, pixel.manifest.rootContentId, anchors, map); const animation = await buildAnimation(root, map.semanticWorld.rootContentId, pixel.manifest.rootContentId, pixel.pixelContentId, pixel.pixels); await buildCreatures(root, selected, catalog, map.semanticWorld.rootContentId, animation); copyRealAncillary(root, source);
  const realSemantic = fs.readFileSync(path.join(source, 'web/semantic-search/index.json')); const realCreatures = fs.readFileSync(path.join(source, 'web/semantic-search/creatures.json')); const realGameplay = fs.readFileSync(path.join(source, 'web/creature-gameplay/manifest.json'));
  const files = productEntries(root); const result = Object.freeze({ fixtureId: BOUNDED_REAL_WORLD_ID, dataCapability: 'bounded_real_world', mapAuthority: false, targetEntityIds: [...TARGET_ENTITY_IDS], publicationRoot: map.publication.rootContentId, semanticRoot: map.semanticWorld.rootContentId, pixelRoot: pixel.manifest.rootContentId, runtimeIndexRoot: map.runtimeWorld.rootContentId, pixelBucketRoot: pixelBuckets.rootContentId, overviewRoot: overview.rootContentId, minimapRoot: minimap.rootContentId, sourceFingerprint: map.sourceFingerprint, sourceDigests: { semanticSearch: sha(realSemantic), creatureCatalog: sha(realCreatures), creatureGameplay: sha(realGameplay), creatureSemantic: catalog.source.semantic_digest }, productDigest: canonicalDigest(files), files }); writeJson(root, 'bounded-real-manifest.json', result); return result;
}
function filesystemFetcher(root) {
  const base = path.resolve(root); return async (url) => { const relative = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, ''); const target = path.resolve(base, ...relative.split('/')); if (!target.startsWith(`${base}${path.sep}`)) return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }; let bytes; try { bytes = fs.readFileSync(target); } catch { return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }; } return { ok: true, status: 200, headers: { get: (name) => String(name).toLowerCase() === 'content-length' ? String(bytes.length) : null }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }; };
}
export async function verifyBoundedRealWorld(root) {
  const manifest = readJson(root, 'bounded-real-manifest.json'); const files = productEntries(root); if (canonicalDigest(files) !== canonicalDigest(manifest.files) || canonicalDigest(files) !== manifest.productDigest) throw new TypeError('bounded-real world digest mismatch'); if (manifest.fixtureId !== BOUNDED_REAL_WORLD_ID || manifest.dataCapability !== 'bounded_real_world' || manifest.mapAuthority !== false) throw new TypeError('bounded-real world identity mismatch'); for (const field of ['publicationRoot', 'semanticRoot', 'pixelRoot', 'runtimeIndexRoot', 'pixelBucketRoot', 'overviewRoot', 'minimapRoot', 'sourceFingerprint', 'productDigest']) if (!/^sha256:[0-9a-f]{64}$/.test(manifest[field])) throw new TypeError(`bounded-real world ${field} invalid`);
  const trust = resolveBoundedRealManifestTrust(boundedTrustDescriptor(manifest)); const ancillary = ancillarySourceExpectations(trust); const fetcher = filesystemFetcher(root); const animation = await loadAnimationRuntime(new URL('https://bounded.invalid/animation/'), fetcher, ancillary.animation); const creatureIndex = readJson(root, 'data/creatures/index.json'); validateCreaturePublicationSource(creatureIndex.source, animation.manifest.source, ancillary.creatures); const creatureSearch = readJson(root, 'data/creatures/search.json'); validateCreatureSearchRecords(creatureSearch.records); for (const entityId of TARGET_ENTITY_IDS) if (creatureSearch.records.filter((record) => record.entity_id === entityId).length !== 1) throw new TypeError(`bounded-real target ${entityId} missing`); const semanticIndex = readJson(root, 'web/semantic-search/index.json'); validateSemanticSearchIndex(semanticIndex, ancillary.semanticSearch); const semanticCreatures = readJson(root, 'web/semantic-search/creatures.json'); validateCreatureSearchCatalog(semanticCreatures, ancillary.semanticSearch); await validateCreatureGameplayManifest(readJson(root, 'web/creature-gameplay/manifest.json')); return Object.freeze(manifest);
}
export function boundedRealTrustDescriptor(manifest) { return boundedTrustDescriptor(manifest); }
