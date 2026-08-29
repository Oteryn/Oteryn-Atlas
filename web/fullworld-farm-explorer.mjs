import { findCreatureById, validateCreatureSearchCatalog } from '../src/browser/creature-search.mjs';
import { FULLWORLD_TRUST, ancillarySourceExpectations } from '../src/browser/fullworld-trust.mjs';
import { estimateKillTarget } from '../src/browser/farm-intelligence.mjs';
import { parseFarmState, serializeFarmState } from '../src/browser/farm-state.mjs';

const CREATURE_SEARCH_URL = new URL('./semantic-search/creatures.json', import.meta.url);
const ancillarySources = ancillarySourceExpectations(FULLWORLD_TRUST);
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 10;
const TIME_BASES = new Set(['active_hunt', 'hunt_wall', 'trip_wall']);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function frozenState(state, trustClass, message) {
  return Object.freeze({ state, trust_class: trustClass, message });
}
export function buildFarmUiReadiness({ farmPublicationAvailable = false, interactionSeamAvailable = false, presentationSeamAvailable = false } = {}) {
  const itemTask = farmPublicationAvailable
    ? frozenState('AVAILABLE', 'VERIFIED', 'Accepted Game farm-intelligence publication is available.')
    : frozenState('UPSTREAM_BLOCKED', 'UNKNOWN', 'Accepted Game farm-intelligence publication is not available.');
  const mapInteraction = interactionSeamAvailable
    ? frozenState('AVAILABLE', 'VERIFIED', 'Canonical creature-interaction-v1 map seam is available.')
    : frozenState('DEPENDENCY_BLOCKED', 'UNKNOWN', 'Canonical creature interaction seam is unavailable.');
  const presentationEnrichment = presentationSeamAvailable
    ? frozenState('AVAILABLE', 'VERIFIED', 'Canonical creature presentation enrichment is available.')
    : frozenState('DEPENDENCY_BLOCKED', 'UNKNOWN', 'Creature label/badge presentation enrichment remains owned by #115 and is not duplicated by Farm Explorer.');
  return Object.freeze({ item_task: itemTask, map_interaction: mapInteraction, presentation_enrichment: presentationEnrichment,
    custom_kill: frozenState('AVAILABLE', 'ESTIMATE', 'Custom kill estimate uses an explicit manual credited-progress KPH assumption.') });
}

export function validateFarmCreatureCatalog(catalog) {
  return validateCreatureSearchCatalog(catalog, ancillarySources.semanticSearch).records;
}

export function searchFarmMonsterTargets(records, query, { limit = MAX_RESULTS } = {}) {
  requireValue(Array.isArray(records), 'creature records must be an array');
  requireValue(Number.isSafeInteger(limit) && limit > 0 && limit <= MAX_RESULTS, 'monster search limit invalid');
  const needle = String(query ?? '').trim().toLocaleLowerCase('en-US');
  if (!needle) return Object.freeze([]);
  const matches = records
    .filter((record) => record.kind === 'monster' && record.resolution_state === 'RESOLVED' && typeof record.entity_id === 'string' && record.entity_id.startsWith('monster-entity:'))
    .filter((record) => record.label.toLocaleLowerCase('en-US').includes(needle) || record.entity_id === query)
    .sort((a, b) => a.label.localeCompare(b.label) || a.entity_id.localeCompare(b.entity_id))
    .slice(0, limit);
  return Object.freeze(matches.map((record) => Object.freeze({ ...record })));
}
export function customKillEstimate({ targetKills, kph = null, timeBase = 'active_hunt' }) {
  requireValue(Number.isSafeInteger(targetKills) && targetKills > 0 && targetKills <= 100_000, 'custom kill target invalid');
  if (kph == null) return estimateKillTarget({ targetKills, progressScope: 'selected_creature_kills' });
  requireValue(typeof kph === 'number' && Number.isFinite(kph) && kph > 0, 'custom kill KPH invalid');
  requireValue(TIME_BASES.has(timeBase), 'custom kill time base unsupported');
  return estimateKillTarget({
    targetKills,
    kph: { kind: 'manual', value: kph, progress_scope: 'selected_creature_kills', time_base: timeBase },
    progressScope: 'selected_creature_kills',
  });
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
const interactionSeamAvailable = globalThis.__OTERYN_ATLAS_CREATURES__?.interactionVersion === 'creature-interaction-v1';
const runtime = { records: [], selected: null, readiness: buildFarmUiReadiness({ interactionSeamAvailable, presentationSeamAvailable: false }), error: null };

function byId(id) { return document.getElementById(id); }
function positiveInt(value, fallback = 100) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : fallback;
}
function positiveNumber(value) {
  if (String(value ?? '').trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function findSelectedMapMonster(records, value = '') {
  requireValue(Array.isArray(records), 'creature records must be an array');
  const params = value instanceof URLSearchParams ? value : new URLSearchParams(String(value ?? '').replace(/^\?/, ''));
  const selected = params.get('creature');
  if (!selected) return null;
  const record = findCreatureById(records, selected);
  return usableMonster(record) ? record : null;
}

function selectedFromUrl() {
  const params = new URLSearchParams(location.search);
  const farmState = (() => { try { return parseFarmState(params); } catch { return { mode: 'inactive', view: 'auto', kph: null }; } })();
  if (farmState.mode === 'creature') return findCreatureById(runtime.records, farmState.creature_id);
  return findSelectedMapMonster(runtime.records, params);
}
function usableMonster(record) {
  return record?.kind === 'monster' && (record.resolution_state ?? record.provenance?.resolution_state) === 'RESOLVED' && typeof record.entity_id === 'string' && record.entity_id.startsWith('monster-entity:');
}

function pushCreatureState(record) {
  requireValue(usableMonster(record), 'custom kill target requires a resolved monster entity');
  const targetKills = positiveInt(byId('farm-target-kills')?.value, 100);
  const kph = positiveNumber(byId('farm-kph')?.value);
  const timeBase = byId('farm-time-base')?.value ?? 'active_hunt';
  const state = {
    mode: 'creature', creature_id: record.entity_id, target_kills: targetKills, view: 'auto',
    kph: kph == null ? null : { kind: 'manual', value: kph, progress_scope: 'selected_creature_kills', time_base: timeBase },
  };
  const params = serializeFarmState(state, location.search);
  history.pushState({}, '', `${location.pathname}?${params.toString()}${location.hash}`);
  runtime.selected = record;
  renderCustomKill();
}
function renderMonsterResults() {
  const host = byId('farm-creature-results');
  const input = byId('farm-creature-search');
  if (!host || !input) return;
  host.replaceChildren();
  const results = searchFarmMonsterTargets(runtime.records, input.value);
  for (const record of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'farm-creature-result';
    button.textContent = record.label;
    button.title = record.entity_id;
    button.addEventListener('click', () => pushCreatureState(record));
    host.append(button);
  }
  host.hidden = results.length === 0;
}

function renderCustomKill() {
  const selectedHost = byId('farm-selected-creature');
  const estimateHost = byId('farm-estimate-output');
  if (!selectedHost || !estimateHost) return;
  const selected = runtime.selected;
  selectedHost.textContent = usableMonster(selected)
    ? `${selected.label} · ${selected.entity_id}`
    : 'No resolved monster selected.';
  estimateHost.replaceChildren();
  if (!usableMonster(selected)) return;
  const targetKills = positiveInt(byId('farm-target-kills')?.value, 100);
  const kph = positiveNumber(byId('farm-kph')?.value);
  const timeBase = byId('farm-time-base')?.value ?? 'active_hunt';
  try {
    const estimate = customKillEstimate({ targetKills, kph, timeBase });
    const target = document.createElement('p');
    target.textContent = `Target: ${estimate.target_kills.toLocaleString()} selected creature kills`;
    estimateHost.append(target);
    if (typeof estimate.estimated_hours === 'number') {
      const time = document.createElement('p');
      time.textContent = `ESTIMATE · ${estimate.estimated_hours.toFixed(2)} h at ${estimate.kph_value.toLocaleString()} selected creature kills/h (${estimate.time_base})`;
      estimateHost.append(time);
    } else {
      const note = document.createElement('p');
      note.textContent = 'ESTIMATE · enter an explicit selected creature kills/hour assumption to calculate time.';
      estimateHost.append(note);
    }
  } catch (error) {
    const note = document.createElement('p');
    note.textContent = `UNAVAILABLE · ${error.message ?? error}`;
    estimateHost.append(note);
  }
}
function syncInputsFromUrl() {
  let state;
  try { state = parseFarmState(location.search); } catch { state = { mode: 'inactive', view: 'auto', kph: null }; }
  if (state.mode === 'creature') {
    if (byId('farm-target-kills')) byId('farm-target-kills').value = String(state.target_kills);
    if (byId('farm-kph')) byId('farm-kph').value = state.kph ? String(state.kph.value) : '';
    if (byId('farm-time-base')) byId('farm-time-base').value = state.kph?.time_base ?? 'active_hunt';
  }
  runtime.selected = selectedFromUrl();
  renderCustomKill();
}

function publish() {
  globalThis.__OTERYN_ATLAS_FARM__ = Object.freeze({
    status: runtime.error ? 'FAIL' : 'PASS',
    itemTaskState: runtime.readiness.item_task.state,
    mapInteractionState: runtime.readiness.map_interaction.state,
    presentationEnrichmentState: runtime.readiness.presentation_enrichment.state,
    customKillState: runtime.readiness.custom_kill.state,
    creatureCatalogRecords: runtime.records.length,
    selectedCreatureId: usableMonster(runtime.selected) ? runtime.selected.entity_id : null,
    error: runtime.error ? String(runtime.error.message ?? runtime.error) : null,
  });
}
async function bootFarmExplorer() {
  if (typeof document === 'undefined') return;
  const panel = byId('farm-explorer');
  if (!panel) return;
  const raw = await boundedJson(CREATURE_SEARCH_URL, MAX_CATALOG_BYTES);
  runtime.records = validateFarmCreatureCatalog(raw);
  byId('farm-creature-search')?.addEventListener('input', renderMonsterResults);
  byId('farm-estimate-button')?.addEventListener('click', () => {
    if (usableMonster(runtime.selected)) pushCreatureState(runtime.selected);
    else renderCustomKill();
  });
  byId('farm-use-selected')?.addEventListener('click', () => {
    const current = findSelectedMapMonster(runtime.records, location.search);
    if (usableMonster(current)) pushCreatureState(current);
  });
  window.addEventListener('popstate', () => { syncInputsFromUrl(); publish(); });
  syncInputsFromUrl();
  publish();
}

bootFarmExplorer().catch((error) => {
  runtime.error = error;
  const host = typeof document === 'undefined' ? null : byId('farm-estimate-output');
  if (host) host.textContent = `UNAVAILABLE · ${error.message ?? error}`;
  if (typeof console !== 'undefined') console.error(error);
  if (typeof globalThis !== 'undefined') publish();
});
