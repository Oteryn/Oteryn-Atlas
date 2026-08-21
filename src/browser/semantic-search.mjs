const ALLOWED_KINDS = new Set(['npc', 'monster', 'town', 'waypoint', 'poi', 'teleport', 'house', 'quest_area', 'mechanic']);
const PREFIXES = new Map([
  ['npc', 'npc'], ['monster', 'monster'], ['town', 'town'], ['waypoint', 'waypoint'],
  ['poi', 'poi'], ['teleport', 'teleport'], ['house', 'house'], ['quest', 'quest_area'],
  ['quest_area', 'quest_area'], ['mechanic', 'mechanic'], ['id', 'id'],
]);
const MAX_QUERY = 256;
const MAX_RESULTS = 50;
const MAX_RECORDS = 250000;

export class SemanticSearchError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new SemanticSearchError(message);
}

export function normalizeSearchText(value) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  requireValue(text.length <= MAX_QUERY && !/[\u0000-\u001f\u007f]/.test(text), 'search query invalid');
  return text;
}

function validatePosition(position, label) {
  requireValue(position && Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y) && Number.isSafeInteger(position.floor), `${label} position invalid`);
}

function validateBounds(bounds, label) {
  if (bounds == null) return;
  requireValue(bounds && Number.isSafeInteger(bounds.x_min) && Number.isSafeInteger(bounds.y_min)
    && Number.isSafeInteger(bounds.x_max_exclusive) && Number.isSafeInteger(bounds.y_max_exclusive)
    && Number.isSafeInteger(bounds.floor), `${label} bounds invalid`);
  requireValue(bounds.x_min < bounds.x_max_exclusive && bounds.y_min < bounds.y_max_exclusive, `${label} bounds empty`);
}

export function validateSemanticSearchIndex(index) {
  requireValue(index?.schema_version === 1, 'semantic search index schema unsupported');
  requireValue(index.source?.authority === 'Oteryn/Oteryn-Game' && index.source?.repository === 'Oteryn/Oteryn-Game', 'semantic search source authority invalid');
  requireValue(index.source?.contract_id === 'oteryn-game-atlas-export-v1' && index.source?.capability === 'semantic-search-source-v1', 'semantic search source contract unsupported');
  requireValue(index.source?.profile_id === 'oteryn-game-atlas-semantic-search-v1', 'semantic search source profile unsupported');
  requireValue(/^[0-9a-f]{40}$/.test(index.source?.game_revision ?? ''), 'semantic search Game revision invalid');
  requireValue(/^sha256:[0-9a-f]{64}$/.test(index.source?.semantic_digest ?? '') && /^sha256:[0-9a-f]{64}$/.test(index.index_digest ?? ''), 'semantic search digest identity invalid');
  requireValue(index.input_floor_aliases && typeof index.input_floor_aliases === 'object' && Object.keys(index.input_floor_aliases).length <= 64, 'semantic search floor aliases invalid');
  for (const [key, value] of Object.entries(index.input_floor_aliases)) {
    requireValue(/^-?\d+$/.test(key) && Number.isSafeInteger(value), 'semantic search floor alias invalid');
  }
  requireValue(index.ranking && Object.values(index.ranking).every(Number.isFinite), 'semantic ranking profile invalid');
  requireValue(Array.isArray(index.records) && index.records.length <= MAX_RECORDS, 'semantic search record count invalid');
  const seen = new Set();
  for (const record of index.records) {
    requireValue(record && ALLOWED_KINDS.has(record.kind), 'semantic search record kind invalid');
    requireValue(typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 128 && !seen.has(record.id), 'semantic search record id invalid/duplicate');
    seen.add(record.id);
    requireValue(typeof record.label === 'string' && record.label.length > 0 && record.label.length <= 256, 'semantic search label invalid');
    requireValue(Array.isArray(record.aliases) && record.aliases.length <= 32 && record.aliases.every((value) => typeof value === 'string' && value.length <= 256), 'semantic aliases invalid');
    requireValue(Array.isArray(record.capabilities) && record.capabilities.length <= 32 && record.capabilities.every((value) => typeof value === 'string' && value.length <= 64), 'semantic capabilities invalid');
    requireValue(record.provenance && typeof record.provenance === 'object' && !Array.isArray(record.provenance), 'semantic provenance invalid');
    validatePosition(record.position, record.id);
    validateBounds(record.bounds, record.id);
    requireValue(record.search_terms && typeof record.search_terms.label === 'string' && Array.isArray(record.search_terms.aliases), 'semantic normalized terms missing');
    requireValue(record.search_terms.label === normalizeSearchText(record.label), 'semantic normalized label mismatch');
  }
  return index;
}

function splitPrefix(raw) {
  const match = String(raw).trim().match(/^([a-z_]+)\s*:\s*(.*)$/i);
  if (!match) return { type: null, query: String(raw) };
  const type = PREFIXES.get(match[1].toLowerCase());
  if (!type) return { type: null, query: String(raw) };
  return { type, query: match[2] };
}

function resolveInputFloor(index, rawFloor, currentFloor) {
  if (rawFloor == null) {
    requireValue(Number.isSafeInteger(currentFloor), 'coordinate query requires a floor');
    return currentFloor;
  }
  requireValue(Number.isSafeInteger(rawFloor), 'coordinate floor invalid');
  const key = String(rawFloor);
  if (Object.prototype.hasOwnProperty.call(index.input_floor_aliases, key)) return index.input_floor_aliases[key];
  return rawFloor;
}

export function parseCoordinateQuery(raw, index, currentFloor = null) {
  const text = String(raw).trim();
  const labelledX = text.match(/\bx\s*=?\s*(-?\d+)\b/i);
  const labelledY = text.match(/\by\s*=?\s*(-?\d+)\b/i);
  const labelledFloor = text.match(/\b(?:floor|f|z)\s*=?\s*(-?\d+)\b/i);
  let x; let y; let floor;
  if (labelledX && labelledY) {
    x = Number(labelledX[1]); y = Number(labelledY[1]);
    floor = resolveInputFloor(index, labelledFloor ? Number(labelledFloor[1]) : null, currentFloor);
  } else if (/^\s*-?\d+\s*[,; ]+\s*-?\d+(?:\s*[,; ]+\s*-?\d+)?\s*$/.test(text)) {
    const values = text.match(/-?\d+/g)?.map(Number) ?? [];
    [x, y] = values;
    floor = resolveInputFloor(index, values.length >= 3 ? values[2] : null, currentFloor);
  } else {
    return null;
  }
  requireValue(Number.isSafeInteger(x) && Number.isSafeInteger(y), 'coordinate query invalid');
  return Object.freeze({ kind: 'position', id: null, label: `${x}, ${y}, ${displayFloor(floor, index)}`, aliases: [], position: Object.freeze({ x, y, floor }), bounds: null, provenance: Object.freeze({ authority: 'coordinate-query' }), capabilities: Object.freeze(['navigation']), score: Number.POSITIVE_INFINITY });
}

function scoreRecord(record, query, type, ranking) {
  const label = record.search_terms.label;
  const aliases = record.search_terms.aliases;
  if (type === 'id') {
    return record.id.toLowerCase() === query ? ranking.exact_id : -1;
  }
  if (type && record.kind !== type) return -1;
  if (label === query) return ranking.exact_label;
  if (aliases.includes(query)) return ranking.exact_alias;
  if (label.startsWith(query)) return ranking.prefix_label;
  if (aliases.some((alias) => alias.startsWith(query))) return ranking.prefix_alias;
  if (label.includes(query)) return ranking.contains_label;
  if (aliases.some((alias) => alias.includes(query))) return ranking.contains_alias;
  return -1;
}

export function searchSemanticIndex(index, rawQuery, options = {}) {
  validateSemanticSearchIndex(index);
  const limit = Math.min(MAX_RESULTS, Math.max(1, Number(options.limit ?? 12)));
  const split = splitPrefix(rawQuery);
  if (split.type == null) {
    const coordinate = parseCoordinateQuery(split.query, index, options.currentFloor ?? null);
    if (coordinate) return Object.freeze({ mode: 'coordinate', query: normalizeSearchText(split.query), results: Object.freeze([coordinate]) });
  }
  const query = normalizeSearchText(split.query);
  if (!query) return Object.freeze({ mode: 'semantic', query, results: Object.freeze([]) });
  const results = [];
  for (const record of index.records) {
    const score = scoreRecord(record, query, split.type, index.ranking);
    if (score >= 0) results.push(Object.freeze({ ...record, score }));
  }
  results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  return Object.freeze({ mode: 'semantic', query, type: split.type, results: Object.freeze(results.slice(0, limit)) });
}

export function displayFloor(nativeFloor, index) {
  const matches = Object.entries(index.input_floor_aliases)
    .filter(([, value]) => value === nativeFloor)
    .map(([key]) => Number(key))
    .filter(Number.isSafeInteger)
    .sort((a, b) => a - b);
  return matches.length ? matches[0] : nativeFloor;
}

export function navigationSearchParams(result, currentSearch, index, rawQuery = '') {
  validatePosition(result?.position, 'navigation result');
  const params = new URLSearchParams(String(currentSearch ?? '').replace(/^\?/, ''));
  params.set('x', String(result.position.x));
  params.set('y', String(result.position.y));
  params.set('floor', String(result.position.floor));
  params.set('zoom', String(Math.max(2, Number(params.get('zoom')) || 2)));
  params.set('selected', `${result.position.floor}:${result.position.x}:${result.position.y}`);
  params.set('q', String(rawQuery).trim().slice(0, MAX_QUERY));
  if (!params.has('layers')) params.set('layers', 'minimap-overview');
  if (result.id) params.set('semantic', result.id); else params.delete('semantic');
  if (result.kind === 'npc' || result.kind === 'monster') {
    const enabled = new Set((params.get('creatures') ?? '').split(',').filter(Boolean));
    enabled.add(result.kind);
    params.set('creatures', [...enabled].sort().join(','));
  }
  return params;
}
