// Immutable protected qualification oracle: verifier-only dependency closure.
// Candidate builders and runtime modules are input, never imported authority.
// Mechanical extraction: tests/verification/protected-qualification-oracle.test.mjs --emit-entry.
// Reproduce payload from the recorded source blobs (not mutable candidate sources):
// node tests/verification/protected-qualification-oracle.test.mjs --emit-entry |
//   esbuild --bundle --format=esm --platform=node --target=node22 --tree-shaking=true |
//   node tests/verification/protected-qualification-oracle.test.mjs --finalize-bundle
// Finalization removes only the exact unused FULLWORLD_TRUST browser-global initializer.
// Generator: esbuild 0.25.9. No minification or dependency execution at proof time.
// Regeneration requires independent authority review; admission cannot change this file.
// Source blob 0c26b4f7fbfe3eed258cd14b893646015da09476 src/browser/animation-runtime.mjs
// Source blob 0f44da17c30a61089b0cec1c110d8411fedc8f94 src/browser/creature-publication-source.mjs
// Source blob e732c6478251f476f09750687dadfb38799b521a src/browser/creature-search.mjs
// Source blob e2a788657d92e0e641dad5627f12416507700055 src/browser/fullworld-trust.mjs
// Source blob 2f56433f797b4178e28d7bf1cbf86487ac2832e8 src/browser/loader.mjs
// Source blob 152b79dfe3f8fd92dd4159c236db55ef2a86d904 src/browser/semantic-search.mjs
// Source blob 61df75f257812eea13ddaddb7b771ac3c722ad97 src/browser/semantic.mjs
// Source blob 88fe5302a799c02f46c57154623d721435f9599a tools/verification/qualification-fixture-definition.mjs
// Source blob eaf0c278570233c3ac0de8c51c18f6d579392d71 tools/verification/qualification-world.mjs
// Payload sha256 7d1f8ff5ae8efc96501a35052859900eeae588ef9e584cda78c2e3791ccd88f2
// BEGIN GENERATED ORACLE
// <stdin>
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// src/browser/semantic.mjs
var PROOF_BOUNDS = Object.freeze({
  floor: -7,
  xMin: 32280,
  xMaxExclusive: 32441,
  yMin: 32155,
  yMaxExclusive: 32306
});
var CAMERA_ITINERARY = Object.freeze([
  Object.freeze({ x: 32280, y: 32155, floor: -7, label: "north-west proof bound" }),
  Object.freeze({ x: 32360, y: 32230, floor: -7, label: "representative proof center" }),
  Object.freeze({ x: 32440, y: 32305, floor: -7, label: "south-east proof bound" })
]);

// src/browser/loader.mjs
var MAX_MANIFEST_BYTES = 256 * 1024;
var MAX_CHUNK_BYTES = 2 * 1024 * 1024;
function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = sortCanonical(value[key]);
    return result;
  }
  return value;
}
function canonicalJsonBytes(value) {
  const text = `${JSON.stringify(sortCanonical(value))}
`;
  return new TextEncoder().encode(text);
}
var SHA256_K = Object.freeze([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function rotr32(value, amount) {
  return value >>> amount | value << 32 - amount;
}
function sha256HexPortable(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const bitLength = bytes.byteLength * 8;
  const paddedLength = Math.ceil((bytes.byteLength + 1 + 8) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(bytes);
  message[bytes.byteLength] = 128;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 4294967296), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const hash = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15];
      const y = words[index - 2];
      const sigma0 = rotr32(x, 7) ^ rotr32(x, 18) ^ x >>> 3;
      const sigma1 = rotr32(y, 17) ^ rotr32(y, 19) ^ y >>> 10;
      words[index] = words[index - 16] + sigma0 + words[index - 7] + sigma1 >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const choice = e & f ^ ~e & g;
      const t1 = h + sum1 + choice + SHA256_K[index] + words[index] >>> 0;
      const sum0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const majority = a & b ^ a & c ^ b & c;
      const t2 = sum0 + majority >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    hash[0] = hash[0] + a >>> 0;
    hash[1] = hash[1] + b >>> 0;
    hash[2] = hash[2] + c >>> 0;
    hash[3] = hash[3] + d >>> 0;
    hash[4] = hash[4] + e >>> 0;
    hash[5] = hash[5] + f >>> 0;
    hash[6] = hash[6] + g >>> 0;
    hash[7] = hash[7] + h >>> 0;
  }
  return [...hash].map((word) => word.toString(16).padStart(8, "0")).join("");
}
async function sha256ContentId(bytes, subtle = globalThis.crypto?.subtle) {
  let hex;
  if (subtle?.digest) {
    const digest = await subtle.digest("SHA-256", bytes);
    hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } else {
    hex = sha256HexPortable(bytes);
  }
  return `sha256:${hex}`;
}

// src/browser/animation-runtime.mjs
var ANIMATION_RUNTIME_PROFILE = "oteryn-atlas-animation-runtime-v1";
var ANIMATION_PRODUCT_ROOT = "sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1";
var OUTFIT_SPATIAL_ROOT = "sha256:62fdd7d0ce02652582f03bf971455f4a2f9ec1e472eaebfec5af739cf11a921e";
var GAME_ANIMATION_SHA = "8f6a4fdea4487a61c4cdaf1889d421ecd2265a31";
var PRODUCTION_ANIMATION_SOURCE = Object.freeze({ gameSha: GAME_ANIMATION_SHA, appearanceProductRoot: ANIMATION_PRODUCT_ROOT, outfitSpatialProductRoot: OUTFIT_SPATIAL_ROOT });
var MAX_MANIFEST_BYTES2 = 2 * 1024 * 1024;
var MAX_PROGRAM_BYTES = 48 * 1024 * 1024;
var MAX_BUCKET_BYTES = 8 * 1024 * 1024;
var MAX_BUCKETS = 64;
var AnimationRuntimeError = class extends Error {
};
function requireValue(condition, message) {
  if (!condition) throw new AnimationRuntimeError(message);
}
function isSha(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}
function safePath(value) {
  requireValue(typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.includes("\\"), "unsafe animation path");
  requireValue(!value.split("/").some((part) => part === "" || part === "." || part === ".."), "unsafe animation path");
  return value;
}
async function readBytes(url, maxBytes, expectedDigest = null, expectedBytes = null, fetcher = fetch) {
  const response = await fetcher(url, { cache: "no-store" });
  requireValue(response?.ok, `${url.pathname} HTTP ${response?.status ?? "unknown"}`);
  const declared = response.headers?.get?.("content-length");
  if (declared != null) requireValue(Number(declared) <= maxBytes, `${url.pathname} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= maxBytes, `${url.pathname} exceeds byte limit`);
  if (expectedBytes != null) requireValue(bytes.byteLength === expectedBytes, `${url.pathname} byte count mismatch`);
  if (expectedDigest) requireValue(await sha256ContentId(bytes) === expectedDigest, `${url.pathname} digest mismatch`);
  return bytes;
}
function parseJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new AnimationRuntimeError(`${label} JSON invalid: ${error.message}`);
  }
}
function stableHash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
function phaseSequence(program) {
  const count = program.phase_count;
  if (program.animation.loop_type === "pingpong" && count > 1) return [...Array(count).keys(), ...Array.from({ length: count - 2 }, (_, i) => count - 2 - i)];
  return [...Array(count).keys()];
}
function durationFor(program, phase) {
  const durations = program.animation.presentation_durations_ms;
  requireValue(Array.isArray(durations) && durations.length === program.phase_count, "animation duration cardinality mismatch");
  const value = durations[phase];
  requireValue(Number.isSafeInteger(value) && value > 0, "animation duration invalid");
  return value;
}
function phaseAt(program, logicalTimeMs, instanceId = "") {
  requireValue(program && Number.isSafeInteger(program.phase_count) && program.phase_count > 0, "animation program invalid");
  if (program.phase_count === 1) return 0;
  const sequence = phaseSequence(program);
  const sequenceDurations = sequence.map((phase) => durationFor(program, phase));
  const cycle = sequenceDurations.reduce((sum, value) => sum + value, 0);
  requireValue(cycle > 0, "animation cycle empty");
  let elapsed = Math.max(0, Math.floor(logicalTimeMs));
  if (!program.animation.synchronized) elapsed += stableHash(String(instanceId)) % cycle;
  if (program.animation.loop_type === "counted") {
    const loops = Math.max(1, Number(program.animation.loop_count) || 1);
    const end = cycle * loops;
    if (elapsed >= end) return sequence[sequence.length - 1];
  } else elapsed %= cycle;
  if (program.animation.loop_type === "counted") elapsed %= cycle;
  for (let i = 0; i < sequence.length; i += 1) {
    if (elapsed < sequenceDurations[i]) return sequence[i];
    elapsed -= sequenceDurations[i];
  }
  return sequence[sequence.length - 1];
}
function objectSpriteFor(program, pattern, phase) {
  const { width, height, depth } = program.patterns;
  requireValue(pattern && Number.isSafeInteger(pattern.x) && Number.isSafeInteger(pattern.y) && Number.isSafeInteger(pattern.z), "object animation pattern missing");
  requireValue(pattern.x >= 0 && pattern.x < width && pattern.y >= 0 && pattern.y < height && pattern.z >= 0 && pattern.z < depth, "object animation pattern outside program");
  requireValue(program.layers === 1, "animated object layers must be prequalified as one layer");
  const index = ((phase * depth + pattern.z) * height + pattern.y) * width + pattern.x;
  const sprite = program.sprite_source_ids[index];
  requireValue(Number.isSafeInteger(sprite) && sprite > 0, "object animation sprite missing");
  return sprite;
}
async function loadAnimationRuntime(baseUrl, fetcher = fetch, expectedSource = PRODUCTION_ANIMATION_SOURCE) {
  requireValue(expectedSource && typeof expectedSource === "object", "animation source expectations invalid");
  requireValue(expectedSource.gameSha === "fixture" || /^[0-9a-f]{40}$/.test(expectedSource.gameSha ?? ""), "animation source Game SHA expectation invalid");
  requireValue(isSha(expectedSource.appearanceProductRoot) && isSha(expectedSource.outfitSpatialProductRoot), "animation source root expectation invalid");
  const root = new URL(baseUrl);
  const manifestBytes = await readBytes(new URL("manifest.json", root), MAX_MANIFEST_BYTES2, null, null, fetcher);
  const manifest = parseJson(manifestBytes, "animation manifest");
  requireValue(manifest.profile === ANIMATION_RUNTIME_PROFILE && manifest.identityAuthority === false, "unsupported animation runtime manifest");
  requireValue(manifest.source?.game_sha === expectedSource.gameSha, "animation Game SHA mismatch");
  requireValue(manifest.source?.appearance_product_root === expectedSource.appearanceProductRoot, "animation product root mismatch");
  requireValue(manifest.source?.outfit_spatial_product_root === expectedSource.outfitSpatialProductRoot, "outfit spatial root mismatch");
  requireValue(Array.isArray(manifest.buckets) && manifest.buckets.length <= MAX_BUCKETS, "animation bucket census invalid");
  const programBytes = await readBytes(new URL(safePath(manifest.programs.path), root), MAX_PROGRAM_BYTES, manifest.programs.digest, manifest.programs.bytes, fetcher);
  const product = parseJson(programBytes, "animation programs");
  requireValue(product.profile === ANIMATION_RUNTIME_PROFILE, "animation program profile mismatch");
  const objects = /* @__PURE__ */ new Map();
  for (const program of product.object_programs ?? []) {
    requireValue(Number.isSafeInteger(program.appearance_source_id) && !objects.has(program.appearance_source_id), "duplicate/invalid object animation program");
    objects.set(program.appearance_source_id, Object.freeze(program));
  }
  const creatures = /* @__PURE__ */ new Map();
  for (const program of product.creature_programs ?? []) {
    requireValue(typeof program.outfit_presentation_id === "string" && !creatures.has(program.outfit_presentation_id), "duplicate/invalid creature program");
    creatures.set(program.outfit_presentation_id, Object.freeze(program));
  }
  const sprites = new Map(Object.entries(product.sprite_index ?? {}).map(([key, value]) => [Number(key), Object.freeze(value)]));
  const blobs = new Map(Object.entries(product.blob_index ?? {}).map(([key, value]) => [key, Object.freeze(value)]));
  const buckets = new Map(manifest.buckets.map((entry) => [entry.id, Object.freeze(entry)]));
  return createAnimationRuntime(root, { manifest, objects, creatures, sprites, blobs, buckets, fetcher });
}
function createAnimationRuntime(root, product) {
  const bucketCache = /* @__PURE__ */ new Map();
  const bucketPending = /* @__PURE__ */ new Map();
  const bitmapCache = /* @__PURE__ */ new Map();
  const bitmapPending = /* @__PURE__ */ new Map();
  let bucketBytes = 0;
  let bucketLoads = 0;
  let frameUpdates = 0;
  async function bucket(id) {
    const existing = bucketCache.get(id);
    if (existing) {
      bucketCache.delete(id);
      bucketCache.set(id, existing);
      return existing;
    }
    if (bucketPending.has(id)) return bucketPending.get(id);
    const descriptor = product.buckets.get(id);
    requireValue(descriptor && descriptor.bytes <= MAX_BUCKET_BYTES && isSha(descriptor.digest), `animation bucket ${id} invalid`);
    const pending = (async () => {
      const bytes = await readBytes(new URL(safePath(descriptor.path), root), MAX_BUCKET_BYTES, descriptor.digest, descriptor.bytes, product.fetcher);
      bucketCache.set(id, bytes);
      bucketBytes += bytes.byteLength;
      bucketLoads += 1;
      while (bucketCache.size > 12) {
        const key = bucketCache.keys().next().value;
        bucketBytes -= bucketCache.get(key).byteLength;
        bucketCache.delete(key);
      }
      return bytes;
    })();
    bucketPending.set(id, pending);
    try {
      return await pending;
    } finally {
      if (bucketPending.get(id) === pending) bucketPending.delete(id);
    }
  }
  async function bitmap(contentId) {
    if (bitmapCache.has(contentId)) return bitmapCache.get(contentId);
    if (bitmapPending.has(contentId)) return bitmapPending.get(contentId);
    const blob = product.blobs.get(contentId);
    requireValue(blob && product.buckets.has(blob.bucket), "animation blob missing");
    const pending = (async () => {
      const bytes = await bucket(blob.bucket);
      requireValue(blob.offset >= 0 && blob.bytes > 0 && blob.offset + blob.bytes <= bytes.byteLength, "animation blob range invalid");
      const rgba = new Uint8ClampedArray(bytes.buffer.slice(bytes.byteOffset + blob.offset, bytes.byteOffset + blob.offset + blob.bytes));
      requireValue(rgba.byteLength === blob.width * blob.height * 4, "animation RGBA geometry mismatch");
      let value;
      if (typeof createImageBitmap === "function") value = await createImageBitmap(new ImageData(rgba, blob.width, blob.height));
      else value = Object.freeze({ rgba, width: blob.width, height: blob.height });
      bitmapCache.set(contentId, value);
      while (bitmapCache.size > 512) {
        const key = bitmapCache.keys().next().value;
        bitmapCache.get(key)?.close?.();
        bitmapCache.delete(key);
      }
      return value;
    })();
    bitmapPending.set(contentId, pending);
    try {
      return await pending;
    } finally {
      if (bitmapPending.get(contentId) === pending) bitmapPending.delete(contentId);
    }
  }
  function hasObject(record) {
    return product.objects.has(record?.presentation?.appearanceSourceId);
  }
  function hasCreature(record) {
    return product.creatures.has(record?.outfit_presentation?.outfit_presentation_id);
  }
  function objectFrame(record, timeMs) {
    const program = product.objects.get(record.presentation.appearanceSourceId);
    if (!program) return null;
    const phase = phaseAt(program, timeMs, record.presentation.recordId);
    const spriteId = objectSpriteFor(program, record.primitive.pattern, phase);
    const sprite = product.sprites.get(spriteId);
    requireValue(sprite && isSha(sprite.content_id), "animation sprite index missing");
    return Object.freeze({ phase, contentId: sprite.content_id, program });
  }
  function creatureFrame(record, timeMs) {
    const id = record?.outfit_presentation?.outfit_presentation_id;
    if (!id) return null;
    const program = product.creatures.get(id);
    if (!program) return null;
    const phase = phaseAt(program, timeMs, record.record_id);
    const contentId = program.phase_content_ids[phase];
    requireValue(isSha(contentId), "creature phase content missing");
    return Object.freeze({ phase, contentId, program });
  }
  function noteFrameUpdate(count = 1) {
    frameUpdates += count;
  }
  function stats() {
    return Object.freeze({ bucketBytes, bucketLoads, cachedBuckets: bucketCache.size, cachedBitmaps: bitmapCache.size, frameUpdates, objectPrograms: product.objects.size, creaturePrograms: product.creatures.size });
  }
  return Object.freeze({ bitmap, creatureFrame, hasCreature, hasObject, manifest: product.manifest, noteFrameUpdate, objectFrame, stats });
}

// src/browser/creature-publication-source.mjs
var SHA256 = /^sha256:[0-9a-f]{64}$/;
function requireValue2(condition, message) {
  if (!condition) throw new TypeError(message);
}
function validateCreaturePublicationSource(source, animationSource, expected) {
  requireValue2(source && typeof source === "object" && !Array.isArray(source), "creature source invalid");
  requireValue2(animationSource && typeof animationSource === "object" && !Array.isArray(animationSource), "creature animation source invalid");
  requireValue2(expected && typeof expected === "object" && !Array.isArray(expected), "creature source expectations invalid");
  requireValue2(typeof expected.contractId === "string" && expected.contractId.length > 0, "creature contract expectation invalid");
  requireValue2(typeof expected.capability === "string" && expected.capability.length > 0, "creature capability expectation invalid");
  requireValue2(SHA256.test(expected.semanticDigest), "creature semantic digest expectation invalid");
  requireValue2(Number.isSafeInteger(expected.npcRoleSchemaVersion) && expected.npcRoleSchemaVersion > 0, "creature NPC role schema expectation invalid");
  requireValue2(source.contract_id === expected.contractId, "creature source contract mismatch");
  requireValue2(source.capability === expected.capability, "creature source capability mismatch");
  requireValue2(source.semantic_digest === expected.semanticDigest, "creature source semantic digest mismatch");
  requireValue2(source.npc_role_schema_version === expected.npcRoleSchemaVersion, "creature source NPC role schema mismatch");
  if (expected.fixtureId == null) requireValue2(source.fixture_id == null, "production creature source must not claim fixture identity");
  else requireValue2(source.fixture_id === expected.fixtureId, "creature source fixture identity mismatch");
  requireValue2(SHA256.test(source.appearance_product_root), "creature source appearance root invalid");
  requireValue2(SHA256.test(source.outfit_spatial_product_root), "creature source outfit root invalid");
  requireValue2(source.appearance_product_root === animationSource.appearance_product_root, "creature/animation appearance root mismatch");
  requireValue2(source.outfit_spatial_product_root === animationSource.outfit_spatial_product_root, "creature/animation outfit root mismatch");
  return Object.freeze({ ...source });
}

// src/browser/creature-search.mjs
var MAX_CREATURE_SEARCH_RECORDS = 2e4;
var RECORD_ID = /^(?:npc|monster):[0-9a-f]{32}$/;
var ENTITY_ID = /^(?:npc|monster)-entity:[0-9a-f]{32}$/;
function requireValue3(condition, message) {
  if (!condition) throw new Error(message);
}
function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}
function validateCreatureSearchRecords(records) {
  requireValue3(Array.isArray(records) && records.length <= MAX_CREATURE_SEARCH_RECORDS, "creature search record count invalid");
  const seen = /* @__PURE__ */ new Set();
  for (const record of records) {
    requireValue3(record && (record.kind === "npc" || record.kind === "monster"), "creature search kind invalid");
    requireValue3(typeof record.label === "string" && record.label.trim().length > 0 && record.label.length <= 256, "creature search label invalid");
    requireValue3(RECORD_ID.test(record.record_id ?? ""), "creature search record id invalid");
    if (record.entity_id != null) requireValue3(ENTITY_ID.test(record.entity_id), "creature search entity id invalid");
    requireValue3(record.position && Number.isSafeInteger(record.position.x) && Number.isSafeInteger(record.position.y) && Number.isSafeInteger(record.position.floor), "creature search position invalid");
    if (record.provenance != null) {
      requireValue3(record.provenance && typeof record.provenance === "object" && !Array.isArray(record.provenance), "creature search provenance invalid");
      requireValue3(typeof record.provenance.authority === "string" && record.provenance.authority.length > 0, "creature search provenance authority invalid");
      requireValue3(typeof record.provenance.source_capability === "string" && record.provenance.source_capability.length > 0, "creature search provenance capability invalid");
    }
    const key = `${record.kind}:${normalize(record.label)}`;
    requireValue3(!seen.has(key), "creature search duplicate label/kind");
    seen.add(key);
  }
  return records;
}
function validateCreatureSearchCatalog(catalog, expectedSource) {
  requireValue3(catalog?.schema_version === 1, "unsupported creature search catalog schema");
  requireValue3(expectedSource && typeof expectedSource === "object" && !Array.isArray(expectedSource), "creature search source expectations invalid");
  requireValue3(catalog.source?.contract_id === expectedSource.creatureContractId && catalog.source?.capability === expectedSource.creatureCapability, "creature search source unsupported");
  requireValue3(catalog.source?.coordinate_profile === "oteryn-native-floor-v1", "creature search coordinate profile unsupported");
  requireValue3(catalog.source?.semantic_digest === expectedSource.creatureSemanticDigest, "creature search semantic digest mismatch");
  if (expectedSource.fixtureId == null) requireValue3(catalog.source?.fixture_id == null, "production creature search source must not claim fixture identity");
  else requireValue3(catalog.source?.fixture_id === expectedSource.fixtureId, "creature search fixture identity invalid");
  validateCreatureSearchRecords(catalog.records);
  return catalog;
}

// src/browser/fullworld-trust.mjs
var PRODUCTION_FULLWORLD_TRUST = Object.freeze({
  gameSha: "f79fd3b5c239fa13810338f1380539c4eac67d7d",
  publicationRoot: "sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f",
  semanticRoot: "sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9",
  pixelRoot: "sha256:8b8228fcc4574903e547cb7d65b96f3d45e5a9e67045091c1bceb6e54d3690ad",
  overviewRoot: "sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db",
  minimapRoot: "sha256:23f4d2c3901673fb38980e2600828145a6d0626c0e44d1d9f5ca23bfbce02268",
  runtimeIndexRoot: "sha256:fa30ae5fc47f0ca8a6d482ed87b5db2cd74f32f7f523df16187ca719b8e04f08",
  pixelBucketRoot: "sha256:99cf23b01a0d652ff670a994a2b80cbef8d17036f514522d47f1aa98352d3116",
  sourceFingerprint: "sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9"
});
var QUALIFICATION_TRUST_MARKER = "oteryn-atlas-qualification-trust-v1";
var QUALIFICATION_FIXTURE_ID = "atlas-qualification-world-v2";
var BOUNDED_REAL_TRUST_MARKER = "oteryn-atlas-bounded-real-trust-v1";
var BOUNDED_REAL_FIXTURE_ID = "atlas-bounded-real-world-v1";
var BOUNDED_REAL_SOURCE_CONTRACT = "oteryn-atlas-bounded-real-runtime-v1";
var BOUNDED_REAL_CREATURE_CAPABILITY = "bounded-real-creatures-v1";
var BOUNDED_REAL_GAME_SHA = "fixture";
var CONTENT_ID = /^sha256:[0-9a-f]{64}$/;
var TRUST_ID_FIELDS = Object.freeze([
  "publicationRoot",
  "semanticRoot",
  "pixelRoot",
  "overviewRoot",
  "minimapRoot",
  "runtimeIndexRoot",
  "pixelBucketRoot",
  "sourceFingerprint",
  "productDigest"
]);
var TRUST_DESCRIPTOR_KEYS = Object.freeze([
  "marker",
  "fixtureId",
  "dataCapability",
  ...TRUST_ID_FIELDS
]);
function invalidQualificationTrust(detail) {
  throw new TypeError(`qualification trust invalid: ${detail}`);
}
function validateExactDescriptor(candidate) {
  const actualKeys = Object.keys(candidate).sort();
  const expectedKeys = [...TRUST_DESCRIPTOR_KEYS].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) invalidQualificationTrust("descriptor fields mismatch");
}
function validateRoots(candidate) {
  for (const field of TRUST_ID_FIELDS) {
    if (!CONTENT_ID.test(candidate[field])) invalidQualificationTrust(`${field} must be a sha256 content id`);
  }
}
function validateQualificationIdentity(candidate, { exactDescriptor = false } = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) invalidQualificationTrust("descriptor must be an object");
  if (candidate.fixtureId !== QUALIFICATION_FIXTURE_ID) invalidQualificationTrust("fixture identity mismatch");
  if (candidate.dataCapability !== "qualification_fixture") invalidQualificationTrust("data capability mismatch");
  if (exactDescriptor) validateExactDescriptor(candidate);
  validateRoots(candidate);
  return candidate;
}
function validateBoundedRealIdentity(candidate, { exactDescriptor = false } = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) invalidQualificationTrust("descriptor must be an object");
  if (candidate.fixtureId !== BOUNDED_REAL_FIXTURE_ID) invalidQualificationTrust("bounded-real fixture identity mismatch");
  if (candidate.dataCapability !== "bounded_real_world") invalidQualificationTrust("bounded-real data capability mismatch");
  if (exactDescriptor) validateExactDescriptor(candidate);
  validateRoots(candidate);
  return candidate;
}
function qualificationRuntimeTrust(candidate) {
  return Object.freeze({
    gameSha: "fixture",
    publicationRoot: candidate.publicationRoot,
    semanticRoot: candidate.semanticRoot,
    pixelRoot: candidate.pixelRoot,
    overviewRoot: candidate.overviewRoot,
    minimapRoot: candidate.minimapRoot,
    runtimeIndexRoot: candidate.runtimeIndexRoot,
    pixelBucketRoot: candidate.pixelBucketRoot,
    sourceFingerprint: candidate.sourceFingerprint,
    qualificationFixtureId: candidate.fixtureId,
    qualificationProductDigest: candidate.productDigest
  });
}
function boundedRealRuntimeTrust(candidate) {
  return Object.freeze({
    gameSha: BOUNDED_REAL_GAME_SHA,
    publicationRoot: candidate.publicationRoot,
    semanticRoot: candidate.semanticRoot,
    pixelRoot: candidate.pixelRoot,
    overviewRoot: candidate.overviewRoot,
    minimapRoot: candidate.minimapRoot,
    runtimeIndexRoot: candidate.runtimeIndexRoot,
    pixelBucketRoot: candidate.pixelBucketRoot,
    sourceFingerprint: candidate.sourceFingerprint,
    boundedRealFixtureId: candidate.fixtureId,
    boundedRealProductDigest: candidate.productDigest
  });
}
function resolveQualificationManifestTrust(candidate) {
  return qualificationRuntimeTrust(validateQualificationIdentity(candidate));
}
function resolveFullWorldTrust(scope = globalThis) {
  const candidate = scope?.__OTERYN_ATLAS_QUALIFICATION_TRUST__;
  if (candidate == null) return PRODUCTION_FULLWORLD_TRUST;
  if (candidate.marker === QUALIFICATION_TRUST_MARKER) {
    validateQualificationIdentity(candidate, { exactDescriptor: true });
    return qualificationRuntimeTrust(candidate);
  }
  if (candidate.marker === BOUNDED_REAL_TRUST_MARKER) {
    validateBoundedRealIdentity(candidate, { exactDescriptor: true });
    return boundedRealRuntimeTrust(candidate);
  }
  invalidQualificationTrust("marker mismatch");
}
var QUALIFICATION_SOURCE_CONTRACT = "oteryn-atlas-qualification-fixture-v1";
var PRODUCTION_ANCILLARY_SOURCES = Object.freeze({
  mode: "production",
  animation: Object.freeze({ gameSha: "8f6a4fdea4487a61c4cdaf1889d421ecd2265a31", appearanceProductRoot: "sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1", outfitSpatialProductRoot: "sha256:62fdd7d0ce02652582f03bf971455f4a2f9ec1e472eaebfec5af739cf11a921e" }),
  creatures: Object.freeze({ contractId: "oteryn-game-atlas-export-v1", capability: "animated-creatures-v1", semanticDigest: "sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8", npcRoleSchemaVersion: 1 }),
  semanticSearch: Object.freeze({ authority: "Oteryn/Oteryn-Game", repository: "Oteryn/Oteryn-Game", contractId: "oteryn-game-atlas-export-v1", capability: "semantic-search-source-v1", profileId: "oteryn-game-atlas-semantic-search-v1", creatureContractId: "oteryn-game-atlas-export-v1", creatureCapability: "static-creatures-v1", creatureSemanticDigest: "sha256:81505e91d7089f91e71813ec43f97118932db9cc7fd76d291fa399447ee2dfa4" })
});
function ancillarySourceExpectations(trust = PRODUCTION_FULLWORLD_TRUST) {
  if (trust?.boundedRealFixtureId === BOUNDED_REAL_FIXTURE_ID) {
    if (!CONTENT_ID.test(trust.semanticRoot) || !CONTENT_ID.test(trust.pixelRoot)) invalidQualificationTrust("ancillary source roots are not bounded-real-bound");
    return Object.freeze({
      mode: "bounded_real_world",
      contractId: BOUNDED_REAL_SOURCE_CONTRACT,
      animation: Object.freeze({ gameSha: BOUNDED_REAL_GAME_SHA, appearanceProductRoot: trust.pixelRoot, outfitSpatialProductRoot: trust.semanticRoot }),
      creatures: Object.freeze({ contractId: BOUNDED_REAL_SOURCE_CONTRACT, capability: BOUNDED_REAL_CREATURE_CAPABILITY, semanticDigest: PRODUCTION_ANCILLARY_SOURCES.semanticSearch.creatureSemanticDigest, npcRoleSchemaVersion: 1, fixtureId: BOUNDED_REAL_FIXTURE_ID }),
      semanticSearch: PRODUCTION_ANCILLARY_SOURCES.semanticSearch
    });
  }
  if (trust?.gameSha !== "fixture") return PRODUCTION_ANCILLARY_SOURCES;
  if (!CONTENT_ID.test(trust.semanticRoot) || !CONTENT_ID.test(trust.pixelRoot) || trust.qualificationFixtureId !== QUALIFICATION_FIXTURE_ID) invalidQualificationTrust("ancillary source roots are not qualification-bound");
  return Object.freeze({
    mode: "qualification_fixture",
    contractId: QUALIFICATION_SOURCE_CONTRACT,
    animation: Object.freeze({ gameSha: "fixture", appearanceProductRoot: trust.pixelRoot, outfitSpatialProductRoot: trust.semanticRoot }),
    creatures: Object.freeze({ contractId: QUALIFICATION_SOURCE_CONTRACT, capability: "qualification-creatures-v1", semanticDigest: trust.semanticRoot, npcRoleSchemaVersion: 1, fixtureId: QUALIFICATION_FIXTURE_ID }),
    semanticSearch: Object.freeze({ authority: "Oteryn/Oteryn-Atlas", repository: "Oteryn/Oteryn-Atlas", contractId: QUALIFICATION_SOURCE_CONTRACT, capability: "qualification-semantic-search-v1", profileId: "oteryn-atlas-qualification-semantic-search-v1", fixtureId: QUALIFICATION_FIXTURE_ID, gameRevision: "fixture", semanticDigest: trust.semanticRoot, creatureContractId: QUALIFICATION_SOURCE_CONTRACT, creatureCapability: "qualification-creatures-v1", creatureSemanticDigest: trust.semanticRoot })
  });
}
var FULLWORLD_PATHS = Object.freeze({
  animation: "/fullworld/animation/",
  minimap: "/fullworld/minimap/",
  overview: "/fullworld/overview/",
  publication: "/fullworld/publication/",
  pixelBuckets: "/fullworld/pixel-buckets/",
  runtimeIndex: "/fullworld/runtime-index/"
});
var FULLWORLD_CAPABILITIES = Object.freeze({
  animation: Object.freeze({
    enabled: true,
    status: "PROVEN",
    reason: "Verified 15.32 Game-owned animation programs are available; playback remains opt-in and static when disabled."
  }),
  layers: Object.freeze([
    Object.freeze({ id: "minimap-overview", label: "Overview / density", status: "PROVEN", enabled: true }),
    Object.freeze({ id: "areas", label: "Areas", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "subareas", label: "Subareas", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "towns", label: "Towns", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "temples", label: "Temples", status: "UNKNOWN", enabled: false }),
    Object.freeze({ id: "teleports-transitions", label: "Teleports / transitions", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "houses", label: "Houses", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "house-doors", label: "House doors", status: "UNKNOWN", enabled: false }),
    Object.freeze({ id: "action-ids", label: "Action IDs", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "unique-ids", label: "Unique IDs", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "waypoints", label: "Waypoints", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "mechanics", label: "Mechanics", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "raids-encounters", label: "Raids / encounters", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "quest-areas", label: "Quest areas", status: "UNKNOWN", enabled: false }),
    Object.freeze({ id: "pois", label: "POIs", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "npcs", label: "NPCs", status: "BLOCKED", enabled: false }),
    Object.freeze({ id: "monsters-spawns", label: "Monsters / spawns", status: "BLOCKED", enabled: false })
  ])
});

// src/browser/semantic-search.mjs
var ALLOWED_KINDS = /* @__PURE__ */ new Set(["npc", "monster", "town", "waypoint", "poi", "teleport", "house", "quest_area", "mechanic"]);
var MAX_QUERY = 256;
var MAX_RECORDS = 25e4;
var PRODUCTION_SEMANTIC_SEARCH_SOURCE = Object.freeze({ authority: "Oteryn/Oteryn-Game", repository: "Oteryn/Oteryn-Game", contractId: "oteryn-game-atlas-export-v1", capability: "semantic-search-source-v1", profileId: "oteryn-game-atlas-semantic-search-v1" });
var SemanticSearchError = class extends Error {
};
function requireValue4(condition, message) {
  if (!condition) throw new SemanticSearchError(message);
}
function normalizeSearchText(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
  requireValue4(text.length <= MAX_QUERY && !/[\u0000-\u001f\u007f]/.test(text), "search query invalid");
  return text;
}
function validatePosition(position, label) {
  requireValue4(position && Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y) && Number.isSafeInteger(position.floor), `${label} position invalid`);
}
function validateBounds(bounds, label) {
  if (bounds == null) return;
  requireValue4(bounds && Number.isSafeInteger(bounds.x_min) && Number.isSafeInteger(bounds.y_min) && Number.isSafeInteger(bounds.x_max_exclusive) && Number.isSafeInteger(bounds.y_max_exclusive) && Number.isSafeInteger(bounds.floor), `${label} bounds invalid`);
  requireValue4(bounds.x_min < bounds.x_max_exclusive && bounds.y_min < bounds.y_max_exclusive, `${label} bounds empty`);
}
function validateSemanticSearchIndex(index, expectedSource = PRODUCTION_SEMANTIC_SEARCH_SOURCE) {
  requireValue4(index?.schema_version === 1, "semantic search index schema unsupported");
  requireValue4(expectedSource && typeof expectedSource === "object" && !Array.isArray(expectedSource), "semantic search source expectations invalid");
  requireValue4(index.source?.authority === expectedSource.authority && index.source?.repository === expectedSource.repository, "semantic search source authority invalid");
  requireValue4(index.source?.contract_id === expectedSource.contractId && index.source?.capability === expectedSource.capability, "semantic search source contract unsupported");
  requireValue4(index.source?.profile_id === expectedSource.profileId, "semantic search source profile unsupported");
  if (expectedSource.gameRevision == null) requireValue4(/^[0-9a-f]{40}$/.test(index.source?.game_revision ?? ""), "semantic search Game revision invalid");
  else requireValue4(index.source?.game_revision === expectedSource.gameRevision, "semantic search fixture revision invalid");
  if (expectedSource.fixtureId == null) requireValue4(index.source?.fixture_id == null, "production semantic search source must not claim fixture identity");
  else requireValue4(index.source?.fixture_id === expectedSource.fixtureId, "semantic search fixture identity invalid");
  requireValue4(/^sha256:[0-9a-f]{64}$/.test(index.source?.semantic_digest ?? "") && /^sha256:[0-9a-f]{64}$/.test(index.index_digest ?? ""), "semantic search digest identity invalid");
  if (expectedSource.semanticDigest != null) requireValue4(index.source.semantic_digest === expectedSource.semanticDigest, "semantic search semantic digest mismatch");
  requireValue4(index.input_floor_aliases && typeof index.input_floor_aliases === "object" && Object.keys(index.input_floor_aliases).length <= 64, "semantic search floor aliases invalid");
  for (const [key, value] of Object.entries(index.input_floor_aliases)) {
    requireValue4(/^-?\d+$/.test(key) && Number.isSafeInteger(value), "semantic search floor alias invalid");
  }
  requireValue4(index.ranking && Object.values(index.ranking).every(Number.isFinite), "semantic ranking profile invalid");
  requireValue4(Array.isArray(index.records) && index.records.length <= MAX_RECORDS, "semantic search record count invalid");
  const seen = /* @__PURE__ */ new Set();
  for (const record of index.records) {
    requireValue4(record && ALLOWED_KINDS.has(record.kind), "semantic search record kind invalid");
    requireValue4(typeof record.id === "string" && record.id.length > 0 && record.id.length <= 128 && !seen.has(record.id), "semantic search record id invalid/duplicate");
    seen.add(record.id);
    requireValue4(typeof record.label === "string" && record.label.length > 0 && record.label.length <= 256, "semantic search label invalid");
    requireValue4(Array.isArray(record.aliases) && record.aliases.length <= 32 && record.aliases.every((value) => typeof value === "string" && value.length <= 256), "semantic aliases invalid");
    requireValue4(Array.isArray(record.capabilities) && record.capabilities.length <= 32 && record.capabilities.every((value) => typeof value === "string" && value.length <= 64), "semantic capabilities invalid");
    requireValue4(record.provenance && typeof record.provenance === "object" && !Array.isArray(record.provenance), "semantic provenance invalid");
    validatePosition(record.position, record.id);
    validateBounds(record.bounds, record.id);
    requireValue4(record.search_terms && typeof record.search_terms.label === "string" && Array.isArray(record.search_terms.aliases), "semantic normalized terms missing");
    requireValue4(record.search_terms.label === normalizeSearchText(record.label), "semantic normalized label mismatch");
  }
  return index;
}

// <stdin>
var FIXTURE_ID = "atlas-qualification-world-v2";
var QUALIFICATION_TRUST_MARKER2 = "oteryn-atlas-qualification-trust-v1";
function sha(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}
function canonicalDigest(value) {
  return sha(canonicalJsonBytes(value));
}
function productEntries(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).replaceAll(path.sep, "/");
      if (entry.isDirectory()) walk(full);
      else if (relative !== "fixture-manifest.json") {
        const bytes = fs.readFileSync(full);
        out.push({ path: relative, bytes: bytes.length, digest: sha(bytes) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
function qualificationTrustDescriptor(manifest) {
  resolveQualificationManifestTrust(manifest);
  return Object.freeze({
    marker: QUALIFICATION_TRUST_MARKER2,
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
    productDigest: manifest.productDigest
  });
}
function qualificationFilesystemFetcher(root) {
  const base = path.resolve(root);
  return async (url) => {
    const relative = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "");
    const target = path.resolve(base, ...relative.split("/"));
    if (!target.startsWith(`${base}${path.sep}`)) return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    let bytes;
    try {
      bytes = fs.readFileSync(target);
    } catch {
      return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => String(name).toLowerCase() === "content-length" ? String(bytes.length) : null },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
  };
}
async function verifyQualificationWorld(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "fixture-manifest.json"), "utf8"));
  const files = productEntries(root);
  if (canonicalDigest(files) !== canonicalDigest(manifest.files) || canonicalDigest(files) !== manifest.productDigest) throw new TypeError("qualification world digest mismatch");
  if (manifest.fixtureId !== FIXTURE_ID || manifest.dataCapability !== "qualification_fixture" || manifest.semanticFloorCount !== 16 || manifest.runtimeFloorCount !== 16) throw new TypeError("qualification world identity mismatch");
  for (const field of ["publicationRoot", "semanticRoot", "pixelRoot", "runtimeIndexRoot", "pixelBucketRoot", "overviewRoot", "minimapRoot", "sourceFingerprint"]) {
    if (!/^sha256:[0-9a-f]{64}$/.test(manifest[field])) throw new TypeError(`qualification world ${field} invalid`);
  }
  const trust = resolveQualificationManifestTrust(manifest);
  const ancillary = ancillarySourceExpectations(trust);
  const fetcher = qualificationFilesystemFetcher(root);
  const animation = await loadAnimationRuntime(new URL("https://qualification.invalid/animation/"), fetcher, ancillary.animation);
  const creatureIndex = JSON.parse(fs.readFileSync(path.join(root, "data/creatures/index.json"), "utf8"));
  validateCreaturePublicationSource(creatureIndex.source, animation.manifest.source, ancillary.creatures);
  const creatureSearch = JSON.parse(fs.readFileSync(path.join(root, "data/creatures/search.json"), "utf8"));
  validateCreatureSearchRecords(creatureSearch.records);
  const semanticIndex = JSON.parse(fs.readFileSync(path.join(root, "web/semantic-search/index.json"), "utf8"));
  validateSemanticSearchIndex(semanticIndex, ancillary.semanticSearch);
  const semanticCreatures = JSON.parse(fs.readFileSync(path.join(root, "web/semantic-search/creatures.json"), "utf8"));
  validateCreatureSearchCatalog(semanticCreatures, ancillary.semanticSearch);
  return Object.freeze(manifest);
}
export {
  qualificationTrustDescriptor,
  verifyQualificationWorld
};
