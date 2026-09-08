#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { bytesDigest, canonicalDigest, deepFreeze } from './anti-loop-common.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';

const DOMAINS = Object.freeze({
  publication: 'OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0',
  semanticWorld: 'OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0',
  semanticFloor: 'OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0',
  runtimeWorld: 'OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-WORLD-V0\0',
  runtimeFloor: 'OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-FLOOR-V0\0',
  pixelWorld: 'OTERYN-ATLAS-FULLWORLD-PIXEL-STORE-V0\0',
  pixelBlob: 'OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0',
  pixelBuckets: 'OTERYN-ATLAS-RUNTIME-PIXEL-BUCKETS-V0\0',
  minimapWorld: 'OTERYN-ATLAS-VISUAL-MINIMAP-WORLD-V0\0',
  minimapFloor: 'OTERYN-ATLAS-VISUAL-MINIMAP-FLOOR-V0\0',
});

const PROFILES = Object.freeze({
  publication: 'oteryn-atlas-fullworld-publication-v0',
  semanticWorld: 'oteryn-atlas-fullworld-semantic-publication-v0',
  runtimeWorld: 'oteryn-atlas-fullworld-runtime-index-v0',
  runtimeFloor: 'oteryn-atlas-fullworld-runtime-floor-index-v0',
  pixelWorld: 'oteryn-atlas-fullworld-pixel-publication-v0',
  pixelBuckets: 'oteryn-atlas-runtime-pixel-buckets-v0',
  minimapWorld: 'oteryn-atlas-visual-minimap-world-v0',
  minimapFloor: 'oteryn-atlas-visual-minimap-floor-v0',
});

const MODES = new Set(['runtime-index', 'pixel-buckets', 'minimap', 'all']);
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const RAW_SHA256 = /^[0-9a-f]{64}$/;
const MAX_MANIFEST_BYTES = 512 * 1024 * 1024;
const MAX_SLICE_BYTES = 64 * 1024 * 1024;

export class CompleteArtifactVerificationError extends Error {}
function fail(message) { throw new CompleteArtifactVerificationError(message); }
function requireValue(value, message) { if (!value) fail(message); }
function canonicalBytes(value) { return Buffer.from(`${canonicalJson(value)}\n`); }
function rooted(domain, value) {
  const core = structuredClone(value); delete core.rootContentId;
  return bytesDigest(Buffer.concat([Buffer.from(domain), canonicalBytes(core)]));
}
function safeRelative(relative, label) {
  requireValue(typeof relative === 'string' && relative.length > 0 && !path.isAbsolute(relative) && !relative.includes('\\'), `${label} path invalid`);
  const parts = relative.split('/');
  requireValue(parts.every((part) => part && part !== '.' && part !== '..'), `${label} path unsafe`);
  return parts.join('/');
}
function address(logical, label) {
  requireValue(logical && Number.isSafeInteger(logical.floor) && Number.isSafeInteger(logical.region_x) && Number.isSafeInteger(logical.region_y), `${label} logical address invalid`);
  return `${logical.floor}:${logical.region_x}:${logical.region_y}`;
}
function same(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(`${label} mismatch`);
}
function integer(value, label, { positive = false } = {}) {
  requireValue(Number.isSafeInteger(value) && value >= (positive ? 1 : 0), `${label} invalid`); return value;
}
function digest(value, label) { requireValue(typeof value === 'string' && DIGEST.test(value), `${label} invalid`); return value; }
function spriteIdentifier(value, label) {
  requireValue(typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value), `${label} invalid`); const numeric = Number(value);
  requireValue(Number.isSafeInteger(numeric) && numeric >= 0, `${label} invalid`); return numeric;
}

class Reader {
  constructor(roots) {
    this.files = new Map(); this.labels = new Map(Object.entries(roots).map(([surface, root]) => [path.resolve(root), surface]));
  }
  file(root, relative, label) {
    const rel = safeRelative(relative, label); const base = path.resolve(root); const target = path.resolve(base, ...rel.split('/'));
    requireValue(target.startsWith(`${base}${path.sep}`), `${label} path escapes root`);
    let stat; try { stat = fs.lstatSync(target); } catch { fail(`${label} missing: ${rel}`); }
    requireValue(stat.isFile() && !stat.isSymbolicLink(), `${label} is not a regular file: ${rel}`);
    const key = `${base}\0${rel}`; let descriptor = this.files.get(key);
    if (!descriptor) {
      const hash = crypto.createHash('sha256'); const handle = fs.openSync(target, 'r'); const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
      try { for (let offset = 0; offset < stat.size;) { const count = fs.readSync(handle, buffer, 0, Math.min(buffer.length, stat.size - offset), offset); requireValue(count > 0, `${label} truncated while hashing`); hash.update(buffer.subarray(0, count)); offset += count; } }
      finally { fs.closeSync(handle); }
      const surface = this.labels.get(base); requireValue(surface, `${label} uses an unregistered artifact root`);
      descriptor = { surface, path: rel, bytes: stat.size, digest: `sha256:${hash.digest('hex')}` }; this.files.set(key, descriptor);
    }
    return { target, descriptor };
  }
  bytes(root, relative, label, limit = MAX_MANIFEST_BYTES) {
    const { target, descriptor } = this.file(root, relative, label); requireValue(descriptor.bytes <= limit, `${label} exceeds bounded read limit`); const raw = fs.readFileSync(target);
    requireValue(raw.byteLength === descriptor.bytes, `${label} changed while reading`);
    return raw;
  }
  slice(root, relative, offset, length, label) {
    integer(offset, `${label} offset`); integer(length, `${label} length`, { positive: true }); requireValue(length <= MAX_SLICE_BYTES, `${label} exceeds bounded slice limit`);
    const end = offset + length; requireValue(Number.isSafeInteger(end), `${label} range invalid`); const { target, descriptor } = this.file(root, relative, label); requireValue(end <= descriptor.bytes, `${label} range exceeds file`);
    const raw = Buffer.allocUnsafe(length); const handle = fs.openSync(target, 'r'); let read = 0;
    try { while (read < length) { const count = fs.readSync(handle, raw, read, length - read, offset + read); requireValue(count > 0, `${label} truncated while reading`); read += count; } }
    finally { fs.closeSync(handle); }
    return raw;
  }
  json(root, relative, label) {
    const raw = this.bytes(root, relative, label); let value;
    try { value = JSON.parse(raw.toString('utf8')); } catch { fail(`${label} is not JSON`); }
    requireValue(value && typeof value === 'object' && !Array.isArray(value) && raw.equals(canonicalBytes(value)), `${label} is not a canonical JSON object`);
    return { raw, value };
  }
  descriptors() { return [...this.files.values()].sort((a, b) => `${a.surface}/${a.path}`.localeCompare(`${b.surface}/${b.path}`)); }
}

function assertNoExtraFiles(root, expected, label) {
  const base = path.resolve(root); const foundFiles = []; const foundDirectories = [];
  let rootStat; try { rootStat = fs.lstatSync(base); } catch { fail(`${label} root missing`); }
  requireValue(rootStat.isDirectory() && !rootStat.isSymbolicLink(), `${label} root is not a regular directory`);
  function walk(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name; const target = path.join(current, entry.name);
      requireValue(!entry.isSymbolicLink(), `${label} contains symlink: ${rel}`);
      if (entry.isDirectory()) { foundDirectories.push(rel); walk(target, rel); }
      else { requireValue(entry.isFile(), `${label} contains special file: ${rel}`); foundFiles.push(rel); }
    }
  }
  walk(base);
  const expectedDirectories = new Set();
  for (const relative of expected) {
    const parts = relative.split('/');
    for (let length = 1; length < parts.length; length += 1) expectedDirectories.add(parts.slice(0, length).join('/'));
  }
  same(foundFiles.sort(), [...expected].sort(), `${label} file closure`); same(foundDirectories.sort(), [...expectedDirectories].sort(), `${label} directory closure`);
}

function verifiedSources(publicationRoot, expectedPublicationRoot, reader) {
  digest(expectedPublicationRoot, 'expected publication root');
  const expectedFiles = new Set(['publication.json']);
  const publication = reader.json(publicationRoot, 'publication.json', 'publication manifest').value;
  requireValue(publication.profile === PROFILES.publication && publication.source?.authority === 'Oteryn/Oteryn-Game' && /^[0-9a-f]{40}$/.test(publication.source.gameSha), 'publication profile/authority invalid');
  requireValue(publication.serializerStatus === 'PROVISIONAL_NOT_FROZEN', 'publication serializer status invalid');
  requireValue(rooted(DOMAINS.publication, publication) === publication.rootContentId && publication.rootContentId === expectedPublicationRoot, 'publication root mismatch');

  const semanticPath = safeRelative(publication.semantic?.path, 'semantic world');
  expectedFiles.add(semanticPath);
  const semantic = reader.json(publicationRoot, semanticPath, 'semantic world').value;
  requireValue(semantic.profile === PROFILES.semanticWorld && rooted(DOMAINS.semanticWorld, semantic) === semantic.rootContentId && semantic.rootContentId === publication.semantic.rootContentId, 'semantic world root/profile mismatch');
  requireValue(Array.isArray(semantic.floors), 'semantic floors missing');
  const semanticRoot = path.posix.dirname(semanticPath); const floors = new Map(); const chunks = new Map();
  const semanticTotals = { bytes: 0, floors: 0, resolvedPrimitives: 0, shards: 0, tiles: 0 };
  for (const floorEntry of semantic.floors) {
    requireValue(Number.isSafeInteger(floorEntry.floor), 'semantic floor invalid');
    requireValue(!floors.has(floorEntry.floor), 'duplicate semantic floor');
    const floorPath = path.posix.join(semanticRoot, safeRelative(floorEntry.path, 'semantic floor'));
    requireValue(!expectedFiles.has(floorPath), `duplicate semantic floor path ${floorPath}`); expectedFiles.add(floorPath);
    const floorFile = reader.json(publicationRoot, floorPath, `semantic floor ${floorEntry.floor}`);
    const floor = floorFile.value;
    requireValue(floor.profile === PROFILES.semanticWorld && floor.floor === floorEntry.floor && rooted(DOMAINS.semanticFloor, floor) === floor.rootContentId && floor.rootContentId === floorEntry.rootContentId, `semantic floor ${floorEntry.floor} root/profile mismatch`);
    requireValue(Array.isArray(floor.chunks), `semantic floor ${floorEntry.floor} chunks missing`);
    floors.set(floor.floor, { entry: floorEntry, value: floor });
    const floorCounts = { bytes: 0, resolvedPrimitives: 0, tiles: 0 };
    for (const entry of floor.chunks) {
      const key = address(entry.logicalAddress, 'semantic chunk'); requireValue(!chunks.has(key), `duplicate semantic chunk ${key}`);
      requireValue(entry.logicalAddress.floor === floor.floor, `semantic chunk ${key} floor mismatch`);
      const relative = path.posix.join(semanticRoot, safeRelative(entry.path, 'semantic chunk'));
      requireValue(!expectedFiles.has(relative), `duplicate semantic chunk path ${relative}`); expectedFiles.add(relative);
      const file = reader.file(publicationRoot, relative, `semantic chunk ${key}`);
      requireValue(file.descriptor.bytes === entry.bytes && file.descriptor.digest === entry.contentId, `semantic chunk ${key} byte identity mismatch`);
      chunks.set(key, { entry, root: publicationRoot, relative, floor: floor.floor });
      floorCounts.bytes += integer(entry.bytes, `semantic chunk ${key} bytes`, { positive: true });
      floorCounts.resolvedPrimitives += integer(entry.resolvedPrimitives, `semantic chunk ${key} primitives`);
      floorCounts.tiles += integer(entry.tiles, `semantic chunk ${key} tiles`, { positive: true });
    }
    same(floor.counts, floorCounts, `semantic floor ${floor.floor} counts`); same(floorEntry.counts, floorCounts, `semantic world floor ${floor.floor} counts`);
    semanticTotals.bytes += floorCounts.bytes; semanticTotals.floors += 1; semanticTotals.resolvedPrimitives += floorCounts.resolvedPrimitives; semanticTotals.shards += floor.chunks.length; semanticTotals.tiles += floorCounts.tiles;
  }
  requireValue(semantic.counts && typeof semantic.counts === 'object', 'semantic world counts missing');
  for (const key of Object.keys(semanticTotals)) requireValue(semantic.counts[key] === semanticTotals[key], `semantic world ${key} census mismatch`);

  const pixelPath = safeRelative(publication.pixels?.path, 'pixel manifest');
  requireValue(!expectedFiles.has(pixelPath), `duplicate pixel manifest path ${pixelPath}`); expectedFiles.add(pixelPath);
  const pixels = reader.json(publicationRoot, pixelPath, 'pixel manifest').value;
  requireValue(pixels.profile === PROFILES.pixelWorld && rooted(DOMAINS.pixelWorld, pixels) === pixels.rootContentId && pixels.rootContentId === publication.pixels.rootContentId, 'pixel manifest root/profile mismatch');
  requireValue(Array.isArray(pixels.packs) && Array.isArray(pixels.blobs), 'pixel artifact descriptors missing');
  requireValue(RAW_SHA256.test(pixels.assetZipSha256) && pixels.pixelHashDomain === DOMAINS.pixelBlob.slice(0, -1) && canonicalJson(pixels.runtimePlacement) === canonicalJson({ identityAuthority: false }), 'pixel authority metadata invalid');
  const pixelRoot = path.posix.dirname(pixelPath); const packs = [];
  for (const [index, entry] of pixels.packs.entries()) {
    const relative = path.posix.join(pixelRoot, safeRelative(entry.path, `pixel pack ${index}`)); requireValue(!expectedFiles.has(relative), `duplicate pixel pack path ${relative}`); expectedFiles.add(relative); const file = reader.file(publicationRoot, relative, `pixel pack ${index}`);
    requireValue(entry.identityAuthority === false && file.descriptor.bytes === entry.bytes && file.descriptor.digest.slice(7) === entry.sha256, `pixel pack ${index} identity mismatch`); packs.push({ root: publicationRoot, relative, bytes: file.descriptor.bytes, cursor: 0 });
  }
  const blobs = new Map(); let previousBlob = null; let rawAfterDedupe = 0;
  for (const entry of pixels.blobs) {
    digest(entry.contentId, 'pixel blob content id'); requireValue(!blobs.has(entry.contentId) && (previousBlob === null || entry.contentId > previousBlob), `duplicate/unsorted pixel blob ${entry.contentId}`); previousBlob = entry.contentId;
    const width = integer(entry.width, 'pixel blob width', { positive: true }); const height = integer(entry.height, 'pixel blob height', { positive: true });
    const bytes = integer(entry.bytes, 'pixel blob bytes', { positive: true }); const offset = integer(entry.offset, 'pixel blob offset'); const pack = integer(entry.pack, 'pixel blob pack');
    const rgbaBytes = width * height * 4; requireValue(width <= 0xffff && height <= 0xffff && Number.isSafeInteger(rgbaBytes) && bytes === rgbaBytes && packs[pack] && offset === packs[pack].cursor && Number.isSafeInteger(offset + bytes) && offset + bytes <= packs[pack].bytes, `pixel blob ${entry.contentId} range/coverage mismatch`);
    const raw = reader.slice(packs[pack].root, packs[pack].relative, offset, bytes, `pixel blob ${entry.contentId}`);
    const dimensions = Buffer.alloc(4); dimensions.writeUInt16BE(width, 0); dimensions.writeUInt16BE(height, 2);
    const actual = bytesDigest(Buffer.concat([Buffer.from(DOMAINS.pixelBlob), dimensions, raw]));
    requireValue(actual === entry.contentId, `pixel blob ${entry.contentId} identity mismatch`);
    blobs.set(entry.contentId, { entry, pack: packs[pack], offset });
    packs[pack].cursor += bytes; rawAfterDedupe += bytes;
  }
  for (const [index, pack] of packs.entries()) requireValue(pack.cursor === pack.bytes, `pixel pack ${index} byte coverage mismatch`);
  requireValue(pixels.spriteIndex && typeof pixels.spriteIndex === 'object' && !Array.isArray(pixels.spriteIndex), 'pixel sprite index missing');
  let rawBeforeDedupe = 0;
  for (const [spriteId, descriptor] of Object.entries(pixels.spriteIndex)) {
    spriteIdentifier(spriteId, `pixel sprite ${spriteId}`); requireValue(blobs.has(descriptor.contentId), `pixel sprite ${spriteId} blob linkage invalid`);
    const blob = blobs.get(descriptor.contentId).entry; requireValue(descriptor.width === blob.width && descriptor.height === blob.height, `pixel sprite ${spriteId} dimensions mismatch`); rawBeforeDedupe += blob.bytes;
  }
  const expectedPixelCounts = { dedupeBytesSaved: rawBeforeDedupe - rawAfterDedupe, rawBytesAfterDedupe: rawAfterDedupe, rawBytesBeforeDedupe: rawBeforeDedupe, spriteRefs: Object.keys(pixels.spriteIndex).length, uniquePixelBlobs: blobs.size };
  same(pixels.counts, expectedPixelCounts, 'pixel manifest census'); requireValue(semantic.counts.uniqueSpriteRefs === expectedPixelCounts.spriteRefs, 'semantic/pixel sprite census mismatch');

  const evidencePath = 'build-evidence.json';
  if (fs.existsSync(path.join(path.resolve(publicationRoot), evidencePath))) {
    expectedFiles.add(evidencePath); const evidence = reader.json(publicationRoot, evidencePath, 'publication build evidence').value;
    requireValue(evidence.publicationRoot === publication.rootContentId && evidence.semanticRoot === semantic.rootContentId && evidence.pixelRoot === pixels.rootContentId, 'publication build evidence root linkage mismatch');
    same(evidence.counts, semantic.counts, 'publication build evidence semantic counts'); same(evidence.pixelCounts, pixels.counts, 'publication build evidence pixel counts');
  }
  assertNoExtraFiles(publicationRoot, expectedFiles, 'publication');
  return { publication, semantic, floors, chunks, pixels, blobs };
}

function parseSemanticLines(raw, label) {
  requireValue(raw.byteLength > 0 && raw.at(-1) === 0x0a, `${label} is not newline terminated`);
  let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch { fail(`${label} is not UTF-8`); }
  const lines = text.split('\n'); requireValue(lines.pop() === '' && lines.every((line) => line.length > 0), `${label} has empty records`);
  return lines.map((line, index) => {
    let value; try { value = JSON.parse(line); } catch { fail(`${label} line ${index + 1} is invalid JSON`); }
    requireValue(canonicalJson(value) === line, `${label} line ${index + 1} is not canonical JSON`); return value;
  });
}
function primitiveStats(value) {
  const stats = { primitives: 0, maxWidthUnits: 32, maxHeightUnits: 32, minDxUnits: 0, maxDxUnits: 0, minDyUnits: 0, maxDyUnits: 0 };
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Object.hasOwn(node, 'sprite_source_id')) stats.primitives += 1;
    if (Number.isSafeInteger(node.width_units)) stats.maxWidthUnits = Math.max(stats.maxWidthUnits, node.width_units);
    if (Number.isSafeInteger(node.height_units)) stats.maxHeightUnits = Math.max(stats.maxHeightUnits, node.height_units);
    if (Number.isSafeInteger(node.dx_units)) { stats.minDxUnits = Math.min(stats.minDxUnits, node.dx_units); stats.maxDxUnits = Math.max(stats.maxDxUnits, node.dx_units); }
    if (Number.isSafeInteger(node.dy_units)) { stats.minDyUnits = Math.min(stats.minDyUnits, node.dy_units); stats.maxDyUnits = Math.max(stats.maxDyUnits, node.dy_units); }
    for (const child of Object.values(node)) visit(child);
  }
  visit(value); return stats;
}
function mergeVisual(target, source) {
  for (const key of ['maxWidthUnits', 'maxHeightUnits', 'maxDxUnits', 'maxDyUnits']) target[key] = Math.max(target[key], source[key]);
  for (const key of ['minDxUnits', 'minDyUnits']) target[key] = Math.min(target[key], source[key]);
}

export function verifyRuntimeIndexArtifacts({ publicationRoot, runtimeIndexRoot, expectedPublicationRoot, expectedRuntimeIndexRoot }) {
  digest(expectedRuntimeIndexRoot, 'expected runtime index root'); const reader = new Reader({ publication: publicationRoot, runtimeIndex: runtimeIndexRoot });
  const source = verifiedSources(publicationRoot, expectedPublicationRoot, reader);
  const world = reader.json(runtimeIndexRoot, 'world.json', 'runtime index world').value;
  requireValue(world.profile === PROFILES.runtimeWorld && rooted(DOMAINS.runtimeWorld, world) === world.rootContentId && world.rootContentId === expectedRuntimeIndexRoot, 'runtime index world root/profile mismatch');
  same(world.source, { authority: 'Oteryn/Oteryn-Game', gameSha: source.publication.source.gameSha, pixelRoot: source.pixels.rootContentId, publicationRoot: source.publication.rootContentId, semanticRoot: source.semantic.rootContentId, sourceFingerprint: source.semantic.sourceFingerprint }, 'runtime index source linkage');
  requireValue(Array.isArray(world.floors), 'runtime index floors missing');
  const seenFloors = new Set(); const seenChunks = new Set(); const expectedFiles = new Set(['world.json']);
  const totals = { floors: 0, groups: 0, resolvedPrimitives: 0, shards: 0, sourceBytes: 0, tiles: 0 };
  const globalVisual = { maxWidthUnits: 32, maxHeightUnits: 32, minDxUnits: 0, maxDxUnits: 0, minDyUnits: 0, maxDyUnits: 0 };
  for (const floorEntry of world.floors) {
    requireValue(!seenFloors.has(floorEntry.floor) && source.floors.has(floorEntry.floor), `runtime floor ${floorEntry.floor} unexpected/duplicate`); seenFloors.add(floorEntry.floor);
    const rel = safeRelative(floorEntry.path, 'runtime floor'); expectedFiles.add(rel);
    const floorFile = reader.json(runtimeIndexRoot, rel, `runtime floor ${floorEntry.floor}`); const floor = floorFile.value; const sourceFloor = source.floors.get(floorEntry.floor).value;
    requireValue(floorFile.raw.byteLength === floorEntry.bytes && floor.profile === PROFILES.runtimeFloor && rooted(DOMAINS.runtimeFloor, floor) === floor.rootContentId && floor.rootContentId === floorEntry.rootContentId, `runtime floor ${floorEntry.floor} identity mismatch`);
    requireValue(floor.floor === floorEntry.floor && floor.sourceFloorRoot === sourceFloor.rootContentId && floor.sourcePublicationRoot === source.publication.rootContentId && floor.sourceSemanticRoot === source.semantic.rootContentId && floor.sourceFingerprint === source.semantic.sourceFingerprint, `runtime floor ${floorEntry.floor} source linkage mismatch`);
    same(floor.bounds, sourceFloor.bounds, `runtime floor ${floorEntry.floor} bounds`); requireValue(Array.isArray(floor.chunks), `runtime floor ${floorEntry.floor} chunks missing`);
    const floorCounts = { chunks: 0, groups: 0, resolvedPrimitives: 0, sourceBytes: 0, tiles: 0 };
    for (const chunk of floor.chunks) {
      const key = address(chunk.logicalAddress, 'runtime chunk'); const sourceChunk = source.chunks.get(key);
      requireValue(sourceChunk && !seenChunks.has(key) && sourceChunk.floor === floor.floor, `runtime chunk ${key} unexpected/duplicate`); seenChunks.add(key);
      for (const field of ['bytes', 'contentId', 'logicalAddress', 'path', 'resolvedPrimitives', 'tiles']) same(chunk[field], sourceChunk.entry[field], `runtime chunk ${key} ${field}`);
      requireValue(Array.isArray(chunk.groups) && chunk.groups.length > 0, `runtime chunk ${key} groups missing`);
      let offset = 0; let tileCursor = 0; let chunkPrevious = null; const chunkVisual = { maxWidthUnits: 32, maxHeightUnits: 32, minDxUnits: 0, maxDxUnits: 0, minDyUnits: 0, maxDyUnits: 0 }; let primitiveCount = 0;
      for (const group of chunk.groups) {
        integer(group.bytes, `runtime group ${key} bytes`, { positive: true }); integer(group.tiles, `runtime group ${key} tiles`, { positive: true });
        requireValue(Number.isSafeInteger(world.rowGroupSpan) && world.rowGroupSpan > 0 && group.yMin % world.rowGroupSpan === 0 && group.yMaxExclusive === group.yMin + world.rowGroupSpan, `runtime group ${key} y band invalid`);
        requireValue(group.offset === offset && offset + group.bytes <= sourceChunk.entry.bytes, `runtime group ${key} byte coverage mismatch`);
        const raw = reader.slice(sourceChunk.root, sourceChunk.relative, offset, group.bytes, `runtime group ${key}`); requireValue(bytesDigest(raw) === group.contentId, `runtime group ${key} content identity mismatch`);
        const groupRecords = parseSemanticLines(raw, `runtime group ${key}`); requireValue(groupRecords.length === group.tiles, `runtime group ${key} tile count mismatch`);
        let groupPrimitives = 0;
        for (const record of groupRecords) {
          const position = record.position; requireValue(position?.floor === floor.floor && Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y), `runtime group ${key} position invalid`);
          const order = [position.y, position.x]; requireValue(chunkPrevious === null || order[0] > chunkPrevious[0] || (order[0] === chunkPrevious[0] && order[1] > chunkPrevious[1]), `runtime group ${key} records unsorted`); chunkPrevious = order;
          requireValue(position.y >= group.yMin && position.y < group.yMaxExclusive, `runtime group ${key} y range mismatch`);
          const stats = primitiveStats(record); groupPrimitives += stats.primitives; mergeVisual(chunkVisual, stats);
        }
        requireValue(groupPrimitives === group.resolvedPrimitives, `runtime group ${key} primitive count mismatch`);
        primitiveCount += groupPrimitives; tileCursor += groupRecords.length; offset += group.bytes;
      }
      requireValue(offset === sourceChunk.entry.bytes && tileCursor === chunk.tiles && primitiveCount === chunk.resolvedPrimitives, `runtime chunk ${key} aggregate mismatch`);
      same(chunk.visualBounds, chunkVisual, `runtime chunk ${key} visual bounds`); mergeVisual(globalVisual, chunkVisual);
      floorCounts.chunks += 1; floorCounts.groups += chunk.groups.length; floorCounts.resolvedPrimitives += primitiveCount; floorCounts.sourceBytes += sourceChunk.entry.bytes; floorCounts.tiles += tileCursor;
    }
    same(floor.counts, floorCounts, `runtime floor ${floor.floor} counts`); same(floorEntry.counts, floorCounts, `runtime world floor ${floor.floor} counts`);
    totals.floors += 1; totals.shards += floorCounts.chunks; for (const key of ['groups', 'resolvedPrimitives', 'sourceBytes', 'tiles']) totals[key] += floorCounts[key];
  }
  requireValue(seenFloors.size === source.floors.size && seenChunks.size === source.chunks.size, 'runtime index source coverage incomplete');
  same(world.counts, totals, 'runtime world counts');
  for (const [runtimeKey, sourceKey] of [['floors', 'floors'], ['shards', 'shards'], ['resolvedPrimitives', 'resolvedPrimitives'], ['sourceBytes', 'bytes'], ['tiles', 'tiles']]) requireValue(totals[runtimeKey] === source.semantic.counts[sourceKey], `runtime world/source ${runtimeKey} mismatch`);
  globalVisual.overscanTiles = { bottom: Math.ceil(Math.max(0, globalVisual.maxDyUnits) / 32), left: Math.ceil(Math.max(0, (globalVisual.maxWidthUnits - 32) - globalVisual.minDxUnits) / 32), right: Math.ceil(Math.max(0, globalVisual.maxDxUnits) / 32), top: Math.ceil(Math.max(0, (globalVisual.maxHeightUnits - 32) - globalVisual.minDyUnits) / 32) };
  same(world.visualBounds, globalVisual, 'runtime world visual bounds'); assertNoExtraFiles(runtimeIndexRoot, expectedFiles, 'runtime index');
  return receipt('runtime-index', reader, { publication: source.publication.rootContentId, semantic: source.semantic.rootContentId, runtimeIndex: world.rootContentId }, totals);
}

export function verifyPixelBucketArtifacts({ publicationRoot, pixelBucketsRoot, expectedPublicationRoot, expectedPixelBucketRoot }) {
  digest(expectedPixelBucketRoot, 'expected pixel bucket root'); const reader = new Reader({ publication: publicationRoot, pixelBuckets: pixelBucketsRoot }); const source = verifiedSources(publicationRoot, expectedPublicationRoot, reader);
  const manifest = reader.json(pixelBucketsRoot, 'manifest.json', 'pixel bucket manifest').value;
  requireValue(manifest.profile === PROFILES.pixelBuckets && rooted(DOMAINS.pixelBuckets, manifest) === manifest.rootContentId && manifest.rootContentId === expectedPixelBucketRoot, 'pixel bucket root/profile mismatch');
  same(manifest.source, { authority: 'Oteryn/Oteryn-Game', publicationRoot: source.publication.rootContentId, pixelRoot: source.pixels.rootContentId }, 'pixel bucket source linkage');
  requireValue(Array.isArray(manifest.buckets) && manifest.blobIndex && typeof manifest.blobIndex === 'object', 'pixel bucket descriptors missing');
  same(Object.keys(manifest.blobIndex).sort(), [...source.blobs.keys()].sort(), 'pixel bucket source blob set');
  const expectedFiles = new Set(['manifest.json']); const bucketRaws = new Map(); let totalBytes = 0; let totalBlobs = 0; let previousBucket = null;
  for (const descriptor of manifest.buckets) {
    requireValue(typeof descriptor.bucket === 'string' && /^[0-9a-f]{1,4}$/.test(descriptor.bucket) && descriptor.bucket.length === manifest.bucketNibbles && (previousBucket === null || descriptor.bucket > previousBucket), 'pixel bucket order/identity invalid'); previousBucket = descriptor.bucket;
    const rel = safeRelative(descriptor.path, `pixel bucket ${descriptor.bucket}`); expectedFiles.add(rel); const file = reader.file(pixelBucketsRoot, rel, `pixel bucket ${descriptor.bucket}`);
    requireValue(file.descriptor.bytes === descriptor.bytes && file.descriptor.digest === descriptor.contentId && descriptor.sha256 === descriptor.contentId.slice(7), `pixel bucket ${descriptor.bucket} byte identity mismatch`);
    const ids = Object.keys(manifest.blobIndex).filter((id) => manifest.blobIndex[id].bucket === descriptor.bucket).sort(); requireValue(ids.length === descriptor.blobCount, `pixel bucket ${descriptor.bucket} blob count mismatch`);
    let offset = 0;
    for (const id of ids) {
      const index = manifest.blobIndex[id]; const sourceBlob = source.blobs.get(id).entry;
      requireValue(id.slice(7, 7 + manifest.bucketNibbles) === descriptor.bucket && index.offset === offset, `pixel bucket ${descriptor.bucket} offset/prefix mismatch`);
      for (const field of ['bytes', 'width', 'height']) requireValue(index[field] === sourceBlob[field], `pixel bucket ${descriptor.bucket} blob ${field} mismatch`);
      const bytes = reader.slice(pixelBucketsRoot, rel, offset, index.bytes, `pixel bucket ${descriptor.bucket} blob ${id}`); const dimensions = Buffer.alloc(4); dimensions.writeUInt16BE(index.width, 0); dimensions.writeUInt16BE(index.height, 2);
      requireValue(bytesDigest(Buffer.concat([Buffer.from(DOMAINS.pixelBlob), dimensions, bytes])) === id, `pixel bucket ${descriptor.bucket} blob bytes mismatch`); offset += index.bytes;
    }
    requireValue(offset === file.descriptor.bytes, `pixel bucket ${descriptor.bucket} byte coverage mismatch`); bucketRaws.set(descriptor.bucket, { relative: rel, bytes: file.descriptor.bytes }); totalBytes += file.descriptor.bytes; totalBlobs += ids.length;
  }
  same(manifest.counts, { blobs: totalBlobs, buckets: manifest.buckets.length, bytes: totalBytes }, 'pixel bucket counts');
  const bundle = manifest.localMaxBundle; const bundleRel = safeRelative(bundle.path, 'pixel local-max bundle'); expectedFiles.add(bundleRel); const bundleFile = reader.file(pixelBucketsRoot, bundleRel, 'pixel local-max bundle');
  requireValue(bundleFile.descriptor.bytes === bundle.bytes && bundleFile.descriptor.digest === bundle.contentId && bundle.sha256 === bundle.contentId.slice(7), 'pixel local-max bundle identity mismatch');
  requireValue(Array.isArray(bundle.bucketOffsets) && bundle.bucketOffsets.length === manifest.buckets.length, 'pixel local-max bucket offsets missing');
  let bundleOffset = 0;
  for (const [index, offset] of bundle.bucketOffsets.entries()) {
    const descriptor = manifest.buckets[index]; const bucket = bucketRaws.get(descriptor.bucket);
    same(offset, { bucket: descriptor.bucket, offset: bundleOffset, bytes: bucket.bytes }, `pixel local-max offset ${descriptor.bucket}`);
    let compared = 0;
    while (compared < bucket.bytes) {
      const size = Math.min(MAX_SLICE_BYTES, bucket.bytes - compared); const bundleBytes = reader.slice(pixelBucketsRoot, bundleRel, bundleOffset + compared, size, `pixel local-max bucket ${descriptor.bucket}`); const bucketBytes = reader.slice(pixelBucketsRoot, bucket.relative, compared, size, `pixel bucket ${descriptor.bucket}`);
      requireValue(bundleBytes.equals(bucketBytes), `pixel local-max bucket ${descriptor.bucket} mismatch`); compared += size;
    }
    bundleOffset += bucket.bytes;
  }
  requireValue(bundleOffset === bundleFile.descriptor.bytes, 'pixel local-max coverage mismatch'); assertNoExtraFiles(pixelBucketsRoot, expectedFiles, 'pixel buckets');
  return receipt('pixel-buckets', reader, { publication: source.publication.rootContentId, pixel: source.pixels.rootContentId, pixelBuckets: manifest.rootContentId }, manifest.counts);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function decodeBuilderPng(raw, label) {
  requireValue(raw.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${label} PNG signature invalid`);
  let offset = 8; let width; let height; let sawIhdr = false; let idat; let sawIend = false;
  while (offset < raw.length) {
    requireValue(offset + 12 <= raw.length, `${label} PNG chunk truncated`); const size = raw.readUInt32BE(offset); const type = raw.subarray(offset + 4, offset + 8); const data = raw.subarray(offset + 8, offset + 8 + size); const crcAt = offset + 8 + size;
    requireValue(crcAt + 4 <= raw.length && raw.readUInt32BE(crcAt) === crc32(Buffer.concat([type, data])), `${label} PNG CRC mismatch`);
    const name = type.toString('ascii');
    if (name === 'IHDR') { requireValue(!sawIhdr && offset === 8 && size === 13 && data[8] === 8 && data[9] === 6 && data[10] === 0 && data[11] === 0 && data[12] === 0, `${label} PNG format invalid`); width = data.readUInt32BE(0); height = data.readUInt32BE(4); sawIhdr = true; }
    else if (name === 'IDAT') { requireValue(sawIhdr && idat === undefined, `${label} PNG IDAT order invalid`); idat = data; }
    else if (name === 'IEND') { requireValue(sawIhdr && idat !== undefined && size === 0, `${label} PNG IEND invalid`); sawIend = true; }
    else fail(`${label} PNG unexpected chunk ${name}`);
    offset = crcAt + 4; if (sawIend) break;
  }
  requireValue(sawIend && offset === raw.length && width === 256 && height === 256 && idat?.length > 0, `${label} PNG closure/dimensions invalid`);
  let inflated; try { inflated = zlib.inflateSync(idat, { maxOutputLength: height * (1 + width * 4) }); } catch { fail(`${label} PNG deflate invalid`); }
  requireValue(inflated.byteLength === height * (1 + width * 4), `${label} PNG pixel length mismatch`);
  const pixels = Buffer.allocUnsafe(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const start = row * (1 + width * 4); requireValue(inflated[start] === 0, `${label} PNG uses unsupported row filter`);
    inflated.copy(pixels, row * width * 4, start + 1, start + 1 + width * 4);
  }
  return { width, height, pixels };
}

function roundHalfEven(value) {
  const floor = Math.floor(value); const fraction = value - floor;
  if (fraction < 0.5) return floor; if (fraction > 0.5) return floor + 1; return floor % 2 === 0 ? floor : floor + 1;
}
function meanRgba(raw) {
  let red = 0; let green = 0; let blue = 0; let alphaSum = 0; let count = 0;
  for (let index = 0; index < raw.length; index += 4) {
    const alpha = raw[index + 3]; if (alpha === 0) continue;
    red += raw[index] * alpha; green += raw[index + 1] * alpha; blue += raw[index + 2] * alpha; alphaSum += alpha; count += 1;
  }
  if (count === 0 || alphaSum === 0) return [0, 0, 0, 0];
  return [roundHalfEven(red / alphaSum), roundHalfEven(green / alphaSum), roundHalfEven(blue / alphaSum), roundHalfEven(alphaSum / count)];
}
function spriteColors(source, reader) {
  requireValue(source.pixels.spriteIndex && typeof source.pixels.spriteIndex === 'object', 'minimap sprite index missing'); const byContent = new Map(); const colors = new Map();
  for (const [spriteId, descriptor] of Object.entries(source.pixels.spriteIndex).sort((a, b) => spriteIdentifier(a[0], 'minimap sprite id') - spriteIdentifier(b[0], 'minimap sprite id'))) {
    const numericSpriteId = spriteIdentifier(spriteId, `minimap sprite ${spriteId}`); requireValue(source.blobs.has(descriptor.contentId), `minimap sprite ${spriteId} blob linkage invalid`);
    const blob = source.blobs.get(descriptor.contentId); requireValue(descriptor.width === blob.entry.width && descriptor.height === blob.entry.height, `minimap sprite ${spriteId} dimensions mismatch`);
    let color = byContent.get(descriptor.contentId);
    if (!color) { color = meanRgba(reader.slice(blob.pack.root, blob.pack.relative, blob.offset, blob.entry.bytes, `minimap sprite blob ${descriptor.contentId}`)); byContent.set(descriptor.contentId, color); }
    colors.set(numericSpriteId, color);
  }
  return colors;
}
function presentationColor(presentation, colors, label) {
  requireValue(presentation && Array.isArray(presentation.resolved_primitives), `${label} primitives missing`);
  const values = presentation.resolved_primitives.map((primitive) => {
    const spriteId = Number(primitive.sprite_source_id); requireValue(Number.isSafeInteger(spriteId) && colors.has(spriteId), `${label} sprite ${primitive.sprite_source_id} missing from verified pixels`); return colors.get(spriteId);
  }).filter((color) => color[3] > 0);
  if (values.length === 0) return [0, 0, 0, 0]; const weight = values.reduce((sum, color) => sum + color[3], 0);
  return [0, 1, 2, 3].map((channel) => channel < 3
    ? roundHalfEven(values.reduce((sum, color) => sum + color[channel] * color[3], 0) / weight)
    : roundHalfEven(weight / values.length));
}
function composite(dst, src) {
  const sourceAlpha = src[3] / 255; const destinationAlpha = dst[3] / 255; const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return [0, 0, 0, 0];
  const rgb = [0, 1, 2].map((channel) => Math.max(0, Math.min(255, roundHalfEven((src[channel] * sourceAlpha + dst[channel] * destinationAlpha * (1 - sourceAlpha)) / outputAlpha))));
  return [...rgb, Math.max(0, Math.min(255, roundHalfEven(outputAlpha * 255)))];
}
function expectedMinimapPixels(sourceChunk, colors, reader, label) {
  const pixels = Buffer.alloc(256 * 256 * 4); const raw = reader.bytes(sourceChunk.root, sourceChunk.relative, label, MAX_SLICE_BYTES); const records = parseSemanticLines(raw, label); const logical = sourceChunk.entry.logicalAddress; const occupied = new Set();
  for (const record of records) {
    const position = record.position; requireValue(position?.floor === logical.floor && Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y), `${label} position invalid`);
    const x = position.x - logical.region_x * 256; const y = position.y - logical.region_y * 256; requireValue(x >= 0 && x < 256 && y >= 0 && y < 256, `${label} position outside logical region`);
    const coordinate = `${x}:${y}`; requireValue(!occupied.has(coordinate), `${label} duplicate tile position`); occupied.add(coordinate);
    let color = [0, 0, 0, 0]; requireValue(Array.isArray(record.presentation), `${label} presentation missing`);
    for (const presentation of record.presentation) color = composite(color, presentationColor(presentation, colors, label));
    pixels.set(color, (y * 256 + x) * 4);
  }
  requireValue(records.length === sourceChunk.entry.tiles, `${label} tile count mismatch`); return pixels;
}

export function verifyMinimapArtifacts({ publicationRoot, minimapRoot, expectedPublicationRoot, expectedMinimapRoot }) {
  digest(expectedMinimapRoot, 'expected minimap root'); const reader = new Reader({ publication: publicationRoot, minimap: minimapRoot }); const source = verifiedSources(publicationRoot, expectedPublicationRoot, reader);
  const world = reader.json(minimapRoot, 'world.json', 'minimap world').value;
  requireValue(world.profile === PROFILES.minimapWorld && rooted(DOMAINS.minimapWorld, world) === world.rootContentId && world.rootContentId === expectedMinimapRoot, 'minimap world root/profile mismatch');
  same(world.source, { authority: 'Oteryn/Oteryn-Game', gameSha: source.publication.source.gameSha, pixelRoot: source.pixels.rootContentId, publicationRoot: source.publication.rootContentId, semanticRoot: source.semantic.rootContentId }, 'minimap source linkage');
  requireValue(world.pixelPerWorldTile === 1 && world.regionSpan === 256 && world.semantics?.classification === 'VISUAL_PRESENTATION_ONLY' && world.semantics?.terrainClassification === 'NOT_CLAIMED' && world.semantics?.walkability === 'NOT_CLAIMED' && world.semantics?.canonicalRegions === 'NOT_CLAIMED', 'minimap semantics/scale invalid');
  requireValue(Array.isArray(world.floors), 'minimap floors missing'); const colors = spriteColors(source, reader); const expectedFiles = new Set(['world.json']); const floors = new Set(); const chunks = new Set(); let bytes = 0; let tiles = 0;
  for (const floorEntry of world.floors) {
    requireValue(!floors.has(floorEntry.floor) && source.floors.has(floorEntry.floor), `minimap floor ${floorEntry.floor} unexpected/duplicate`); floors.add(floorEntry.floor);
    const rel = safeRelative(floorEntry.path, 'minimap floor'); requireValue(!expectedFiles.has(rel), `duplicate minimap floor path ${rel}`); expectedFiles.add(rel); const floor = reader.json(minimapRoot, rel, `minimap floor ${floorEntry.floor}`).value; const sourceFloor = source.floors.get(floorEntry.floor).value;
    requireValue(floor.profile === PROFILES.minimapFloor && rooted(DOMAINS.minimapFloor, floor) === floor.rootContentId && floor.rootContentId === floorEntry.rootContentId && floor.floor === floorEntry.floor, `minimap floor ${floorEntry.floor} identity mismatch`);
    requireValue(floor.sourceFloorRoot === sourceFloor.rootContentId && floor.pixelPerWorldTile === 1 && floor.regionSpan === 256 && Array.isArray(floor.chunks), `minimap floor ${floorEntry.floor} source/shape mismatch`); same(floor.bounds, sourceFloor.bounds, `minimap floor ${floorEntry.floor} bounds`);
    let floorBytes = 0; let floorTiles = 0;
    for (const entry of floor.chunks) {
      const key = address(entry.logicalAddress, 'minimap chunk'); const sourceChunk = source.chunks.get(key);
      requireValue(sourceChunk && sourceChunk.floor === floor.floor && !chunks.has(key), `minimap chunk ${key} unexpected/duplicate`); chunks.add(key);
      requireValue(entry.sourceContentId === sourceChunk.entry.contentId && entry.tiles === sourceChunk.entry.tiles, `minimap chunk ${key} source linkage mismatch`);
      const pngRel = safeRelative(entry.path, `minimap chunk ${key}`); requireValue(!expectedFiles.has(pngRel), `duplicate minimap chunk path ${pngRel}`); expectedFiles.add(pngRel); const raw = reader.bytes(minimapRoot, pngRel, `minimap chunk ${key}`, 2 * 1024 * 1024);
      requireValue(raw.byteLength === entry.bytes && bytesDigest(raw) === entry.contentId, `minimap chunk ${key} byte identity mismatch`); const decoded = decodeBuilderPng(raw, `minimap chunk ${key}`);
      const expectedPixels = expectedMinimapPixels(sourceChunk, colors, reader, `semantic minimap source ${key}`); requireValue(decoded.pixels.equals(expectedPixels), `minimap chunk ${key} pixel derivation mismatch`);
      floorBytes += raw.byteLength; floorTiles += entry.tiles;
    }
    same(floor.counts, { bytes: floorBytes, chunks: floor.chunks.length, tiles: floorTiles }, `minimap floor ${floor.floor} counts`); bytes += floorBytes; tiles += floorTiles;
  }
  requireValue(floors.size === source.floors.size && chunks.size === source.chunks.size, 'minimap source coverage incomplete');
  same(world.counts, { bytes, chunks: chunks.size, floors: floors.size, tiles }, 'minimap world counts'); assertNoExtraFiles(minimapRoot, expectedFiles, 'minimap');
  return receipt('minimap', reader, { publication: source.publication.rootContentId, semantic: source.semantic.rootContentId, pixel: source.pixels.rootContentId, minimap: world.rootContentId }, world.counts, { pixelDerivation: 'independently-recomputed-from-verified-semantic-and-rgba-source-bytes' });
}

function receipt(mode, reader, roots, counts, extra = {}) {
  const artifacts = reader.descriptors(); const core = { schemaVersion: 1, kind: 'oteryn-atlas-complete-artifact-verification-v1', mode, result: 'PASS', roots, counts, artifacts, artifactInventoryDigest: canonicalDigest(artifacts), ...extra };
  return deepFreeze({ ...core, receiptDigest: canonicalDigest(core) });
}

export function verifyCompleteProductArtifacts(options) {
  requireValue(options && MODES.has(options.mode), 'verification mode invalid');
  if (options.mode === 'runtime-index') return verifyRuntimeIndexArtifacts(options);
  if (options.mode === 'pixel-buckets') return verifyPixelBucketArtifacts(options);
  if (options.mode === 'minimap') return verifyMinimapArtifacts(options);
  const results = {
    runtimeIndex: verifyRuntimeIndexArtifacts(options),
    pixelBuckets: verifyPixelBucketArtifacts(options),
    minimap: verifyMinimapArtifacts(options),
  };
  const core = { schemaVersion: 1, kind: 'oteryn-atlas-complete-artifact-suite-v1', result: 'PASS', results, receiptDigests: Object.values(results).map((result) => result.receiptDigest).sort() };
  return deepFreeze({ ...core, receiptDigest: canonicalDigest(core) });
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]; const value = argv[index + 1]; requireValue(flag?.startsWith('--') && value !== undefined, 'CLI arguments invalid'); out[flag.slice(2)] = value;
  }
  return {
    mode: out.mode,
    publicationRoot: out.publication,
    runtimeIndexRoot: out['runtime-index'],
    pixelBucketsRoot: out['pixel-buckets'],
    minimapRoot: out.minimap,
    expectedPublicationRoot: out['expected-publication-root'],
    expectedRuntimeIndexRoot: out['expected-runtime-index-root'],
    expectedPixelBucketRoot: out['expected-pixel-bucket-root'],
    expectedMinimapRoot: out['expected-minimap-root'],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(`${canonicalJson(verifyCompleteProductArtifacts(parseArgs(process.argv.slice(2))))}\n`); }
  catch (error) { process.stderr.write(`${error.name}: ${error.message}\n`); process.exitCode = 1; }
}
