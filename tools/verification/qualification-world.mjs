import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { canonicalJsonBytes, sha256ContentId } from '../../src/browser/loader.mjs';
import {
  FLOOR_DOMAIN, PUBLICATION_DOMAIN, PUBLICATION_PROFILE, RUNTIME_FLOOR_DOMAIN,
  RUNTIME_WORLD_DOMAIN, RUNTIME_WORLD_PROFILE, RUNTIME_FLOOR_PROFILE,
  SEMANTIC_DOMAIN, SEMANTIC_PROFILE, rootedContentId,
} from '../../src/browser/fullworld.mjs';

const FIXTURE_ID = 'atlas-qualification-world-v1';
const SOURCE_FINGERPRINT = 'sha256:5af8a7b6d6cb61bf6a430842141a658d3ba183f6e2ec5e3d9a7ea39ccf866d72';
const PIXEL_ROOT = 'sha256:14efce8719754b9af3d23b511f360ad6998ee2e747e16b30b1a6f8eceef9291c';
const FLOORS = Object.freeze([-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]);
const ACTIVE_FLOOR = -7;
const CHUNK_PATH = 'chunks/f-7-r1008-c1004.jsonl';
const BOUNDS = Object.freeze({ x_min: 32256, x_max_exclusive: 32288, y_min: 32128, y_max_exclusive: 32160 });

function sha(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function canonicalDigest(value) { return sha(canonicalJsonBytes(value)); }
function writeJson(root, relative, value) {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, canonicalJsonBytes(value));
}
function writeBytes(root, relative, value) {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value);
}
function fixtureTile() {
  return {
    record_type: 'tile', position: { x: 32280, y: 32155, floor: ACTIVE_FLOOR }, source_position: { legacy_x: 32280, legacy_y: 32155, legacy_z: 7 },
    tile_record_id: 'tile:qualification-fixture-anchor', presentation: [{ export_record_id: 'presentation:qualification-fixture-anchor', appearance_source_id: 1, entity_identity_state: 'UNRESOLVED', presentation_order: { order: 0, plane: 0 }, source_role: 'ground', resolved_primitives: [{ sprite_source_id: 1, width_units: 32, height_units: 32, displacement: { dx_units: 0, dy_units: 0 }, source_profile_id: 'oteryn-atlas-15-32-appearance-spatial-v1', layer_index: 0, phase: 0, pattern: { x: 0, y: 0, z: 0 }, visual_coverage_offsets: [0, 0] }] }],
  };
}
function productEntries(root) {
  const out = [];
  const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); const relative = path.relative(root, full).replaceAll(path.sep, '/'); if (entry.isDirectory()) walk(full); else if (relative !== 'fixture-manifest.json') { const bytes = fs.readFileSync(full); out.push({ path: relative, bytes: bytes.length, digest: sha(bytes) }); } } };
  walk(root); return out.sort((a, b) => a.path.localeCompare(b.path));
}

export async function buildQualificationWorld(destination) {
  const root = path.resolve(destination);
  if (fs.existsSync(root)) throw new TypeError('qualification world destination already exists');
  fs.mkdirSync(root, { recursive: true });
  const chunkBytes = new TextEncoder().encode(`${JSON.stringify(fixtureTile())}\n`);
  const chunkContentId = await sha256ContentId(chunkBytes);
  const semanticFloors = [];
  const runtimeFloorSeeds = [];
  for (const floor of FLOORS) {
    const counts = floor === ACTIVE_FLOOR ? { bytes: chunkBytes.byteLength, resolvedPrimitives: 1, tiles: 1 } : { bytes: 0, resolvedPrimitives: 0, tiles: 0 };
    const semanticCore = { profile: SEMANTIC_PROFILE, floor, bounds: BOUNDS, sourceFingerprint: SOURCE_FINGERPRINT, chunks: floor === ACTIVE_FLOOR ? [{ logicalAddress: { floor, region_x: 1008, region_y: 1004 }, contentId: chunkContentId, bytes: chunkBytes.byteLength, tiles: 1, resolvedPrimitives: 1, path: CHUNK_PATH }] : [], counts };
    const semantic = { ...semanticCore, rootContentId: await rootedContentId(FLOOR_DOMAIN, semanticCore) };
    writeJson(root, `publication/semantic/floors/f${floor}.json`, semantic);
    semanticFloors.push({ floor, path: `floors/f${floor}.json`, rootContentId: semantic.rootContentId, counts });
    runtimeFloorSeeds.push({ floor, semantic });
  }
  const semanticCore = { profile: SEMANTIC_PROFILE, fabricRoot: `fixture:${FIXTURE_ID}`, sourceFingerprint: SOURCE_FINGERPRINT, floors: semanticFloors, counts: { floors: 16, shards: 1, tiles: 1, resolvedPrimitives: 1, uniqueSpriteRefs: 1, bytes: chunkBytes.byteLength } };
  const semanticWorld = { ...semanticCore, rootContentId: await rootedContentId(SEMANTIC_DOMAIN, semanticCore) };
  writeJson(root, 'publication/semantic/world.json', semanticWorld);
  const publicationCore = { profile: PUBLICATION_PROFILE, source: { authority: 'Oteryn/Oteryn-Game', handoffSha256: `fixture:${FIXTURE_ID}`, fabricRoot: `fixture:${FIXTURE_ID}`, sourceFingerprint: SOURCE_FINGERPRINT, gameSha: 'fixture', canonicalWorldId: null, canonicalWorldIdState: 'FIXTURE_NOT_AUTHORITY' }, semantic: { path: 'semantic/world.json', rootContentId: semanticWorld.rootContentId }, pixels: { path: 'pixels/manifest.json', rootContentId: PIXEL_ROOT }, serializerStatus: 'QUALIFICATION_FIXTURE' };
  const publication = { ...publicationCore, rootContentId: await rootedContentId(PUBLICATION_DOMAIN, publicationCore) };
  writeJson(root, 'publication/publication.json', publication);
  const runtimeWorldCore = { profile: RUNTIME_WORLD_PROFILE, source: { authority: 'Oteryn/Oteryn-Game', publicationRoot: publication.rootContentId, semanticRoot: semanticWorld.rootContentId, pixelRoot: PIXEL_ROOT, sourceFingerprint: SOURCE_FINGERPRINT }, regionSpan: 32, rowGroupSpan: 1, floors: [], counts: { floors: 16, groups: 1, resolvedPrimitives: 1, shards: 1, sourceBytes: chunkBytes.byteLength, tiles: 1 }, visualBounds: { maxWidthUnits: 32, maxHeightUnits: 32, minDxUnits: 0, maxDxUnits: 0, minDyUnits: 0, maxDyUnits: 0, overscanTiles: { left: 0, right: 0, top: 0, bottom: 0 } } };
  for (const { floor, semantic } of runtimeFloorSeeds) {
    const chunks = floor === ACTIVE_FLOOR ? [{ logicalAddress: { floor, region_x: 1008, region_y: 1004 }, path: CHUNK_PATH, contentId: chunkContentId, bytes: chunkBytes.byteLength, worldChunk: { identityAuthority: false, chunk_id: 'qualification-anchor', floor, bounds: BOUNDS, semantic_root: semanticWorld.rootContentId, pixel_root: PIXEL_ROOT, content_hash: chunkContentId, estimated_memory_cost: chunkBytes.byteLength, dependencies: [semantic.rootContentId, semanticWorld.rootContentId, PIXEL_ROOT] }, groups: [{ offset: 0, bytes: chunkBytes.byteLength, contentId: chunkContentId, yMin: 32155, yMaxExclusive: 32156, tiles: 1, resolvedPrimitives: 1 }] }] : [];
    const counts = { chunks: chunks.length, groups: chunks.length, resolvedPrimitives: chunks.length, sourceBytes: chunks.length ? chunkBytes.byteLength : 0, tiles: chunks.length };
    const core = { profile: RUNTIME_FLOOR_PROFILE, floor, sourcePublicationRoot: publication.rootContentId, sourceSemanticRoot: semanticWorld.rootContentId, sourceFloorRoot: semantic.rootContentId, sourceFingerprint: SOURCE_FINGERPRINT, regionSpan: 32, rowGroupSpan: 1, bounds: BOUNDS, chunks, counts };
    const runtimeFloor = { ...core, rootContentId: await rootedContentId(RUNTIME_FLOOR_DOMAIN, core) };
    writeJson(root, `runtime-index/floors/f${floor}.json`, runtimeFloor);
    runtimeWorldCore.floors.push({ floor, path: `floors/f${floor}.json`, rootContentId: runtimeFloor.rootContentId });
  }
  const runtimeWorld = { ...runtimeWorldCore, rootContentId: await rootedContentId(RUNTIME_WORLD_DOMAIN, runtimeWorldCore) };
  writeJson(root, 'runtime-index/world.json', runtimeWorld);
  writeBytes(root, `publication/semantic/${CHUNK_PATH}`, chunkBytes);
  const files = productEntries(root);
  const result = Object.freeze({ fixtureId: FIXTURE_ID, dataCapability: 'qualification_fixture', semanticFloorCount: semanticFloors.length, runtimeFloorCount: runtimeWorldCore.floors.length, publicationRoot: publication.rootContentId, semanticRoot: semanticWorld.rootContentId, runtimeIndexRoot: runtimeWorld.rootContentId, productDigest: canonicalDigest(files), files });
  writeJson(root, 'fixture-manifest.json', result);
  return result;
}

export async function verifyQualificationWorld(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'fixture-manifest.json'), 'utf8'));
  const files = productEntries(root);
  if (canonicalDigest(files) !== canonicalDigest(manifest.files) || canonicalDigest(files) !== manifest.productDigest) throw new TypeError('qualification world digest mismatch');
  if (manifest.fixtureId !== FIXTURE_ID || manifest.dataCapability !== 'qualification_fixture' || manifest.semanticFloorCount !== 16 || manifest.runtimeFloorCount !== 16) throw new TypeError('qualification world identity mismatch');
  return Object.freeze(manifest);
}
