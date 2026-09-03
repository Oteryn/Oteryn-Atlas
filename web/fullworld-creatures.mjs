import { sha256ContentId } from '../src/browser/loader.mjs';
import { getAnimationRuntime } from '../src/browser/animation-runtime-service.mjs';
import { ancillarySourceExpectations, FULLWORLD_PATHS, FULLWORLD_TRUST } from '../src/browser/fullworld-trust.mjs';
import { createCreatureRenderSnapshot } from '../src/browser/creature-render-diagnostics.mjs';
import { buildCreatureInteractionIndex, createClosedCreatureCardState, placeCreatureCard, queryCreatureHits, reduceCreatureCardState } from '../src/browser/creature-interaction.mjs';
import { createCreatureInteractionTarget } from '../src/browser/creature-interaction-target.mjs';
import { createCreaturePresentationController, NPC_MARKER_STYLE } from '../src/browser/creature-presentation-controller.mjs';
import { availableNpcFilters, npcMatchesRole, npcPresentationRoles, npcRoleFilter, npcRoleLabel, validateNpcRoleMetadata } from '../src/browser/npc-markers.mjs';
import { createCreatureGameplayProfileService } from '../src/browser/creature-gameplay-profiles.mjs';
import { parseCreatureInspectorState, reduceCreatureInspectorState, serializeCreatureInspectorState } from '../src/browser/creature-inspector-state.mjs';
import { createCreatureGameplayInspectorController } from './fullworld-creature-gameplay.mjs';

const ROOT = new URL('../data/creatures/', location.href);
const GAMEPLAY_ROOT = new URL('./creature-gameplay/', import.meta.url);
const EXPECTED_CREATURE_SOURCE = ancillarySourceExpectations(FULLWORLD_TRUST).creatures;
const CREATURE_SOURCE_LABEL = EXPECTED_CREATURE_SOURCE.fixtureId ? 'fixture-owned verified creatures' : 'Game-owned verified creatures';
const MAX_INDEX_CHUNKS = 20_000;
const MAX_CHUNK_RECORDS = 5_000;
const MAX_VISIBLE_CHUNKS = 64;
const MAX_CACHE_CHUNKS = 96;
const MAX_INDEX_BYTES = 4 * 1024 * 1024;
const MAX_SEARCH_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const INTERACTION_CELL_SIZE = 64;
const MAX_CHOOSER_CHOICES = 8;
const RECORD_ID = /^(?:npc|monster):[0-9a-f]{32}$/;

const initialParams = new URLSearchParams(location.search);
const requested = new Set((initialParams.get('creatures') || '').split(',').filter(Boolean));
const selectedParam = initialParams.get('creature') || null;
const requestedNpcRole = npcRoleFilter(initialParams.get('npcRole'));
const inspectorState = parseCreatureInspectorState(initialParams, { liveAvailable: false });
const state = {
  index: null,
  view: null,
  detailReady: false,
  effectivePresentation: null,
  enabled: { npc: requested.has('npc'), monster: requested.has('monster') },
  npcRole: requestedNpcRole,
  availableNpcRoles: ['all'],
  selectedId: selectedParam && RECORD_ID.test(selectedParam) ? selectedParam : null,
  cache: new Map(),
  search: [],
  canvas: null,
  presentation: null,
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
  lastCommittedBase: null,
  lastCommittedAnchors: [],
  lastCanvasMetrics: null,
  interactionIndex: null,
  interactionGeneration: null,
  interactionBaseGeneration: null,
  interactionRecords: new Map(),
  interactionTargets: new Map(),
  hoveredId: null,
  hoverFrame: null,
  cardState: createClosedCreatureCardState(),
  restoreCardFromDeepLink: Boolean(selectedParam),
  inspectorState,
  gameplayProfiles: null,
  gameplayInspector: null,
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
    interactionVersion: 'creature-interaction-v1',
    interactionTargets: state.interactionIndex?.targetCount ?? 0,
    interactionBaseGeneration: state.interactionBaseGeneration,
    interactionCreatureGeneration: state.renderGeneration || null,
    interactionBuckets: state.interactionIndex?.bucketCount ?? 0,
    interactionCellSize: state.interactionIndex?.cellSize ?? INTERACTION_CELL_SIZE,
    hoveredRecordId: state.hoveredId,
    cardState: state.cardState.mode,
    cardRecordId: state.cardState.recordId,
    selectedTargetRect: state.selectedId ? state.interactionTargets.get(state.selectedId)?.presentationRect ?? null : null,
    cardTargetRect: state.cardState.recordId ? state.interactionTargets.get(state.cardState.recordId)?.presentationRect ?? null : null,
    cardTargetAssistRect: state.cardState.recordId ? state.interactionTargets.get(state.cardState.recordId)?.assistRect ?? null : null,
    inspectorTab: state.inspectorState.tab,
    gameplay: state.gameplayInspector?.stats?.() ?? null,
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
  state.presentation?.clear();
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
  const serialized = serializeCreatureInspectorState(params, state.inspectorState, { liveAvailable: false });
  const next = `${location.pathname}?${serialized.toString()}${location.hash}`;
  if (`${location.pathname}${location.search}${location.hash}` !== next) history.replaceState(null, '', next);
}

function cardElement(id) {
  return document.querySelector(`#${id}`);
}

function clearCardCopyFeedback() {
  const status = cardElement('creature-card-copy-status');
  const fallback = cardElement('creature-card-link-fallback');
  if (status) status.textContent = '';
  if (fallback) { fallback.hidden = true; fallback.value = ''; }
}

function closeCreatureCard({ publishState = true } = {}) {
  state.cardState = reduceCreatureCardState(state.cardState, { type: 'close' });
  const card = cardElement('creature-quick-card');
  if (card) card.hidden = true;
  clearCardCopyFeedback();
  repaintPresentation();
  if (publishState) publish('PASS');
}

function suspendCreatureCard() {
  if (state.cardState.mode === 'closed') return;
  state.cardState = reduceCreatureCardState(state.cardState, { type: 'suspend' });
  const card = cardElement('creature-quick-card');
  if (card) card.hidden = true;
  repaintPresentation();
}

function invalidateInteraction({ closeCard = false } = {}) {
  state.interactionIndex = null;
  state.interactionGeneration = null;
  state.interactionBaseGeneration = null;
  state.interactionRecords = new Map();
  state.interactionTargets = new Map();
  state.hoveredId = null;
  document.querySelector('#map-frame')?.classList.remove('creature-hovering');
  if (closeCard) closeCreatureCard({ publishState: false });
  else suspendCreatureCard();
  state.presentation?.clear();
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

function renderCreatureSemantic(panel, record) {
  panel.textContent = '';
  const heading = document.createElement('h3');
  heading.textContent = 'Verified creature';
  panel.append(heading);
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
  if (record.kind === 'npc') {
    panel.append(createTextRow('NPC role resolution', record.role_resolution_state ?? 'UNKNOWN'));
    panel.append(createTextRow('Map category', npcPresentationRoles(record).map(npcRoleLabel).join(', ')));
  }
  const verifiedPixel = record.presentation_resolution_state === 'RESOLVED' && state.animationRuntime?.hasCreature(record);
  panel.append(
    createTextRow('Presentation', verifiedPixel ? `Verified outfit pixels · ${state.animationOn ? 'animated' : 'static verified phase'}` : `Factual marker fallback · ${record.presentation_reason ?? record.presentation_resolution_state ?? 'UNKNOWN'}`),
    createTextRow('Authority', `${EXPECTED_CREATURE_SOURCE.contractId} / ${EXPECTED_CREATURE_SOURCE.capability}`),
    createTextRow('Semantic digest', state.index.source.semantic_digest),
  );
}

function renderCreatureInspector(record) {
  if (!state.gameplayInspector) return;
  state.gameplayInspector.render(record, state.inspectorState.tab).catch((error) => {
    console.error(`Creature gameplay inspector unavailable: ${error.message ?? error}`);
    if (state.inspector) {
      state.inspector.textContent = '';
      const message = document.createElement('p');
      message.className = 'creature-gameplay-notice';
      message.textContent = `Gameplay inspector unavailable: ${error.message ?? error}`;
      state.inspector.append(message);
    }
  });
}

function appendCardFact(container, label, value, { warning = false } = {}) {
  const row = createTextRow(label, value);
  if (warning) row.className = 'creature-card-warning';
  container.append(row);
  return row;
}

function reservedCardRects() {
  const frame = document.querySelector('#map-frame');
  if (!frame) return [];
  const frameRect = frame.getBoundingClientRect();
  return ['#runtime-badge', '#detail-badge', '#cursor-coordinate'].map((selector) => {
    const node = document.querySelector(selector);
    if (!node || node.hidden) return null;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { x: rect.left - frameRect.left, y: rect.top - frameRect.top, width: rect.width, height: rect.height };
  }).filter(Boolean);
}

function positionCreatureCard(target) {
  const card = cardElement('creature-quick-card');
  const frame = document.querySelector('#map-frame');
  if (!card || !frame || !target) return;
  card.hidden = false;
  card.style.visibility = 'hidden';
  if (matchMedia('(max-width: 980px)').matches) {
    card.style.left = '';
    card.style.top = '';
    card.style.visibility = '';
    return;
  }
  const placement = placeCreatureCard(target.presentationRect,
    { width: card.offsetWidth, height: card.offsetHeight },
    { width: frame.clientWidth, height: frame.clientHeight }, reservedCardRects());
  card.style.left = `${placement.x}px`;
  card.style.top = `${placement.y}px`;
  card.style.visibility = '';
}

function renderCreatureCardRecord(record, target) {
  const card = cardElement('creature-quick-card');
  const title = cardElement('creature-card-title');
  const kind = cardElement('creature-card-kind');
  const body = cardElement('creature-card-body');
  const choices = cardElement('creature-card-choices');
  const actions = cardElement('creature-card-actions');
  if (!card || !title || !kind || !body || !choices || !actions) return;
  clearCardCopyFeedback();
  title.textContent = record.name;
  kind.textContent = record.kind === 'npc' ? 'NPC' : 'Monster spawn';
  body.textContent = '';
  appendCardFact(body, 'Position', `X ${record.position.x} · Y ${record.position.y} · F ${record.position.floor}`);
  if (record.kind === 'npc' && record.role_resolution_state === 'RESOLVED' && Array.isArray(record.roles) && record.roles.length) {
    appendCardFact(body, 'NPC roles', record.roles.map(npcRoleLabel).join(', '));
  }
  if (record.spawn_area && Number.isFinite(record.spawn_area.radius)) appendCardFact(body, 'Spawn radius', record.spawn_area.radius);
  if (record.kind === 'npc' && record.role_resolution_state === 'AMBIGUOUS') {
    appendCardFact(body, 'Notice', 'NPC role information is ambiguous in the verified Game export.', { warning: true });
  }
  if (record.presentation_resolution_state && record.presentation_resolution_state !== 'RESOLVED') {
    appendCardFact(body, 'Notice', 'Presentation detail is unresolved; Atlas is using the factual marker fallback.', { warning: true });
  }
  choices.hidden = true;
  choices.textContent = '';
  actions.hidden = false;
  card.hidden = false;
  positionCreatureCard(target);
  updateCreatureCardGameplaySummary(record, body).catch((error) => console.warn(`Creature gameplay card summary unavailable: ${error.message ?? error}`));
}

async function updateCreatureCardGameplaySummary(record, body) {
  if (!state.gameplayInspector || !record?.entity_id) return;
  const recordId = record.record_id;
  const summary = await state.gameplayInspector.gameplaySummary(record);
  if (!summary || state.cardState.recordId !== recordId || body !== cardElement('creature-card-body')) return;
  if (body.querySelector('[data-gameplay-summary]')) return;
  const row = appendCardFact(body, 'Gameplay', summary);
  row.dataset.gameplaySummary = 'true';
}

function selectedCreatureRecord() {
  if (!state.selectedId) return null;
  return state.interactionRecords.get(state.selectedId)
    ?? state.lastVisibleRecords.find((record) => record.record_id === state.selectedId)
    ?? null;
}

function openCreatureRecord(recordId) {
  const record = state.interactionRecords.get(recordId);
  const target = state.interactionTargets.get(recordId);
  if (!record || !target || !state.interactionGeneration) return false;
  state.selectedId = recordId;
  state.inspectorState = reduceCreatureInspectorState(state.inspectorState, { type: 'select-creature' });
  state.cardState = reduceCreatureCardState(state.cardState, {
    type: 'open-record', generation: state.interactionGeneration, recordId,
  });
  state.restoreCardFromDeepLink = false;
  persist();
  renderCreatureInspector(record);
  renderCreatureCardRecord(record, target);
  repaintPresentation();
  publish('PASS');
  return true;
}

function openCreatureChooser(hits) {
  const bounded = hits.slice(0, MAX_CHOOSER_CHOICES);
  if (bounded.length < 2 || !state.interactionGeneration) return false;
  state.cardState = reduceCreatureCardState(state.cardState, {
    type: 'open-chooser', generation: state.interactionGeneration,
    choices: bounded.map((hit) => hit.recordId),
  });
  const card = cardElement('creature-quick-card');
  const title = cardElement('creature-card-title');
  const kind = cardElement('creature-card-kind');
  const body = cardElement('creature-card-body');
  const choices = cardElement('creature-card-choices');
  const actions = cardElement('creature-card-actions');
  if (!card || !title || !kind || !body || !choices || !actions) return false;
  clearCardCopyFeedback();
  kind.textContent = 'Overlapping placements';
  title.textContent = 'Choose a creature';
  body.textContent = '';
  appendCardFact(body, 'Notice', 'Multiple verified creature placements overlap at this point.');
  choices.textContent = '';
  choices.hidden = false;
  actions.hidden = true;
  for (const hit of bounded) {
    const record = state.interactionRecords.get(hit.recordId);
    if (!record) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${record.name} · ${record.kind === 'npc' ? 'NPC' : 'Monster spawn'}`;
    button.addEventListener('click', () => openCreatureRecord(hit.recordId));
    choices.append(button);
  }
  card.hidden = false;
  positionCreatureCard(bounded[0]);
  repaintPresentation();
  publish('PASS');
  return true;
}

function handleMapActivation(event) {
  const detail = event.detail;
  if (!state.interactionIndex || !state.interactionGeneration
      || detail?.rendererGeneration !== state.interactionBaseGeneration
      || detail?.floor !== state.view?.floor) {
    closeCreatureCard({ publishState: false });
    return;
  }
  const hits = queryCreatureHits(state.interactionIndex, {
    x: detail.cssX, y: detail.cssY, pointerType: detail.pointerType,
    generation: state.interactionGeneration,
  });
  if (!hits.length) {
    closeCreatureCard({ publishState: false });
    publish('PASS');
    return;
  }
  event.preventDefault();
  if (hits.length > 1 && hits[0].hitKind === 'direct') openCreatureChooser(hits);
  else openCreatureRecord(hits[0].recordId);
}

async function copyCreatureLink() {
  const status = cardElement('creature-card-copy-status');
  const fallback = cardElement('creature-card-link-fallback');
  if (!status || !fallback || state.cardState.mode !== 'record') return;
  const canonicalUrl = location.href;
  fallback.hidden = true;
  fallback.value = '';
  try {
    if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('clipboard API unavailable');
    await navigator.clipboard.writeText(canonicalUrl);
    status.textContent = 'Copied link.';
  } catch {
    fallback.value = canonicalUrl;
    fallback.hidden = false;
    status.textContent = 'Copy unavailable. Copy the link manually.';
  }
}

function openCreatureDetails() {
  const recordId = state.cardState.recordId;
  const record = recordId ? state.interactionRecords.get(recordId) : null;
  if (!record) return;
  state.inspectorState = reduceCreatureInspectorState(state.inspectorState, { type: 'open-details' });
  persist();
  renderCreatureInspector(record);
  window.dispatchEvent(new CustomEvent('oteryn-atlas-open-inspector', { detail: { recordId, tab: 'gameplay' } }));
  requestAnimationFrame(() => state.inspector?.closest('.inspector')?.scrollTo({ top: 0, behavior: 'auto' }));
}

function clearCreatureHover() {
  if (state.hoveredId == null) return;
  state.hoveredId = null;
  document.querySelector('#map-frame')?.classList.remove('creature-hovering');
  repaintPresentation();
  publish('PASS');
}

function scheduleCreatureHover(event, base) {
  if (event.pointerType === 'touch') { clearCreatureHover(); return; }
  const rect = base.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (state.hoverFrame != null) cancelAnimationFrame(state.hoverFrame);
  state.hoverFrame = requestAnimationFrame(() => {
    state.hoverFrame = null;
    const rendererGeneration = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__?.generation ?? null;
    const hits = state.interactionIndex && rendererGeneration === state.interactionBaseGeneration
      ? queryCreatureHits(state.interactionIndex, { x, y, pointerType: 'mouse', generation: state.interactionGeneration }) : [];
    const next = hits[0]?.recordId ?? null;
    if (next === state.hoveredId) return;
    state.hoveredId = next;
    document.querySelector('#map-frame')?.classList.toggle('creature-hovering', Boolean(next));
    repaintPresentation();
    publish('PASS');
  });
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

function applyView(nextView, detailReady = state.detailReady, effectivePresentation = null) {
  requireValue(nextView && typeof nextView === 'object', 'invalid FullWorld view snapshot');
  state.view = nextView;
  state.animationOn = nextView.animation === 'on';
  if (typeof detailReady === 'boolean') state.detailReady = detailReady;
  state.effectivePresentation = effectivePresentation && typeof effectivePresentation === 'object'
    ? effectivePresentation
    : null;
}

function consumePublishedView() {
  const snapshot = globalThis.__OTERYN_ATLAS_VIEW__;
  if (!snapshot || typeof snapshot !== 'object') return false;
  const effectivePresentation = globalThis.__OTERYN_ATLAS_EFFECTIVE_PRESENTATION__;
  applyView(snapshot, effectivePresentation?.detailReady, effectivePresentation);
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
      applyView(event.detail.view, event.detail.detailReady, event.detail.effectivePresentation ?? null);
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
  state.presentation = createCreaturePresentationController({ frame });

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
        invalidateInteraction({ closeCard: true });
        persist();
        repaintPreparedForCurrentState();
        refresh().catch(fail);
      });
    }
  }

  const region = document.querySelector('#region-controls');
  if (region) {
    const section = document.createElement('section');
    section.innerHTML = `<h2>Creature search</h2><label class="npc-role-control" for="npc-role-filter"><span>NPC category</span><select id="npc-role-filter" aria-label="Filter NPCs by map category"><option value="all">All NPCs</option></select></label><input id="creature-search" type="search" placeholder="Search NPCs or monsters" aria-label="Search verified creatures"><div id="creature-results" class="region-results" aria-live="polite"></div><p class="rail-note" id="creature-status">Loading ${CREATURE_SOURCE_LABEL} index…</p>`;
    region.after(section);
    section.querySelector('#creature-search').addEventListener('input', (event) => renderSearch(event.target.value));
    section.querySelector('#npc-role-filter').addEventListener('change', (event) => {
      state.npcRole = npcRoleFilter(event.target.value);
      invalidateInteraction({ closeCard: true });
      persist();
      repaintPreparedForCurrentState();
      refresh().catch(fail);
    });
  }

  const inspectorContent = document.querySelector('#inspector-content');
  if (inspectorContent) {
    const panel = document.createElement('section');
    panel.id = 'creature-inspector';
    panel.className = 'creature-inspector';
    panel.hidden = true;
    inspectorContent.after(panel);
    state.inspector = panel;
    state.gameplayProfiles = createCreatureGameplayProfileService({ baseUrl: GAMEPLAY_ROOT });
    state.gameplayInspector = createCreatureGameplayInspectorController({
      panel,
      baseInspector: inspectorContent,
      tabs: {
        gameplay: document.querySelector('#inspector-tab-gameplay'),
        semantic: document.querySelector('#inspector-tab-semantic'),
        live: document.querySelector('#inspector-tab-live'),
      },
      profileService: state.gameplayProfiles,
      getPlacements: (entityId) => state.lastVisibleRecords.filter((record) => record.entity_id === entityId),
      onSelectTab: (tab) => {
        state.inspectorState = reduceCreatureInspectorState(state.inspectorState, { type: 'select-tab', tab, liveAvailable: false });
        persist();
        renderCreatureInspector(selectedCreatureRecord());
        publish('PASS');
      },
      renderSemantic: renderCreatureSemantic,
    });
    renderCreatureInspector(null);
  }

  cardElement('creature-card-close')?.addEventListener('click', () => closeCreatureCard());
  cardElement('creature-card-details')?.addEventListener('click', openCreatureDetails);
  cardElement('creature-card-copy')?.addEventListener('click', () => copyCreatureLink().catch(fail));
  base.addEventListener('pointermove', (event) => scheduleCreatureHover(event, base));
  base.addEventListener('pointerleave', clearCreatureHover);
  window.addEventListener('oteryn-atlas-map-activate', handleMapActivation);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.cardState.mode !== 'closed') {
      const backdrop = document.querySelector('#mobile-drawer-backdrop');
      if (backdrop && !backdrop.hidden) return;
      closeCreatureCard();
    }
  });

  window.addEventListener('oteryn-atlas-view', (event) => {
    if (!event.detail?.view) return;
    const floorChanged = state.view && event.detail.view.floor !== state.view.floor;
    invalidateInteraction({ closeCard: Boolean(floorChanged) });
    applyView(event.detail.view, event.detail.detailReady, event.detail.effectivePresentation ?? null);
    persist();
    repaintPreparedForCurrentState();
    refresh().catch(fail);
  });
  window.addEventListener('oteryn-atlas-render-committed', (event) => {
    if (!state.index || !state.canvas) return;
    if (event.detail?.generation !== state.interactionBaseGeneration) invalidateInteraction();
    drawCommitted(state.lastVisibleRecords, event.detail).then((count) => {
      if (count != null) { state.lastDrawnRecords = count; publish('PASS'); }
    }).catch(fail);
  });
  window.addEventListener('oteryn-atlas-animation-frame', (event) => {
    state.logicalTimeMs = event.detail.logicalTimeMs;
    if (state.animationOn && state.lastVisibleRecords.length) draw(state.lastVisibleRecords).then((count) => { state.lastDrawnRecords = count; publish('PASS'); }).catch(fail);
  });
  window.addEventListener('resize', () => {
    invalidateInteraction();
    repaintPreparedForCurrentState();
    refresh().catch(fail);
  });
  window.addEventListener('popstate', () => {
    state.inspectorState = parseCreatureInspectorState(new URLSearchParams(location.search), { liveAvailable: false });
    renderCreatureInspector(selectedCreatureRecord());
  });
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
  params.set('inspector', 'gameplay');
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

function presentationView(baseView) {
  if (!baseView) return null;
  return Object.freeze({
    ...baseView,
    mode: state.view?.mode ?? 'auto',
    overview: Boolean(state.view?.overview),
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

function presentationDiagnostics(baseView) {
  if (!state.presentation) return {};
  return state.presentation.commit({
    view: presentationView(baseView),
    detailReady: state.detailReady,
    effectivePresentation: state.effectivePresentation,
    targets: [...state.interactionTargets.values()],
    records: state.interactionRecords,
    selectedId: state.selectedId,
    hoveredId: state.hoveredId,
    activeFilter: state.npcRole,
  });
}

function repaintPresentation() {
  if (!state.presentation || !state.lastRender || !state.lastCommittedBase || !state.lastCanvasMetrics) return;
  if (!sameRendererCommit(state.lastCommittedBase)) return;
  const baseView = rendererView(state.lastCommittedBase);
  if (!baseView) return;
  const presentation = presentationDiagnostics(baseView);
  state.lastDrawnNpcIcons = presentation.drawnNpcIcons ?? 0;
  state.lastRender = createCreatureRenderSnapshot({
    generation: state.lastRender.generation,
    baseGenerationAtStart: state.lastCommittedBase.generation,
    baseGenerationAtCommit: state.lastCommittedBase.generation,
    view: baseView,
    canvas: state.lastCanvasMetrics,
    anchors: state.lastCommittedAnchors,
    ...presentation,
  });
  window.dispatchEvent(new CustomEvent('oteryn-atlas-creature-render-committed', { detail: state.lastRender }));
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

function monsterMarkerRadius(view) {
  return Math.max(3, Math.min(7, view.zoom * 4));
}

function interactionPresentation(item, record, npcSize, view) {
  if (!item.marker) {
    return {
      kind: 'pixel', bitmapWidth: item.bitmap.width, bitmapHeight: item.bitmap.height,
      displacement: item.frame.program.displacement ?? { x: 0, y: 0 }, contentId: item.frame.contentId,
    };
  }
  if (record.kind === 'npc') return { kind: 'marker', width: npcSize, height: npcSize, originRounding: 'nearest' };
  const diameter = monsterMarkerRadius(view) * 2;
  return { kind: 'marker', width: diameter, height: diameter };
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
  const npcSize = Math.round(Math.max(13, Math.min(20, 12 + view.zoom * 2)));
  let pixelDrawn = 0;
  let markerDrawn = 0;
  let drawn = 0;
  const anchors = [];
  const commitEligible = Boolean(committedBase && sameRendererCommit(committedBase));
  const nextCreatureGeneration = commitEligible ? state.renderGeneration + 1 : null;
  const interactionTargets = [];
  const interactionRecords = new Map();
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
    } else if (record.kind === 'monster') {
      const radius = monsterMarkerRadius(view);
      context.beginPath(); context.arc(tileX, tileY, radius, 0, Math.PI * 2);
      context.fillStyle = '#ef476f'; context.fill();
      context.strokeStyle = '#111827'; context.lineWidth = 1.5; context.stroke();
      markerDrawn += 1;
    }
    if (commitEligible) {
      const target = createCreatureInteractionTarget({
        record, view, viewport: { width: rect.width, height: rect.height },
        presentation: interactionPresentation(item, record, npcSize, view),
        auxiliaryRects: [], drawOrder: drawn,
        baseGeneration: committedBase.generation,
        creatureGeneration: nextCreatureGeneration,
      });
      if (target) {
        interactionTargets.push(target);
        interactionRecords.set(record.record_id, record);
      }
    }
  }
  context.restore();
  if (commitEligible) {
    state.renderGeneration = nextCreatureGeneration;
    state.interactionGeneration = `${committedBase.generation}:${state.renderGeneration}`;
    state.interactionBaseGeneration = committedBase.generation;
    state.interactionRecords = interactionRecords;
    state.interactionTargets = new Map(interactionTargets.map((target) => [target.recordId, target]));
    state.interactionIndex = buildCreatureInteractionIndex(interactionTargets, {
      width: rect.width, height: rect.height,
      cellSize: INTERACTION_CELL_SIZE, generation: state.interactionGeneration,
    });
    state.lastCommittedBase = committedBase;
    state.lastCommittedAnchors = anchors;
    state.lastCanvasMetrics = { width: rect.width, height: rect.height, dpr };
    const presentation = presentationDiagnostics(view);
    state.lastDrawnNpcIcons = presentation.drawnNpcIcons ?? 0;
    state.lastRender = createCreatureRenderSnapshot({
      generation: state.renderGeneration,
      baseGenerationAtStart: committedBase.generation,
      baseGenerationAtCommit: committedBase.generation,
      view,
      canvas: state.lastCanvasMetrics,
      anchors,
      ...presentation,
    });
    window.dispatchEvent(new CustomEvent('oteryn-atlas-creature-render-committed', { detail: state.lastRender }));
    if (state.cardState.mode === 'chooser' && state.cardState.generation !== state.interactionGeneration) {
      closeCreatureCard({ publishState: false });
    }
    const reopenId = state.cardState.recordId
      ?? (state.restoreCardFromDeepLink ? state.selectedId : null);
    if (reopenId && state.interactionTargets.has(reopenId)) openCreatureRecord(reopenId);
    else if (state.cardState.mode === 'record') suspendCreatureCard();
  }
  state.pixelDrawnRecords = pixelDrawn;
  state.markerDrawnRecords = markerDrawn;
  if (!commitEligible) state.lastDrawnNpcIcons = state.presentation?.snapshot()?.drawnNpcIcons ?? state.lastDrawnNpcIcons;
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
  if (status) status.textContent = `${CREATURE_SOURCE_LABEL} · ${state.index.counts.records.toLocaleString()} placements · NPC ${npcRoleLabel(state.npcRole)} · ${entries.length} visible shards · ${state.pixelDrawnRecords} pixel / ${state.lastDrawnNpcIcons} NPC icon / ${state.markerDrawnRecords} marker`;
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
    requireValue(index.source?.contract_id === EXPECTED_CREATURE_SOURCE.contractId && index.source?.capability === EXPECTED_CREATURE_SOURCE.capability, 'unsupported creature index authority');
    requireValue(index.source?.semantic_digest === EXPECTED_CREATURE_SOURCE.semanticDigest, 'untrusted creature semantic digest');
    requireValue(index.source?.npc_role_schema_version === EXPECTED_CREATURE_SOURCE.npcRoleSchemaVersion, 'unsupported NPC role schema');
    if (EXPECTED_CREATURE_SOURCE.fixtureId != null) requireValue(index.source?.fixture_id === EXPECTED_CREATURE_SOURCE.fixtureId, 'creature fixture identity mismatch');
    else requireValue(index.source?.fixture_id == null, 'unexpected creature fixture identity');
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
    if (status) status.textContent = `Ready · ${index.counts.records.toLocaleString()} verified creature placements`;
    await waitForInitialView();
    await refresh();
  } catch (error) {
    fail(error);
  }
}

boot();
