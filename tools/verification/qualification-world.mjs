import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

import { canonicalJsonBytes, sha256ContentId } from '../../src/browser/loader.mjs';
import { loadAnimationRuntime } from '../../src/browser/animation-runtime.mjs';
import { validateCreaturePublicationSource } from '../../src/browser/creature-publication-source.mjs';
import { validateCreatureSearchCatalog, validateCreatureSearchRecords } from '../../src/browser/creature-search.mjs';
import { ancillarySourceExpectations, resolveQualificationManifestTrust } from '../../src/browser/fullworld-trust.mjs';
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
import {
  QUALIFICATION_ACTIVE_FLOOR, QUALIFICATION_CENTER, QUALIFICATION_CREATURES, QUALIFICATION_FIXTURE_ID,
  QUALIFICATION_SEMANTIC_RECORD, QUALIFICATION_SOURCE_CONTRACT,
} from './qualification-fixture-definition.mjs';

const FIXTURE_ID = QUALIFICATION_FIXTURE_ID;
const QUALIFICATION_TRUST_MARKER = 'oteryn-atlas-qualification-trust-v1';
const SOURCE_FINGERPRINT = 'sha256:5af8a7b6d6cb61bf6a430842141a658d3ba183f6e2ec5e3d9a7ea39ccf866d72';
const FLOORS = Object.freeze([-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]);
const ACTIVE_FLOOR = QUALIFICATION_ACTIVE_FLOOR;
const CHUNK_PATH = 'chunks/f-7-r1008-c1004.jsonl';
const REGION_XS = Object.freeze([1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015]);
const REGION_YS = Object.freeze([1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011]);
const BOUNDS = Object.freeze({ x_min: 32224, x_max_exclusive: 32512, y_min: 32096, y_max_exclusive: 32384 });
const PIXEL_BYTES = 32 * 32 * 4;

function sha(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function canonicalDigest(value) { return sha(canonicalJsonBytes(value)); }
function domainRoot(domain, value) {
  const core = { ...value }; delete core.rootContentId;
  return sha256ContentId(Buffer.concat([Buffer.from(domain), Buffer.from(canonicalJsonBytes(core))]));
}
function writeJson(root, relative, value) {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, canonicalJsonBytes(value));
}
function writeBytes(root, relative, value) {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value);
}
function fixtureTile(position = QUALIFICATION_CENTER) {
  const identity = position.x === QUALIFICATION_CENTER.x && position.y === QUALIFICATION_CENTER.y && position.floor === QUALIFICATION_CENTER.floor
    ? 'qualification-fixture-anchor' : `qualification-fixture-${position.floor}-${position.x}-${position.y}`;
  return {
    record_type: 'tile', position: { ...position }, source_position: { legacy_x: position.x, legacy_y: position.y, legacy_z: 7 },
    tile_record_id: `tile:${identity}`, presentation: [{ export_record_id: `presentation:${identity}`, appearance_source_id: 1, entity_identity_state: 'UNRESOLVED', presentation_order: { order: 0, plane: 0 }, source_role: 'ground', resolved_primitives: [{ sprite_source_id: 1, width_units: 32, height_units: 32, displacement: { dx_units: 0, dy_units: 0 }, source_profile_id: 'oteryn-atlas-15-32-appearance-spatial-v1', layer_index: 0, phase: 0, pattern: { x: 0, y: 0, z: 0 }, visual_coverage_offsets: [0, 0] }] }],
  };
}
function fixturePixels() {
  const bytes = Buffer.alloc(PIXEL_BYTES);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const pixel = offset / 4;
    const x = pixel % 32;
    const y = Math.floor(pixel / 32);
    bytes[offset] = 40 + ((x * 5) % 160);
    bytes[offset + 1] = 70 + ((y * 3) % 150);
    bytes[offset + 2] = 120 + (((x + y) * 2) % 120);
    bytes[offset + 3] = 255;
  }
  return bytes;
}
function productEntries(root) {
  const out = [];
  const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); const relative = path.relative(root, full).replaceAll(path.sep, '/'); if (entry.isDirectory()) walk(full); else if (relative !== 'fixture-manifest.json') { const bytes = fs.readFileSync(full); out.push({ path: relative, bytes: bytes.length, digest: sha(bytes) }); } } };
  walk(root); return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function buildPixelPublication(root) {
  const pixels = fixturePixels();
  const pixelContentId = await sha256ContentId(pixels);
  const packSha = sha(pixels).slice('sha256:'.length);
  const core = {
    profile: PIXEL_PROFILE,
    pixelHashDomain: PIXEL_HASH_DOMAIN,
    runtimePlacement: { identityAuthority: false },
    packs: [{ path: 'packs/p0.rgba', bytes: pixels.length, sha256: packSha, identityAuthority: false }],
    blobs: [{ contentId: pixelContentId, pack: 0, width: 32, height: 32, offset: 0, bytes: pixels.length }],
    spriteIndex: { '1': { contentId: pixelContentId, width: 32, height: 32 } },
    counts: { spriteRefs: 1, uniquePixelBlobs: 1, rawBytesAfterDedupe: pixels.length },
  };
  const manifest = { ...core, rootContentId: await domainRoot(PIXEL_ROOT_DOMAIN, core) };
  writeJson(root, 'publication/pixels/manifest.json', manifest);
  writeBytes(root, 'publication/pixels/packs/p0.rgba', pixels);
  return { manifest, pixelContentId, pixels };
}

async function buildRuntimePixelBuckets(root, publicationRoot, pixelRoot, pixelContentId, pixels) {
  const bucket = pixelContentId.slice('sha256:'.length, 'sha256:'.length + 1);
  const bucketPath = `buckets/${bucket}.rgba`;
  const bundlePath = 'local-max.rgba';
  const contentId = await sha256ContentId(pixels);
  const sha256 = contentId.slice('sha256:'.length);
  const core = {
    profile: RUNTIME_PIXEL_BUCKET_PROFILE,
    identityAuthority: false,
    source: { authority: 'Oteryn/Oteryn-Game', publicationRoot, pixelRoot },
    bucketNibbles: 1,
    buckets: [{ bucket, path: bucketPath, identityAuthority: false, bytes: pixels.length, contentId, sha256 }],
    localMaxBundle: { path: bundlePath, identityAuthority: false, bytes: pixels.length, contentId, sha256, bucketOffsets: [{ bucket, offset: 0, bytes: pixels.length }] },
    blobIndex: { [pixelContentId]: { bucket, offset: 0, bytes: pixels.length, width: 32, height: 32 } },
    counts: { buckets: 1, blobs: 1, bytes: pixels.length },
  };
  const manifest = { ...core, rootContentId: await domainRoot(RUNTIME_PIXEL_BUCKET_DOMAIN, core) };
  writeJson(root, 'pixel-buckets/manifest.json', manifest);
  writeBytes(root, `pixel-buckets/${bucketPath}`, pixels);
  writeBytes(root, `pixel-buckets/${bundlePath}`, pixels);
  return manifest;
}

async function buildOverview(root, publicationRoot, semanticWorld, semanticFloors, activeChunks) {
  const floors = [];
  for (const semanticEntry of semanticFloors) {
    const floor = semanticEntry.floor;
    const active = floor === ACTIVE_FLOOR;
    const chunks = [];
    if (active) {
      for (const sourceChunk of activeChunks) {
        const { region_x: regionX, region_y: regionY } = sourceChunk.logicalAddress;
        const chunkCore = {
          profile: overviewProfiles.chunk,
          logicalAddress: { floor, region_x: regionX, region_y: regionY },
          sourceContentId: sourceChunk.contentId,
          sourceFingerprint: SOURCE_FINGERPRINT,
          cellSizeTiles: 8,
          cells: [{ cell_x: Math.floor(sourceChunk.position.x / 8), cell_y: Math.floor(sourceChunk.position.y / 8), tiles: 1, resolvedPrimitives: 1 }],
          counts: { cells: 1, resolvedPrimitives: 1, tiles: 1 },
        };
        const bytes = canonicalJsonBytes(chunkCore);
        const relative = `chunks/f${floor}-r${regionX}-c${regionY}.json`;
        writeBytes(root, `overview/${relative}`, bytes);
        chunks.push({ logicalAddress: chunkCore.logicalAddress, path: relative, bytes: bytes.length, contentId: await sha256ContentId(bytes), sourceContentId: sourceChunk.contentId, counts: chunkCore.counts });
      }
    }
    const floorCore = {
      profile: overviewProfiles.floor,
      floor,
      cellSizeTiles: 8,
      sourceFingerprint: SOURCE_FINGERPRINT,
      sourceFloorRoot: semanticEntry.rootContentId,
      bounds: BOUNDS,
      chunks,
      counts: { cells: chunks.reduce((sum, entry) => sum + entry.counts.cells, 0), chunks: chunks.length, resolvedPrimitives: chunks.reduce((sum, entry) => sum + entry.counts.resolvedPrimitives, 0), tiles: chunks.reduce((sum, entry) => sum + entry.counts.tiles, 0) },
    };
    const floorManifest = { ...floorCore, rootContentId: await computeOverviewRoot(floorCore, overviewDomains.floor) };
    writeJson(root, `overview/floors/f${floor}.json`, floorManifest);
    floors.push({ floor, path: `floors/f${floor}.json`, rootContentId: floorManifest.rootContentId });
  }
  const worldCore = {
    profile: overviewProfiles.world,
    cellSizeTiles: 8,
    source: { authority: 'Oteryn/Oteryn-Game', publicationRoot, semanticRoot: semanticWorld.rootContentId, sourceFingerprint: SOURCE_FINGERPRINT },
    semantics: { walkability: 'NOT_CLAIMED', collision: 'NOT_CLAIMED', terrainClassification: 'NOT_CLAIMED' },
    floors,
    counts: { cells: activeChunks.length, chunks: activeChunks.length, floors: FLOORS.length, resolvedPrimitives: activeChunks.length, tiles: activeChunks.length },
  };
  const world = { ...worldCore, rootContentId: await computeOverviewRoot(worldCore, overviewDomains.world) };
  writeJson(root, 'overview/world.json', world);
  return world;
}

// A deterministic RGBA PNG with unfiltered rows; pixels are the bounded
// visual projection of published tile pixels, never terrain/gameplay authority.
function minimapPng(rgba) {
  function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
    size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, body, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(256, 0); header.writeUInt32BE(256, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(256 * 1025);
  for (let y = 0; y < 256; y++) rgba.copy(rows, y * 1025 + 1, y * 1024, (y + 1) * 1024);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function buildMinimap(root, publicationRoot, pixelRoot, activeChunks, pixels) {
  const color = [0, 0, 0, 255];
  for (let channel = 0; channel < 3; channel++) {
    let sum = 0;
    for (let offset = channel; offset < pixels.length; offset += 4) sum += pixels[offset];
    color[channel] = Math.round(sum / (pixels.length / 4));
  }
  const tiles = [];
  for (let regionX = Math.floor(BOUNDS.x_min / 256); regionX <= Math.floor((BOUNDS.x_max_exclusive - 1) / 256); regionX++) {
    for (let regionY = Math.floor(BOUNDS.y_min / 256); regionY <= Math.floor((BOUNDS.y_max_exclusive - 1) / 256); regionY++) {
      const rgba = Buffer.alloc(256 * 256 * 4);
      const sources = activeChunks.filter(chunk => Math.floor(chunk.position.x / 256) === regionX && Math.floor(chunk.position.y / 256) === regionY);
      for (const source of sources) {
        const offset = ((source.position.y - regionY * 256) * 256 + source.position.x - regionX * 256) * 4;
        rgba.set(color, offset);
      }
      const png = minimapPng(rgba), relative = `tiles/f${ACTIVE_FLOOR}-r${regionX}-c${regionY}.png`;
      writeBytes(root, `minimap/${relative}`, png);
      tiles.push({ logicalAddress: { floor: ACTIVE_FLOOR, region_x: regionX, region_y: regionY }, path: relative,
        bytes: png.length, contentId: await sha256ContentId(png), sourceContentId: canonicalDigest(sources.map(source => source.contentId)) });
    }
  }
  const floors = [];
  for (const floor of FLOORS) {
    const chunks = floor === ACTIVE_FLOOR ? tiles : [];
    const floorCore = { profile: minimapProfiles.floor, floor, regionSpan: 256, pixelPerWorldTile: 1,
      bounds: BOUNDS, chunks, counts: { chunks: chunks.length, tiles: chunks.length } };
    const floorManifest = { ...floorCore, rootContentId: await domainRoot(minimapDomains.floor, floorCore) };
    writeJson(root, `minimap/floors/f${floor}.json`, floorManifest);
    floors.push({ floor, path: `floors/f${floor}.json`, rootContentId: floorManifest.rootContentId });
  }
  const worldCore = { profile: minimapProfiles.world, regionSpan: 256, pixelPerWorldTile: 1,
    source: { authority: 'Oteryn/Oteryn-Game', publicationRoot, pixelRoot },
    semantics: { terrainClassification: 'NOT_CLAIMED', walkability: 'NOT_CLAIMED' }, floors,
    counts: { floors: FLOORS.length, chunks: tiles.length, tiles: tiles.length } };
  const world = { ...worldCore, rootContentId: await domainRoot(minimapDomains.world, worldCore) };
  writeJson(root, 'minimap/world.json', world);
  return world;
}

function creatureSearchRecord(record) {
  const value = {
    kind: record.kind,
    label: record.name,
    record_id: record.record_id,
    entity_id: record.entity_id,
    position: { ...record.position },
    resolution_state: record.resolution_state,
    provenance: {
      authority: 'Oteryn/Oteryn-Atlas',
      source_capability: 'qualification-creatures-v1',
      fixture_id: FIXTURE_ID,
      resolution_state: record.resolution_state,
    },
  };
  if (record.kind === 'npc') {
    value.role_resolution_state = record.role_resolution_state;
    value.roles = [...record.roles];
  }
  if (record.outfit_presentation) value.outfit_presentation = { ...record.outfit_presentation };
  return value;
}

async function buildQualificationAnimation(root, semanticRoot, pixelRoot, contentId, pixels) {
  const bucketId = 'q0000';
  const bucketPath = `buckets/${bucketId}.rgba`;
  const secondPhase = Buffer.from(pixels);
  for (let offset = 0; offset < secondPhase.length; offset += 4) {
    secondPhase[offset] = 255 - secondPhase[offset];
    secondPhase[offset + 1] = (secondPhase[offset + 1] + 73) % 256;
  }
  const secondContentId = await sha256ContentId(secondPhase);
  if (secondContentId === contentId) throw new TypeError('qualification animation phases must have distinct content identities');
  const bucketBytes = Buffer.concat([pixels, secondPhase]);
  const dynamic = QUALIFICATION_CREATURES.filter((record) => record.outfit_presentation).map((record) => ({
    animation: {
      default_start_phase: 0,
      loop_count: 0,
      loop_type: 'infinite',
      presentation_durations_ms: [120, 120],
      synchronized: true,
    },
    animation_program_id: `animation-program:${record.record_id}`,
    displacement: { x: 0, y: 0 },
    height: 32,
    outfit_presentation_id: record.outfit_presentation.outfit_presentation_id,
    phase_content_ids: [contentId, secondContentId],
    phase_count: 2,
    selection_policy: 'qualification-dynamic-phase-v1',
    width: 32,
  }));
  const program = {
    profile: 'oteryn-atlas-animation-runtime-v1',
    object_programs: [{
      animation_program_id: 'animation-program:qualification-world-ground',
      appearance_source_id: 1,
      animation: {
        default_start_phase: 0,
        loop_count: 0,
        loop_type: 'infinite',
        presentation_durations_ms: [120, 120],
        synchronized: true,
      },
      phase_count: 2,
      layers: 1,
      patterns: { width: 1, height: 1, depth: 1 },
      sprite_source_ids: [1, 2],
    }],
    creature_programs: dynamic,
    sprite_index: {
      '1': { content_id: contentId },
      '2': { content_id: secondContentId },
    },
    blob_index: {
      [contentId]: { bucket: bucketId, bytes: pixels.length, height: 32, offset: 0, width: 32 },
      [secondContentId]: { bucket: bucketId, bytes: secondPhase.length, height: 32, offset: pixels.length, width: 32 },
    },
  };
  const programBytes = canonicalJsonBytes(program);
  const manifestCore = {
    profile: 'oteryn-atlas-animation-runtime-v1',
    identityAuthority: false,
    source: {
      game_sha: 'fixture',
      fixture_id: FIXTURE_ID,
      source_contract: QUALIFICATION_SOURCE_CONTRACT,
      appearance_product_root: pixelRoot,
      outfit_spatial_product_root: semanticRoot,
    },
    buckets: [{ id: bucketId, path: bucketPath, bytes: bucketBytes.length, digest: sha(bucketBytes) }],
    programs: { path: 'programs.json', bytes: programBytes.length, digest: sha(programBytes) },
  };
  const manifest = { ...manifestCore, rootContentId: canonicalDigest(manifestCore) };
  writeJson(root, 'animation/manifest.json', manifest);
  writeBytes(root, 'animation/programs.json', programBytes);
  writeBytes(root, `animation/${bucketPath}`, bucketBytes);
  return manifest;
}

async function buildQualificationCreatures(root, semanticRoot, animation) {
  const chunkX = 504;
  const chunkY = 502;
  const chunkPath = `chunks/f${ACTIVE_FLOOR}/${chunkX}_${chunkY}.json`;
  const chunk = {
    floor: ACTIVE_FLOOR,
    chunk_x: chunkX,
    chunk_y: chunkY,
    records: QUALIFICATION_CREATURES.map((record) => ({
      ...record,
      position: { ...record.position },
      roles: record.roles ? [...record.roles] : undefined,
      spawn_area: record.spawn_area ? { center: { ...record.spawn_area.center }, radius: record.spawn_area.radius } : undefined,
      outfit_presentation: record.outfit_presentation ? { ...record.outfit_presentation } : undefined,
    })),
  };
  for (const record of chunk.records) {
    if (record.roles === undefined) delete record.roles;
    if (record.spawn_area === undefined) delete record.spawn_area;
    if (record.outfit_presentation === undefined) delete record.outfit_presentation;
  }
  const chunkBytes = canonicalJsonBytes(chunk);
  const search = { records: QUALIFICATION_CREATURES.map(creatureSearchRecord) };
  const searchBytes = canonicalJsonBytes(search);
  const source = {
    contract_id: QUALIFICATION_SOURCE_CONTRACT,
    capability: 'qualification-creatures-v1',
    semantic_digest: semanticRoot,
    npc_role_schema_version: 1,
    fixture_id: FIXTURE_ID,
    appearance_product_root: animation.source.appearance_product_root,
    outfit_spatial_product_root: animation.source.outfit_spatial_product_root,
    coordinate_profile: 'oteryn-native-floor-v1',
    semantic_revision: 1,
  };
  const index = {
    schema_version: 1,
    source,
    chunk_size: 64,
    counts: { chunks: 1, records: chunk.records.length, search_records: search.records.length },
    search_path: 'search.json',
    search_bytes: searchBytes.length,
    search_digest: sha(searchBytes),
    chunks: [{
      floor: ACTIVE_FLOOR,
      chunk_x: chunkX,
      chunk_y: chunkY,
      path: chunkPath,
      bytes: chunkBytes.length,
      digest: sha(chunkBytes),
      records: chunk.records.length,
    }],
  };
  writeJson(root, 'data/creatures/index.json', index);
  writeBytes(root, 'data/creatures/search.json', searchBytes);
  writeBytes(root, `data/creatures/${chunkPath}`, chunkBytes);
  return { index, search };
}

function semanticRanking() {
  return {
    contains_alias: 500, contains_label: 600, exact_alias: 900, exact_id: 1100,
    exact_label: 1000, prefix_alias: 700, prefix_id: 850, prefix_label: 800,
  };
}
async function buildQualificationSearch(root, semanticRoot, creatureSearch) {
  const semanticRecord = {
    ...QUALIFICATION_SEMANTIC_RECORD,
    aliases: [...QUALIFICATION_SEMANTIC_RECORD.aliases],
    capabilities: [...QUALIFICATION_SEMANTIC_RECORD.capabilities],
    position: { ...QUALIFICATION_SEMANTIC_RECORD.position },
    provenance: { ...QUALIFICATION_SEMANTIC_RECORD.provenance },
    search_terms: { label: QUALIFICATION_SEMANTIC_RECORD.search_terms.label, aliases: [...QUALIFICATION_SEMANTIC_RECORD.search_terms.aliases] },
  };
  const syntheticRecords = Array.from({ length: 48 }, (_, index) => {
    const ordinal = String(index + 1).padStart(2, '0');
    const label = `Fixture Point ${ordinal}`;
    const alias = `Qualification POI ${ordinal}`;
    return {
      kind: 'poi',
      id: `semantic-record:qualification-poi-${ordinal}`,
      label,
      aliases: [alias],
      capabilities: ['overlay-point'],
      position: { x: 32258 + (index % 24), y: 32130 + Math.floor(index / 24), floor: ACTIVE_FLOOR },
      bounds: null,
      provenance: { authority: 'Oteryn/Oteryn-Atlas', source_capability: 'qualification-semantic-search-v1', fixture_id: FIXTURE_ID },
      search_terms: { label: label.toLowerCase(), aliases: [alias.toLowerCase()] },
    };
  });
  const semanticRecords = [semanticRecord, ...syntheticRecords];
  const indexCore = {
    schema_version: 1,
    source: {
      authority: 'Oteryn/Oteryn-Atlas', repository: 'Oteryn/Oteryn-Atlas',
      contract_id: QUALIFICATION_SOURCE_CONTRACT, capability: 'qualification-semantic-search-v1',
      profile_id: 'oteryn-atlas-qualification-semantic-search-v1', game_revision: 'fixture',
      fixture_id: FIXTURE_ID, semantic_digest: semanticRoot, records: semanticRecords.length,
    },
    input_floor_aliases: Object.fromEntries(FLOORS.map((floor) => [String(floor), floor])),
    ranking: semanticRanking(), records: semanticRecords,
  };
  const index = { ...indexCore, index_digest: canonicalDigest(indexCore.records) };
  const catalog = {
    schema_version: 1,
    source: {
      contract_id: QUALIFICATION_SOURCE_CONTRACT,
      capability: 'qualification-creatures-v1',
      coordinate_profile: 'oteryn-native-floor-v1',
      semantic_digest: semanticRoot,
      fixture_id: FIXTURE_ID,
      semantic_revision: 1,
    },
    records: creatureSearch.records,
  };
  writeJson(root, 'web/semantic-search/index.json', index);
  writeJson(root, 'web/semantic-search/creatures.json', catalog);
  return { index, catalog };
}

export async function buildQualificationWorld(destination) {
  const root = path.resolve(destination);
  if (fs.existsSync(root)) throw new TypeError('qualification world destination already exists');
  fs.mkdirSync(root, { recursive: true });

  const pixel = await buildPixelPublication(root);
  const activeChunks = [];
  for (const regionX of REGION_XS) {
    for (const regionY of REGION_YS) {
      const position = regionX === 1008 && regionY === 1004
        ? QUALIFICATION_CENTER
        : { x: regionX * 32 + 16, y: regionY * 32 + 16, floor: ACTIVE_FLOOR };
      const bytes = new TextEncoder().encode(`${JSON.stringify(fixtureTile(position))}\n`);
      const contentId = await sha256ContentId(bytes);
      const relative = `chunks/f-7-r${regionX}-c${regionY}.jsonl`;
      writeBytes(root, `publication/semantic/${relative}`, bytes);
      activeChunks.push({
        logicalAddress: { floor: ACTIVE_FLOOR, region_x: regionX, region_y: regionY },
        contentId,
        bytes: bytes.byteLength,
        tiles: 1,
        resolvedPrimitives: 1,
        path: relative,
        position,
        bounds: { x_min: regionX * 32, x_max_exclusive: (regionX + 1) * 32, y_min: regionY * 32, y_max_exclusive: (regionY + 1) * 32 },
      });
    }
  }
  const anchorChunk = activeChunks.find((chunk) => chunk.path === CHUNK_PATH);
  if (!anchorChunk) throw new TypeError('qualification anchor chunk missing');
  const totalChunkBytes = activeChunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  const semanticFloors = [];
  const runtimeFloorSeeds = [];
  for (const floor of FLOORS) {
    const chunks = floor === ACTIVE_FLOOR
      ? activeChunks.map(({ position, bounds, ...chunk }) => ({ ...chunk, logicalAddress: { ...chunk.logicalAddress } }))
      : [];
    const counts = floor === ACTIVE_FLOOR
      ? { bytes: totalChunkBytes, resolvedPrimitives: activeChunks.length, tiles: activeChunks.length }
      : { bytes: 0, resolvedPrimitives: 0, tiles: 0 };
    const semanticCore = { profile: SEMANTIC_PROFILE, floor, bounds: BOUNDS, sourceFingerprint: SOURCE_FINGERPRINT, chunks, counts };
    const semantic = { ...semanticCore, rootContentId: await rootedContentId(FLOOR_DOMAIN, semanticCore) };
    writeJson(root, `publication/semantic/floors/f${floor}.json`, semantic);
    semanticFloors.push({ floor, path: `floors/f${floor}.json`, rootContentId: semantic.rootContentId, counts });
    runtimeFloorSeeds.push({ floor, semantic });
  }
  const semanticCore = { profile: SEMANTIC_PROFILE, fabricRoot: `fixture:${FIXTURE_ID}`, sourceFingerprint: SOURCE_FINGERPRINT, floors: semanticFloors, counts: { floors: 16, shards: activeChunks.length, tiles: activeChunks.length, resolvedPrimitives: activeChunks.length, uniqueSpriteRefs: 1, bytes: totalChunkBytes } };
  const semanticWorld = { ...semanticCore, rootContentId: await rootedContentId(SEMANTIC_DOMAIN, semanticCore) };
  writeJson(root, 'publication/semantic/world.json', semanticWorld);

  const publicationCore = { profile: PUBLICATION_PROFILE, source: { authority: 'Oteryn/Oteryn-Game', handoffSha256: `fixture:${FIXTURE_ID}`, fabricRoot: `fixture:${FIXTURE_ID}`, sourceFingerprint: SOURCE_FINGERPRINT, gameSha: 'fixture', canonicalWorldId: null, canonicalWorldIdState: 'FIXTURE_NOT_AUTHORITY' }, semantic: { path: 'semantic/world.json', rootContentId: semanticWorld.rootContentId }, pixels: { path: 'pixels/manifest.json', rootContentId: pixel.manifest.rootContentId }, serializerStatus: 'QUALIFICATION_FIXTURE' };
  const publication = { ...publicationCore, rootContentId: await rootedContentId(PUBLICATION_DOMAIN, publicationCore) };
  writeJson(root, 'publication/publication.json', publication);

  const runtimeWorldCore = { profile: RUNTIME_WORLD_PROFILE, source: { authority: 'Oteryn/Oteryn-Game', publicationRoot: publication.rootContentId, semanticRoot: semanticWorld.rootContentId, pixelRoot: pixel.manifest.rootContentId, sourceFingerprint: SOURCE_FINGERPRINT }, regionSpan: 32, rowGroupSpan: 1, floors: [], counts: { floors: 16, groups: activeChunks.length, resolvedPrimitives: activeChunks.length, shards: activeChunks.length, sourceBytes: totalChunkBytes, tiles: activeChunks.length }, visualBounds: { maxWidthUnits: 32, maxHeightUnits: 32, minDxUnits: 0, maxDxUnits: 0, minDyUnits: 0, maxDyUnits: 0, overscanTiles: { left: 0, right: 0, top: 0, bottom: 0 } } };
  for (const { floor, semantic } of runtimeFloorSeeds) {
    const chunks = floor === ACTIVE_FLOOR ? activeChunks.map((chunk) => ({
      logicalAddress: { ...chunk.logicalAddress },
      path: chunk.path,
      contentId: chunk.contentId,
      bytes: chunk.bytes,
      worldChunk: {
        identityAuthority: false,
        chunk_id: `qualification-${chunk.logicalAddress.region_x}-${chunk.logicalAddress.region_y}`,
        floor,
        bounds: { ...chunk.bounds },
        semantic_root: semanticWorld.rootContentId,
        pixel_root: pixel.manifest.rootContentId,
        content_hash: chunk.contentId,
        estimated_memory_cost: chunk.bytes,
        dependencies: [semantic.rootContentId, semanticWorld.rootContentId, pixel.manifest.rootContentId],
      },
      groups: [{ offset: 0, bytes: chunk.bytes, contentId: chunk.contentId, yMin: chunk.position.y, yMaxExclusive: chunk.position.y + 1, tiles: 1, resolvedPrimitives: 1 }],
    })) : [];
    const counts = { chunks: chunks.length, groups: chunks.length, resolvedPrimitives: chunks.length, sourceBytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0), tiles: chunks.length };
    const core = { profile: RUNTIME_FLOOR_PROFILE, floor, sourcePublicationRoot: publication.rootContentId, sourceSemanticRoot: semanticWorld.rootContentId, sourceFloorRoot: semantic.rootContentId, sourceFingerprint: SOURCE_FINGERPRINT, regionSpan: 32, rowGroupSpan: 1, bounds: BOUNDS, chunks, counts };
    const runtimeFloor = { ...core, rootContentId: await rootedContentId(RUNTIME_FLOOR_DOMAIN, core) };
    writeJson(root, `runtime-index/floors/f${floor}.json`, runtimeFloor);
    runtimeWorldCore.floors.push({ floor, path: `floors/f${floor}.json`, rootContentId: runtimeFloor.rootContentId, bounds: BOUNDS });
  }
  const runtimeWorld = { ...runtimeWorldCore, rootContentId: await rootedContentId(RUNTIME_WORLD_DOMAIN, runtimeWorldCore) };
  writeJson(root, 'runtime-index/world.json', runtimeWorld);
  const pixelBuckets = await buildRuntimePixelBuckets(root, publication.rootContentId, pixel.manifest.rootContentId, pixel.pixelContentId, pixel.pixels);
  const overview = await buildOverview(root, publication.rootContentId, semanticWorld, semanticFloors, activeChunks);
  const minimap = await buildMinimap(root, publication.rootContentId, pixel.manifest.rootContentId, activeChunks, pixel.pixels);

  const animation = await buildQualificationAnimation(root, semanticWorld.rootContentId, pixel.manifest.rootContentId, pixel.pixelContentId, pixel.pixels);
  const creatures = await buildQualificationCreatures(root, semanticWorld.rootContentId, animation);
  await buildQualificationSearch(root, semanticWorld.rootContentId, creatures.search);
  writeJson(root, 'web/creature-gameplay/qualification-unavailable.json', { fixtureId: FIXTURE_ID, dataCapability: 'qualification_fixture', profileStatus: 'intentionally-unavailable' });

  const files = productEntries(root);
  const result = Object.freeze({
    fixtureId: FIXTURE_ID,
    dataCapability: 'qualification_fixture',
    semanticFloorCount: semanticFloors.length,
    runtimeFloorCount: runtimeWorldCore.floors.length,
    publicationRoot: publication.rootContentId,
    semanticRoot: semanticWorld.rootContentId,
    pixelRoot: pixel.manifest.rootContentId,
    runtimeIndexRoot: runtimeWorld.rootContentId,
    pixelBucketRoot: pixelBuckets.rootContentId,
    overviewRoot: overview.rootContentId,
    minimapRoot: minimap.rootContentId,
    sourceFingerprint: SOURCE_FINGERPRINT,
    productDigest: canonicalDigest(files),
    files,
  });
  writeJson(root, 'fixture-manifest.json', result);
  return result;
}

export function qualificationTrustDescriptor(manifest) {
  resolveQualificationManifestTrust(manifest);
  return Object.freeze({
    marker: QUALIFICATION_TRUST_MARKER,
    fixtureId: manifest.fixtureId,
    dataCapability: manifest.dataCapability,
    publicationRoot: manifest.publicationRoot,
    semanticRoot: manifest.semanticRoot,
    pixelRoot: manifest.pixelRoot,
    runtimeIndexRoot: manifest.runtimeIndexRoot,
    pixelBucketRoot: manifest.pixelBucketRoot,
    overviewRoot: manifest.overviewRoot,
    minimapRoot: manifest.minimapRoot,
    sourceFingerprint: manifest.sourceFingerprint,
    productDigest: manifest.productDigest,
  });
}

function qualificationFilesystemFetcher(root) {
  const base = path.resolve(root);
  return async (url) => {
    const relative = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
    const target = path.resolve(base, ...relative.split('/'));
    if (!target.startsWith(`${base}${path.sep}`)) return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    let bytes;
    try { bytes = fs.readFileSync(target); }
    catch { return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }; }
    return {
      ok: true, status: 200,
      headers: { get: (name) => String(name).toLowerCase() === 'content-length' ? String(bytes.length) : null },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  };
}
export async function verifyQualificationWorld(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'fixture-manifest.json'), 'utf8'));
  const files = productEntries(root);
  if (canonicalDigest(files) !== canonicalDigest(manifest.files) || canonicalDigest(files) !== manifest.productDigest) throw new TypeError('qualification world digest mismatch');
  if (manifest.fixtureId !== FIXTURE_ID || manifest.dataCapability !== 'qualification_fixture' || manifest.semanticFloorCount !== 16 || manifest.runtimeFloorCount !== 16) throw new TypeError('qualification world identity mismatch');
  for (const field of ['publicationRoot', 'semanticRoot', 'pixelRoot', 'runtimeIndexRoot', 'pixelBucketRoot', 'overviewRoot', 'minimapRoot', 'sourceFingerprint']) {
    if (!/^sha256:[0-9a-f]{64}$/.test(manifest[field])) throw new TypeError(`qualification world ${field} invalid`);
  }
  const trust = resolveQualificationManifestTrust(manifest);
  const ancillary = ancillarySourceExpectations(trust);
  const fetcher = qualificationFilesystemFetcher(root);
  const animation = await loadAnimationRuntime(new URL('https://qualification.invalid/animation/'), fetcher, ancillary.animation);
  const creatureIndex = JSON.parse(fs.readFileSync(path.join(root, 'data/creatures/index.json'), 'utf8'));
  validateCreaturePublicationSource(creatureIndex.source, animation.manifest.source, ancillary.creatures);
  const creatureSearch = JSON.parse(fs.readFileSync(path.join(root, 'data/creatures/search.json'), 'utf8'));
  validateCreatureSearchRecords(creatureSearch.records);
  const semanticIndex = JSON.parse(fs.readFileSync(path.join(root, 'web/semantic-search/index.json'), 'utf8'));
  validateSemanticSearchIndex(semanticIndex, ancillary.semanticSearch);
  const semanticCreatures = JSON.parse(fs.readFileSync(path.join(root, 'web/semantic-search/creatures.json'), 'utf8'));
  validateCreatureSearchCatalog(semanticCreatures, ancillary.semanticSearch);  return Object.freeze(manifest);
}
