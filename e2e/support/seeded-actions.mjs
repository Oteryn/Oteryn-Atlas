const ACTION_TYPES = new Set(['pan', 'wheelZoom', 'buttonZoom', 'resize', 'mode', 'creatures']);
const MODES = new Set(['auto', 'map']);
const CREATURES = new Set(['npc', 'monster', 'both']);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function rng(seed) {
  requireValue(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffff_ffff, 'seed must be an unsigned 32-bit integer');
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
  requireValue(action && typeof action === 'object' && !Array.isArray(action) && ACTION_TYPES.has(action.type), 'action type invalid');
  if (action.type === 'pan') {
    requireValue(Number.isSafeInteger(action.dx) && Number.isSafeInteger(action.dy)
      && Math.abs(action.dx) <= 96 && Math.abs(action.dy) <= 96
      && Math.abs(action.dx) + Math.abs(action.dy) > 0, 'pan action invalid');
  } else if (action.type === 'wheelZoom') {
    requireValue(action.direction === 'in' || action.direction === 'out', 'wheel zoom action invalid');
  } else if (action.type === 'buttonZoom') {
    requireValue(action.direction === 'in' || action.direction === 'out', 'button zoom action invalid');
  } else if (action.type === 'resize') {
    requireValue(Number.isSafeInteger(action.width) && action.width >= 800 && action.width <= 1600
      && Number.isSafeInteger(action.height) && action.height >= 600 && action.height <= 1000, 'resize action invalid');
  } else if (action.type === 'mode') {
    requireValue(MODES.has(action.value), 'mode action invalid');
  } else if (action.type === 'creatures') {
    requireValue(CREATURES.has(action.value), 'creature action invalid');
  }
  return Object.freeze({ ...action });
}

export function generateActionLog(seed, length) {
  requireValue(Number.isSafeInteger(length) && length >= 1 && length <= 256, 'action log length invalid');
  const next = rng(seed);
  const types = ['pan', 'pan', 'wheelZoom', 'buttonZoom', 'resize', 'mode', 'creatures'];
  return Object.freeze(Array.from({ length }, () => {
    const type = choose(next, types);
    if (type === 'pan') {
      let dx = Math.round((next() * 2 - 1) * 96);
      let dy = Math.round((next() * 2 - 1) * 96);
      if (dx === 0 && dy === 0) dx = 1;
      return validateAction({ type, dx, dy });
    }
    if (type === 'wheelZoom' || type === 'buttonZoom') return validateAction({ type, direction: next() < 0.5 ? 'in' : 'out' });
    if (type === 'resize') return validateAction({ type, width: 800 + Math.floor(next() * 801), height: 600 + Math.floor(next() * 401) });
    if (type === 'mode') return validateAction({ type, value: next() < 0.5 ? 'auto' : 'map' });
    return validateAction({ type, value: choose(next, ['npc', 'monster', 'both']) });
  }));
}

export function serializeActionLog(actions) {
  requireValue(Array.isArray(actions), 'action log must be an array');
  return JSON.stringify(actions.map(validateAction));
}

export function parseReplayActionLog(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) { throw new TypeError(`action log JSON invalid: ${error.message}`); }
  requireValue(Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 256, 'action log JSON must contain 1-256 actions');
  return Object.freeze(parsed.map(validateAction));
}
