const MAX_CREATURE_SEARCH_RECORDS = 20000;
const RECORD_ID = /^(?:npc|monster):[0-9a-f]{32}$/;
const ENTITY_ID = /^(?:npc|monster)-entity:[0-9a-f]{32}$/;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

export function validateCreatureSearchRecords(records) {
  requireValue(Array.isArray(records) && records.length <= MAX_CREATURE_SEARCH_RECORDS, 'creature search record count invalid');
  const seen = new Set();
  for (const record of records) {
    requireValue(record && (record.kind === 'npc' || record.kind === 'monster'), 'creature search kind invalid');
    requireValue(typeof record.label === 'string' && record.label.trim().length > 0 && record.label.length <= 256, 'creature search label invalid');
    requireValue(RECORD_ID.test(record.record_id ?? ''), 'creature search record id invalid');
    if (record.entity_id != null) requireValue(ENTITY_ID.test(record.entity_id), 'creature search entity id invalid');
    requireValue(record.position && Number.isSafeInteger(record.position.x) && Number.isSafeInteger(record.position.y) && Number.isSafeInteger(record.position.floor), 'creature search position invalid');
    const key = `${record.kind}:${normalize(record.label)}`;
    requireValue(!seen.has(key), 'creature search duplicate label/kind');
    seen.add(key);
  }
  return records;
}

function parse(raw) {
  const text = String(raw ?? '').trim();
  const match = text.match(/^(npc|monster|id)\s*:\s*(.*)$/i);
  if (!match) return { type: null, query: normalize(text) };
  return { type: match[1].toLowerCase(), query: normalize(match[2]) };
}

export function creatureSemanticRecord(source, score = 0) {
  const id = source.entity_id ?? source.record_id;
  return Object.freeze({
    kind: source.kind,
    id,
    record_id: source.record_id,
    entity_id: source.entity_id ?? null,
    label: source.label,
    aliases: [],
    position: Object.freeze({ ...source.position }),
    bounds: null,
    provenance: Object.freeze({
      authority: 'Oteryn/Oteryn-Game',
      source_capability: 'static-creatures-v1',
      resolution_state: source.resolution_state ?? 'UNKNOWN',
    }),
    capabilities: Object.freeze(['static-placement']),
    score,
  });
}

export function searchCreatureRecords(records, rawQuery, options = {}) {
  validateCreatureSearchRecords(records);
  const { type, query } = parse(rawQuery);
  const limit = Math.min(50, Math.max(1, Number(options.limit ?? 12)));
  if (!query) return [];
  const output = [];
  for (const source of records) {
    if ((type === 'npc' || type === 'monster') && source.kind !== type) continue;
    let score = -1;
    if (type === 'id') {
      if (normalize(source.record_id) === query || normalize(source.entity_id) === query) score = 1050;
    } else {
      const label = normalize(source.label);
      if (label === query) score = 950;
      else if (label.startsWith(query)) score = 760;
      else if (label.includes(query)) score = 550;
    }
    if (score >= 0) output.push(creatureSemanticRecord(source, score));
  }
  output.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  return output.slice(0, limit);
}

export function findCreatureById(records, id) {
  const needle = normalize(id);
  if (!needle) return null;
  const source = records.find((record) => normalize(record.entity_id) === needle || normalize(record.record_id) === needle);
  return source ? creatureSemanticRecord(source) : null;
}