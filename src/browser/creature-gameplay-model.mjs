const DEFAULT_ROW_LIMIT = 50;
const MAX_ROW_LIMIT = 100;

function boundedRowLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1) return DEFAULT_ROW_LIMIT;
  return Math.min(value, MAX_ROW_LIMIT);
}

function stateNotice(label, state) {
  switch (state) {
    case 'PARTIAL': return `${label} data partially published by Game.`;
    case 'UNKNOWN': return `${label} data not published by Game.`;
    case 'UNRESOLVED': return `${label} profile unresolved for this creature.`;
    case 'AMBIGUOUS': return `${label} data is ambiguous in the Game publication.`;
    default: return '';
  }
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function tradeRow(row) {
  return Object.freeze({
    itemRef: row.item_ref ?? null,
    itemName: text(row.item_name),
    itemResolutionState: row.item_resolution_state,
    unitPrice: row.unit_price,
    currency: row.currency,
    amount: row.amount ?? null,
    clickable: row.item_resolution_state === 'RESOLVED' && typeof row.item_ref === 'string' && row.item_ref.length > 0,
  });
}

function tradeSection(rows, state, label, emptyCopy, query, rowLimit) {
  const normalizedQuery = text(query).trim().toLocaleLowerCase('en-US');
  const source = Array.isArray(rows) ? rows : [];
  const filtered = normalizedQuery
    ? source.filter((row) => text(row.item_name).toLocaleLowerCase('en-US').includes(normalizedQuery))
    : source;
  return Object.freeze({
    state,
    rows: Object.freeze(filtered.slice(0, rowLimit).map(tradeRow)),
    totalRows: source.length,
    filteredRows: filtered.length,
    emptyCopy: state === 'COMPLETE' && source.length === 0 ? emptyCopy : null,
    notice: stateNotice(label, state),
  });
}

function lootRow(row) {
  return Object.freeze({
    itemRef: row.item_ref ?? null,
    itemName: text(row.item_name),
    itemResolutionState: row.item_resolution_state,
    chancePpm: row.chance_ppm,
    chanceLabel: formatChancePpm(row.chance_ppm),
    minCount: row.min_count,
    maxCount: row.max_count,
    clickable: row.item_resolution_state === 'RESOLVED' && typeof row.item_ref === 'string' && row.item_ref.length > 0,
  });
}

export function formatChancePpm(chancePpm) {
  if (!Number.isSafeInteger(chancePpm) || chancePpm < 0 || chancePpm > 1_000_000) throw new RangeError('chance_ppm invalid');
  const value = chancePpm / 10_000;
  if (Number.isInteger(value)) return `${value}%`;
  return `${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

export function joinCreaturePlacements(entityId, placements) {
  if (typeof entityId !== 'string' || !Array.isArray(placements)) return Object.freeze([]);
  const rows = placements.filter((record) => record?.entity_id === entityId).slice();
  rows.sort((a, b) => (a.position?.floor ?? 0) - (b.position?.floor ?? 0)
    || (a.position?.y ?? 0) - (b.position?.y ?? 0)
    || (a.position?.x ?? 0) - (b.position?.x ?? 0)
    || String(a.record_id ?? '').localeCompare(String(b.record_id ?? '')));
  return Object.freeze(rows.map((row) => Object.freeze({ ...row, position: row.position ? Object.freeze({ ...row.position }) : null })));
}

function createNpcView(profile, placements, options) {
  const rowLimit = boundedRowLimit(options.rowLimit);
  const shop = profile.shop ?? { state: 'UNKNOWN', sells: [], buys: [] };
  const services = profile.services ?? { state: 'UNKNOWN', values: [] };
  const travel = profile.travel ?? { state: 'UNKNOWN', destinations: [] };
  const joined = joinCreaturePlacements(profile.entity_id, placements);
  return Object.freeze({
    kind: 'npc', entityId: profile.entity_id, name: profile.name,
    sections: Object.freeze({
      sells: tradeSection(shop.sells, shop.state, 'Shop', 'No items sold.', options.shopQuery, rowLimit),
      buys: tradeSection(shop.buys, shop.state, 'Shop', 'No items bought.', options.shopQuery, rowLimit),
      services: Object.freeze({
        state: services.state,
        values: Object.freeze([...(services.values ?? [])]),
        emptyCopy: services.state === 'COMPLETE' && (services.values ?? []).length === 0 ? 'No published services.' : null,
        notice: stateNotice('Services', services.state),
      }),
      travel: Object.freeze({
        state: travel.state,
        rows: Object.freeze((travel.destinations ?? []).slice(0, rowLimit).map((row) => Object.freeze({ ...row, position: row.position ? Object.freeze({ ...row.position }) : null }))),
        totalRows: (travel.destinations ?? []).length,
        emptyCopy: travel.state === 'COMPLETE' && (travel.destinations ?? []).length === 0 ? 'No travel destinations.' : null,
        notice: stateNotice('Travel', travel.state),
      }),
      locations: Object.freeze({ rows: joined.slice(0, rowLimit), totalRows: joined.length }),
    }),
  });
}

function createMonsterView(profile, placements, options) {
  const rowLimit = boundedRowLimit(options.rowLimit);
  const loot = profile.loot ?? { state: 'UNKNOWN', entries: [] };
  const stats = profile.stats ?? { state: 'UNKNOWN' };
  const resistances = profile.resistances ?? { state: 'UNKNOWN', elements: [], immunities: [] };
  const sourceLoot = [...(loot.entries ?? [])];
  if (options.lootSort === 'chance') sourceLoot.sort((a, b) => b.chance_ppm - a.chance_ppm || text(a.item_name).localeCompare(text(b.item_name)));
  else if (options.lootSort === 'name') sourceLoot.sort((a, b) => text(a.item_name).localeCompare(text(b.item_name)) || b.chance_ppm - a.chance_ppm);
  const joined = joinCreaturePlacements(profile.entity_id, placements);
  return Object.freeze({
    kind: 'monster', entityId: profile.entity_id, name: profile.name,
    sections: Object.freeze({
      loot: Object.freeze({
        state: loot.state,
        rows: Object.freeze(sourceLoot.slice(0, rowLimit).map(lootRow)),
        totalRows: sourceLoot.length,
        emptyCopy: loot.state === 'COMPLETE' && sourceLoot.length === 0 ? 'No published loot.' : null,
        notice: stateNotice('Loot', loot.state),
      }),
      stats: Object.freeze({
        state: stats.state,
        values: Object.freeze({ health: stats.health ?? null, experience: stats.experience ?? null, armor: stats.armor ?? null, defense: stats.defense ?? null, speed: stats.speed ?? null }),
        notice: stateNotice('Stats', stats.state),
      }),
      resistances: Object.freeze({
        state: resistances.state,
        elements: Object.freeze((resistances.elements ?? []).map((row) => Object.freeze({ ...row }))),
        immunities: Object.freeze([...(resistances.immunities ?? [])]),
        notice: stateNotice('Resistances / Immunities', resistances.state),
      }),
      spawns: Object.freeze({ rows: joined.slice(0, rowLimit), totalRows: joined.length }),
    }),
  });
}

export function createCreatureGameplayView(profile, placements = [], options = {}) {
  if (!profile || (profile.kind !== 'npc' && profile.kind !== 'monster')) throw new TypeError('validated creature gameplay profile required');
  return profile.kind === 'npc' ? createNpcView(profile, placements, options) : createMonsterView(profile, placements, options);
}