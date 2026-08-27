const TABS = new Set(['gameplay', 'semantic', 'live']);

function normalizeTab(value, { liveAvailable = false } = {}) {
  if (!TABS.has(value)) return 'gameplay';
  if (value === 'live' && !liveAvailable) return 'gameplay';
  return value;
}

export function parseCreatureInspectorState(params, options = {}) {
  if (!(params instanceof URLSearchParams)) throw new TypeError('URLSearchParams required');
  return Object.freeze({ tab: normalizeTab(params.get('inspector') ?? 'gameplay', options) });
}

export function serializeCreatureInspectorState(params, state, options = {}) {
  if (!(params instanceof URLSearchParams)) throw new TypeError('URLSearchParams required');
  const result = new URLSearchParams(params);
  result.set('inspector', normalizeTab(state?.tab ?? 'gameplay', options));
  return result;
}

export function reduceCreatureInspectorState(state, action) {
  const current = Object.freeze({ tab: normalizeTab(state?.tab ?? 'gameplay', { liveAvailable: true }) });
  if (!action || typeof action !== 'object') return current;
  switch (action.type) {
    case 'open-details':
      return Object.freeze({ tab: 'gameplay' });
    case 'select-creature':
      return current;
    case 'select-tab':
      return Object.freeze({ tab: normalizeTab(action.tab, { liveAvailable: action.liveAvailable === true }) });
    default:
      return current;
  }
}