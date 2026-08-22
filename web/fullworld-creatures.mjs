import { AnimationPixelStore, createAnimationClock, createAnimationScheduler, loadAnimationRuntime, phaseState } from '../src/browser/animation-runtime.mjs';
import { sha256ContentId } from '../src/browser/loader.mjs';

const ROOT = new URL('../data/creatures/', location.href);
const ANIMATION_ROOT = new URL('../data/animation/', location.href);
const EXPECTED_CONTRACT = 'oteryn-game-atlas-export-v1';
const EXPECTED_CAPABILITY = 'animated-creatures-v1';
const EXPECTED_SEMANTIC_DIGEST = 'sha256:3ecb5570fa2d018089bb5301c73abc8073154329a1443498c84f38d8febd8f23';
const EXPECTED_APPEARANCE_ROOT = 'sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1';
const MAX_INDEX_CHUNKS = 20_000;
const MAX_CHUNK_RECORDS = 5_000;
const MAX_VISIBLE_CHUNKS = 64;
const MAX_CACHE_CHUNKS = 96;
const MAX_INDEX_BYTES = 4 * 1024 * 1024;
const MAX_SEARCH_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const RECORD_ID = /^(?:npc|monster):[0-9a-f]{32}$/;

const initialParams = new URLSearchParams(location.search);
const requested = new Set((initialParams.get('creatures') || '').split(',').filter(Boolean));
const selectedParam = initialParams.get('creature') || null;
const state = {
  index: null,
  view: null,
  enabled: { npc: requested.has('npc'), monster: requested.has('monster') },
  selectedId: selectedParam && RECORD_ID.test(selectedParam) ? selectedParam : null,
  cache: new Map(),
  search: [],
  canvas: null,
  inspector: null,
  lastVisibleRecords: [],
  lastVisibleShards: 0,
  lastDrawnRecords: 0,
  pixelRecords: 0,
  markerRecords: 0,
  animationRuntime: null,
  animationPixelStore: null,
  animationClock: createAnimationClock(),
  animationScheduler: null,
  frameCache: new Map(),
  recordStarts: new Map(),
  animationStatus: 'STATIC',
};

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function safeRelativePath(path) {
  requireValue(typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\'), 'unsafe creature path');
  requireValue(!path.split('/').some((part) => part === '' || part === '.' || part === '..'), 'unsafe creature path');
  return path;
}

async function boundedJson(url, maxBytes, expectedDigest = null, expectedBytes = null) {
  const response = await fetch(url, { cache: 'no-store' });
  requireValue(response.ok, `${url.pathname} HTTP ${response.status}`);
  const declared = response.headers.get('content-length');
  if (declared != null) requireValue(Number(declared) <= maxBytes, `${url.pathname} exceeds byte limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= maxBytes, `${url.pathname} exceeds byte limit`);
  if (expectedBytes != null) requireValue(bytes.byteLength === expectedBytes, `${url.pathname} byte count mismatch`);
  if (expectedDigest) requireValue(await sha256ContentId(bytes) === expectedDigest, `${url.pathname} digest mismatch`);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function publish(status = 'LOADING', error = null, extra = {}) {
  globalThis.__OTERYN_ATLAS_CREATURES__ = Object.freeze({
    status,
    sourceSemanticDigest: state.index?.source?.semantic_digest ?? null,
    totalRecords: state.index?.counts?.records ?? null,
    totalChunks: state.index?.counts?.chunks ?? null,
    searchRecords: state.index?.counts?.search_records ?? null,
    enabled: Object.freeze({ ...state.enabled }),
    selectedRecordId: state.selectedId,
    visibleRecords: state.lastVisibleRecords.length,
    drawnRecords: state.lastDrawnRecords,
    pixelRecords: state.pixelRecords,
    markerRecords: state.markerRecords,
    animationStatus: state.animationStatus,
    animationEnabled: state.view?.animation === 'on',
    animationScheduler: state.animationScheduler?.stats?.() ?? null,
    animationPixelCache: state.animationPixelStore?.stats?.() ?? null,
    cacheChunks: state.cache.size,
    error: error ? String(error.message ?? error) : null,
    ...extra,
  });
}

function fail(message) {
  const error = message instanceof Error ? message : new Error(String(message));
  console.error(`Creature overlay disabled: ${error.message}`);
  const status = document.querySelector('#creature-status');
  if (status) status.textContent = `Unavailable: ${error.message}`;
  state.animationScheduler?.cancel();
  state.lastDrawnRecords = 0;
  state.pixelRecords = 0;
  state.markerRecords = 0;
  draw([]).catch(() => {});
  publish('FAIL', error);
}

function persist() {
  const params = new URLSearchParams(location.search);
  const enabled = Object.entries(state.enabled).filter(([, on]) => on).map(([kind]) => kind).sort();
  if (enabled.length) params.set('creatures', enabled.join(','));
  else params.delete('creatures');
  if (state.selectedId) params.set('creature', state.selectedId);
  else params.delete('creature');
  const next = `${location.pathname}?${params.toString()}${location.hash}`;
  if (`${location.pathname}${location.search}${location.hash}` !== next) history.replaceState(null, '', next);
}

function visibleBounds(view, canvas) {
  const rect = canvas.getBoundingClientRect();
  const halfX = rect.width / (64 * view.zoom);
  const halfY = rect.height / (64 * view.zoom);
  return { x0: view.x - halfX - 2, x1: view.x + halfX + 2, y0: view.y - halfY - 2, y1: view.y + halfY + 2 };
}

function wantedEntries(view, canvas) {
  const bounds = visibleBounds(view, canvas);
  const span = state.index.chunk_size;
  const entries = state.index.chunks.filter((entry) => entry.floor === view.floor
    && entry.chunk_x >= Math.floor(bounds.x0 / span) && entry.chunk_x <= Math.floor(bounds.x1 / span)
    && entry.chunk_y >= Math.floor(bounds.y0 / span) && entry.chunk_y <= Math.floor(bounds.y1 / span));
  requireValue(entries.length <= MAX_VISIBLE_CHUNKS, 'visible creature shard set exceeds bounded runtime cap');
  return entries;
}

function remember(key, promise) {
  if (state.cache.has(key)) state.cache.delete(key);
  state.cache.set(key, promise);
  while (state.cache.size > MAX_CACHE_CHUNKS) state.cache.delete(state.cache.keys().next().value);
}

async function loadEntry(entry) {
  const key = `${entry.floor}:${entry.chunk_x}:${entry.chunk_y}`;
  const existing = state.cache.get(key);
  if (existing) {
    remember(key, existing);
    return existing;
  }
  requireValue(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_CHUNK_BYTES, 'invalid creature chunk byte bound');
  requireValue(typeof entry.digest === 'string' && /^sha256:[0-9a-f]{64}$/.test(entry.digest), 'invalid creature chunk digest');
  const promise = boundedJson(new URL(safeRelativePath(entry.path), ROOT), MAX_CHUNK_BYTES, entry.digest, entry.bytes).then((value) => {
    requireValue(value.floor === entry.floor && value.chunk_x === entry.chunk_x && value.chunk_y === entry.chunk_y, 'creature chunk identity mismatch');
    requireValue(Array.isArray(value.records) && value.records.length === entry.records && value.records.length <= MAX_CHUNK_RECORDS, 'creature chunk count mismatch');
    for (const record of value.records) {
      requireValue((record.kind === 'npc' || record.kind === 'monster') && RECORD_ID.test(record.record_id), 'invalid creature record');
      requireValue(record.position?.floor === entry.floor && Number.isSafeInteger(record.position?.x) && Number.isSafeInteger(record.position?.y), 'invalid creature position');
    }
    return value.records;
  });
  remember(key, promise);
  try {
    return await promise;
  } catch (error) {
    state.cache.delete(key);
    throw error;
  }
}

function createTextRow(label, value) {
  const row = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  row.append(strong, document.createTextNode(String(value)));
  return row;
}

function renderCreatureInspector(record) {
  const panel = state.inspector;
  if (!panel) return;
  panel.textContent = '';
  const heading = document.createElement('h3');
  heading.textContent = 'Creature';
  panel.append(heading);
  if (!record) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = state.selectedId ? 'Selected creature is outside the currently loaded factual region.' : 'Select a creature from search to inspect its factual record.';
    panel.append(empty);
    return;
  }
  panel.append(
    createTextRow('Name', record.name),
    createTextRow('Kind', record.kind === 'npc' ? 'NPC' : 'Monster / Spawn'),
    createTextRow('Position', `X ${record.position.x} · Y ${record.position.y} · F ${record.position.floor}`),
    createTextRow('Resolution', record.resolution_state),
    createTextRow('Record', record.record_id),
    createTextRow('Origin', record.origin ?? 'UNKNOWN'),
  );
  if (record.entity_id) panel.append(createTextRow('Entity', record.entity_id));
  if (record.spawn_area) panel.append(createTextRow('Spawn area', `X ${record.spawn_area.center.x} · Y ${record.spawn_area.center.y} · F ${record.spawn_area.center.floor} · radius ${record.spawn_area.radius}`));
  if (record.appearance) panel.append(createTextRow('Outfit', record.appearance.outfit_key ?? record.appearance.look_type));
  if (record.presentation_resolution_state === 'RESOLVED' && record.outfit_presentation_id) {
    panel.append(
      createTextRow('Presentation', state.animationRuntime ? `Verified outfit pixels · playback ${state.view?.animation === 'on' ? 'ON' : 'OFF'}` : 'Verified presentation metadata; pixel delivery unavailable, marker fallback active.'),
      createTextRow('Presentation ID', record.outfit_presentation_id),
    );
  } else {
    panel.append(createTextRow('Presentation', `Factual marker fallback · ${record.presentation_reason ?? record.resolution_state ?? 'UNKNOWN'}`));
  }
  panel.append(
    createTextRow('Authority', `${EXPECTED_CONTRACT} / ${EXPECTED_CAPABILITY}`),
    createTextRow('Appearance root', state.index.source.appearance_product_root ?? 'UNKNOWN'),
    createTextRow('Semantic digest', state.index.source.semantic_digest),
  );
}

function setup() {
  const frame = document.querySelector('#map-frame');
  const base = document.querySelector('#atlas');
  if (!frame || !base) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'creature-overlay';
  canvas.setAttribute('aria-label', 'NPC and monster outfit overlays');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '6' });
  frame.append(canvas);
  state.canvas = canvas;

  const host = document.querySelector('#semantic-layer-list');
  if (host) {
    for (const row of [...host.querySelectorAll('label')]) if (/NPCs|Monsters \/ Spawns/.test(row.textContent)) row.remove();
    for (const [kind, label] of [['npc', 'NPCs'], ['monster', 'Monsters / Spawns']]) {
      const row = document.createElement('label');
      row.className = 'layer';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = state.enabled[kind];
      input.dataset.creatureKind = kind;
      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = label;
      const status = document.createElement('span');
      status.textContent = 'OUTFIT';
      row.append(input, name, status);
      host.append(row);
      input.addEventListener('change', () => {
        state.enabled[kind] = input.checked;
        persist();
        refresh().catch(fail);
      });
    }
  }

  const region = document.querySelector('#region-controls');
  if (region) {
    const section = document.createElement('section');
    section.innerHTML = '<h2>Creature search</h2><input id="creature-search" type="search" placeholder="Search NPCs or monsters" aria-label="Search creatures"><div id="creature-results" class="region-results" aria-live="polite"></div><p class="rail-note" id="creature-status">Loading Game-owned creature index…</p>';
    region.after(section);
    section.querySelector('#creature-search').addEventListener('input', (event) => renderSearch(event.target.value));
  }

  const inspectorContent = document.querySelector('#inspector-content');
  if (inspectorContent) {
    const panel = document.createElement('section');
    panel.id = 'creature-inspector';
    panel.className = 'notice-box';
    inspectorContent.after(panel);
    state.inspector = panel;
    renderCreatureInspector(null);
  }

  window.addEventListener('oteryn-atlas-view', (event) => {
    state.view = event.detail.view;
    state.animationClock.setEnabled(animationEnabled());
    persist();
    refresh().catch(fail);
  });
  document.addEventListener('visibilitychange', () => {
    state.animationClock.setEnabled(animationEnabled());
    if (document.hidden) state.animationScheduler?.cancel();
    else redrawCurrent().catch(fail);
  });
  window.addEventListener('resize', () => refresh().catch(fail));
}

function navigate(item) {
  requireValue(RECORD_ID.test(item.record_id), 'search result has no stable creature record id');
  state.selectedId = item.record_id;
  const params = new URLSearchParams(location.search);
  params.set('x', item.position.x);
  params.set('y', item.position.y);
  params.set('floor', item.position.floor);
  params.set('zoom', Math.max(2, Number(params.get('zoom')) || 2));
  const enabled = Object.entries(state.enabled).filter(([, on]) => on).map(([kind]) => kind).sort();
  if (enabled.length) params.set('creatures', enabled.join(','));
  else params.delete('creatures');
  params.set('creature', item.record_id);
  location.search = params.toString();
}

function renderSearch(query) {
  const output = document.querySelector('#creature-results');
  if (!output) return;
  const normalized = query.trim().toLowerCase();
  output.textContent = '';
  if (!normalized) return;
  for (const item of state.search.filter((record) => record.label.toLowerCase().includes(normalized)).slice(0, 20)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${item.label} · ${item.kind} · X ${item.position.x} Y ${item.position.y} F ${item.position.floor}`;
    button.addEventListener('click', () => navigate(item));
    output.append(button);
  }
}

function animationEnabled() {
  return state.view?.animation === 'on' && !document.hidden;
}

function creatureTimeline(record, animation) {
  if (animation?.synchronized) return Date.now();
  const now = performance.now();
  let started = state.recordStarts.get(record.record_id);
  if (started == null) {
    started = now;
    state.recordStarts.set(record.record_id, started);
    while (state.recordStarts.size > 2048) state.recordStarts.delete(state.recordStarts.keys().next().value);
  }
  return Math.max(0, now - started);
}

function presentationFor(record) {
  if (!state.animationRuntime || record.presentation_resolution_state !== 'RESOLVED' || typeof record.outfit_presentation_id !== 'string') return null;
  return state.animationRuntime.creaturePresentations.get(record.outfit_presentation_id) ?? null;
}

function rememberFrame(key, promise) {
  if (state.frameCache.has(key)) state.frameCache.delete(key);
  state.frameCache.set(key, promise);
  while (state.frameCache.size > 256) state.frameCache.delete(state.frameCache.keys().next().value);
}

async function frameCanvas(entry) {
  const existing = state.frameCache.get(entry.contentId);
  if (existing) { rememberFrame(entry.contentId, existing); return existing; }
  const promise = (async () => {
    const bytes = await state.animationPixelStore.load(entry, 'creature');
    const surface = document.createElement('canvas');
    surface.width = entry.width; surface.height = entry.height;
    const context = surface.getContext('2d');
    context.putImageData(new ImageData(new Uint8ClampedArray(bytes), entry.width, entry.height), 0, 0);
    return surface;
  })();
  rememberFrame(entry.contentId, promise);
  try { return await promise; } catch (error) { state.frameCache.delete(entry.contentId); throw error; }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length); let cursor = 0;
  async function worker() { while (cursor < items.length) { const index = cursor; cursor += 1; results[index] = await mapper(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function draw(records) {
  const canvas = state.canvas; const view = state.view;
  if (!canvas || !view) return { drawn: 0, pixels: 0, markers: 0, animated: 0, nextDelayMs: Infinity };
  const prepared = []; const needed = new Map(); let nextDelayMs = Infinity; let animated = 0;
  for (const record of records) {
    if (!state.enabled[record.kind]) continue;
    const presentation = presentationFor(record);
    if (!presentation) { prepared.push({ record, marker: true }); continue; }
    const phase = animationEnabled() && presentation.animation
      ? phaseState(presentation.animation, presentation.phaseCount, creatureTimeline(record, presentation.animation), record.record_id, Boolean(presentation.animation.random_start_phase))
      : { phase: Number(presentation.animation?.default_start_phase ?? 0), remainingMs: Infinity };
    const entry = presentation.frames?.[phase.phase];
    requireValue(entry && Number.isSafeInteger(entry.width) && Number.isSafeInteger(entry.height), 'creature frame descriptor invalid');
    needed.set(entry.contentId, entry);
    prepared.push({ record, presentation, entry, marker: false });
    if (animationEnabled() && presentation.animation && presentation.phaseCount > 1) { animated += 1; nextDelayMs = Math.min(nextDelayMs, phase.remainingMs); }
  }
  if (state.animationPixelStore && needed.size) await mapLimit([...needed.values()], 8, frameCanvas);

  const rect = canvas.getBoundingClientRect(); const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  const width = Math.max(1, Math.round(rect.width * dpr)); const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext('2d'); context.clearRect(0, 0, width, height); context.save(); context.scale(dpr, dpr);
  context.imageSmoothingEnabled = false; context.font = '12px sans-serif'; context.textBaseline = 'middle';
  const scale = 32 * view.zoom; let drawn = 0; let pixels = 0; let markers = 0;
  for (const item of prepared) {
    const record = item.record; const x = rect.width / 2 + (record.position.x - view.x) * scale; const y = rect.height / 2 + (record.position.y - view.y) * scale;
    if (x < -96 || y < -96 || x > rect.width + 96 || y > rect.height + 96) continue;
    if (!item.marker) {
      const surface = await frameCanvas(item.entry); const displacement = item.presentation.displacement ?? { x: 0, y: 0 };
      const drawX = x - ((item.entry.width - 32) + Number(displacement.x ?? 0)) * view.zoom;
      const drawY = y - ((item.entry.height - 32) + Number(displacement.y ?? 0)) * view.zoom;
      context.drawImage(surface, drawX, drawY, item.entry.width * view.zoom, item.entry.height * view.zoom); pixels += 1;
    } else {
      const radius = Math.max(3, Math.min(7, view.zoom * 4)); context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = record.kind === 'npc' ? '#ffd166' : '#ef476f'; context.fill(); context.strokeStyle = '#111827'; context.lineWidth = 1.5; context.stroke(); markers += 1;
    }
    if (view.zoom >= 1) { context.fillStyle = '#f8fafc'; context.fillText(record.name, x + 8, y); }
    drawn += 1;
  }
  context.restore();
  return { drawn, pixels, markers, animated, nextDelayMs };
}

async function redrawCurrent() {
  let result;
  try {
    result = await draw(state.lastVisibleRecords);
  } catch (error) {
    if (!state.animationRuntime) throw error;
    state.animationRuntime = null;
    state.animationPixelStore = null;
    state.frameCache.clear();
    state.animationScheduler?.cancel();
    state.animationClock.setEnabled(false);
    state.animationStatus = `STATIC_FALLBACK: ${error?.message ?? error}`;
    console.warn(state.animationStatus);
    result = await draw(state.lastVisibleRecords);
  }
  state.lastDrawnRecords = result.drawn; state.pixelRecords = result.pixels; state.markerRecords = result.markers;
  if (state.animationRuntime) state.animationStatus = animationEnabled() ? (result.animated ? 'PLAYING' : 'ON_STATIC_VISIBLE') : 'OUTFIT_STATIC';
  state.animationScheduler?.update(animationEnabled() && Boolean(state.animationRuntime), result.animated, result.nextDelayMs);
  publish('PASS', null, { visibleShards: state.lastVisibleShards });
  return result;
}

async function refresh() {
  if (!state.index || !state.view || !state.canvas) return;
  const entries = wantedEntries(state.view, state.canvas); const groups = await Promise.all(entries.map(loadEntry)); const records = groups.flat();
  state.lastVisibleRecords = records; state.lastVisibleShards = entries.length;
  const result = await redrawCurrent();
  const selected = state.selectedId ? records.find((record) => record.record_id === state.selectedId) ?? null : null; renderCreatureInspector(selected);
  const status = document.querySelector('#creature-status');
  if (status) status.textContent = `Game-owned facts · ${state.index.counts.records.toLocaleString()} placements · ${entries.length} visible shards · ${result.pixels} outfits · ${result.markers} factual markers`;
  publish('PASS', null, { visibleShards: entries.length, selectedVisible: Boolean(selected) });
}

async function boot() {
  publish();
  setup();
  try {
    requireValue(!selectedParam || RECORD_ID.test(selectedParam), 'invalid creature deep-link id');
    requireValue([...requested].every((kind) => kind === 'npc' || kind === 'monster'), 'unsupported creature layer');
    const index = await boundedJson(new URL('index.json', ROOT), MAX_INDEX_BYTES);
    requireValue(index.schema_version === 1, 'unsupported creature index schema');
    requireValue(index.source?.contract_id === EXPECTED_CONTRACT && index.source?.capability === EXPECTED_CAPABILITY, 'unsupported creature index authority');
    requireValue(index.source?.semantic_digest === EXPECTED_SEMANTIC_DIGEST, 'untrusted Game creature semantic digest');
    requireValue(index.source?.appearance_product_root === EXPECTED_APPEARANCE_ROOT, 'untrusted Game appearance product root');
    requireValue(Array.isArray(index.chunks) && index.chunks.length === index.counts?.chunks && index.chunks.length <= MAX_INDEX_CHUNKS, 'creature index exceeds bounded chunk cap');
    requireValue(Number.isSafeInteger(index.search_bytes) && index.search_bytes > 0 && index.search_bytes <= MAX_SEARCH_BYTES, 'invalid creature search byte bound');
    requireValue(/^sha256:[0-9a-f]{64}$/.test(index.search_digest), 'invalid creature search digest');
    state.index = index;
    state.animationScheduler = createAnimationScheduler(() => redrawCurrent().catch(fail));
    try {
      const runtime = await loadAnimationRuntime(ANIMATION_ROOT);
      requireValue(runtime.manifest.creatures?.presentations === 1377, 'creature presentation census mismatch');
      requireValue(runtime.manifest.counts?.resolvedNpcRecords === 973 && runtime.manifest.counts?.resolvedMonsterRecords === 87193, 'creature presentation record census mismatch');
      state.animationRuntime = runtime;
      state.animationPixelStore = new AnimationPixelStore(runtime, fetch, 32 * 1024 * 1024);
      state.animationStatus = 'OUTFIT_READY';
    } catch (error) {
      state.animationRuntime = null;
      state.animationPixelStore = null;
      state.animationStatus = `STATIC_FALLBACK: ${error?.message ?? error}`;
      console.warn(state.animationStatus);
    }
    state.animationClock.setEnabled(animationEnabled());
    const search = await boundedJson(new URL(safeRelativePath(index.search_path), ROOT), MAX_SEARCH_BYTES, index.search_digest, index.search_bytes);
    requireValue(Array.isArray(search.records) && search.records.length === index.counts.search_records && search.records.length <= 20_000, 'creature search index count mismatch');
    requireValue(search.records.every((record) => RECORD_ID.test(record.record_id)), 'creature search record identity missing');
    state.search = search.records;
    const status = document.querySelector('#creature-status');
    if (status) status.textContent = `Ready · ${index.counts.records.toLocaleString()} placements · ${state.animationRuntime ? 'verified outfit pixels' : 'factual marker fallback'}`;
    await refresh();
  } catch (error) {
    fail(error);
  }
}

boot();
