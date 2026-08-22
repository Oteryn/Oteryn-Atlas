import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateActionLog,
  parseReplayActionLog,
  serializeActionLog,
} from '../../e2e/support/seeded-actions.mjs';

const SEED = 0x85;

test('fixed seed produces byte-equivalent bounded Atlas actions', () => {
  const first = generateActionLog(SEED, 40);
  const second = generateActionLog(SEED, 40);
  assert.deepEqual(first, second);
  assert.equal(serializeActionLog(first), serializeActionLog(second));
  assert.equal(first.length, 40);
  assert(first.every((action) => ['pan', 'wheelZoom', 'buttonZoom', 'resize', 'mode', 'creatures'].includes(action.type)));
  for (const action of first) {
    if (action.type === 'pan') {
      assert(Math.abs(action.dx) <= 96);
      assert(Math.abs(action.dy) <= 96);
    }
    if (action.type === 'resize') {
      assert(action.width >= 800 && action.width <= 1600);
      assert(action.height >= 600 && action.height <= 1000);
    }
  }
});

test('different seeds produce different action logs', () => {
  assert.notDeepEqual(generateActionLog(SEED, 12), generateActionLog(SEED + 1, 12));
});

test('serialized action log is canonical and replayable', () => {
  const original = generateActionLog(SEED, 20);
  const text = serializeActionLog(original);
  assert.deepEqual(parseReplayActionLog(text), original);
});

test('replay parser rejects unknown actions and unbounded values', () => {
  assert.throws(() => parseReplayActionLog('[{"type":"deleteWorld"}]'), /action/i);
  assert.throws(() => parseReplayActionLog('[{"type":"pan","dx":100000,"dy":0}]'), /pan/i);
  assert.throws(() => parseReplayActionLog('not-json'), /JSON/i);
});