import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCreatureInspectorState, serializeCreatureInspectorState, reduceCreatureInspectorState } from '../src/browser/creature-inspector-state.mjs';

test('gameplay is default and unknown/live-unavailable values fail closed to gameplay', () => {
  assert.deepEqual(parseCreatureInspectorState(new URLSearchParams('creature=npc:abc')), { tab: 'gameplay' });
  assert.deepEqual(parseCreatureInspectorState(new URLSearchParams('inspector=wat')), { tab: 'gameplay' });
  assert.deepEqual(parseCreatureInspectorState(new URLSearchParams('inspector=live'), { liveAvailable: false }), { tab: 'gameplay' });
  assert.deepEqual(parseCreatureInspectorState(new URLSearchParams('inspector=semantic')), { tab: 'semantic' });
  assert.deepEqual(parseCreatureInspectorState(new URLSearchParams('inspector=live'), { liveAvailable: true }), { tab: 'live' });
});

test('serialization preserves unrelated URL state and creature selection', () => {
  const params = new URLSearchParams('x=1&creature=npc:123&inspector=semantic&animation=on');
  const out = serializeCreatureInspectorState(params, { tab: 'gameplay' });
  assert.equal(out.get('creature'), 'npc:123');
  assert.equal(out.get('animation'), 'on');
  assert.equal(out.get('inspector'), 'gameplay');
});

test('state reducer keeps valid tab through selection and rejects unavailable live', () => {
  let state = { tab: 'semantic' };
  state = reduceCreatureInspectorState(state, { type: 'select-creature' });
  assert.equal(state.tab, 'semantic');
  state = reduceCreatureInspectorState(state, { type: 'open-details' });
  assert.equal(state.tab, 'gameplay');
  state = reduceCreatureInspectorState(state, { type: 'select-tab', tab: 'live', liveAvailable: false });
  assert.equal(state.tab, 'gameplay');
});