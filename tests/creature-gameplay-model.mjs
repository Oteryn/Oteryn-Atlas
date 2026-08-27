import assert from 'node:assert/strict';
import test from 'node:test';
import { createCreatureGameplayView, formatChancePpm, joinCreaturePlacements } from '../src/browser/creature-gameplay-model.mjs';

const npc = {
  entity_id: 'npc-entity:' + '1'.repeat(32), kind: 'npc', name: 'Trader',
  shop: { state: 'COMPLETE', sells: [], buys: [], reason_codes: [] },
  services: { state: 'PARTIAL', values: ['shop'], reason_codes: ['SERVICE_TAXONOMY_NOT_EXHAUSTIVE'] },
  travel: { state: 'UNKNOWN', destinations: [], reason_codes: ['NO_STATIC_TRAVEL_EVIDENCE'] },
};
const monster = {
  entity_id: 'monster-entity:' + '2'.repeat(32), kind: 'monster', name: 'Rat',
  loot: { state: 'COMPLETE', entries: [{ item_ref: null, item_name: 'gold coin', item_resolution_state: 'UNRESOLVED', chance_ppm: 850000, min_count: 1, max_count: 2 }, { item_ref: null, item_name: 'cookie', item_resolution_state: 'UNRESOLVED', chance_ppm: 7500, min_count: 1, max_count: 1 }], reason_codes: [] },
  stats: { state: 'PARTIAL', health: 30, experience: 10, armor: 1, defense: 0, speed: 75, reason_codes: ['INCOMPLETE_STATIC_STATS'] },
  resistances: { state: 'COMPLETE', elements: [{ type: 'fire', percent: -10 }], immunities: [] },
};

test('complete empty is authoritative while unknown/partial empty is not', () => {
  const view = createCreatureGameplayView(npc, []);
  assert.equal(view.sections.sells.emptyCopy, 'No items sold.');
  assert.equal(view.sections.buys.emptyCopy, 'No items bought.');
  assert.match(view.sections.services.notice, /partially published/i);
  assert.match(view.sections.travel.notice, /not published/i);
  assert.notEqual(view.sections.travel.emptyCopy, 'No travel destinations.');
});

test('loot keeps integer authority, deterministic sorting and bounded rows', () => {
  assert.equal(formatChancePpm(850000), '85%');
  assert.equal(formatChancePpm(7500), '0.75%');
  const byChance = createCreatureGameplayView(monster, [], { lootSort: 'chance', rowLimit: 1 });
  assert.equal(byChance.sections.loot.rows.length, 1);
  assert.equal(byChance.sections.loot.rows[0].itemName, 'gold coin');
  assert.equal(byChance.sections.loot.totalRows, 2);
  const byName = createCreatureGameplayView(monster, [], { lootSort: 'name', rowLimit: 10 });
  assert.deepEqual(byName.sections.loot.rows.map((x) => x.itemName), ['cookie', 'gold coin']);
  assert.equal(byName.sections.loot.rows.every((x) => x.clickable === false), true);
});

test('stats preserve unsupported null and signed resistance meaning', () => {
  const view = createCreatureGameplayView(monster, []);
  assert.equal(view.sections.stats.values.health, 30);
  assert.equal(view.sections.stats.notice.includes('partially'), true);
  assert.equal(view.sections.resistances.elements[0].percent, -10);
});

test('placement join uses entity_id only even for identical display names', () => {
  const placements = [
    { record_id: 'monster:' + 'a'.repeat(32), entity_id: monster.entity_id, name: 'Rat', position: { x: 1, y: 2, floor: -7 } },
    { record_id: 'monster:' + 'b'.repeat(32), entity_id: 'monster-entity:' + '3'.repeat(32), name: 'Rat', position: { x: 9, y: 9, floor: -7 } },
  ];
  assert.deepEqual(joinCreaturePlacements(monster.entity_id, placements).map((x) => x.record_id), ['monster:' + 'a'.repeat(32)]);
});

test('large shop windowing/filtering is bounded without changing authoritative totals', () => {
  const big = structuredClone(npc);
  big.shop.sells = Array.from({ length: 300 }, (_, i) => ({ item_ref: null, item_name: `item ${String(i).padStart(3, '0')}`, item_resolution_state: 'UNRESOLVED', unit_price: i + 1, currency: 'gold' }));
  const view = createCreatureGameplayView(big, [], { shopQuery: 'item 2', rowLimit: 25 });
  assert.equal(view.sections.sells.rows.length <= 25, true);
  assert.equal(view.sections.sells.totalRows, 300);
  assert.equal(view.sections.sells.filteredRows > 0, true);
});