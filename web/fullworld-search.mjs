import {
  displayFloor,
  navigationSearchParams,
  searchSemanticIndex,
  validateSemanticSearchIndex,
} from '../src/browser/semantic-search.mjs';

const INDEX_URL = new URL('./semantic-search/index.json', import.meta.url);
const CREATURE_ROOT = new URL('../data/creatures/', import.meta.url);
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_CREATURE_INDEX_BYTES = 4 * 1024 * 1024;
const MAX_CREATURE_SEARCH_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 12;
const state = { index: null, creatureSearch: [], active: null, lastQuery: '', lastResults: 0, status: 'LOADING' };

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

function publish(error = null) {
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
  const fromUrl = Number(params.get('floor'));
  if (Number.isSafeInteger(fromUrl)) return fromUrl;
  const fromUi = Number(document.querySelector('#coord-floor')?.textContent);
  return Number.isSafeInteger(fromUi) ? fromUi : null;
}

function kindLabel(kind) {
  return ({ npc: 'NPC', monster: 'Monster / Spawn', town: 'Town', waypoint: 'Waypoint', poi: 'POI', teleport: 'Teleport', house: 'House', quest_area: 'Quest area', mechanic: 'Mechanic', position: 'Position' })[kind] ?? kind;
}

function creaturePrefix(raw) {
  const match = String(raw).trim().match(/^(npc|monster)\s*:\s*(.*)$/i);
  if (match) return { kind: match[1].toLowerCase(), query: match[2].trim().toLowerCase() };
  if (/^id\s*:/i.test(String(raw))) return { kind: 'none', query: '' };
  return { kind: null, query: String(raw).trim().toLowerCase() };
}

function supplementalCreatureResults(raw, existingKeys) {
  const { kind, query } = creaturePrefix(raw);
  if (kind === 'none' || !query) return [];
  const output = [];
  for (const source of state.creatureSearch) {
    if (kind && source.kind !== kind) continue;
    const label = String(source.label ?? '');
    const folded = label.toLowerCase();
    let score = -1;
    if (folded === query) score = 950;
    else if (folded.startsWith(query)) score = 760;
    else if (folded.includes(query)) score = 550;
    if (score < 0) continue;
    const key = `${source.kind}:${folded}:${source.position?.floor}:${source.position?.x}:${source.position?.y}`;
    if (existingKeys.has(key)) continue;
    output.push({
      kind: source.kind, id: null, label, aliases: [], position: source.position, bounds: null,
      provenance: { authority: 'Oteryn/Oteryn-Game', source_capability: 'static-creatures-v1', resolution_state: source.resolution_state },
      capabilities: ['static-placement'], score,
    });
  }
  output.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return output.slice(0, MAX_RESULTS);
}

function queryAll(raw) {
  const primary = searchSemanticIndex(state.index, raw, { limit: MAX_RESULTS, currentFloor: currentFloor() });
  if (primary.mode === 'coordinate') return primary.results;
  const keys = new Set(primary.results.map((record) => `${record.kind}:${record.label.toLowerCase()}:${record.position.floor}:${record.position.x}:${record.position.y}`));
  const supplement = supplementalCreatureResults(raw, keys);
  return [...primary.results, ...supplement]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, MAX_RESULTS);
}

function navigate(record, rawQuery) {
  const params = navigationSearchParams(record, location.search, state.index, rawQuery);
  location.search = params.toString();
}

function renderResults(host, raw) {
  host.replaceChildren();
  const query = String(raw).trim();
  state.lastQuery = query;
  if (!query || !state.index) {
    host.hidden = true;
    state.lastResults = 0;
    publish();
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
  input.placeholder = suffix === 'mobile' ? 'Search NPC, town or coordinates' : 'Search NPC, town, coordinates or type:query';
  input.setAttribute('aria-label', 'Global semantic Atlas search');
  input.addEventListener('input', () => renderResults(host, input.value));
  input.addEventListener('focus', () => { if (input.value.trim()) renderResults(host, input.value); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    renderResults(host, input.value);
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
  const id = document.createElement('p'); id.textContent = `Stable export id: ${record.id}`;
  const caps = document.createElement('p'); caps.textContent = `Public capabilities: ${record.capabilities.length ? record.capabilities.join(', ') : 'none published'}`;
  const source = document.createElement('p'); source.textContent = `Source: Oteryn/Oteryn-Game@${state.index.source.game_revision.slice(0, 12)} · ${state.index.source.profile_id}`;
  const bounds = document.createElement('p'); bounds.textContent = record.bounds ? 'Authoritative bounds published.' : 'Authoritative bounds: not published by Game.';
  inspector.replaceChildren(card, position, id, caps, bounds, source);
  addActiveLayer(record);
}

async function loadCreatureSearch() {
  try {
    const index = await boundedJson(new URL('index.json', CREATURE_ROOT), MAX_CREATURE_INDEX_BYTES);
    requireValue(index.source?.contract_id === 'oteryn-game-atlas-export-v1' && index.source?.capability === 'static-creatures-v1', 'creature search source unsupported');
    const search = await boundedJson(new URL(index.search_path, CREATURE_ROOT), MAX_CREATURE_SEARCH_BYTES);
    requireValue(Array.isArray(search.records) && search.records.length <= 20000, 'creature search record count invalid');
    return search.records.filter((record) => (record.kind === 'npc' || record.kind === 'monster') && record.position && Number.isSafeInteger(record.position.x) && Number.isSafeInteger(record.position.y) && Number.isSafeInteger(record.position.floor));
  } catch (error) {
    console.info(`Optional creature search extension unavailable: ${error.message ?? error}`);
    return [];
  }
}

async function boot() {
  injectStyle();
  wireForm('#search-form', '#search-input', 'desktop');
  wireForm('#mobile-search-form', '#mobile-search-input', 'mobile');
  const raw = await boundedJson(INDEX_URL, MAX_INDEX_BYTES);
  state.index = validateSemanticSearchIndex(raw);
  state.creatureSearch = await loadCreatureSearch();
  const activeId = new URLSearchParams(location.search).get('semantic');
  state.active = activeId ? state.index.records.find((record) => record.id === activeId) ?? null : null;
  state.status = 'PASS';
  renderActiveInspector();
  window.addEventListener('oteryn-atlas-view', () => renderActiveInspector());
  publish();
}

boot().catch((error) => {
  state.status = 'FAIL';
  publish(error);
  console.error(error);
});
