const FARM_PARAMS = Object.freeze([
  'item', 'farmSource', 'farmQty', 'farmKph', 'farmKphScope', 'farmTimeBase',
  'farmTask', 'farmCreature', 'farmKills', 'farmView',
]);
const FARM_PARAM_SET = new Set(FARM_PARAMS);
const FARM_VIEWS = new Set(['auto', 'heatmap', 'clusters', 'spawns']);
const TIME_BASES = new Set(['active_hunt', 'hunt_wall', 'trip_wall']);
const KPH_SCOPES = new Set(['qualifying_source_kills', 'credited_target_progress', 'selected_creature_kills']);
const MAX_TARGET = 100_000;
const MAX_IDENTITY = 256;

export class FarmStateError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new FarmStateError(message);
}

function toParams(value) {
  if (value instanceof URLSearchParams) return new URLSearchParams(value);
  requireValue(typeof value === 'string' || value == null, 'farm URL state must be a query string or URLSearchParams');
  return new URLSearchParams((value ?? '').replace(/^\?/, ''));
}

function parseIdentity(value, label) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= MAX_IDENTITY, `${label} identity invalid`);
  requireValue(!/[\\/\u0000-\u001f\u007f]/.test(value), `${label} identity must not be path-shaped or contain controls`);
  return value;
}

function parsePositiveInteger(params, key, { defaultValue = null } = {}) {
  if (!params.has(key)) return defaultValue;
  const raw = params.get(key);
  requireValue(/^\d+$/.test(raw ?? ''), `${key} must be a positive integer`);
  const value = Number(raw);
  requireValue(Number.isSafeInteger(value) && value > 0 && value <= MAX_TARGET, `${key} outside bounded target range`);
  return value;
}

function parseKph(params, mode, hasSource) {
  const keys = ['farmKph', 'farmKphScope', 'farmTimeBase'];
  const present = keys.filter((key) => params.has(key));
  if (present.length === 0) return null;
  requireValue(present.length === keys.length, 'farm KPH requires value, progress scope and time base together');
  const rawValue = params.get('farmKph');
  requireValue(rawValue != null && rawValue.trim() !== '', 'farmKph missing');
  const value = Number(rawValue);
  requireValue(Number.isFinite(value) && value > 0, 'farmKph must be positive and finite');
  const progressScope = params.get('farmKphScope');
  const timeBase = params.get('farmTimeBase');
  requireValue(KPH_SCOPES.has(progressScope), 'farmKphScope unsupported');
  requireValue(TIME_BASES.has(timeBase), 'farmTimeBase unsupported');
  if (mode === 'item') {
    requireValue(hasSource, 'item KPH requires a selected source creature');
    requireValue(progressScope === 'qualifying_source_kills', 'item KPH must count qualifying source kills');
  }
  if (mode === 'creature') requireValue(progressScope === 'selected_creature_kills', 'custom creature KPH must count selected creature kills');
  return { kind: 'manual', value, progress_scope: progressScope, time_base: timeBase };
}

function activeMode(params) {
  const active = [
    ['item', params.has('item')],
    ['task', params.has('farmTask')],
    ['creature', params.has('farmCreature')],
  ].filter(([, present]) => present);
  requireValue(active.length <= 1, 'farm URL state selects contradictory target modes');
  return active.length === 1 ? active[0][0] : 'inactive';
}

function parseView(params) {
  const value = params.get('farmView') ?? 'auto';
  requireValue(FARM_VIEWS.has(value), 'farmView unsupported');
  return value;
}

function rejectModeFields(params, allowed, mode) {
  for (const key of FARM_PARAM_SET) {
    if (!allowed.has(key) && params.has(key)) throw new FarmStateError(`${key} is invalid in ${mode} mode`);
  }
}

export function parseFarmState(value = '') {
  const params = toParams(value);
  const mode = activeMode(params);
  if (mode === 'inactive') {
    const stale = FARM_PARAMS.filter((key) => params.has(key));
    requireValue(stale.length === 0, 'farm parameters require an active target');
    return { mode: 'inactive', view: 'auto', kph: null };
  }
  const view = parseView(params);
  if (mode === 'item') {
    const allowed = new Set(['item', 'farmSource', 'farmQty', 'farmKph', 'farmKphScope', 'farmTimeBase', 'farmView']);
    rejectModeFields(params, allowed, mode);
    const itemId = parseIdentity(params.get('item'), 'item');
    const sourceCreatureId = params.has('farmSource') ? parseIdentity(params.get('farmSource'), 'farm source') : null;
    const state = {
      mode: 'item', item_id: itemId, source_creature_id: sourceCreatureId,
      target_quantity: parsePositiveInteger(params, 'farmQty', { defaultValue: 100 }),
      view,
    };
    state.kph = parseKph(params, mode, Boolean(sourceCreatureId));
    return state;
  }

  if (mode === 'creature') {
    const allowed = new Set(['farmCreature', 'farmKills', 'farmKph', 'farmKphScope', 'farmTimeBase', 'farmView']);
    rejectModeFields(params, allowed, mode);
    const state = {
      mode: 'creature', creature_id: parseIdentity(params.get('farmCreature'), 'creature'),
      target_kills: parsePositiveInteger(params, 'farmKills', { defaultValue: 100 }),
      view,
    };
    state.kph = parseKph(params, mode, false);
    return state;
  }
  const allowed = new Set(['farmTask', 'farmKph', 'farmKphScope', 'farmTimeBase', 'farmView']);
  rejectModeFields(params, allowed, mode);
  const state = {
    mode: 'task', task_id: parseIdentity(params.get('farmTask'), 'task'),
    target_quantity: null, target_kills: null, view,
  };
  const kphKeysPresent = ['farmKph', 'farmKphScope', 'farmTimeBase'].some((key) => params.has(key));
  requireValue(!kphKeysPresent, 'task KPH requires authoritative task semantics before URL parsing');
  state.kph = null;
  return state;
}

function setKph(params, kph) {
  if (kph == null) return;
  requireValue(kph.kind === 'manual', 'serialized Farm Explorer KPH must be a manual assumption');
  requireValue(Number.isFinite(kph.value) && kph.value > 0, 'serialized farm KPH invalid');
  requireValue(KPH_SCOPES.has(kph.progress_scope), 'serialized KPH progress scope invalid');
  requireValue(TIME_BASES.has(kph.time_base), 'serialized KPH time base invalid');
  params.set('farmKph', String(kph.value));
  params.set('farmKphScope', kph.progress_scope);
  params.set('farmTimeBase', kph.time_base);
}

function clearFarmParams(params) {
  for (const key of FARM_PARAMS) params.delete(key);
}
export function serializeFarmState(state, base = '') {
  requireValue(state && typeof state === 'object' && !Array.isArray(state), 'farm state must be an object');
  const params = toParams(base);
  clearFarmParams(params);
  if (state.mode === 'inactive') return params;
  requireValue(FARM_VIEWS.has(state.view), 'serialized farm view invalid');
  params.set('farmView', state.view);

  if (state.mode === 'item') {
    params.set('item', parseIdentity(state.item_id, 'item'));
    if (state.source_creature_id != null) params.set('farmSource', parseIdentity(state.source_creature_id, 'farm source'));
    requireValue(Number.isSafeInteger(state.target_quantity) && state.target_quantity > 0 && state.target_quantity <= MAX_TARGET, 'serialized item target invalid');
    if (state.target_quantity !== 100) params.set('farmQty', String(state.target_quantity));
    if (state.kph != null) {
      requireValue(state.source_creature_id != null, 'serialized item KPH requires source creature');
      requireValue(state.kph.progress_scope === 'qualifying_source_kills', 'serialized item KPH scope invalid');
      setKph(params, state.kph);
    }
  } else if (state.mode === 'creature') {
    params.set('farmCreature', parseIdentity(state.creature_id, 'creature'));
    requireValue(Number.isSafeInteger(state.target_kills) && state.target_kills > 0 && state.target_kills <= MAX_TARGET, 'serialized kill target invalid');
    if (state.target_kills !== 100) params.set('farmKills', String(state.target_kills));
    if (state.kph != null) {
      requireValue(state.kph.progress_scope === 'selected_creature_kills', 'serialized creature KPH scope invalid');
      setKph(params, state.kph);
    }
  } else if (state.mode === 'task') {
    params.set('farmTask', parseIdentity(state.task_id, 'task'));
    requireValue(state.kph == null, 'serialized task KPH requires authoritative task semantics');
    requireValue(state.target_quantity == null && state.target_kills == null, 'serialized task state must not invent authoritative target');
  } else {
    throw new FarmStateError('unsupported farm state mode');
  }
  return params;
}
