import { sha256ContentId } from '../src/browser/loader.mjs';

const ROOT = new URL('../data/creatures/', location.href);
const EXPECTED_CONTRACT = 'oteryn-game-atlas-export-v1';
const EXPECTED_CAPABILITY = 'static-creatures-v1';
const EXPECTED_SEMANTIC_DIGEST = 'sha256:01921968a6cb4f6ecea237820a053fc5052aaa1da556851f2c2a60d99890b5e1';
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
  lastDrawnRecords: 0,
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
  state.lastDrawnRecords = 0;
  draw([]);
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
  heading.textContent = 'Static creature';
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
  panel.append(
    createTextRow('Presentation', 'Static marker fallback; no unverified creature pixel asset is inferred.'),
    createTextRow('Authority', `${EXPECTED_CONTRACT} / ${EXPECTED_CAPABILITY}`),
    createTextRow('Semantic digest', state.index.source.semantic_digest),
  );
}

function setup() {
  const frame = document.querySelector('#map-frame');
  const base = document.querySelector('#atlas');
  if (!frame || !base) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'creature-overlay';
  canvas.setAttribute('aria-label', 'Static NPC and monster spawn overlays');
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
      status.textContent = 'STATIC';
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
    section.innerHTML = '<h2>Creature search</h2><input id="creature-search" type="search" placeholder="Search NPCs or monsters" aria-label="Search static creatures"><div id="creature-results" class="region-results" aria-live="polite"></div><p class="rail-note" id="creature-status">Loading Game-owned static creature index…</p>';
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
    persist();
    refresh().catch(fail);
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

function draw(records) {
  const canvas = state.canvas;
  const view = state.view;
  if (!canvas || !view) return 0;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(dpr, dpr);
  context.font = '12px sans-serif';
  context.textBaseline = 'middle';
  const scale = 32 * view.zoom;
  let drawn = 0;
  for (const record of records) {
    if (!state.enabled[record.kind]) continue;
    const x = rect.width / 2 + (record.position.x - view.x) * scale;
    const y = rect.height / 2 + (record.position.y - view.y) * scale;
    if (x < -20 || y < -20 || x > rect.width + 20 || y > rect.height + 20) continue;
    const radius = Math.max(3, Math.min(7, view.zoom * 4));
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = record.kind === 'npc' ? '#ffd166' : '#ef476f';
    context.fill();
    context.strokeStyle = '#111827';
    context.lineWidth = 1.5;
    context.stroke();
    if (view.zoom >= 1) {
      context.fillStyle = '#f8fafc';
      context.fillText(record.name, x + 8, y);
    }
    drawn += 1;
  }
  context.restore();
  return drawn;
}

async function refresh() {
  if (!state.index || !state.view || !state.canvas) return;
  const entries = wantedEntries(state.view, state.canvas);
  const groups = await Promise.all(entries.map(loadEntry));
  const records = groups.flat();
  state.lastVisibleRecords = records;
  state.lastDrawnRecords = draw(records);
  const selected = state.selectedId ? records.find((record) => record.record_id === state.selectedId) ?? null : null;
  renderCreatureInspector(selected);
  const status = document.querySelector('#creature-status');
  if (status) status.textContent = `Game-owned static facts · ${state.index.counts.records.toLocaleString()} placements · ${entries.length} visible shards · ${state.lastDrawnRecords} drawn`;
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
    requireValue(Array.isArray(index.chunks) && index.chunks.length === index.counts?.chunks && index.chunks.length <= MAX_INDEX_CHUNKS, 'creature index exceeds bounded chunk cap');
    requireValue(Number.isSafeInteger(index.search_bytes) && index.search_bytes > 0 && index.search_bytes <= MAX_SEARCH_BYTES, 'invalid creature search byte bound');
    requireValue(/^sha256:[0-9a-f]{64}$/.test(index.search_digest), 'invalid creature search digest');
    state.index = index;
    const search = await boundedJson(new URL(safeRelativePath(index.search_path), ROOT), MAX_SEARCH_BYTES, index.search_digest, index.search_bytes);
    requireValue(Array.isArray(search.records) && search.records.length === index.counts.search_records && search.records.length <= 20_000, 'creature search index count mismatch');
    requireValue(search.records.every((record) => RECORD_ID.test(record.record_id)), 'creature search record identity missing');
    state.search = search.records;
    const status = document.querySelector('#creature-status');
    if (status) status.textContent = `Ready · ${index.counts.records.toLocaleString()} static placements`;
    await refresh();
  } catch (error) {
    fail(error);
  }
}

boot();
