import { sha256ContentId } from '../src/browser/loader.mjs';
import { getAnimationRuntime } from '../src/browser/animation-runtime-service.mjs';
import { FULLWORLD_PATHS } from '../src/browser/fullworld-trust.mjs';
import { createCreatureRenderSnapshot } from '../src/browser/creature-render-diagnostics.mjs';
import { availableNpcFilters, npcMatchesRole, npcPresentationRoles, npcRoleFilter, npcRoleGlyph, npcRoleLabel, validateNpcRoleMetadata } from '../src/browser/npc-markers.mjs';

const ROOT = new URL('../data/creatures/', location.href);
const EXPECTED_CONTRACT = 'oteryn-game-atlas-export-v1';
const EXPECTED_CAPABILITY = 'animated-creatures-v1';
const EXPECTED_SEMANTIC_DIGEST = 'sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8';
const EXPECTED_NPC_ROLE_SCHEMA = 1;
const NPC_MARKER_STYLE = 'functional-icons-v1';
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
const requestedNpcRole = npcRoleFilter(initialParams.get('npcRole'));
const state = {
  index: null,
  view: null,
  enabled: { npc: requested.has('npc'), monster: requested.has('monster') },
  npcRole: requestedNpcRole,
  availableNpcRoles: ['all'],
  selectedId: selectedParam && RECORD_ID.test(selectedParam) ? selectedParam : null,
  cache: new Map(),
  search: [],
  canvas: null,
  inspector: null,
  lastVisibleRecords: [],
  lastPreparedRecords: [],
  lastDrawnRecords: 0,
  refreshEpoch: 0,
  drawEpoch: 0,
  animationRuntime: null,
  animationOn: initialParams.get('animation') === 'on',
  logicalTimeMs: 0,
  pixelDrawnRecords: 0,
  markerDrawnRecords: 0,
  lastDrawnNpcIcons: 0,
  renderGeneration: 0,
  lastRender: null,
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
    npcRole: state.npcRole,
    availableNpcRoles: Object.freeze([...state.availableNpcRoles]),
    npcMarkerStyle: NPC_MARKER_STYLE,
    selectedRecordId: state.selectedId,
    visibleRecords: state.lastVisibleRecords.length,
    drawnRecords: state.lastDrawnRecords,
    pixelDrawnRecords: state.pixelDrawnRecords,
    markerDrawnRecords: state.markerDrawnRecords,
    drawnNpcIcons: state.lastDrawnNpcIcons,
    animationOn: state.animationOn,
    animationRuntime: state.animationRuntime?.stats?.() ?? null,
    render: state.lastRender,
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
  state.pixelDrawnRecords = 0;
  state.markerDrawnRecords = 0;
  state.lastDrawnNpcIcons = 0;
  draw([]).catch(() => {});
  publish('FAIL', error);
}

function persist() {
  const params = new URLSearchParams(location.search);
  const enabled = Object.entries(state.enabled).filter(([, on]) => on).map(([kind]) => kind).sort();
  if (enabled.length) params.set('creatures', enabled.join(','));
  else params.delete('creatures');
  if (state.npcRole !== 'all') params.set('npcRole', state.npcRole);
  else params.delete('npcRole');
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
      if (record.kind === 'npc') validateNpcRoleMetadata(record);
      else requireValue(record.roles == null && record.role_resolution_state == null, 'monster record exposes NPC role metadata');
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
  heading.textContent = 'Verified creature';
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
    createTextRow('Position', `X ${record.position.x} Â· Y ${record.position.y} Â· F ${record.position.floor}`),
    createTextRow('Resolution', record.resolution_state),
    createTextRow('Record', record.record_id),
    createTextRow('Origin', record.origin ?? 'UNKNOWN'),
  );
  if (record.entity_id) panel.append(createTextRow('Entity', record.entity_id));
  if (record.spawn_area) panel.append(createTextRow('Spawn area', `X ${record.spawn_area.center.x} Â· Y ${record.spawn_area.center.y} Â· F ${record.spawn_area.center.floor} Â· radius ${record.spawn_area.radius}`));
  if (record.appearance) panel.append(createTextRow('Outfit', record.appearance.outfit_key ?? record.appearance.look_type));
  if (record.kind === 'npc') {
    panel.append(createTextRow('NPC role resolution', record.role_resolution_state ?? 'UNKNOWN'));
    panel.append(createTextRow('Map category', npcPresentationRoles(record).map(npcRoleLabel).join(', ')));
  }
  const verifiedPixel = record.presentation_resolution_state === 'RESOLVED' && state.animationRuntime?.hasCreature(record);
  panel.append(
    createTextRow('Presentation', verifiedPixel ? `Verified outfit pixels Â· ${state.animationOn ? 'animated' : 'static verified phase'}` : `Factual marker fallback Â· ${record.presentation_reason ?? record.presentation_resolution_state ?? 'UNKNOWN'}`),
    createTextRow('Authority', `${EXPECTED_CONTRACT} / ${EXPECTED_CAPABILITY}`),
    createTextRow('Semantic digest', state.index.source.semantic_digest),
  );
}

function syncNpcRoleControl() {
  const select = document.querySelector('#npc-role-filter');
  if (!select) return;
  state.availableNpcRoles = availableNpcFilters(state.search);
  if (!state.availableNpcRoles.includes(state.npcRole)) state.npcRole = 'all';
  select.textContent = '';
  for (const role of state.availableNpcRoles) {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = npcRoleLabel(role);
    option.selected = role === state.npcRole;
    select.append(option);
  }
  persist();
}

function applyView(nextView) {
  requireValue(nextView && typeof nextView === 'object', 'invalid FullWorld view snapshot');
  state.view = nextView;
  state.animationOn = nextView.animation === 'on';
}

function consumePublishedView() {
  const snapshot = globalThis.__OTERYN_ATLAS_VIEW__;
  if (!snapshot || typeof snapshot !== 'object') return false;
  applyView(snapshot);
  return true;
}

async function waitForInitialView(timeoutMs = 30_000) {
  if (state.view || consumePublishedView()) return;
  await new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      if (timer != null) clearTimeout(timer);
      window.removeEventListener('oteryn-atlas-view', onView);
    };
    const onView = (event) => {
      if (!event.detail?.view) return;
      applyView(event.detail.view);
      cleanup();
      resolve();
    };
    window.addEventListener('oteryn-atlas-view', onView);
    if (consumePublishedView()) {
      cleanup();
      resolve();
      return;
    }
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('FullWorld view snapshot unavailable during creature boot'));
    }, timeoutMs);
  });
}

function repaintPreparedForCurrentState() {
  state.drawEpoch += 1;
  state.lastDrawnRecords = paintPrepared(state.lastPreparedRecords, state.view);
}

function setup() {
  const frame = document.querySelector('#map-frame');
  const base = document.querySelector('#atlas');
  if (!frame || !base) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'creature-overlay';
  canvas.setAttribute('aria-label', 'Verified NPC and monster spawn presentations');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '6' });
  frame.append(canvas);
  state.canvas = canvas;

  const host = document.querySelector('#semantic-layer-list');
  if (host) {
    for (const row of [...host.querySelectorAll('label')]) if (/NPCs|Monsters \/ spawns/i.test(row.textContent)) row.remove();
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
      status.textContent = 'VERIFIED';
      row.append(input, name, status);
      host.append(row);
      input.addEventListener('change', () => {
        state.enabled[kind] = input.checked;
        persist();
        repaintPreparedForCurrentState();
        refresh().catch(fail);
      });
    }
  }

  const region = document.querySelector('#region-controls');
  if (region) {
    const section = document.createElement('section');
    section.innerHTML = '<h2>Creature search</h2><label class="npc-role-control" for="npc-role-filter"><span>NPC category</span><select id="npc-role-filter" aria-label="Filter NPCs by map category"><option value="all">All NPCs</option></select></label><input id="creature-search" type="search" placeholder="Search NPCs or monsters" aria-label="Search verified creatures"><div id="creature-results" class="region-results" aria-live="polite"></div><p class="rail-note" id="creature-status">Loading Game-owned verified creature indexâ€¦</p>';
    region.after(section);
    section.querySelector('#creature-search').addEventListener('input', (event) => renderSearch(event.target.value));
    section.querySelector('#npc-role-filter').addEventListener('change', (event) => {
      state.npcRole = npcRoleFilter(event.target.value);
      persist();
      repaintPreparedForCurrentState();
      refresh().catch(fail);
    });
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
    applyView(event.detail.view);
    persist();
    repaintPreparedForCurrentState();
    refresh().catch(fail);
  });
  window.addEventListener('oteryn-atlas-render-committed', (event) => {
    if (!state.index || !state.canvas) return;
    drawCommitted(state.lastVisibleRecords, event.detail).then((count) => {
      if (count != null) { state.lastDrawnRecords = count; publish('PASS'); }
    }).catch(fail);
  });
  window.addEventListener('oteryn-atlas-animation-frame', (event) => {
    state.logicalTimeMs = event.detail.logicalTimeMs;
    if (state.animationOn && state.lastVisibleRecords.length) draw(state.lastVisibleRecords).then((count) => { state.lastDrawnRecords = count; publish('PASS'); }).catch(fail);
  });
  window.addEventListener('resize', () => { repaintPreparedForCurrentState(); refresh().catch(fail); });
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
  if (state.npcRole !== 'all') params.set('npcRole', state.npcRole);
  else params.delete('npcRole');
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
    button.textContent = `${item.label} Â· ${item.kind} Â· X ${item.position.x} Y ${item.position.y} F ${item.position.floor}`;
    button.addEventListener('click', () => navigate(item));
    output.append(button);
  }
}

function rendererView(snapshot) {
  const transform = snapshot?.transform;
  if (!transform) return null;
  return Object.freeze({
    x: transform.centerTileX,
    y: transform.centerTileY,
    floor: transform.floor,
    zoom: transform.zoom,
  });
}

function sameView(left, right) {
  return Boolean(left && right)
    && left.floor === right.floor
    && Math.abs(left.x - right.x) < 1e-9
    && Math.abs(left.y - right.y) < 1e-9
    && Math.abs(left.zoom - right.zoom) < 1e-9;
}

function sameRendererCommit(expected) {
  const current = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
  return current?.generation === expected?.generation
    && current?.transform?.floor === expected?.transform?.floor
    && current?.transform?.centerTileX === expected?.transform?.centerTileX
    && current?.transform?.centerTileY === expected?.transform?.centerTileY
    && current?.transform?.zoom === expected?.transform?.zoom;
}

function drawNpcIcon(context, x, y, glyph, size) {
  const left = Math.round(x - size / 2);
  const top = Math.round(y - size / 2);
  const mid = Math.floor(size / 2);
  const pad = Math.max(2, Math.floor(size / 5));
  context.save();
  context.translate(left, top);
  context.fillStyle = 'rgba(5, 10, 17, .94)';
  context.fillRect(0, 0, size, size);
  context.strokeStyle = '#d7e5f2';
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, size - 1, size - 1);
  context.fillStyle = '#ffd166'; context.strokeStyle = '#ffd166';
  context.lineWidth = Math.max(1, Math.floor(size / 8));
  context.lineCap = 'square'; context.lineJoin = 'miter';
  if (glyph === 'coin') {
    context.beginPath(); context.arc(mid, mid, Math.max(3, mid - pad), 0, Math.PI * 2); context.stroke();
    context.fillRect(mid - 1, pad + 2, 2, size - (pad + 2) * 2);
  } else if (glyph === 'travel') {
    context.beginPath(); context.moveTo(mid, pad); context.lineTo(size - pad, mid); context.lineTo(mid, size - pad); context.lineTo(pad, mid); context.closePath(); context.stroke();
    context.fillRect(mid - 1, pad + 2, 2, size - (pad + 2) * 2); context.fillRect(pad + 2, mid - 1, size - (pad + 2) * 2, 2);
  } else if (glyph === 'bag') {
    context.strokeRect(pad, mid - 1, size - pad * 2, size - mid - pad + 1); context.strokeRect(mid - 3, pad + 1, 6, Math.max(3, mid - pad - 1));
  } else if (glyph === 'quest') {
    context.fillRect(mid - 1, pad, 3, size - pad * 2 - 4); context.fillRect(mid - 1, size - pad - 2, 3, 3);
  } else if (glyph === 'star') {
    context.beginPath(); context.moveTo(mid, pad); context.lineTo(mid + 2, mid - 2); context.lineTo(size - pad, mid); context.lineTo(mid + 2, mid + 2); context.lineTo(mid, size - pad); context.lineTo(mid - 2, mid + 2); context.lineTo(pad, mid); context.lineTo(mid - 2, mid - 2); context.closePath(); context.fill();
  } else if (glyph === 'book') {
    context.strokeRect(pad, pad + 2, mid - pad, size - pad * 2 - 2); context.strokeRect(mid, pad + 2, mid - pad, size - pad * 2 - 2); context.fillRect(mid - 1, pad + 2, 2, size - pad * 2 - 2);
  } else {
    context.beginPath(); context.arc(mid, pad + 3, Math.max(2, Math.floor(size / 6)), 0, Math.PI * 2); context.fill(); context.fillRect(pad + 1, mid + 1, size - (pad + 1) * 2, Math.max(3, size - mid - pad - 1));
  }
  context.restore();
}

async function prepareDraw(records, view = state.view) {
  const canvas = state.canvas;
  if (!canvas || !view) return [];
  const rect = canvas.getBoundingClientRect();
  const scale = 32 * view.zoom;
  const candidates = records.filter((record) => {
    if (record.position.floor !== view.floor) return false;
    if (!state.enabled[record.kind]) return false;
    if (record.kind === 'npc' && !npcMatchesRole(record, state.npcRole)) return false;
    const x = rect.width / 2 + (record.position.x - view.x) * scale;
    const y = rect.height / 2 + (record.position.y - view.y) * scale;
    return x >= -96 && y >= -96 && x <= rect.width + 96 && y <= rect.height + 96;
  });
  return Promise.all(candidates.map(async (record) => {
    const verified = record.presentation_resolution_state === 'RESOLVED' && state.animationRuntime?.hasCreature(record);
    if (!verified || (record.kind === 'npc' && view.zoom < 1)) return { record, marker: true };
    const frame = state.animationRuntime.creatureFrame(record, state.animationOn ? state.logicalTimeMs : 0);
    return { record, frame, bitmap: await state.animationRuntime.bitmap(frame.contentId), marker: false };
  }));
}

function paintPrepared(prepared, view = state.view, committedBase = null) {
  const canvas = state.canvas;
  if (!canvas || !view) return 0;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const scale = 32 * view.zoom;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(dpr, dpr);
  context.imageSmoothingEnabled = false;
  context.font = '12px sans-serif';
  context.textBaseline = 'middle';
  const npcSize = Math.round(Math.max(13, Math.min(20, 12 + view.zoom * 2)));
  let pixelDrawn = 0;
  let markerDrawn = 0;
  let npcIcons = 0;
  let drawn = 0;
  const anchors = [];
  for (const item of prepared) {
    const { record } = item;
    if (record.position.floor !== view.floor) continue;
    if (!state.enabled[record.kind]) continue;
    if (record.kind === 'npc' && !npcMatchesRole(record, state.npcRole)) continue;
    drawn += 1;
    const tileX = rect.width / 2 + (record.position.x - view.x) * scale;
    const tileY = rect.height / 2 + (record.position.y - view.y) * scale;
    if (committedBase && anchors.length < 24) {
      anchors.push({ id: record.record_id, kind: record.kind, floor: record.position.floor, x: record.position.x, y: record.position.y, screenX: tileX, screenY: tileY });
    }
    if (!item.marker) {
      const displacement = item.frame.program.displacement ?? { x: 0, y: 0 };
      const x = tileX - (item.bitmap.width - 32 + Number(displacement.x ?? 0)) * view.zoom;
      const y = tileY - (item.bitmap.height - 32 + Number(displacement.y ?? 0)) * view.zoom;
      context.drawImage(item.bitmap, x, y, item.bitmap.width * view.zoom, item.bitmap.height * view.zoom);
      pixelDrawn += 1;
    }
    if (record.kind === 'npc') {
      const badgeOffset = item.marker ? 0 : Math.min(14, 8 + view.zoom * 3);
      drawNpcIcon(context, tileX + badgeOffset, tileY - badgeOffset, npcRoleGlyph(record, state.npcRole), npcSize);
      npcIcons += 1;
    } else if (item.marker) {
      const radius = Math.max(3, Math.min(7, view.zoom * 4));
      context.beginPath(); context.arc(tileX, tileY, radius, 0, Math.PI * 2);
      context.fillStyle = '#ef476f'; context.fill();
      context.strokeStyle = '#111827'; context.lineWidth = 1.5; context.stroke();
      markerDrawn += 1;
    }
    if (view.zoom >= (record.kind === 'npc' ? 1.5 : 1)) {
      context.fillStyle = '#f8fafc'; context.fillText(record.name, tileX + 8, tileY);
    }
  }
  context.restore();
  if (committedBase && sameRendererCommit(committedBase)) {
    state.renderGeneration += 1;
    state.lastRender = createCreatureRenderSnapshot({
      generation: state.renderGeneration,
      baseGenerationAtStart: committedBase.generation,
      baseGenerationAtCommit: committedBase.generation,
      view,
      canvas: { width: rect.width, height: rect.height, dpr },
      anchors,
    });
    window.dispatchEvent(new CustomEvent('oteryn-atlas-creature-render-committed', { detail: state.lastRender }));
  }
  state.pixelDrawnRecords = pixelDrawn;
  state.markerDrawnRecords = markerDrawn;
  state.lastDrawnNpcIcons = npcIcons;
  state.animationRuntime?.noteFrameUpdate(state.animationOn ? pixelDrawn : 0);
  return drawn;
}

async function draw(records, view = state.view) {
  const epoch = ++state.drawEpoch;
  const prepared = await prepareDraw(records, view);
  if (epoch !== state.drawEpoch || view !== state.view) return state.lastDrawnRecords;
  state.lastPreparedRecords = prepared;
  state.lastDrawnRecords = paintPrepared(prepared, view);
  return state.lastDrawnRecords;
}

async function drawCommitted(records, committedBase) {
  const view = rendererView(committedBase);
  const canvas = state.canvas;
  const epoch = ++state.drawEpoch;
  if (!canvas || !view || !committedBase?.generation) return null;
  const rect = canvas.getBoundingClientRect();
  const baseViewport = committedBase.transform;
  if (Math.abs(rect.width - baseViewport.cssViewportWidth) > 0.01
      || Math.abs(rect.height - baseViewport.cssViewportHeight) > 0.01) return null;
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  if (Math.abs(dpr - baseViewport.dpr) > 0.01) return null;
  const prepared = await prepareDraw(records, view);
  if (epoch !== state.drawEpoch || !sameRendererCommit(committedBase)) return null;
  state.lastPreparedRecords = prepared;
  state.lastDrawnRecords = paintPrepared(prepared, view, committedBase);
  return state.lastDrawnRecords;
}

async function refresh() {
  if (!state.index || !state.view || !state.canvas) return;
  const epoch = ++state.refreshEpoch;
  const view = state.view;
  const entries = wantedEntries(view, state.canvas);
  const groups = await Promise.all(entries.map(loadEntry));
  if (epoch !== state.refreshEpoch || view !== state.view) return;
  const records = groups.flat();
  const prepared = await prepareDraw(records, view);
  if (epoch !== state.refreshEpoch || view !== state.view) return;
  state.lastVisibleRecords = records;
  state.lastPreparedRecords = prepared;
  state.lastDrawnRecords = paintPrepared(prepared, view);
  const committedBase = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
  if (sameView(rendererView(committedBase), view)) {
    const committedCount = await drawCommitted(records, committedBase);
    if (committedCount != null) state.lastDrawnRecords = committedCount;
  }
  const selected = state.selectedId ? records.find((record) => record.record_id === state.selectedId) ?? null : null;
  renderCreatureInspector(selected);
  const status = document.querySelector('#creature-status');
  if (status) status.textContent = `Game-owned verified creatures Â· ${state.index.counts.records.toLocaleString()} placements Â· NPC ${npcRoleLabel(state.npcRole)} Â· ${entries.length} visible shards Â· ${state.pixelDrawnRecords} pixel / ${state.lastDrawnNpcIcons} NPC icon / ${state.markerDrawnRecords} marker`;
  publish('PASS', null, { visibleShards: entries.length, selectedVisible: Boolean(selected) });
}
async function boot() {
  publish();
  setup();
  try {
    requireValue(!selectedParam || RECORD_ID.test(selectedParam), 'invalid creature deep-link id');
    requireValue([...requested].every((kind) => kind === 'npc' || kind === 'monster'), 'unsupported creature layer');
    state.animationRuntime = await getAnimationRuntime(new URL(FULLWORLD_PATHS.animation, location.href));
    const index = await boundedJson(new URL('index.json', ROOT), MAX_INDEX_BYTES);
    requireValue(index.schema_version === 1, 'unsupported creature index schema');
    requireValue(index.source?.contract_id === EXPECTED_CONTRACT && index.source?.capability === EXPECTED_CAPABILITY, 'unsupported creature index authority');
    requireValue(index.source?.semantic_digest === EXPECTED_SEMANTIC_DIGEST, 'untrusted Game creature semantic digest');
    requireValue(index.source?.npc_role_schema_version === EXPECTED_NPC_ROLE_SCHEMA, 'unsupported Game NPC role schema');
    requireValue(index.source?.appearance_product_root === state.animationRuntime.manifest.source.appearance_product_root, 'creature/animation appearance root mismatch');
    requireValue(index.source?.outfit_spatial_product_root === state.animationRuntime.manifest.source.outfit_spatial_product_root, 'creature/animation outfit root mismatch');
    requireValue(Array.isArray(index.chunks) && index.chunks.length === index.counts?.chunks && index.chunks.length <= MAX_INDEX_CHUNKS, 'creature index exceeds bounded chunk cap');
    requireValue(Number.isSafeInteger(index.search_bytes) && index.search_bytes > 0 && index.search_bytes <= MAX_SEARCH_BYTES, 'invalid creature search byte bound');
    requireValue(/^sha256:[0-9a-f]{64}$/.test(index.search_digest), 'invalid creature search digest');
    state.index = index;
    const search = await boundedJson(new URL(safeRelativePath(index.search_path), ROOT), MAX_SEARCH_BYTES, index.search_digest, index.search_bytes);
    requireValue(Array.isArray(search.records) && search.records.length === index.counts.search_records && search.records.length <= 20_000, 'creature search index count mismatch');
    requireValue(search.records.every((record) => RECORD_ID.test(record.record_id)), 'creature search record identity missing');
    for (const record of search.records) {
      requireValue(record.kind === 'npc' || record.kind === 'monster', 'invalid creature search kind');
      if (record.kind === 'npc') validateNpcRoleMetadata(record);
      else requireValue(record.roles == null && record.role_resolution_state == null, 'monster search record exposes NPC role metadata');
    }
    state.search = search.records;
    syncNpcRoleControl();
    const status = document.querySelector('#creature-status');
    if (status) status.textContent = `Ready Â· ${index.counts.records.toLocaleString()} verified creature placements`;
    await waitForInitialView();
    await refresh();
  } catch (error) {
    fail(error);
  }
}

boot();
