import {
  displayFloor,
  navigationSearchParams,
  searchSemanticIndex,
  validateSemanticSearchIndex,
} from '../src/browser/semantic-search.mjs';
import {
  findCreatureById,
  searchCreatureRecords,
  validateCreatureSearchRecords,
} from '../src/browser/creature-search.mjs';
import { ancillarySourceExpectations, FULLWORLD_TRUST } from '../src/browser/fullworld-trust.mjs';

import { createSearchView, renderEntitySummary } from './fullworld-search-view.mjs';

const views = [];
const INDEX_URL = new URL('./semantic-search/index.json', import.meta.url);
const CREATURE_SEARCH_URL = new URL('./semantic-search/creatures.json', import.meta.url);
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_CREATURE_SEARCH_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 12;
const SOURCE_EXPECTATIONS = ancillarySourceExpectations(FULLWORLD_TRUST);
const state = { index: null, creatureSearch: [], active: null, lastQuery: '', lastResults: 0, status: 'LOADING', error: null };

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function boundedJson(url, maxBytes) {
  const response = await fetch(url, { cache: 'no-store' });
  requireValue(response.ok, `${url.pathname} HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared) requireValue(declared <= maxBytes, `${url.pathname} exceeds byte limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= maxBytes, `${url.pathname} exceeds byte limit`);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function publish(error = state.error) {
  globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__ = Object.freeze({
    status: error ? 'FAIL' : state.status,
    records: state.index?.records?.length ?? 0,
    creatureSearchRecords: state.creatureSearch.length,
    activeId: state.active?.id ?? null,
    lastQuery: state.lastQuery,
    lastResults: state.lastResults,
    error: error ? String(error.message ?? error) : null,
  });
}

function currentFloor() {
  const params = new URLSearchParams(location.search);
  if (params.has('floor')) {
    const fromUrl = Number(params.get('floor'));
    if (Number.isSafeInteger(fromUrl)) return fromUrl;
  }
  const fromUi = Number(document.querySelector('#coord-floor')?.textContent);
  return Number.isSafeInteger(fromUi) ? fromUi : null;
}

function kindLabel(kind) {
  return ({ npc: 'NPC', monster: 'Monster / Spawn', town: 'Town', waypoint: 'Waypoint', poi: 'POI', teleport: 'Teleport', house: 'House', quest_area: 'Quest area', mechanic: 'Mechanic', position: 'Position' })[kind] ?? kind;
}

function resultIdentity(record) {
  return record.record_id ?? record.id ?? `${record.kind}:${record.label.toLowerCase()}:${record.position.floor}:${record.position.x}:${record.position.y}`;
}

function queryAll(raw) {
  const primary = searchSemanticIndex(state.index, raw, {
    limit: MAX_RESULTS,
    currentFloor: currentFloor(),
    expectedSource: SOURCE_EXPECTATIONS.semanticSearch,
  });
  if (primary.mode === 'coordinate') return primary.results;
  const existing = new Set(primary.results.map(resultIdentity));
  const supplement = searchCreatureRecords(state.creatureSearch, raw, { limit: MAX_RESULTS })
    .filter((record) => !existing.has(resultIdentity(record)));
  return [...primary.results, ...supplement]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label) || resultIdentity(a).localeCompare(resultIdentity(b)))
    .slice(0, MAX_RESULTS);
}

function navigate(record, rawQuery) {
  const params = navigationSearchParams(record, location.search, state.index, rawQuery);
  if (record.record_id) params.set('creature', record.record_id);
  else params.delete('creature');
  location.search = params.toString();
}

function hideResults(view) {
  view.close();
  state.lastResults = 0;
  publish();
}

function renderResults(view, raw) {
  const query = String(raw).trim();
  state.lastQuery = query;
  state.lastResults = 0;
  if (!query) view.close();
  else if (state.status === 'LOADING') view.show({ phase: 'loading', query });
  else if (state.status === 'FAIL' || !state.index) {
    view.show({ phase: 'unavailable', query, detail: String(state.error?.message ?? 'Verified search data unavailable.') });
  } else {
    try {
      const results = queryAll(query);
      state.lastResults = results.length;
      view.show({ phase: results.length ? 'results' : 'empty', query, results });
    } catch (error) {
      view.show({ phase: 'invalid', query, detail: String(error.message ?? error) });
    }
  }
  publish();
}

function wireForm(formId, inputId, suffix) {
  const form = document.querySelector(formId);
  const input = document.querySelector(inputId);
  if (!form || !input) return;
  const view = createSearchView({
    form, input, id: suffix,
    describe: record => ({
      type: kindLabel(record.kind),
      position: `${record.position.x}, ${record.position.y} · ${displayFloor(record.position.floor, state.index)}`,
    }),
    onQuery: raw => renderResults(view, raw),
    onChoose: navigate,
    onClose: () => { state.lastResults = 0; publish(); },
  });
  views.push(view);
  form.addEventListener('submit', (event) => {
    const query = input.value;
    if (state.index) {
      try {
        const primary = searchSemanticIndex(state.index, query, {
          limit: MAX_RESULTS,
          currentFloor: currentFloor(),
          expectedSource: SOURCE_EXPECTATIONS.semanticSearch,
        });
        if (primary.mode === 'coordinate') {
          hideResults(view);
          return;
        }
      } catch {}
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    renderResults(view, query);
  }, true);
}

function addActiveLayer(record) {
  const host = document.querySelector('#semantic-layer-list');
  if (!host || !record) return;
  const existing = host.querySelector('[data-semantic-search-layer]');
  if (existing) existing.remove();
  const row = document.createElement('label');
  row.className = 'layer active semantic-active-layer';
  row.dataset.semanticSearchLayer = record.kind;
  const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.disabled = true;
  const name = document.createElement('span'); name.className = 'layer-name'; name.textContent = `${kindLabel(record.kind)} · ${record.label}`;
  const status = document.createElement('span'); status.textContent = 'SEARCH';
  row.append(input, name, status); host.append(row);
}

function renderActiveInspector() {
  const record = state.active;
  const inspector = document.querySelector('#inspector-content');
  const pill = document.querySelector('#inspector-pill');
  if (!record || !inspector || !pill) return;
  pill.textContent = kindLabel(record.kind).toUpperCase();
  pill.className = 'pill ok';
  const source = record.provenance?.source_capability === 'static-creatures-v1'
    ? 'Oteryn/Oteryn-Game · static-creatures-v1'
    : `Oteryn/Oteryn-Game@${state.index.source.game_revision.slice(0, 12)} · ${state.index.source.profile_id}`;
  renderEntitySummary({
    host: inspector, record, type: kindLabel(record.kind), source,
    position: `${record.position.x}, ${record.position.y} · ${displayFloor(record.position.floor, state.index)}`,
  });
  addActiveLayer(record);
}

async function loadCreatureSearch() {
  const catalog = await boundedJson(CREATURE_SEARCH_URL, MAX_CREATURE_SEARCH_BYTES);
  const expected = SOURCE_EXPECTATIONS.semanticSearch;
  requireValue(catalog.schema_version === 1, 'unsupported creature search catalog schema');
  requireValue(catalog.source?.contract_id === expected.creatureContractId && catalog.source?.capability === expected.creatureCapability, 'creature search source unsupported');
  requireValue(catalog.source?.semantic_digest === expected.creatureSemanticDigest, 'untrusted creature search semantic digest');
  requireValue(catalog.source?.coordinate_profile === 'oteryn-native-floor-v1', 'creature search coordinate profile unsupported');
  if (expected.fixtureId == null) requireValue(catalog.source?.fixture_id == null, 'production creature search source must not claim fixture identity');
  else requireValue(catalog.source?.fixture_id === expected.fixtureId, 'creature search fixture identity invalid');
  return validateCreatureSearchRecords(catalog.records);
}

async function boot() {
  wireForm('#search-form', '#search-input', 'desktop');
  wireForm('#mobile-search-form', '#mobile-search-input', 'mobile');
  const raw = await boundedJson(INDEX_URL, MAX_INDEX_BYTES);
  state.index = validateSemanticSearchIndex(raw, SOURCE_EXPECTATIONS.semanticSearch);
  state.creatureSearch = await loadCreatureSearch();
  const params = new URLSearchParams(location.search);
  const activeId = params.get('semantic');
  const creatureId = params.get('creature');
  state.active = activeId ? state.index.records.find((record) => record.id === activeId) ?? findCreatureById(state.creatureSearch, activeId) : null;
  if (!state.active && creatureId) state.active = findCreatureById(state.creatureSearch, creatureId);
  state.status = 'PASS';
  state.error = null;
  views.forEach(view => view.refresh());
  renderActiveInspector();
  if (state.active && !matchMedia('(max-width: 980px)').matches) window.dispatchEvent(new CustomEvent('oteryn-atlas-open-inspector'));
  window.addEventListener('oteryn-atlas-view', () => renderActiveInspector());
  window.addEventListener('oteryn-atlas-inspector-rendered', () => renderActiveInspector());
  publish();
}

boot().catch((error) => {
  state.status = 'FAIL';
  state.error = error;
  views.forEach(view => view.refresh());
  publish();
  console.error(error);
});
