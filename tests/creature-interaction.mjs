import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCreatureInteractionIndex,
  createClosedCreatureCardState,
  placeCreatureCard,
  queryCreatureHits,
  reduceCreatureCardState,
} from '../src/browser/creature-interaction.mjs';

function target(recordId, overrides = {}) {
  return {
    recordId,
    entityId: null,
    kind: recordId.startsWith('npc:') ? 'npc' : 'monster',
    floor: -7,
    baseGeneration: 11,
    creatureGeneration: 4,
    generationKey: '11:4',
    drawOrder: 1,
    anchor: { x: 50, y: 50 },
    worldAnchor: { x: 100, y: 200, floor: -7 },
    presentationRect: { x: 40, y: 40, width: 20, height: 20 },
    hitRects: [{ x: 40, y: 40, width: 20, height: 20 }],
    assistRect: { x: 32, y: 32, width: 36, height: 36 },
    geometryKey: `${recordId}:g`,
    ...overrides,
  };
}

test('bucket hits include rectangle edges and reject stale generations', () => {
  const index = buildCreatureInteractionIndex([
    target('npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  ], { width: 120, height: 100, cellSize: 32, generation: '11:4' });
  assert.equal(queryCreatureHits(index, { x: 40, y: 40, pointerType: 'mouse', generation: '11:4' }).length, 1);
  const edgeHit = queryCreatureHits(index, { x: 60, y: 60, pointerType: 'mouse', generation: '11:4' });
  assert.equal(edgeHit.length, 1);
  assert.deepEqual(edgeHit[0].worldAnchor, { x: 100, y: 200, floor: -7 });
  assert.equal(queryCreatureHits(index, { x: 60.01, y: 60.01, pointerType: 'mouse', generation: '11:4' }).length, 0);
  assert.deepEqual(queryCreatureHits(index, { x: 50, y: 50, pointerType: 'mouse', generation: '12:5' }), []);
  assert(index.bucketCount > 0);
  assert.equal(index.targetCount, 1);
});

test('direct geometry outranks touch assist', () => {
  const direct = target('monster:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', { drawOrder: 1 });
  const assistOnly = target('npc:cccccccccccccccccccccccccccccccc', {
    drawOrder: 99,
    presentationRect: { x: 70, y: 70, width: 10, height: 10 },
    hitRects: [{ x: 70, y: 70, width: 10, height: 10 }],
    assistRect: { x: 30, y: 30, width: 40, height: 40 },
  });
  const index = buildCreatureInteractionIndex([direct, assistOnly], { width: 120, height: 100, cellSize: 32, generation: '11:4' });
  const hits = queryCreatureHits(index, { x: 50, y: 50, pointerType: 'touch', generation: '11:4' });
  assert.deepEqual(hits.map((item) => item.recordId), [direct.recordId]);
  assert.equal(hits[0].hitKind, 'direct');
});

test('overlap ordering is draw order, then distance, then stable record id', () => {
  const farTop = target('monster:dddddddddddddddddddddddddddddddd', { drawOrder: 4, anchor: { x: 55, y: 50 } });
  const nearTopB = target('npc:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', { drawOrder: 4, anchor: { x: 50, y: 50 } });
  const nearTopA = target('npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { drawOrder: 4, anchor: { x: 50, y: 50 } });
  const lower = target('monster:ffffffffffffffffffffffffffffffff', { drawOrder: 3, anchor: { x: 50, y: 50 } });
  const index = buildCreatureInteractionIndex([farTop, nearTopB, lower, nearTopA], { width: 120, height: 100, cellSize: 32, generation: '11:4' });
  const hits = queryCreatureHits(index, { x: 50, y: 50, pointerType: 'mouse', generation: '11:4' });
  assert.deepEqual(hits.map((item) => item.recordId), [nearTopA.recordId, nearTopB.recordId, farTop.recordId, lower.recordId]);
});

test('touch assist is used only when no direct geometry is hit', () => {
  const only = target('monster:12121212121212121212121212121212', {
    presentationRect: { x: 60, y: 60, width: 8, height: 8 },
    hitRects: [{ x: 60, y: 60, width: 8, height: 8 }],
    assistRect: { x: 40, y: 40, width: 30, height: 30 },
  });
  const index = buildCreatureInteractionIndex([only], { width: 100, height: 100, cellSize: 25, generation: '11:4' });
  assert.equal(queryCreatureHits(index, { x: 45, y: 45, pointerType: 'mouse', generation: '11:4' }).length, 0);
  const hits = queryCreatureHits(index, { x: 45, y: 45, pointerType: 'touch', generation: '11:4' });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].hitKind, 'assist');
});

test('card placement stays in viewport and avoids reserved rectangles when possible', () => {
  const result = placeCreatureCard(
    { x: 45, y: 40, width: 20, height: 20 },
    { width: 40, height: 30 },
    { width: 120, height: 100 },
    [{ x: 70, y: 30, width: 50, height: 70 }],
  );
  assert(result.x >= 0 && result.y >= 0);
  assert(result.x + result.width <= 120 && result.y + result.height <= 100);
  assert.equal(result.width, 40);
  assert.equal(result.height, 30);
  assert(result.x + result.width <= 70 || result.y + result.height <= 30);
});

test('transient card state never owns durable creature selection', () => {
  let state = createClosedCreatureCardState();
  assert.deepEqual(state, { mode: 'closed', generation: null, recordId: null, choices: [] });
  state = reduceCreatureCardState(state, { type: 'open-record', generation: '11:4', recordId: 'npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  assert.equal(state.mode, 'record');
  assert.equal(state.recordId, 'npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal('selectedId' in state, false);
  state = reduceCreatureCardState(state, { type: 'suspend', generation: '11:4' });
  assert.equal(state.mode, 'suspended');
  state = reduceCreatureCardState(state, { type: 'close' });
  assert.deepEqual(state, createClosedCreatureCardState());
});

test('chooser is invalidated when committed geometry generation changes', () => {
  let state = reduceCreatureCardState(createClosedCreatureCardState(), {
    type: 'open-chooser', generation: '11:4',
    choices: ['npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'monster:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
  });
  assert.equal(state.mode, 'chooser');
  state = reduceCreatureCardState(state, { type: 'invalidate-generation', generation: '12:5' });
  assert.deepEqual(state, createClosedCreatureCardState());
});

test('index rejects malformed or generation-mismatched targets', () => {
  assert.throws(() => buildCreatureInteractionIndex([
    target('npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { generationKey: 'old' }),
  ], { width: 100, height: 100, generation: '11:4' }), /generation/i);
  assert.throws(() => buildCreatureInteractionIndex([
    target('npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', { hitRects: [{ x: NaN, y: 0, width: 1, height: 1 }] }),
  ], { width: 100, height: 100, generation: '11:4' }), /rect/i);
});

test('chooser cannot survive geometry suspension', () => {
  const chooser = reduceCreatureCardState(createClosedCreatureCardState(), {
    type: 'open-chooser', generation: '11:4',
    choices: ['npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'monster:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
  });
  assert.deepEqual(reduceCreatureCardState(chooser, { type: 'suspend' }), createClosedCreatureCardState());
});
