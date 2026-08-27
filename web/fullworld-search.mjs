import {
  displayFloor,
  navigationSearchParams,
  searchSemanticIndex,
  validateSemanticSearchIndex,
} from '../src/browser/semantic-search.mjs';
import {
  findCreatureById,
  searchCreatureRecords,
  validateCreatureSearchCatalog,
} from '../src/browser/creature-search.mjs';
import { FULLWORLD_TRUST, ancillarySourceExpectations } from '../src/browser/fullworld-trust.mjs';

const INDEX_URL = new URL('./semantic-search/index.json', import.meta.url);
const CREATURE_SEARCH_URL = new URL('./semantic-search/creatures.json', import.meta.url);
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_CREATURE_SEARCH_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 12;
const ancillarySources = ancillarySourceExpectations(FULLWORLD_TRUST);
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

function injectStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .search,.mobile-search{position:relative}
    .semantic-search-results{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:40;display:grid;gap:2px;max-height:min(440px,60vh);overflow:auto;padding:6px;background:#111923;border:1px solid #34475a;border-radius:8px;box-shadow:0 16px 40px #000a}
    .semantic-search-results[hidden]{display:none}
    .semantic-search-result{display:grid;grid-template-columns:1fr auto;gap:2px 12px;width:100%;padding:9px 10px;text-align:left;background:transparent;border:0;border-radius:5px;color:inherit;cursor:pointer}
    .semantic-search-result:hover,.semantic-search-result:focus-visible{background:#ffffff12;outline:1px solid #ffffff22}
    .semantic-search-result strong{font-size:13px}.semantic-search-result .kind{font-size:10px;letter-spacing:.08em;text-transform:uppercase;opacity:.72}
    .semantic-search-result small{grid-column:1/-1;opacity:.68;font-variant-numeric:tabular-nums}
    .semantic-search-unavailable{display:block;padding:9px 10px;color:#e7ba78;line-height:1.4}
    .semantic-active-layer{outline:1px solid #ffffff20}
    @media(max-width:760px){.semantic-search-results{position:static;margin-top:6px;max-height:36vh}}
  `;
  document.head.append(style);
}

function resultHost(form, suffix) {
  const host = document.createElement('div');
  host.className = 'semantic-search-results';
  host.id = `semantic-search-results-${suffix}`;
  host.hidden = true;
  host.setAttribute('role', 'listbox');
  form.append(host);
  return host;
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
  return record.id ?? `${record.kind}:${record.label.toLowerCase()}:${record.position.floor}:${record.position.x}:${record.position.y}`;
}

function queryAll(raw) {
  const primary = searchSemanticIndex(state.index, raw, { limit: MAX_RESULTS, currentFloor: currentFloor() });
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

function hideResults(host) {
  host.replaceChildren();
  host.hidden = true;
  state.lastResults = 0;
  publish();
}

function renderUnavailable(host) {
  host.replaceChildren();
  const note = document.createElement('small');
  note.className = 'semantic-search-unavailable';
  note.setAttribute('role', 'status');
  note.textContent = `Search unavailable: ${state.error?.message ?? 'verified search data unavailable.'}`;
  host.append(note);
  host.hidden = false;
  state.lastResults = 0;
  publish();
}

function renderResults(host, raw) {
  host.replaceChildren();
  const query = String(raw).trim();
  state.lastQuery = query;
  if (!query) {
    hideResults(host);
    return;
  }
  if (state.status === 'FAIL' || !state.index) {
    renderUnavailable(host);
    return;
  }
  let results;
  try {
    results = queryAll(query);
  } catch (error) {
    const note = document.createElement('small');
    note.textContent = error.message ?? String(error);
    host.append(note);
    host.hidden = false;
    state.lastResults = 0;
    publish();
    return;
  }
  state.lastResults = results.length;
  if (!results.length) {
    const note = document.createElement('small');
    note.textContent = 'No published semantic result.';
    host.append(note);
  }
  for (const record of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'semantic-search-result';
    button.setAttribute('role', 'option');
    const label = document.createElement('strong');
    label.textContent = record.label;
    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = kindLabel(record.kind);
    const coords = document.createElement('small');
    coords.textContent = `${record.position.x}, ${record.position.y}, ${displayFloor(record.position.floor, state.index)}`;
    button.append(label, kind, coords);
    button.addEventListener('click', () => navigate(record, query));
    host.append(button);
  }
  host.hidden = false;
  publish();
}

function wireForm(formId, inputId, suffix) {
  const form = document.querySelector(formId);
  const input = document.querySelector(inputId);
  if (!form || !input) return;
  const host = resultHost(form, suffix);
  input.placeholder = suffix === 'mobile' ? 'Search city, NPC, monster, ID or coordinates' : 'Search city, NPC, monster, ID or coordinates';
  input.setAttribute('aria-label', 'Global semantic Atlas search');
  input.addEventListener('input', () => renderResults(host, input.value));
  input.addEventListener('focus', () => { if (input.value.trim()) renderResults(host, input.value); });
  form.addEventListener('submit', (event) => {
    const query = input.value;
    if (state.index) {
      try {
        const primary = searchSemanticIndex(state.index, query, { limit: MAX_RESULTS, currentFloor: currentFloor() });
        if (primary.mode === 'coordinate') {
          hideResults(host);
          return;
        }
      } catch {}
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    renderResults(host, query);
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
  const card = document.createElement('div'); card.className = 'position-card';
  const title = document.createElement('strong'); title.textContent = record.label;
  const type = document.createElement('span'); type.textContent = kindLabel(record.kind);
  card.append(title, type);
  const position = document.createElement('p'); position.textContent = `Position: ${record.position.x}, ${record.position.y}, ${displayFloor(record.position.floor, state.index)} (native floor ${record.position.floor})`;
  const id = document.createElement('p'); id.textContent = `Stable public id: ${record.id}`;
  const recordId = record.record_id && record.record_id !== record.id ? document.createElement('p') : null;
  if (recordId) recordId.textContent = `Placement record id: ${record.record_id}`;
  const caps = document.createElement('p'); caps.textContent = `Public capabilities: ${record.capabilities.length ? record.capabilities.join(', ') : 'none published'}`;
  const source = document.createElement('p');
  const provenanceAuthority = record.provenance?.authority ?? state.index.source.authority;
  const provenanceCapability = record.provenance?.source_capability;
  source.textContent = provenanceCapability
    ? `Source: ${provenanceAuthority} ? ${provenanceCapability}`
    : `Source: ${state.index.source.repository}@${state.index.source.game_revision.slice(0, 12)} ? ${state.index.source.profile_id}`;
  const bounds = document.createElement('p'); bounds.textContent = record.bounds ? 'Authoritative bounds published.' : 'Authoritative bounds: not published by Game.';
  inspector.replaceChildren(card, position, id);
  if (recordId) inspector.append(recordId);
  inspector.append(caps, bounds, source);
  addActiveLayer(record);
}

async function loadCreatureSearch() {
  const catalog = await boundedJson(CREATURE_SEARCH_URL, MAX_CREATURE_SEARCH_BYTES);
  return validateCreatureSearchCatalog(catalog, ancillarySources.semanticSearch).records;
}

async function boot() {
  injectStyle();
  wireForm('#search-form', '#search-input', 'desktop');
  wireForm('#mobile-search-form', '#mobile-search-input', 'mobile');
  const raw = await boundedJson(INDEX_URL, MAX_INDEX_BYTES);
  state.index = validateSemanticSearchIndex(raw, ancillarySources.semanticSearch);
  state.creatureSearch = await loadCreatureSearch();
  const params = new URLSearchParams(location.search);
  const activeId = params.get('semantic');
  const creatureId = params.get('creature');
  state.active = activeId ? state.index.records.find((record) => record.id === activeId) ?? findCreatureById(state.creatureSearch, activeId) : null;
  if (!state.active && creatureId) state.active = findCreatureById(state.creatureSearch, creatureId);
  state.status = 'PASS';
  state.error = null;
  renderActiveInspector();
  window.addEventListener('oteryn-atlas-view', () => renderActiveInspector());
  window.addEventListener('oteryn-atlas-inspector-rendered', () => renderActiveInspector());
  publish();
}

boot().catch((error) => {
  state.status = 'FAIL';
  state.error = error;
  publish();
  console.error(error);
});
