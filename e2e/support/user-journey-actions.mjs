const ACTION_TYPES = new Set([
  'search', 'zoom', 'pan', 'mode', 'floor', 'creature', 'playback',
  'history', 'reload', 'drawer', 'resize',
]);
const MODES = new Set(['auto', 'map', 'minimap', 'classic']);
const CREATURE_KINDS = new Set(['npc', 'monster']);
const DIRECTIONS = new Set(['in', 'out']);
const FLOOR_DIRECTIONS = new Set(['up', 'down']);
const SURFACES = new Set(['desktop', 'mobile']);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function rng(seed) {
  requireValue(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffff_ffff,
    'seed must be an unsigned 32-bit integer');
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function choose(next, values) {
  return values[Math.min(values.length - 1, Math.floor(next() * values.length))];
}

function validateAction(action) {
  requireValue(action && typeof action === 'object' && !Array.isArray(action)
    && ACTION_TYPES.has(action.type), 'action type invalid');
  if (action.type === 'pan') {
    requireValue(Number.isSafeInteger(action.dx) && Number.isSafeInteger(action.dy)
      && Math.abs(action.dx) <= 96 && Math.abs(action.dy) <= 96
      && Math.abs(action.dx) + Math.abs(action.dy) > 0, 'pan action invalid');
  } else if (action.type === 'zoom') {
    requireValue(DIRECTIONS.has(action.direction), 'zoom action invalid');
  } else if (action.type === 'mode') {
    requireValue(MODES.has(action.value), 'mode action invalid');
  } else if (action.type === 'floor') {
    requireValue(FLOOR_DIRECTIONS.has(action.direction), 'floor action invalid');
  } else if (action.type === 'creature') {
    requireValue(CREATURE_KINDS.has(action.kind), 'creature action invalid');
  } else if (action.type === 'resize') {
    requireValue(Number.isSafeInteger(action.width) && action.width >= 360 && action.width <= 900
      && Number.isSafeInteger(action.height) && action.height >= 360 && action.height <= 900,
    'resize action invalid');
  }
  return Object.freeze({ ...action });
}

function extraAction(next, surface) {
  const choices = surface === 'desktop'
    ? ['pan', 'zoom', 'mode', 'floor', 'creature', 'playback', 'search']
    : ['drawer', 'mode', 'floor', 'resize', 'creature', 'playback', 'search'];
  const type = choose(next, choices);
  if (type === 'pan') {
    let dx = Math.round((next() * 2 - 1) * 96);
    const dy = Math.round((next() * 2 - 1) * 96);
    if (dx === 0 && dy === 0) dx = 1;
    return validateAction({ type, dx, dy });
  }
  if (type === 'zoom') return validateAction({ type, direction: next() < 0.5 ? 'in' : 'out' });
  if (type === 'mode') return validateAction({ type, value: choose(next, ['auto', 'map', 'minimap', 'classic']) });
  if (type === 'floor') return validateAction({ type, direction: next() < 0.5 ? 'up' : 'down' });
  if (type === 'creature') return validateAction({ type, kind: next() < 0.5 ? 'npc' : 'monster' });
  if (type === 'resize') return validateAction(next() < 0.5
    ? { type, width: 390, height: 844 }
    : { type, width: 844, height: 390 });
  return validateAction({ type });
}

function backbone(next, surface) {
  if (surface === 'desktop') {
    return [
      { type: 'search' },
      { type: 'zoom', direction: next() < 0.5 ? 'in' : 'out' },
      { type: 'pan', dx: 64, dy: 32 },
      { type: 'mode', value: next() < 0.5 ? 'minimap' : 'classic' },
      { type: 'floor', direction: next() < 0.5 ? 'up' : 'down' },
      { type: 'creature', kind: next() < 0.5 ? 'npc' : 'monster' },
      { type: 'playback' },
      { type: 'history' },
      { type: 'reload' },
    ].map(validateAction);
  }
  return [
    { type: 'drawer' },
    { type: 'search' },
    { type: 'mode', value: 'map' },
    { type: 'floor', direction: next() < 0.5 ? 'up' : 'down' },
    { type: 'creature', kind: next() < 0.5 ? 'npc' : 'monster' },
    { type: 'playback' },
    next() < 0.5 ? { type: 'resize', width: 844, height: 390 } : { type: 'resize', width: 390, height: 844 },
    { type: 'history' },
    { type: 'reload' },
  ].map(validateAction);
}

export function generateUserJourney(seed, { surface, length } = {}) {
  requireValue(SURFACES.has(surface), 'surface must be desktop or mobile');
  requireValue(Number.isSafeInteger(length) && length >= 9 && length <= 64,
    'journey length must be 9-64 actions');
  const next = rng(seed);
  const actions = [...backbone(next, surface)];
  const terminal = actions.splice(-2);
  while (actions.length + terminal.length < length) actions.push(extraAction(next, surface));
  actions.push(...terminal);
  return Object.freeze(actions);
}

export function serializeUserJourney(actions) {
  requireValue(Array.isArray(actions) && actions.length >= 1 && actions.length <= 64,
    'journey must contain 1-64 actions');
  return JSON.stringify(actions.map(validateAction));
}

export function parseUserJourney(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) {
    throw new TypeError(`journey JSON invalid: ${error.message}`);
  }
  requireValue(Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 64,
    'journey JSON must contain 1-64 actions');
  return Object.freeze(parsed.map(validateAction));
}
