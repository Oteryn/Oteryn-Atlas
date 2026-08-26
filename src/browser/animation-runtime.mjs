import { sha256ContentId } from './loader.mjs';

export const ANIMATION_RUNTIME_PROFILE = 'oteryn-atlas-animation-runtime-v2';
export const ANIMATION_PRODUCT_ROOT = 'sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1';
export const OUTFIT_SPATIAL_ROOT = 'sha256:62fdd7d0ce02652582f03bf971455f4a2f9ec1e472eaebfec5af739cf11a921e';
export const GAME_ANIMATION_SHA = '91b73a7566a59991ebf7d471eacb3a858b755c9c';
export const CREATURE_PLAYBACK_CAPABILITY = 'creature-moving-in-place-v1';
export const CREATURE_SEMANTIC_DIGEST = 'sha256:5f10a15758199105584c38634d08254af79973cf7ce25d54bf46e54d8fee26ca';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_PROGRAM_BYTES = 48 * 1024 * 1024;
const MAX_BUCKET_BYTES = 8 * 1024 * 1024;
const MAX_BUCKETS = 64;

export class AnimationRuntimeError extends Error {}
function requireValue(condition, message) { if (!condition) throw new AnimationRuntimeError(message); }
function isSha(value) { return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value); }
function safePath(value) {
  requireValue(typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.includes('\\'), 'unsafe animation path');
  requireValue(!value.split('/').some((part) => part === '' || part === '.' || part === '..'), 'unsafe animation path');
  return value;
}
async function readBytes(url, maxBytes, expectedDigest = null, expectedBytes = null, fetcher = fetch) {
  const response = await fetcher(url, { cache: 'no-store' });
  requireValue(response?.ok, `${url.pathname} HTTP ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) requireValue(Number(declared) <= maxBytes, `${url.pathname} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= maxBytes, `${url.pathname} exceeds byte limit`);
  if (expectedBytes != null) requireValue(bytes.byteLength === expectedBytes, `${url.pathname} byte count mismatch`);
  if (expectedDigest) requireValue(await sha256ContentId(bytes) === expectedDigest, `${url.pathname} digest mismatch`);
  return bytes;
}
function parseJson(bytes, label) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new AnimationRuntimeError(`${label} JSON invalid: ${error.message}`); }
}
function stableHash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
  return value >>> 0;
}
function phaseSequence(program) {
  const count = program.phase_count;
  if (program.animation.loop_type === 'pingpong' && count > 1) return [...Array(count).keys(), ...Array.from({ length: count - 2 }, (_, i) => count - 2 - i)];
  return [...Array(count).keys()];
}
function durationFor(program, phase) {
  const durations = program.animation.presentation_durations_ms;
  requireValue(Array.isArray(durations) && durations.length === program.phase_count, 'animation duration cardinality mismatch');
  const value = durations[phase];
  requireValue(Number.isSafeInteger(value) && value > 0, 'animation duration invalid');
  return value;
}
export function phaseAt(program, logicalTimeMs, instanceId = '') {
  requireValue(program && Number.isSafeInteger(program.phase_count) && program.phase_count > 0, 'animation program invalid');
  if (program.phase_count === 1) return 0;
  const sequence = phaseSequence(program);
  const sequenceDurations = sequence.map((phase) => durationFor(program, phase));
  const cycle = sequenceDurations.reduce((sum, value) => sum + value, 0);
  requireValue(cycle > 0, 'animation cycle empty');
  let elapsed = Math.max(0, Math.floor(logicalTimeMs));
  if (!program.animation.synchronized) elapsed += stableHash(String(instanceId)) % cycle;
  if (program.animation.loop_type === 'counted') {
    const loops = Math.max(1, Number(program.animation.loop_count) || 1);
    const end = cycle * loops;
    if (elapsed >= end) return sequence[sequence.length - 1];
  } else elapsed %= cycle;
  if (program.animation.loop_type === 'counted') elapsed %= cycle;
  for (let i = 0; i < sequence.length; i += 1) {
    if (elapsed < sequenceDurations[i]) return sequence[i];
    elapsed -= sequenceDurations[i];
  }
  return sequence[sequence.length - 1];
}
function objectSpriteFor(program, pattern, phase) {
  const { width, height, depth } = program.patterns;
  requireValue(pattern && Number.isSafeInteger(pattern.x) && Number.isSafeInteger(pattern.y) && Number.isSafeInteger(pattern.z), 'object animation pattern missing');
  requireValue(pattern.x >= 0 && pattern.x < width && pattern.y >= 0 && pattern.y < height && pattern.z >= 0 && pattern.z < depth, 'object animation pattern outside program');
  requireValue(program.layers === 1, 'animated object layers must be prequalified as one layer');
  const index = (((phase * depth + pattern.z) * height + pattern.y) * width + pattern.x);
  const sprite = program.sprite_source_ids[index];
  requireValue(Number.isSafeInteger(sprite) && sprite > 0, 'object animation sprite missing');
  return sprite;
}
function validateCreatureVisualProgram(program, presentationId, mode) {
  requireValue(program && typeof program === 'object', `${mode} creature program missing`);
  requireValue(program.outfit_presentation_id === presentationId, `${mode} creature presentation identity mismatch`);
  requireValue(program.presentation_mode === mode, `${mode} creature presentation mode mismatch`);
  requireValue(Number.isSafeInteger(program.phase_count) && program.phase_count > 0, `${mode} creature phase count invalid`);
  requireValue(Array.isArray(program.phase_content_ids) && program.phase_content_ids.length === program.phase_count, `${mode} creature phase content cardinality mismatch`);
  requireValue(program.phase_content_ids.every(isSha), `${mode} creature phase content invalid`);
  requireValue(Number.isSafeInteger(program.width) && program.width > 0 && Number.isSafeInteger(program.height) && program.height > 0, `${mode} creature geometry invalid`);
  requireValue(Number.isSafeInteger(program.displacement?.x) && Number.isSafeInteger(program.displacement?.y), `${mode} creature displacement invalid`);
}
function validateCreatureProgram(entry) {
  const id = entry?.outfit_presentation_id;
  requireValue(typeof id === 'string' && id.length > 0, 'invalid creature presentation id');
  validateCreatureVisualProgram(entry.static_program, id, 'static');
  const a = entry.static_program;
  const b = entry.walking_program;
  const envelope = entry.presentation_envelope;
  const requiredWidth = b == null ? a.width : Math.max(a.width, b.width);
  const requiredHeight = b == null ? a.height : Math.max(a.height, b.height);
  requireValue(Number.isSafeInteger(envelope?.width) && envelope.width >= requiredWidth
    && Number.isSafeInteger(envelope?.height) && envelope.height >= requiredHeight,
  'creature playback envelope invalid');
  requireValue(envelope.displacement?.x === a.displacement.x && envelope.displacement?.y === a.displacement.y,
  'creature playback envelope displacement drift');
  if (b == null) {
    requireValue(typeof entry.walking_fallback_reason === 'string' && entry.walking_fallback_reason.length > 0, 'creature walking fallback reason missing');
    return;
  }
  requireValue(entry.walking_fallback_reason == null, 'resolved creature walking program must not carry fallback reason');
  validateCreatureVisualProgram(b, id, 'moving-in-place');
  requireValue(a.displacement.x === b.displacement.x && a.displacement.y === b.displacement.y, 'creature playback displacement drift');
}
export async function loadAnimationRuntime(baseUrl, fetcher = fetch) {
  const root = new URL(baseUrl);
  const manifestBytes = await readBytes(new URL('manifest.json', root), MAX_MANIFEST_BYTES, null, null, fetcher);
  const manifest = parseJson(manifestBytes, 'animation manifest');
  requireValue(manifest.profile === ANIMATION_RUNTIME_PROFILE && manifest.identityAuthority === false, 'unsupported animation runtime manifest');
  requireValue(manifest.source?.game_sha === GAME_ANIMATION_SHA, 'animation Game SHA mismatch');
  requireValue(manifest.source?.appearance_product_root === ANIMATION_PRODUCT_ROOT, 'animation product root mismatch');
  requireValue(manifest.source?.outfit_spatial_product_root === OUTFIT_SPATIAL_ROOT, 'outfit spatial root mismatch');
  requireValue(manifest.source?.creature_semantic_digest === CREATURE_SEMANTIC_DIGEST, 'creature semantic digest mismatch');
  requireValue(manifest.source?.playback_projection_capability === CREATURE_PLAYBACK_CAPABILITY, 'creature playback capability mismatch');
  requireValue(Array.isArray(manifest.buckets) && manifest.buckets.length <= MAX_BUCKETS, 'animation bucket census invalid');
  const programBytes = await readBytes(new URL(safePath(manifest.programs.path), root), MAX_PROGRAM_BYTES, manifest.programs.digest, manifest.programs.bytes, fetcher);
  const product = parseJson(programBytes, 'animation programs');
  requireValue(product.profile === ANIMATION_RUNTIME_PROFILE, 'animation program profile mismatch');
  const objects = new Map();
  for (const program of product.object_programs ?? []) {
    requireValue(Number.isSafeInteger(program.appearance_source_id) && !objects.has(program.appearance_source_id), 'duplicate/invalid object animation program');
    objects.set(program.appearance_source_id, Object.freeze(program));
  }
  const creatures = new Map();
  for (const entry of product.creature_programs ?? []) {
    validateCreatureProgram(entry);
    requireValue(!creatures.has(entry.outfit_presentation_id), 'duplicate creature program');
    creatures.set(entry.outfit_presentation_id, Object.freeze(entry));
  }
  const sprites = new Map(Object.entries(product.sprite_index ?? {}).map(([key, value]) => [Number(key), Object.freeze(value)]));
  const blobs = new Map(Object.entries(product.blob_index ?? {}).map(([key, value]) => [key, Object.freeze(value)]));
  const buckets = new Map(manifest.buckets.map((entry) => [entry.id, Object.freeze(entry)]));
  return createAnimationRuntime(root, { manifest, objects, creatures, sprites, blobs, buckets, fetcher });
}
export function createAnimationRuntime(root, product) {
  const bucketCache = new Map();
  const bucketPending = new Map();
  const bitmapCache = new Map();
  const bitmapPending = new Map();
  let bucketBytes = 0;
  let bucketLoads = 0;
  let frameUpdates = 0;
  async function bucket(id) {
    const existing = bucketCache.get(id);
    if (existing) { bucketCache.delete(id); bucketCache.set(id, existing); return existing; }
    if (bucketPending.has(id)) return bucketPending.get(id);
    const descriptor = product.buckets.get(id);
    requireValue(descriptor && descriptor.bytes <= MAX_BUCKET_BYTES && isSha(descriptor.digest), `animation bucket ${id} invalid`);
    const pending = (async () => {
      const bytes = await readBytes(new URL(safePath(descriptor.path), root), MAX_BUCKET_BYTES, descriptor.digest, descriptor.bytes, product.fetcher);
      bucketCache.set(id, bytes); bucketBytes += bytes.byteLength; bucketLoads += 1;
      while (bucketCache.size > 12) { const key = bucketCache.keys().next().value; bucketBytes -= bucketCache.get(key).byteLength; bucketCache.delete(key); }
      return bytes;
    })();
    bucketPending.set(id, pending);
    try { return await pending; }
    finally { if (bucketPending.get(id) === pending) bucketPending.delete(id); }
  }
  async function bitmap(contentId) {
    if (bitmapCache.has(contentId)) return bitmapCache.get(contentId);
    if (bitmapPending.has(contentId)) return bitmapPending.get(contentId);
    const blob = product.blobs.get(contentId); requireValue(blob && product.buckets.has(blob.bucket), 'animation blob missing');
    const pending = (async () => {
      const bytes = await bucket(blob.bucket); requireValue(blob.offset >= 0 && blob.bytes > 0 && blob.offset + blob.bytes <= bytes.byteLength, 'animation blob range invalid');
      const rgba = new Uint8ClampedArray(bytes.buffer.slice(bytes.byteOffset + blob.offset, bytes.byteOffset + blob.offset + blob.bytes));
      requireValue(rgba.byteLength === blob.width * blob.height * 4, 'animation RGBA geometry mismatch');
      let value;
      if (typeof createImageBitmap === 'function') value = await createImageBitmap(new ImageData(rgba, blob.width, blob.height));
      else value = Object.freeze({ rgba, width: blob.width, height: blob.height });
      bitmapCache.set(contentId, value);
      while (bitmapCache.size > 512) { const key = bitmapCache.keys().next().value; bitmapCache.get(key)?.close?.(); bitmapCache.delete(key); }
      return value;
    })();
    bitmapPending.set(contentId, pending);
    try { return await pending; }
    finally { if (bitmapPending.get(contentId) === pending) bitmapPending.delete(contentId); }
  }
  function hasObject(record) { return product.objects.has(record?.presentation?.appearanceSourceId); }
  function hasCreature(record) { return product.creatures.has(record?.outfit_presentation?.outfit_presentation_id); }
  function objectFrame(record, timeMs) {
    const program = product.objects.get(record.presentation.appearanceSourceId); if (!program) return null;
    const phase = phaseAt(program, timeMs, record.presentation.recordId);
    const spriteId = objectSpriteFor(program, record.primitive.pattern, phase);
    const sprite = product.sprites.get(spriteId); requireValue(sprite && isSha(sprite.content_id), 'animation sprite index missing');
    return Object.freeze({ phase, contentId: sprite.content_id, program });
  }
  function creatureFrame(record, timeMs, playbackMode = 'static') {
    const id = record?.outfit_presentation?.outfit_presentation_id; if (!id) return null;
    const entry = product.creatures.get(id); if (!entry) return null;
    requireValue(playbackMode === 'static' || playbackMode === 'moving-in-place', 'unsupported creature playback mode');
    let program = entry.static_program;
    let presentationMode = 'static';
    let fallbackReason = null;
    let logicalTimeMs = 0;
    if (playbackMode === 'moving-in-place') {
      if (entry.walking_program) {
        program = entry.walking_program;
        presentationMode = 'moving-in-place';
        logicalTimeMs = timeMs;
      } else {
        presentationMode = 'static-fallback';
        fallbackReason = entry.walking_fallback_reason ?? 'MOVING_GROUP_UNAVAILABLE';
      }
    }
    const phase = phaseAt(program, logicalTimeMs, record.record_id);
    const contentId = program.phase_content_ids[phase]; requireValue(isSha(contentId), 'creature phase content missing');
    const presentationEnvelope = entry.presentation_envelope ?? Object.freeze({
      width: program.width, height: program.height, displacement: program.displacement,
      anchor_policy: 'tile-bottom-right-minus-sprite-overhang-and-displacement-v1',
    });
    return Object.freeze({ phase, contentId, program, presentationEnvelope, presentationMode, ...(fallbackReason ? { fallbackReason } : {}) });
  }
  function noteFrameUpdate(count = 1) { frameUpdates += count; }
  function stats() {
    let walkingPrograms = 0;
    let walkingFallbacks = 0;
    for (const entry of product.creatures.values()) {
      if (entry?.walking_program) walkingPrograms += 1;
      else if (entry?.static_program) walkingFallbacks += 1;
    }
    return Object.freeze({ bucketBytes, bucketLoads, cachedBuckets: bucketCache.size, cachedBitmaps: bitmapCache.size, frameUpdates, objectPrograms: product.objects.size, creaturePrograms: product.creatures.size, walkingPrograms, walkingFallbacks });
  }
  return Object.freeze({ bitmap, creatureFrame, hasCreature, hasObject, manifest: product.manifest, noteFrameUpdate, objectFrame, stats });
}