// Immutable protected bounded-world builder and verifier dependency closure.
// Runtime product bytes come only from the caller's protected sourceRoot.
// Mechanical extraction: tests/verification/protected-bounded-oracle.test.mjs --emit-entry.
// Reproduce using the recorded source blobs, not mutable candidate sources:
// node tests/verification/protected-bounded-oracle.test.mjs --emit-entry |
//   esbuild --bundle --format=esm --platform=node --target=node22 --tree-shaking=true |
//   node tests/verification/protected-bounded-oracle.test.mjs --finalize-bundle
// Finalization removes only the exact unused FULLWORLD_TRUST browser-global initializer.
// Generator: esbuild 0.25.9. No minification or dependency imports at proof time.
// Regeneration requires independent authority review; admission cannot change this file.
// Source blob 0c26b4f7fbfe3eed258cd14b893646015da09476 src/browser/animation-runtime.mjs
// Source blob 2cabf956362fed848a83051077cec881551fd674 src/browser/creature-gameplay-profiles.mjs
// Source blob 0f44da17c30a61089b0cec1c110d8411fedc8f94 src/browser/creature-publication-source.mjs
// Source blob e732c6478251f476f09750687dadfb38799b521a src/browser/creature-search.mjs
// Source blob 9a3a37d0dffea7bc1f80bd35b37c9ae6d25a6000 src/browser/fullworld-pixel-buckets.mjs
// Source blob 1ae57543eeb9aa46b47465d315d56496c526bf6d src/browser/fullworld-pixels.mjs
// Source blob e2a788657d92e0e641dad5627f12416507700055 src/browser/fullworld-trust.mjs
// Source blob 86f908811d01d60587b0a644e8f76f803da5ab0f src/browser/fullworld.mjs
// Source blob 2f56433f797b4178e28d7bf1cbf86487ac2832e8 src/browser/loader.mjs
// Source blob 152b79dfe3f8fd92dd4159c236db55ef2a86d904 src/browser/semantic-search.mjs
// Source blob 61df75f257812eea13ddaddb7b771ac3c722ad97 src/browser/semantic.mjs
// Source blob 57440ab5a13cc0b7e813c1c27af797f200677089 src/layers/minimap.mjs
// Source blob b3ce11dc7c2477dc665afd1c0ace5d015d0fb448 src/layers/overview.mjs
// Source blob 8d94ac3710d7702efc914aa3d3930d3c42f14ba5 tools/verification/bounded-real-world.mjs
// Payload sha256 94f2061a1eb98afb4fc68d52676ffb64e27cbee2a17aa730a9de7a99c45b7155
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

// src/browser/creature-gameplay-profiles.mjs
var GAMEPLAY_EXPECTATIONS = Object.freeze({
  contractId: "oteryn-game-atlas-export-v1",
  semanticRevision: 1,
  capability: "creature-gameplay-profiles-v1",
  profileSchemaVersion: 1,
  gameSha: "b56ce339281d252a9e01a5a2bed583582bf29e68",
  semanticDigest: "sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28",
  sourceRepository: "blakinio/Otheryn",
  sourceSha: "e417c5e7c22986bf4acef0495eb47f7b72c97cce",
  shardKeyRule: "entity-hash-prefix-2",
  limitProfile: "creature-gameplay-profiles-v1-e417-census-v1"
});
var PRODUCER_LIMITS = Object.freeze({
  max_manifest_bytes: 262144,
  max_shard_bytes: 524288,
  max_profiles_per_shard: 32,
  max_npc_profiles: 2048,
  max_monster_profiles: 4096,
  max_referenced_items: 4096,
  max_shards: 513,
  max_shop_sells_per_profile: 256,
  max_shop_buys_per_profile: 2048,
  max_shop_rows_per_profile: 2304,
  max_loot_rows_per_profile: 128,
  max_travel_destinations_per_profile: 16,
  max_resistance_elements_per_profile: 16,
  max_immunities_per_profile: 16,
  max_string_bytes: 256,
  max_nesting_depth: 12,
  max_price: 1e8,
  max_loot_count: 1024,
  max_abs_resistance_percent: 2048
});
var GAMEPLAY_LIMITS = Object.freeze({
  producer: PRODUCER_LIMITS,
  defaultCacheShards: 4,
  maxCacheShards: 8,
  maxCacheBytes: 4 * 1024 * 1024
});
var SHA = /^[0-9a-f]{40}$/;
var DIGEST = /^sha256:[0-9a-f]{64}$/;
var HEX_KEY = /^[0-9a-f]{2}$/;
var CreatureGameplayProfileError = class extends Error {
};
function fail(condition, message) {
  if (!condition) throw new CreatureGameplayProfileError(message);
}
function sortCanonical2(value) {
  if (Array.isArray(value)) return value.map(sortCanonical2);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = sortCanonical2(value[key]);
    return result;
  }
  return value;
}
function canonicalGameplayJsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(sortCanonical2(value)));
}
function sameJson(a, b) {
  const left = canonicalGameplayJsonBytes(a);
  const right = canonicalGameplayJsonBytes(b);
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}
function exactKeys(value, required, optional, label) {
  fail(value && typeof value === "object" && !Array.isArray(value), `${label} must be object`);
  const keys = Object.keys(value);
  for (const key of required) fail(Object.hasOwn(value, key), `${label} missing ${key}`);
  const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
  fail(keys.every((key) => allowed.has(key)), `${label} has unsupported field`);
  return value;
}
function safeRelativePath(path2) {
  fail(typeof path2 === "string" && path2.length > 0, "shard path missing");
  fail(!path2.startsWith("/") && !path2.includes("\\") && !path2.includes("//"), "unsafe shard path");
  fail(!path2.split("/").some((part) => part === "" || part === "." || part === ".."), "unsafe shard path");
  fail(path2.startsWith("shards/") && path2.endsWith(".json"), "invalid shard path");
  return path2;
}
function validCount(value, max, label) {
  fail(Number.isSafeInteger(value) && value >= 0 && value <= max, `${label} invalid`);
}
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function descriptorCounts(manifest) {
  const result = { npc_profiles: 0, monster_profiles: 0, referenced_items: 0 };
  for (const shard of manifest.shards) {
    if (shard.kind === "npc") result.npc_profiles += shard.records;
    else if (shard.kind === "monster") result.monster_profiles += shard.records;
    else result.referenced_items += shard.records;
  }
  return result;
}
async function validateCreatureGameplayManifest(manifest, { expectedSemanticDigest = GAMEPLAY_EXPECTATIONS.semanticDigest } = {}) {
  exactKeys(manifest, ["contract_id", "semantic_revision", "capability", "profile_schema_version", "producer_repository_sha", "source_evidence", "shard_key_rule", "limit_profile", "limits", "counts", "shards", "semantic_digest"], [], "gameplay manifest");
  fail(manifest.contract_id === GAMEPLAY_EXPECTATIONS.contractId, "gameplay contract mismatch");
  fail(manifest.semantic_revision === GAMEPLAY_EXPECTATIONS.semanticRevision, "gameplay semantic revision mismatch");
  fail(manifest.capability === GAMEPLAY_EXPECTATIONS.capability, "gameplay capability mismatch");
  fail(manifest.profile_schema_version === GAMEPLAY_EXPECTATIONS.profileSchemaVersion, "gameplay profile schema mismatch");
  fail(typeof manifest.producer_repository_sha === "string" && SHA.test(manifest.producer_repository_sha), "gameplay Game SHA invalid");
  fail(manifest.producer_repository_sha === GAMEPLAY_EXPECTATIONS.gameSha, "gameplay Game SHA mismatch");
  exactKeys(manifest.source_evidence, ["repository", "sha"], [], "gameplay source evidence");
  fail(manifest.source_evidence.repository === GAMEPLAY_EXPECTATIONS.sourceRepository && manifest.source_evidence.sha === GAMEPLAY_EXPECTATIONS.sourceSha, "gameplay source evidence mismatch");
  fail(manifest.shard_key_rule === GAMEPLAY_EXPECTATIONS.shardKeyRule, "gameplay shard rule mismatch");
  fail(manifest.limit_profile === GAMEPLAY_EXPECTATIONS.limitProfile, "gameplay limit profile mismatch");
  fail(sameJson(manifest.limits, PRODUCER_LIMITS), "gameplay producer limits mismatch");
  exactKeys(manifest.counts, ["npc_profiles", "monster_profiles", "referenced_items"], [], "gameplay counts");
  validCount(manifest.counts.npc_profiles, PRODUCER_LIMITS.max_npc_profiles, "npc profile count");
  validCount(manifest.counts.monster_profiles, PRODUCER_LIMITS.max_monster_profiles, "monster profile count");
  validCount(manifest.counts.referenced_items, PRODUCER_LIMITS.max_referenced_items, "referenced item count");
  fail(Array.isArray(manifest.shards) && manifest.shards.length <= PRODUCER_LIMITS.max_shards, "gameplay shard count invalid");
  const slots = /* @__PURE__ */ new Set();
  const paths = /* @__PURE__ */ new Set();
  for (const shard of manifest.shards) {
    exactKeys(shard, ["kind", "key", "path", "bytes", "digest", "records"], [], "gameplay shard descriptor");
    fail(["npc", "monster", "referenced-items"].includes(shard.kind), "gameplay shard kind invalid");
    if (shard.kind === "referenced-items") fail(shard.key === "all", "referenced item shard key invalid");
    else fail(typeof shard.key === "string" && HEX_KEY.test(shard.key), "gameplay shard key invalid");
    safeRelativePath(shard.path);
    fail(!paths.has(shard.path), "duplicate gameplay shard path");
    paths.add(shard.path);
    const slot = `${shard.kind}:${shard.key}`;
    fail(!slots.has(slot), "duplicate gameplay shard slot");
    slots.add(slot);
    validCount(shard.bytes, PRODUCER_LIMITS.max_shard_bytes, "gameplay shard bytes");
    fail(shard.bytes > 0, "gameplay shard bytes invalid");
    validCount(shard.records, shard.kind === "referenced-items" ? PRODUCER_LIMITS.max_referenced_items : PRODUCER_LIMITS.max_profiles_per_shard, "gameplay shard records");
    fail(typeof shard.digest === "string" && DIGEST.test(shard.digest), "gameplay shard digest invalid");
  }
  fail(sameJson(descriptorCounts(manifest), manifest.counts), "gameplay descriptor count mismatch");
  fail(typeof manifest.semantic_digest === "string" && DIGEST.test(manifest.semantic_digest), "gameplay semantic digest invalid");
  const unsigned = { ...manifest };
  delete unsigned.semantic_digest;
  const actual = await sha256ContentId(canonicalGameplayJsonBytes(unsigned));
  fail(actual === manifest.semantic_digest, "gameplay semantic digest mismatch");
  fail(expectedSemanticDigest == null || manifest.semantic_digest === expectedSemanticDigest, "gameplay trusted semantic digest mismatch");
  return deepFreeze(manifest);
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
function resolveBoundedRealManifestTrust(candidate) {
  return boundedRealRuntimeTrust(validateBoundedRealIdentity(candidate));
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

// src/browser/fullworld.mjs
var PUBLICATION_PROFILE = "oteryn-atlas-fullworld-publication-v0";
var SEMANTIC_PROFILE = "oteryn-atlas-fullworld-semantic-publication-v0";
var RUNTIME_WORLD_PROFILE = "oteryn-atlas-fullworld-runtime-index-v0";
var RUNTIME_FLOOR_PROFILE = "oteryn-atlas-fullworld-runtime-floor-index-v0";
var PUBLICATION_DOMAIN = "OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0";
var SEMANTIC_DOMAIN = "OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0";
var FLOOR_DOMAIN = "OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0";
var RUNTIME_WORLD_DOMAIN = "OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-WORLD-V0\0";
var RUNTIME_FLOOR_DOMAIN = "OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-FLOOR-V0\0";
var MAX_PUBLICATION_BYTES = 512 * 1024;
var MAX_WORLD_BYTES = 512 * 1024;
var MAX_FLOOR_BYTES = 4 * 1024 * 1024;
var MAX_SOURCE_CHUNK_BYTES = 96 * 1024 * 1024;
var MAX_GROUP_BYTES = 8 * 1024 * 1024;
function concatBytes(a, b) {
  const value = new Uint8Array(a.byteLength + b.byteLength);
  value.set(a, 0);
  value.set(b, a.byteLength);
  return value;
}
async function rootedContentId(domain, value) {
  const core = { ...value };
  delete core.rootContentId;
  return sha256ContentId(concatBytes(new TextEncoder().encode(domain), canonicalJsonBytes(core)));
}

// src/browser/fullworld-pixels.mjs
var PIXEL_PROFILE = "oteryn-atlas-fullworld-pixel-publication-v0";
var PIXEL_ROOT_DOMAIN = "OTERYN-ATLAS-FULLWORLD-PIXEL-STORE-V0\0";
var PIXEL_HASH_DOMAIN = "OTERYN-DYN-ATLAS-PIXEL-RGBA-V0";
var MAX_MANIFEST_BYTES3 = 16 * 1024 * 1024;
var MAX_PACK_BYTES = 64 * 1024 * 1024;

// src/browser/fullworld-pixel-buckets.mjs
var RUNTIME_PIXEL_BUCKET_PROFILE = "oteryn-atlas-runtime-pixel-buckets-v0";
var RUNTIME_PIXEL_BUCKET_DOMAIN = "OTERYN-ATLAS-RUNTIME-PIXEL-BUCKETS-V0\0";
var MAX_MANIFEST_BYTES4 = 16 * 1024 * 1024;
var MAX_BUCKET_BYTES2 = 8 * 1024 * 1024;

// src/layers/minimap.mjs
var WORLD_PROFILE = "oteryn-atlas-visual-minimap-world-v0";
var FLOOR_PROFILE = "oteryn-atlas-visual-minimap-floor-v0";
var WORLD_DOMAIN = "OTERYN-ATLAS-VISUAL-MINIMAP-WORLD-V0\0";
var FLOOR_DOMAIN2 = "OTERYN-ATLAS-VISUAL-MINIMAP-FLOOR-V0\0";
var MAX_WORLD_BYTES2 = 512 * 1024;
var MAX_FLOOR_BYTES2 = 4 * 1024 * 1024;
var MAX_TILE_BYTES = 512 * 1024;
var minimapProfiles = Object.freeze({ world: WORLD_PROFILE, floor: FLOOR_PROFILE });
var minimapDomains = Object.freeze({ world: WORLD_DOMAIN, floor: FLOOR_DOMAIN2 });

// src/layers/overview.mjs
var WORLD_PROFILE2 = "oteryn-atlas-overview-world-v0";
var FLOOR_PROFILE2 = "oteryn-atlas-overview-floor-v0";
var CHUNK_PROFILE = "oteryn-atlas-overview-chunk-v0";
var WORLD_DOMAIN2 = "OTERYN-ATLAS-OVERVIEW-WORLD-V0\0";
var FLOOR_DOMAIN3 = "OTERYN-ATLAS-OVERVIEW-FLOOR-V0\0";
var MAX_WORLD_BYTES3 = 512 * 1024;
var MAX_FLOOR_BYTES3 = 2 * 1024 * 1024;
var MAX_CHUNK_BYTES2 = 512 * 1024;
function joinBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
async function computeOverviewRoot(value, domain) {
  const core = { ...value };
  delete core.rootContentId;
  const prefix = new TextEncoder().encode(domain);
  return sha256ContentId(joinBytes(prefix, canonicalJsonBytes(core)));
}
var overviewProfiles = Object.freeze({ world: WORLD_PROFILE2, floor: FLOOR_PROFILE2, chunk: CHUNK_PROFILE });
var overviewDomains = Object.freeze({ world: WORLD_DOMAIN2, floor: FLOOR_DOMAIN3 });

// <stdin>
var BOUNDED_REAL_WORLD_ID = "atlas-bounded-real-world-v1";
var BOUNDED_REAL_SOURCE_CONTRACT2 = "oteryn-atlas-bounded-real-runtime-v1";
var BOUNDED_REAL_CREATURE_CAPABILITY2 = "bounded-real-creatures-v1";
var BOUNDED_GAME_SHA = "fixture";
var FLOORS = Object.freeze(Array.from({ length: 16 }, (_, index) => index - 15));
var INITIAL_ANCHOR = Object.freeze({ x: 32369, y: 32241, floor: -7 });
var TARGET_ENTITY_IDS = Object.freeze([
  "npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e",
  "monster-entity:80295e51265b3662bfbea2ea01ee3ccb",
  "npc-entity:0e7857888218c9081fabdb469aa9349b",
  "npc-entity:0c83ae18a907dc7e8f15c37c03e4f04c"
]);
var PIXEL_BYTES = 32 * 32 * 4;
var MINIMAP_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
function sha(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}
function canonicalDigest(value) {
  return sha(canonicalJsonBytes(value));
}
async function domainRoot(domain, value) {
  const core = { ...value };
  delete core.rootContentId;
  return sha256ContentId(Buffer.concat([Buffer.from(domain), Buffer.from(canonicalJsonBytes(core))]));
}
function writeJson(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, canonicalJsonBytes(value));
}
function writeBytes(root, relative, value) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}
function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}
function productEntries(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).replaceAll(path.sep, "/");
      if (entry.isDirectory()) walk(full);
      else if (relative !== "bounded-real-manifest.json") {
        const bytes = fs.readFileSync(full);
        out.push({ path: relative, bytes: bytes.length, digest: sha(bytes) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
function fixturePixels() {
  const bytes = Buffer.alloc(PIXEL_BYTES);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const pixel = offset / 4;
    const x = pixel % 32;
    const y = Math.floor(pixel / 32);
    bytes[offset] = 40 + x * 5 % 160;
    bytes[offset + 1] = 70 + y * 3 % 150;
    bytes[offset + 2] = 120 + (x + y) * 2 % 120;
    bytes[offset + 3] = 255;
  }
  return bytes;
}
function alignBounds(anchors, span) {
  const xs = anchors.map(({ x }) => x);
  const ys = anchors.map(({ y }) => y);
  const xMin = Math.floor(Math.min(...xs) / span) * span;
  const yMin = Math.floor(Math.min(...ys) / span) * span;
  return Object.freeze({ x_min: xMin, x_max_exclusive: (Math.floor(Math.max(...xs) / span) + 1) * span, y_min: yMin, y_max_exclusive: (Math.floor(Math.max(...ys) / span) + 1) * span });
}
function tileAt(anchor, ordinal) {
  return {
    record_type: "tile",
    position: { ...anchor },
    source_position: { legacy_x: anchor.x, legacy_y: anchor.y, legacy_z: -anchor.floor },
    tile_record_id: `tile:bounded-real-substrate-${ordinal}`,
    presentation: [{ export_record_id: `presentation:bounded-real-substrate-${ordinal}`, appearance_source_id: 1, entity_identity_state: "UNRESOLVED", presentation_order: { order: 0, plane: 0 }, source_role: "ground", resolved_primitives: [{ sprite_source_id: 1, width_units: 32, height_units: 32, displacement: { dx_units: 0, dy_units: 0 }, source_profile_id: "oteryn-atlas-15-32-appearance-spatial-v1", layer_index: 0, phase: 0, pattern: { x: 0, y: 0, z: 0 }, visual_coverage_offsets: [0, 0] }] }]
  };
}
function stableAnchors(sourceRoot) {
  const catalog = readJson(sourceRoot, "web/semantic-search/creatures.json");
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
  const grouped = /* @__PURE__ */ new Map();
  for (const anchor of anchors) {
    const region_x = Math.floor(anchor.x / 32);
    const region_y = Math.floor(anchor.y / 32);
    const key = `${anchor.floor}:${region_x}:${region_y}`;
    if (!grouped.has(key)) grouped.set(key, { floor: anchor.floor, region_x, region_y, anchors: [] });
    grouped.get(key).anchors.push(anchor);
  }
  const chunks = [];
  for (const group of [...grouped.values()].sort((a, b) => a.floor - b.floor || a.region_y - b.region_y || a.region_x - b.region_x)) {
    const rows = group.anchors.sort((a, b) => a.y - b.y || a.x - b.x).map((anchor, index) => Buffer.from(canonicalJsonBytes(tileAt(anchor, index))));
    const bytes = Buffer.concat(rows);
    let offset = 0;
    const ranges = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const anchor = group.anchors[index];
      ranges.push({ offset, bytes: row.length, contentId: await sha256ContentId(row), yMin: anchor.y, yMaxExclusive: anchor.y + 1, tiles: 1, resolvedPrimitives: 1 });
      offset += row.length;
    }
    chunks.push({ ...group, path: `chunks/f${group.floor}-r${group.region_x}-c${group.region_y}.jsonl`, bytes, contentId: await sha256ContentId(bytes), ranges });
  }
  return chunks;
}
async function buildPixelPublication(root) {
  const pixels = fixturePixels();
  const pixelContentId = await sha256ContentId(pixels);
  const packSha = sha(pixels).slice("sha256:".length);
  const core = { profile: PIXEL_PROFILE, pixelHashDomain: PIXEL_HASH_DOMAIN, runtimePlacement: { identityAuthority: false }, packs: [{ path: "packs/p0.rgba", bytes: pixels.length, sha256: packSha, identityAuthority: false }], blobs: [{ contentId: pixelContentId, pack: 0, width: 32, height: 32, offset: 0, bytes: pixels.length }], spriteIndex: { "1": { contentId: pixelContentId, width: 32, height: 32 } }, counts: { spriteRefs: 1, uniquePixelBlobs: 1, rawBytesAfterDedupe: pixels.length } };
  const manifest = { ...core, rootContentId: await domainRoot(PIXEL_ROOT_DOMAIN, core) };
  writeJson(root, "publication/pixels/manifest.json", manifest);
  writeBytes(root, "publication/pixels/packs/p0.rgba", pixels);
  return { manifest, pixelContentId, pixels };
}
async function buildRuntimePixelBuckets(root, publicationRoot, pixelRoot, pixelContentId, pixels) {
  const bucket = pixelContentId.slice("sha256:".length, "sha256:".length + 1);
  const bucketPath = `buckets/${bucket}.rgba`;
  const bundlePath = "local-max.rgba";
  const contentId = await sha256ContentId(pixels);
  const sha256 = contentId.slice("sha256:".length);
  const core = { profile: RUNTIME_PIXEL_BUCKET_PROFILE, identityAuthority: false, source: { authority: "Oteryn/Oteryn-Game", publicationRoot, pixelRoot }, bucketNibbles: 1, buckets: [{ bucket, path: bucketPath, identityAuthority: false, bytes: pixels.length, contentId, sha256 }], localMaxBundle: { path: bundlePath, identityAuthority: false, bytes: pixels.length, contentId, sha256, bucketOffsets: [{ bucket, offset: 0, bytes: pixels.length }] }, blobIndex: { [pixelContentId]: { bucket, offset: 0, bytes: pixels.length, width: 32, height: 32 } }, counts: { buckets: 1, blobs: 1, bytes: pixels.length } };
  const manifest = { ...core, rootContentId: await domainRoot(RUNTIME_PIXEL_BUCKET_DOMAIN, core) };
  writeJson(root, "pixel-buckets/manifest.json", manifest);
  writeBytes(root, `pixel-buckets/${bucketPath}`, pixels);
  writeBytes(root, `pixel-buckets/${bundlePath}`, pixels);
  return manifest;
}
async function buildAnimation(root, semanticRoot, pixelRoot, contentId, pixels) {
  const bucketId = "br000";
  const bucketPath = `buckets/${bucketId}.rgba`;
  const program = { profile: "oteryn-atlas-animation-runtime-v1", object_programs: [], creature_programs: [], sprite_index: {}, blob_index: { [contentId]: { bucket: bucketId, bytes: pixels.length, height: 32, offset: 0, width: 32 } } };
  const programBytes = canonicalJsonBytes(program);
  const manifestCore = { profile: "oteryn-atlas-animation-runtime-v1", identityAuthority: false, source: { game_sha: BOUNDED_GAME_SHA, fixture_id: BOUNDED_REAL_WORLD_ID, source_contract: BOUNDED_REAL_SOURCE_CONTRACT2, appearance_product_root: pixelRoot, outfit_spatial_product_root: semanticRoot }, buckets: [{ id: bucketId, path: bucketPath, bytes: pixels.length, digest: sha(pixels) }], programs: { path: "programs.json", bytes: programBytes.length, digest: sha(programBytes) } };
  const manifest = { ...manifestCore, rootContentId: canonicalDigest(manifestCore) };
  writeJson(root, "animation/manifest.json", manifest);
  writeBytes(root, "animation/programs.json", programBytes);
  writeBytes(root, `animation/${bucketPath}`, pixels);
  return manifest;
}
async function buildMap(root, anchors, pixel) {
  const chunks = await mapChunks(anchors);
  const bounds = alignBounds(anchors, 32);
  const sourceFingerprint = canonicalDigest({ fixtureId: BOUNDED_REAL_WORLD_ID, mapAuthority: false, anchors });
  for (const chunk of chunks) writeBytes(root, `publication/semantic/${chunk.path}`, chunk.bytes);
  const semanticFloors = [];
  for (const floor of FLOORS) {
    const floorChunks = chunks.filter((chunk) => chunk.floor === floor);
    const counts = { bytes: floorChunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0), resolvedPrimitives: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0), tiles: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0) };
    const semanticCore2 = { profile: SEMANTIC_PROFILE, floor, bounds, sourceFingerprint, chunks: floorChunks.map((chunk) => ({ logicalAddress: { floor, region_x: chunk.region_x, region_y: chunk.region_y }, contentId: chunk.contentId, bytes: chunk.bytes.length, tiles: chunk.anchors.length, resolvedPrimitives: chunk.anchors.length, path: chunk.path })), counts };
    const semantic = { ...semanticCore2, rootContentId: await rootedContentId(FLOOR_DOMAIN, semanticCore2) };
    writeJson(root, `publication/semantic/floors/f${floor}.json`, semantic);
    semanticFloors.push({ floor, path: `floors/f${floor}.json`, rootContentId: semantic.rootContentId, counts });
  }
  const semanticCore = { profile: SEMANTIC_PROFILE, fabricRoot: `bounded:${BOUNDED_REAL_WORLD_ID}`, sourceFingerprint, floors: semanticFloors, counts: { floors: FLOORS.length, shards: chunks.length, tiles: anchors.length, resolvedPrimitives: anchors.length, uniqueSpriteRefs: 1, bytes: chunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0) } };
  const semanticWorld = { ...semanticCore, rootContentId: await rootedContentId(SEMANTIC_DOMAIN, semanticCore) };
  writeJson(root, "publication/semantic/world.json", semanticWorld);
  const publicationCore = { profile: PUBLICATION_PROFILE, source: { authority: "Oteryn/Oteryn-Game", handoffSha256: `bounded:${BOUNDED_REAL_WORLD_ID}`, fabricRoot: `bounded:${BOUNDED_REAL_WORLD_ID}`, sourceFingerprint, gameSha: BOUNDED_GAME_SHA, canonicalWorldId: null, canonicalWorldIdState: "BOUNDED_SUBSTRATE_NOT_AUTHORITY" }, semantic: { path: "semantic/world.json", rootContentId: semanticWorld.rootContentId }, pixels: { path: "pixels/manifest.json", rootContentId: pixel.manifest.rootContentId }, serializerStatus: "BOUNDED_REAL_WORLD_SUBSTRATE" };
  const publication = { ...publicationCore, rootContentId: await rootedContentId(PUBLICATION_DOMAIN, publicationCore) };
  writeJson(root, "publication/publication.json", publication);
  const runtimeWorldCore = { profile: RUNTIME_WORLD_PROFILE, source: { authority: "Oteryn/Oteryn-Game", publicationRoot: publication.rootContentId, semanticRoot: semanticWorld.rootContentId, pixelRoot: pixel.manifest.rootContentId, sourceFingerprint }, regionSpan: 32, rowGroupSpan: 1, floors: [], counts: { floors: FLOORS.length, groups: anchors.length, resolvedPrimitives: anchors.length, shards: chunks.length, sourceBytes: chunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0), tiles: anchors.length }, visualBounds: { maxWidthUnits: 32, maxHeightUnits: 32, minDxUnits: 0, maxDxUnits: 0, minDyUnits: 0, maxDyUnits: 0, overscanTiles: { left: 0, right: 0, top: 0, bottom: 0 } } };
  for (const entry of semanticFloors) {
    const floorChunks = chunks.filter((chunk) => chunk.floor === entry.floor);
    const descriptors = floorChunks.map((chunk) => ({ logicalAddress: { floor: chunk.floor, region_x: chunk.region_x, region_y: chunk.region_y }, path: chunk.path, contentId: chunk.contentId, bytes: chunk.bytes.length, worldChunk: { identityAuthority: false, chunk_id: `bounded-${chunk.floor}-${chunk.region_x}-${chunk.region_y}`, floor: chunk.floor, bounds: { x_min: chunk.region_x * 32, x_max_exclusive: (chunk.region_x + 1) * 32, y_min: chunk.region_y * 32, y_max_exclusive: (chunk.region_y + 1) * 32 }, semantic_root: semanticWorld.rootContentId, pixel_root: pixel.manifest.rootContentId, content_hash: chunk.contentId, estimated_memory_cost: chunk.bytes.length, dependencies: [entry.rootContentId, semanticWorld.rootContentId, pixel.manifest.rootContentId] }, groups: chunk.ranges }));
    const counts = { chunks: descriptors.length, groups: descriptors.reduce((sum, chunk) => sum + chunk.groups.length, 0), resolvedPrimitives: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0), sourceBytes: floorChunks.reduce((sum, chunk) => sum + chunk.bytes.length, 0), tiles: floorChunks.reduce((sum, chunk) => sum + chunk.anchors.length, 0) };
    const core = { profile: RUNTIME_FLOOR_PROFILE, floor: entry.floor, sourcePublicationRoot: publication.rootContentId, sourceSemanticRoot: semanticWorld.rootContentId, sourceFloorRoot: entry.rootContentId, sourceFingerprint, regionSpan: 32, rowGroupSpan: 1, bounds, chunks: descriptors, counts };
    const runtimeFloor = { ...core, rootContentId: await rootedContentId(RUNTIME_FLOOR_DOMAIN, core) };
    writeJson(root, `runtime-index/floors/f${entry.floor}.json`, runtimeFloor);
    runtimeWorldCore.floors.push({ floor: entry.floor, path: `floors/f${entry.floor}.json`, rootContentId: runtimeFloor.rootContentId, bounds });
  }
  const runtimeWorld = { ...runtimeWorldCore, rootContentId: await rootedContentId(RUNTIME_WORLD_DOMAIN, runtimeWorldCore) };
  writeJson(root, "runtime-index/world.json", runtimeWorld);
  return { chunks, bounds, sourceFingerprint, semanticFloors, semanticWorld, publication, runtimeWorld };
}
async function buildOverview(root, publicationRoot, map) {
  const floors = [];
  let totalCells = 0;
  for (const semanticEntry of map.semanticFloors) {
    const floorChunks = map.chunks.filter((chunk) => chunk.floor === semanticEntry.floor);
    const descriptors = [];
    for (const chunk of floorChunks) {
      const cells = chunk.anchors.map((anchor) => ({ cell_x: Math.floor(anchor.x / 8), cell_y: Math.floor(anchor.y / 8), tiles: 1, resolvedPrimitives: 1 }));
      totalCells += cells.length;
      const core = { profile: overviewProfiles.chunk, logicalAddress: { floor: chunk.floor, region_x: chunk.region_x, region_y: chunk.region_y }, sourceContentId: chunk.contentId, sourceFingerprint: map.sourceFingerprint, cellSizeTiles: 8, cells, counts: { cells: cells.length, resolvedPrimitives: cells.length, tiles: cells.length } };
      const bytes = canonicalJsonBytes(core);
      const relative = `chunks/f${chunk.floor}-r${chunk.region_x}-c${chunk.region_y}.json`;
      writeBytes(root, `overview/${relative}`, bytes);
      descriptors.push({ logicalAddress: core.logicalAddress, path: relative, bytes: bytes.length, contentId: await sha256ContentId(bytes), sourceContentId: chunk.contentId, counts: core.counts });
    }
    const floorCore = { profile: overviewProfiles.floor, floor: semanticEntry.floor, cellSizeTiles: 8, sourceFingerprint: map.sourceFingerprint, sourceFloorRoot: semanticEntry.rootContentId, bounds: map.bounds, chunks: descriptors, counts: { cells: descriptors.reduce((sum, entry) => sum + entry.counts.cells, 0), chunks: descriptors.length, resolvedPrimitives: descriptors.reduce((sum, entry) => sum + entry.counts.resolvedPrimitives, 0), tiles: descriptors.reduce((sum, entry) => sum + entry.counts.tiles, 0) } };
    const floorManifest = { ...floorCore, rootContentId: await computeOverviewRoot(floorCore, overviewDomains.floor) };
    writeJson(root, `overview/floors/f${semanticEntry.floor}.json`, floorManifest);
    floors.push({ floor: semanticEntry.floor, path: `floors/f${semanticEntry.floor}.json`, rootContentId: floorManifest.rootContentId });
  }
  const worldCore = { profile: overviewProfiles.world, cellSizeTiles: 8, source: { authority: "Oteryn/Oteryn-Game", publicationRoot, semanticRoot: map.semanticWorld.rootContentId, sourceFingerprint: map.sourceFingerprint }, semantics: { walkability: "NOT_CLAIMED", collision: "NOT_CLAIMED", terrainClassification: "NOT_CLAIMED" }, floors, counts: { cells: totalCells, chunks: map.chunks.length, floors: FLOORS.length, resolvedPrimitives: map.runtimeWorld.counts.resolvedPrimitives, tiles: map.runtimeWorld.counts.tiles } };
  const world = { ...worldCore, rootContentId: await computeOverviewRoot(worldCore, overviewDomains.world) };
  writeJson(root, "overview/world.json", world);
  return world;
}
async function buildMinimap(root, publicationRoot, pixelRoot, anchors, map) {
  const tileContentId = await sha256ContentId(MINIMAP_PNG);
  const bounds = alignBounds(anchors, 256);
  const floors = [];
  let tileCount = 0;
  for (const floor of FLOORS) {
    const regions = /* @__PURE__ */ new Map();
    for (const anchor of anchors.filter((entry) => entry.floor === floor)) regions.set(`${Math.floor(anchor.x / 256)}:${Math.floor(anchor.y / 256)}`, { region_x: Math.floor(anchor.x / 256), region_y: Math.floor(anchor.y / 256) });
    const chunks = [];
    for (const region of [...regions.values()].sort((a, b) => a.region_y - b.region_y || a.region_x - b.region_x)) {
      const relative = `tiles/f${floor}-r${region.region_x}-c${region.region_y}.png`;
      writeBytes(root, `minimap/${relative}`, MINIMAP_PNG);
      tileCount += 1;
      const sourceChunk = map.chunks.find((chunk) => chunk.floor === floor) ?? map.chunks[0];
      chunks.push({ logicalAddress: { floor, ...region }, path: relative, bytes: MINIMAP_PNG.byteLength, contentId: tileContentId, sourceContentId: sourceChunk.contentId });
    }
    const floorCore = { profile: minimapProfiles.floor, floor, regionSpan: 256, pixelPerWorldTile: 1, bounds, chunks, counts: { chunks: chunks.length, tiles: chunks.length } };
    const floorManifest = { ...floorCore, rootContentId: await domainRoot(minimapDomains.floor, floorCore) };
    writeJson(root, `minimap/floors/f${floor}.json`, floorManifest);
    floors.push({ floor, path: `floors/f${floor}.json`, rootContentId: floorManifest.rootContentId });
  }
  const worldCore = { profile: minimapProfiles.world, regionSpan: 256, pixelPerWorldTile: 1, source: { authority: "Oteryn/Oteryn-Game", publicationRoot, pixelRoot }, semantics: { terrainClassification: "NOT_CLAIMED", walkability: "NOT_CLAIMED" }, floors, counts: { floors: FLOORS.length, chunks: tileCount, tiles: tileCount } };
  const world = { ...worldCore, rootContentId: await domainRoot(minimapDomains.world, worldCore) };
  writeJson(root, "minimap/world.json", world);
  return world;
}
async function buildCreatures(root, selected, catalog, semanticRoot, animation) {
  const grouped = /* @__PURE__ */ new Map();
  for (const record of selected) {
    const chunk_x = Math.floor(record.position.x / 64);
    const chunk_y = Math.floor(record.position.y / 64);
    const key = `${record.position.floor}:${chunk_x}:${chunk_y}`;
    if (!grouped.has(key)) grouped.set(key, { floor: record.position.floor, chunk_x, chunk_y, records: [] });
    grouped.get(key).records.push({ ...record, name: record.label, presentation_resolution_state: "FALLBACK_MARKER", presentation_fallback: "factual-marker" });
  }
  const chunks = [];
  for (const group of [...grouped.values()].sort((a, b) => a.floor - b.floor || a.chunk_y - b.chunk_y || a.chunk_x - b.chunk_x)) {
    const value = { floor: group.floor, chunk_x: group.chunk_x, chunk_y: group.chunk_y, records: group.records.sort((a, b) => a.record_id.localeCompare(b.record_id)) };
    const bytes = canonicalJsonBytes(value);
    const relative = `chunks/f${group.floor}/${group.chunk_x}_${group.chunk_y}.json`;
    writeBytes(root, `data/creatures/${relative}`, bytes);
    chunks.push({ floor: group.floor, chunk_x: group.chunk_x, chunk_y: group.chunk_y, path: relative, bytes: bytes.length, digest: sha(bytes), records: value.records.length });
  }
  const search = { records: selected };
  const searchBytes = canonicalJsonBytes(search);
  writeBytes(root, "data/creatures/search.json", searchBytes);
  const source = { contract_id: BOUNDED_REAL_SOURCE_CONTRACT2, capability: BOUNDED_REAL_CREATURE_CAPABILITY2, semantic_digest: catalog.source.semantic_digest, npc_role_schema_version: catalog.source.npc_role_schema_version, fixture_id: BOUNDED_REAL_WORLD_ID, appearance_product_root: animation.source.appearance_product_root, outfit_spatial_product_root: animation.source.outfit_spatial_product_root, coordinate_profile: catalog.source.coordinate_profile, semantic_revision: catalog.source.semantic_revision };
  const index = { schema_version: 1, source, chunk_size: 64, counts: { chunks: chunks.length, records: selected.length, search_records: selected.length }, search_path: "search.json", search_bytes: searchBytes.length, search_digest: sha(searchBytes), chunks };
  writeJson(root, "data/creatures/index.json", index);
  return { index, search };
}
function repositoryTextBytes(sourceRoot, relative) {
  return Buffer.from(fs.readFileSync(path.join(sourceRoot, relative), "utf8").replace(/\r\n/g, "\n"));
}
function copyRealAncillary(root, sourceRoot) {
  for (const relative of ["web/semantic-search/index.json", "web/semantic-search/creatures.json"]) {
    writeBytes(root, relative, repositoryTextBytes(sourceRoot, relative));
  }
  fs.cpSync(path.join(sourceRoot, "web/creature-gameplay"), path.join(root, "web/creature-gameplay"), { recursive: true, errorOnExist: true });
}
function boundedTrustDescriptor(manifest) {
  return Object.freeze({ marker: "oteryn-atlas-bounded-real-trust-v1", fixtureId: manifest.fixtureId, dataCapability: manifest.dataCapability, publicationRoot: manifest.publicationRoot, semanticRoot: manifest.semanticRoot, pixelRoot: manifest.pixelRoot, overviewRoot: manifest.overviewRoot, minimapRoot: manifest.minimapRoot, runtimeIndexRoot: manifest.runtimeIndexRoot, pixelBucketRoot: manifest.pixelBucketRoot, sourceFingerprint: manifest.sourceFingerprint, productDigest: manifest.productDigest });
}
async function buildBoundedRealWorld(destination, { sourceRoot } = {}) {
  if (!sourceRoot) throw new TypeError("bounded-real sourceRoot is required");
  const source = path.resolve(sourceRoot);
  const root = path.resolve(destination);
  if (fs.existsSync(root)) throw new TypeError("bounded-real destination already exists");
  fs.mkdirSync(root, { recursive: true });
  const { catalog, selected, anchors } = stableAnchors(source);
  const pixel = await buildPixelPublication(root);
  const map = await buildMap(root, anchors, pixel);
  const pixelBuckets = await buildRuntimePixelBuckets(root, map.publication.rootContentId, pixel.manifest.rootContentId, pixel.pixelContentId, pixel.pixels);
  const overview = await buildOverview(root, map.publication.rootContentId, map);
  const minimap = await buildMinimap(root, map.publication.rootContentId, pixel.manifest.rootContentId, anchors, map);
  const animation = await buildAnimation(root, map.semanticWorld.rootContentId, pixel.manifest.rootContentId, pixel.pixelContentId, pixel.pixels);
  await buildCreatures(root, selected, catalog, map.semanticWorld.rootContentId, animation);
  copyRealAncillary(root, source);
  const realSemantic = repositoryTextBytes(source, "web/semantic-search/index.json");
  const realCreatures = repositoryTextBytes(source, "web/semantic-search/creatures.json");
  const realGameplay = fs.readFileSync(path.join(source, "web/creature-gameplay/manifest.json"));
  const files = productEntries(root);
  const result = Object.freeze({ fixtureId: BOUNDED_REAL_WORLD_ID, dataCapability: "bounded_real_world", mapAuthority: false, targetEntityIds: [...TARGET_ENTITY_IDS], publicationRoot: map.publication.rootContentId, semanticRoot: map.semanticWorld.rootContentId, pixelRoot: pixel.manifest.rootContentId, runtimeIndexRoot: map.runtimeWorld.rootContentId, pixelBucketRoot: pixelBuckets.rootContentId, overviewRoot: overview.rootContentId, minimapRoot: minimap.rootContentId, sourceFingerprint: map.sourceFingerprint, sourceDigests: { semanticSearch: sha(realSemantic), creatureCatalog: sha(realCreatures), creatureGameplay: sha(realGameplay), creatureSemantic: catalog.source.semantic_digest }, productDigest: canonicalDigest(files), files });
  writeJson(root, "bounded-real-manifest.json", result);
  return result;
}
function filesystemFetcher(root) {
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
    return { ok: true, status: 200, headers: { get: (name) => String(name).toLowerCase() === "content-length" ? String(bytes.length) : null }, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
}
async function verifyBoundedRealWorld(root) {
  const manifest = readJson(root, "bounded-real-manifest.json");
  const files = productEntries(root);
  if (canonicalDigest(files) !== canonicalDigest(manifest.files) || canonicalDigest(files) !== manifest.productDigest) throw new TypeError("bounded-real world digest mismatch");
  if (manifest.fixtureId !== BOUNDED_REAL_WORLD_ID || manifest.dataCapability !== "bounded_real_world" || manifest.mapAuthority !== false) throw new TypeError("bounded-real world identity mismatch");
  for (const field of ["publicationRoot", "semanticRoot", "pixelRoot", "runtimeIndexRoot", "pixelBucketRoot", "overviewRoot", "minimapRoot", "sourceFingerprint", "productDigest"]) if (!/^sha256:[0-9a-f]{64}$/.test(manifest[field])) throw new TypeError(`bounded-real world ${field} invalid`);
  const trust = resolveBoundedRealManifestTrust(boundedTrustDescriptor(manifest));
  const ancillary = ancillarySourceExpectations(trust);
  const fetcher = filesystemFetcher(root);
  const animation = await loadAnimationRuntime(new URL("https://bounded.invalid/animation/"), fetcher, ancillary.animation);
  const creatureIndex = readJson(root, "data/creatures/index.json");
  validateCreaturePublicationSource(creatureIndex.source, animation.manifest.source, ancillary.creatures);
  const creatureSearch = readJson(root, "data/creatures/search.json");
  validateCreatureSearchRecords(creatureSearch.records);
  for (const entityId of TARGET_ENTITY_IDS) if (creatureSearch.records.filter((record) => record.entity_id === entityId).length !== 1) throw new TypeError(`bounded-real target ${entityId} missing`);
  const semanticIndex = readJson(root, "web/semantic-search/index.json");
  validateSemanticSearchIndex(semanticIndex, ancillary.semanticSearch);
  const semanticCreatures = readJson(root, "web/semantic-search/creatures.json");
  validateCreatureSearchCatalog(semanticCreatures, ancillary.semanticSearch);
  await validateCreatureGameplayManifest(readJson(root, "web/creature-gameplay/manifest.json"));
  return Object.freeze(manifest);
}
export {
  boundedTrustDescriptor,
  buildBoundedRealWorld,
  verifyBoundedRealWorld
};
