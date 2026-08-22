import { canonicalJsonBytes, sha256ContentId } from './loader.mjs';

export const ANIMATION_PROFILE = 'oteryn-atlas-animation-runtime-v1';
export const ANIMATION_ROOT = 'sha256:43ca727af914da89bba591a9e3c7324bfc72ffe96bd4ba0524bdf71a6c6a4caf';
export const ANIMATION_ROOT_DOMAIN = 'OTERYN-ATLAS-ANIMATION-RUNTIME-V1\0';
export const PIXEL_HASH_DOMAIN = 'OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0';
export const GAME_ANIMATION_SHA = '8f6a4fdea4487a61c4cdaf1889d421ecd2265a31';
export const APPEARANCE_PRODUCT_ROOT = 'sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1';
const MAX_JSON_BYTES = 32 * 1024 * 1024;
const MAX_PIXEL_BYTES = 64 * 64 * 4;

export class AnimationRuntimeError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new AnimationRuntimeError(message);
}
function concat(...parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const value = new Uint8Array(total); let offset = 0;
  for (const part of parts) { value.set(part, offset); offset += part.byteLength; }
  return value;
}

async function readBytes(response, maxBytes, label, expectedBytes = null) {
  requireValue(response?.ok, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) requireValue(Number(declared) <= maxBytes, `${label} declared bytes exceed bound`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= maxBytes, `${label} exceeds byte bound`);
  if (expectedBytes != null) requireValue(bytes.byteLength === expectedBytes, `${label} byte mismatch`);
  return bytes;
}

async function jsonFile(baseUrl, descriptor, label, fetcher) {
  requireValue(descriptor && typeof descriptor.path === 'string' && Number.isSafeInteger(descriptor.bytes), `${label} descriptor invalid`);
  const bytes = await readBytes(await fetcher(new URL(descriptor.path, baseUrl), { cache: 'no-store' }), MAX_JSON_BYTES, label, descriptor.bytes);
  requireValue((await sha256ContentId(bytes)).slice(7) === descriptor.sha256, `${label} digest mismatch`);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new AnimationRuntimeError(`${label} invalid JSON: ${error.message}`); }
  requireValue(canonicalJsonBytes(value).every((byte, index) => byte === bytes[index]) && canonicalJsonBytes(value).byteLength === bytes.byteLength, `${label} is not canonical JSON`);
  return value;
}

async function rootedManifest(manifest) {
  const core = { ...manifest }; delete core.rootContentId;
  return sha256ContentId(concat(new TextEncoder().encode(ANIMATION_ROOT_DOMAIN), canonicalJsonBytes(core)));
}

export async function loadAnimationRuntime(baseUrl, expectedRoot = ANIMATION_ROOT, fetcher = fetch) {
  const manifestBytes = await readBytes(await fetcher(new URL('manifest.json', baseUrl), { cache: 'no-store' }), 64 * 1024, 'animation manifest');
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  requireValue(manifest.profile === ANIMATION_PROFILE && manifest.capability === 'animated-world-and-creatures-v1', 'unsupported animation product');
  requireValue(manifest.gameRevision === GAME_ANIMATION_SHA && manifest.appearanceProductRoot === APPEARANCE_PRODUCT_ROOT, 'animation Game authority mismatch');
  requireValue(manifest.source?.zip_sha256 === '1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f', 'animation source digest mismatch');
  requireValue(manifest.rootContentId === await rootedManifest(manifest) && manifest.rootContentId === expectedRoot, 'animation product root mismatch');
  const objects = await jsonFile(baseUrl, manifest.objects, 'object programs', fetcher);
  const objectPixels = await jsonFile(baseUrl, { path: manifest.objectPixels.indexPath, bytes: manifest.objectPixels.indexBytes, sha256: manifest.objectPixels.indexSha256 }, 'object pixel index', fetcher);
  const creatures = await jsonFile(baseUrl, manifest.creatures, 'creature presentations', fetcher);
  const programs = new Map();
  for (const program of objects.programs ?? []) {
    requireValue(Number.isSafeInteger(program.appearance_source_id) && !programs.has(program.appearance_source_id), 'duplicate object animation program');
    requireValue(program.layers === 1 && Number.isSafeInteger(program.phase_count) && program.phase_count > 1, 'invalid object animation program');
    programs.set(program.appearance_source_id, Object.freeze(program));
  }
  const sprites = new Map();
  for (const [id, entry] of Object.entries(objectPixels.sprites ?? {})) {
    requireValue(/^[0-9]+$/.test(id) && entry?.contentId?.startsWith('sha256:'), 'invalid animation sprite entry');
    sprites.set(Number(id), Object.freeze({ ...entry, pack: 'object' }));
  }
  const creaturePresentations = new Map(Object.entries(creatures.presentations ?? {}).map(([id, value]) => [id, Object.freeze(value)]));
  return Object.freeze({ baseUrl: new URL('./', new URL('manifest.json', baseUrl)), creaturePresentations, manifest, programs, sprites });
}

async function verifyPixel(entry, bytes) {
  const dimensions = new Uint8Array([entry.width >> 8, entry.width & 255, entry.height >> 8, entry.height & 255]);
  const actual = await sha256ContentId(concat(new TextEncoder().encode(PIXEL_HASH_DOMAIN), dimensions, bytes));
  requireValue(actual === entry.contentId, 'animation pixel content identity mismatch');
}

export class AnimationPixelStore {
  constructor(runtime, fetcher = fetch, maxBytes = 32 * 1024 * 1024) {
    this.runtime = runtime; this.fetcher = fetcher; this.maxBytes = maxBytes; this.bytes = 0; this.cache = new Map(); this.networkBytes = 0;
  }
  async load(entry, kind = 'object', signal = null) {
    const cached = this.cache.get(entry.contentId);
    if (cached) { this.cache.delete(entry.contentId); this.cache.set(entry.contentId, cached); return cached; }
    requireValue(Number.isSafeInteger(entry.offset) && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_PIXEL_BYTES, 'animation pixel span invalid');
    const pack = kind === 'creature' ? this.runtime.manifest.creaturePixels : this.runtime.manifest.objectPixels;
    const end = entry.offset + entry.bytes - 1;
    const response = await this.fetcher(new URL(pack.path, this.runtime.baseUrl), { cache: 'no-store', headers: { Range: `bytes=${entry.offset}-${end}` }, signal });
    requireValue(response.status === 206, 'animation pixel server must support HTTP Range');
    requireValue(response.headers?.get?.('content-range') === `bytes ${entry.offset}-${end}/${pack.bytes}`, 'animation pixel Content-Range mismatch');
    const bytes = await readBytes(response, MAX_PIXEL_BYTES, 'animation pixel range', entry.bytes);
    await verifyPixel(entry, bytes); this.networkBytes += bytes.byteLength;
    this.cache.set(entry.contentId, bytes); this.bytes += bytes.byteLength;
    while (this.bytes > this.maxBytes && this.cache.size > 1) { const key = this.cache.keys().next().value; const value = this.cache.get(key); this.cache.delete(key); this.bytes -= value.byteLength; }
    return bytes;
  }
  stats() { return Object.freeze({ cacheBytes: this.bytes, cacheEntries: this.cache.size, networkBytes: this.networkBytes }); }
}

function stableOffset(identity, modulo) {
  if (modulo <= 0) return 0;
  let hash = 2166136261;
  for (const char of String(identity)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % modulo;
}

function pingPongOrder(phaseCount) {
  if (phaseCount <= 1) return [0];
  return [...Array.from({ length: phaseCount }, (_, index) => index), ...Array.from({ length: phaseCount - 2 }, (_, index) => phaseCount - 2 - index)];
}

export function phaseState(animation, phaseCount, elapsedMs, identity = '', offsetUnsynchronized = true) {
  requireValue(Number.isSafeInteger(phaseCount) && phaseCount > 0, 'invalid animation phase count');
  if (!animation || phaseCount === 1) return Object.freeze({ phase: 0, remainingMs: Infinity, complete: false });
  const durations = animation.presentation_durations_ms;
  requireValue(Array.isArray(durations) && durations.length === phaseCount && durations.every((value) => Number.isSafeInteger(value) && value > 0), 'invalid presentation durations');
  const start = Number(animation.default_start_phase);
  requireValue(Number.isSafeInteger(start) && start >= 0 && start < phaseCount, 'invalid animation start phase');
  let timeline = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  if (animation.synchronized) {
    const order = Array.from({ length: phaseCount }, (_, index) => index);
    const cycleMs = order.reduce((sum, phase) => sum + durations[phase], 0);
    timeline %= cycleMs;
    for (const phase of order) {
      const duration = durations[phase];
      if (timeline < duration) return Object.freeze({ phase, remainingMs: duration - timeline, complete: false });
      timeline -= duration;
    }
    return Object.freeze({ phase: order.at(-1), remainingMs: 1, complete: false });
  }
  let order = animation.loop_type === 'pingpong' ? pingPongOrder(phaseCount) : Array.from({ length: phaseCount }, (_, index) => index);
  const startIndex = Math.max(0, order.indexOf(start));
  order = [...order.slice(startIndex), ...order.slice(0, startIndex)];
  const cycleMs = order.reduce((sum, phase) => sum + durations[phase], 0);
  requireValue(cycleMs > 0, 'empty animation cycle');
  if (offsetUnsynchronized) timeline += stableOffset(identity, cycleMs);
  if (animation.loop_type === 'counted') {
    const loops = Number(animation.loop_count);
    requireValue(Number.isSafeInteger(loops) && loops > 0, 'invalid counted loop count');
    const total = cycleMs * loops;
    if (timeline >= total) return Object.freeze({ phase: order.at(-1), remainingMs: Infinity, complete: true });
  }
  timeline %= cycleMs;
  for (const phase of order) {
    const duration = durations[phase];
    if (timeline < duration) return Object.freeze({ phase, remainingMs: duration - timeline, complete: false });
    timeline -= duration;
  }
  return Object.freeze({ phase: order.at(-1), remainingMs: 1, complete: false });
}

function programSprite(program, pattern, phase, layer = 0) {
  const dims = program.patterns;
  requireValue(pattern.x >= 0 && pattern.x < dims.width && pattern.y >= 0 && pattern.y < dims.height && pattern.z >= 0 && pattern.z < dims.depth, 'resolved animation pattern outside program');
  const index = ((((phase * dims.depth + pattern.z) * dims.height + pattern.y) * dims.width + pattern.x) * program.layers + layer);
  const spriteId = program.sprite_source_ids[index];
  requireValue(Number.isSafeInteger(spriteId), 'animation phase sprite missing');
  return spriteId;
}

export function decorateAnimatedRecords(records, runtime, enabled, elapsedMs) {
  if (!runtime || !enabled) return Object.freeze({ records, pixelEntries: new Map(), animatedInstances: 0, nextDelayMs: Infinity });
  const output = []; const pixelEntries = new Map(); let animatedInstances = 0; let nextDelayMs = Infinity;
  for (const record of records) {
    const program = runtime.programs.get(record.presentation.appearanceSourceId);
    if (!program) { output.push(record); continue; }
    const state = phaseState(program.animation, program.phase_count, elapsedMs, record.presentation.recordId);
    const spriteId = programSprite(program, record.primitive.pattern, state.phase, record.primitive.layerIndex);
    const entry = runtime.sprites.get(spriteId);
    requireValue(entry, `animation sprite ${spriteId} is unpublished`);
    pixelEntries.set(entry.contentId, entry);
    nextDelayMs = Math.min(nextDelayMs, state.remainingMs);
    animatedInstances += 1;
    output.push(Object.freeze({ ...record, primitive: Object.freeze({ ...record.primitive, phase: state.phase, pixelContentId: entry.contentId, pixelWidth: entry.width, pixelHeight: entry.height }) }));
  }
  return Object.freeze({ records: Object.freeze(output), pixelEntries, animatedInstances, nextDelayMs });
}

export function createAnimationClock(now = () => performance.now()) {
  let enabled = false; let accumulated = 0; let started = 0;
  return Object.freeze({
    setEnabled(value) {
      const next = Boolean(value);
      if (next === enabled) return;
      if (next) started = now(); else accumulated += Math.max(0, now() - started);
      enabled = next;
    },
    elapsed() { return accumulated + (enabled ? Math.max(0, now() - started) : 0); },
    reset() { accumulated = 0; if (enabled) started = now(); },
    enabled() { return enabled; },
  });
}

export function createAnimationScheduler(callback, options = {}) {
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const requestFrame = options.requestFrame ?? requestAnimationFrame;
  const cancelFrame = options.cancelFrame ?? cancelAnimationFrame;
  let timer = null; let frame = null; let active = false; let scheduled = 0; let fired = 0;
  function cancel() { if (timer != null) clearTimer(timer); if (frame != null) cancelFrame(frame); timer = frame = null; }
  function update(enabled, instances, delayMs) {
    cancel(); active = Boolean(enabled) && instances > 0 && Number.isFinite(delayMs);
    if (!active) return;
    const delay = Math.max(1, Math.ceil(delayMs)); scheduled += 1;
    timer = setTimer(() => { timer = null; frame = requestFrame(() => { frame = null; fired += 1; callback(); }); }, delay);
  }
  function stats() { return Object.freeze({ active, fired, pending: timer != null || frame != null, scheduled }); }
  return Object.freeze({ cancel, stats, update });
}

export function buildAnimationBindings(records, runtime) {
  requireValue(Array.isArray(records), 'animation records must be an array');
  const bindings = [];
  records.forEach((record, index) => {
    const program = runtime?.programs?.get(record?.presentation?.appearanceSourceId);
    if (!program) return;
    requireValue(program.layers === 1, 'object animation layer count unsupported');
    bindings.push({
      currentPhase: record.primitive.phase,
      identity: record.presentation.recordId,
      index,
      pattern: record.primitive.pattern,
      program,
    });
  });
  return bindings;
}

export function animationFrameUpdates(bindings, runtime, elapsedMs, wallClockMs = Date.now()) {
  const updates = []; const pixelEntries = new Map(); let nextDelayMs = Infinity;
  for (let bindingIndex = 0; bindingIndex < bindings.length; bindingIndex += 1) {
    const binding = bindings[bindingIndex];
    const timeline = binding.program.animation?.synchronized ? wallClockMs : elapsedMs;
    const state = phaseState(binding.program.animation, binding.program.phase_count, timeline, binding.identity, true);
    nextDelayMs = Math.min(nextDelayMs, state.remainingMs);
    if (state.phase === binding.currentPhase) continue;
    const spriteId = programSprite(binding.program, binding.pattern, state.phase, 0);
    const entry = runtime.sprites.get(spriteId);
    requireValue(entry, `animation sprite ${spriteId} is unpublished`);
    pixelEntries.set(entry.contentId, entry);
    updates.push(Object.freeze({ bindingIndex, contentId: entry.contentId, index: binding.index, phase: state.phase }));
  }
  return Object.freeze({ animatedInstances: bindings.length, nextDelayMs, pixelEntries, updates: Object.freeze(updates) });
}

export function commitAnimationUpdates(bindings, updates) {
  for (const update of updates) bindings[update.bindingIndex].currentPhase = update.phase;
}
