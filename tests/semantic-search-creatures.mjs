import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findCreatureById,
  searchCreatureRecords,
  validateCreatureSearchRecords,
} from '../src/browser/creature-search.mjs';

const records = [
  {
    kind: 'npc', label: 'Sam', record_id: `npc:${'a'.repeat(32)}`, entity_id: `npc-entity:${'b'.repeat(32)}`,
    position: { x: 32361, y: 32198, floor: -7 }, resolution_state: 'RESOLVED',
  },
  {
    kind: 'npc', label: 'Rashid', record_id: `npc:${'c'.repeat(32)}`, entity_id: `npc-entity:${'d'.repeat(32)}`,
    position: { x: 32320, y: 31782, floor: -6 }, resolution_state: 'RESOLVED',
  },
  {
    kind: 'monster', label: 'Dragon', record_id: `monster:${'e'.repeat(32)}`, entity_id: `monster-entity:${'f'.repeat(32)}`,
    position: { x: 32780, y: 31590, floor: -7 }, resolution_state: 'RESOLVED',
  },
];

test('validates full creature search records with public entity ids', () => {
  assert.equal(validateCreatureSearchRecords(records).length, 3);
});

test('npc and monster filters search the full published creature list', () => {
  assert.equal(searchCreatureRecords(records, 'npc:Rashid')[0].label, 'Rashid');
  assert.equal(searchCreatureRecords(records, 'monster:Dragon')[0].label, 'Dragon');
  assert.equal(searchCreatureRecords(records, 'Dragon')[0].kind, 'monster');
});

test('id lookup is exact for both entity and placement ids', () => {
  const samEntity = records[0].entity_id;
  const samRecord = records[0].record_id;
  assert.equal(searchCreatureRecords(records, `id:${samEntity}`).length, 1);
  assert.equal(searchCreatureRecords(records, `id:${samEntity.slice(0, -1)}`).length, 0);
  assert.equal(searchCreatureRecords(records, `id:${samRecord}`)[0].record_id, samRecord);
});

test('creature semantic results navigate with stable entity id and placement id', () => {
  const result = searchCreatureRecords(records, 'Sam')[0];
  assert.equal(result.id, records[0].entity_id);
  assert.equal(result.record_id, records[0].record_id);
  assert.deepEqual(result.position, records[0].position);
});

test('findCreatureById resolves entity and placement ids', () => {
  assert.equal(findCreatureById(records, records[2].entity_id).label, 'Dragon');
  assert.equal(findCreatureById(records, records[2].record_id).label, 'Dragon');
});