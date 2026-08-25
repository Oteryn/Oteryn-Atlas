import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FarmStateError,
  parseFarmState,
  serializeFarmState,
} from '../src/browser/farm-state.mjs';

const ITEM = 'item:alpha';
const SOURCE = `monster-entity:${'a'.repeat(32)}`;
const CREATURE = `monster-entity:${'b'.repeat(32)}`;

test('item state round-trips source-scoped KPH and preserves unrelated FullWorld parameters', () => {
  const search = `floor=-7&x=100&item=${encodeURIComponent(ITEM)}&farmSource=${encodeURIComponent(SOURCE)}&farmQty=125&farmKph=80&farmKphScope=qualifying_source_kills&farmTimeBase=active_hunt&farmView=clusters`;
  const state = parseFarmState(search);
  assert.equal(state.mode, 'item');
  assert.equal(state.target_quantity, 125);
  assert.equal(state.source_creature_id, SOURCE);
  assert.equal(state.kph.value, 80);
  assert.equal(state.kph.progress_scope, 'qualifying_source_kills');
  assert.equal(state.kph.time_base, 'active_hunt');
  const serialized = serializeFarmState(state, 'floor=-7&x=100');
  assert.equal(serialized.get('floor'), '-7');
  assert.equal(serialized.get('x'), '100');
  assert.deepEqual(parseFarmState(serialized), state);
});

test('free item and custom kill targets default to 100 without inventing KPH', () => {
  const item = parseFarmState(`item=${encodeURIComponent(ITEM)}`);
  assert.equal(item.target_quantity, 100);
  assert.equal(item.kph, null);
  const kill = parseFarmState(`farmCreature=${encodeURIComponent(CREATURE)}`);
  assert.equal(kill.target_kills, 100);
  assert.equal(kill.kph, null);
});

test('custom kill state round-trips selected-creature KPH and explicit wall-time base', () => {
  const search = `farmCreature=${encodeURIComponent(CREATURE)}&farmKills=240&farmKph=60&farmKphScope=selected_creature_kills&farmTimeBase=hunt_wall&farmView=spawns`;
  const state = parseFarmState(search);
  assert.equal(state.mode, 'creature');
  assert.equal(state.target_kills, 240);
  assert.equal(state.kph.progress_scope, 'selected_creature_kills');
  assert.equal(state.kph.time_base, 'hunt_wall');
  assert.deepEqual(parseFarmState(serializeFarmState(state)), state);
});

test('authoritative task identity does not invent a requirement before task data loads', () => {
  const state = parseFarmState('farmTask=task%3Aalpha&farmView=auto');
  assert.equal(state.mode, 'task');
  assert.equal(state.task_id, 'task:alpha');
  assert.equal(state.target_quantity, null);
  assert.equal(state.target_kills, null);
});

test('authoritative task KPH stays blocked until task credit semantics load', () => {
  assert.throws(
    () => parseFarmState('farmTask=task%3Aalpha&farmKph=40&farmKphScope=credited_target_progress&farmTimeBase=trip_wall'),
    /authoritative task semantics/i,
  );
});

test('inactive state is stable and strips stale Farm Explorer parameters when serialized', () => {
  const inactive = parseFarmState('floor=-7');
  assert.equal(inactive.mode, 'inactive');
  const serialized = serializeFarmState(inactive, 'floor=-7&farmQty=999&farmKph=12');
  assert.equal(serialized.get('floor'), '-7');
  assert.equal(serialized.has('farmQty'), false);
  assert.equal(serialized.has('farmKph'), false);
});

for (const [name, search] of [
  ['contradictory item and creature', `item=${ITEM}&farmCreature=${CREATURE}`],
  ['negative quantity', `item=${ITEM}&farmQty=-1`],
  ['non integer quantity', `item=${ITEM}&farmQty=1.5`],
  ['item kills field', `item=${ITEM}&farmKills=10`],
  ['creature quantity field', `farmCreature=${CREATURE}&farmQty=10`],
  ['KPH without time base', `farmCreature=${CREATURE}&farmKph=50&farmKphScope=selected_creature_kills`],
  ['time base without KPH', `farmCreature=${CREATURE}&farmTimeBase=hunt_wall`],
  ['KPH without scope', `farmCreature=${CREATURE}&farmKph=50&farmTimeBase=hunt_wall`],
  ['item KPH without selected source', `item=${ITEM}&farmKph=50&farmKphScope=qualifying_source_kills&farmTimeBase=active_hunt`],
  ['item with wrong KPH scope', `item=${ITEM}&farmSource=${SOURCE}&farmKph=50&farmKphScope=credited_target_progress&farmTimeBase=active_hunt`],
  ['creature with wrong KPH scope', `farmCreature=${CREATURE}&farmKph=50&farmKphScope=credited_target_progress&farmTimeBase=active_hunt`],
  ['unknown view', `item=${ITEM}&farmView=sprites`],
  ['path-shaped identity', 'item=../legacy.xml'],
]) {
  test(`malformed URL state fails closed: ${name}`, () => {
    assert.throws(() => parseFarmState(search), FarmStateError);
  });
}

test('serialization refuses contradictory in-memory state instead of normalizing it silently', () => {
  const state = parseFarmState(`item=${ITEM}`);
  assert.throws(() => serializeFarmState({ ...state, target_quantity: -5 }), FarmStateError);
});
