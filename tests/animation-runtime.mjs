import test from 'node:test';
import assert from 'node:assert/strict';
import { phaseAt } from '../src/browser/animation-runtime.mjs';

function program({ phases = 3, loopType = 'infinite', loopCount = 0, synchronized = true, durations = null } = {}) {
  return {
    phase_count: phases,
    animation: {
      default_start_phase: 0,
      loop_type: loopType,
      loop_count: loopCount,
      synchronized,
      presentation_durations_ms: durations ?? Array.from({ length: phases }, () => 100),
    },
  };
}

test('infinite animation advances by verified per-phase durations and wraps', () => {
  const value = program({ durations: [100, 200, 300] });
  assert.equal(phaseAt(value, 0, 'x'), 0);
  assert.equal(phaseAt(value, 99, 'x'), 0);
  assert.equal(phaseAt(value, 100, 'x'), 1);
  assert.equal(phaseAt(value, 299, 'x'), 1);
  assert.equal(phaseAt(value, 300, 'x'), 2);
  assert.equal(phaseAt(value, 600, 'x'), 0);
});
test('ping-pong animation follows source loop topology', () => {
  const value = program({ loopType: 'pingpong' });
  assert.deepEqual([0, 100, 200, 300, 400].map((time) => phaseAt(value, time, 'x')), [0, 1, 2, 1, 0]);
});

test('counted animation freezes on the terminal verified phase', () => {
  const value = program({ phases: 2, loopType: 'counted', loopCount: 2 });
  assert.equal(phaseAt(value, 0, 'x'), 0);
  assert.equal(phaseAt(value, 199, 'x'), 1);
  assert.equal(phaseAt(value, 200, 'x'), 0);
  assert.equal(phaseAt(value, 399, 'x'), 1);
  assert.equal(phaseAt(value, 400, 'x'), 1);
  assert.equal(phaseAt(value, 10_000, 'x'), 1);
});

test('asynchronous start offset is deterministic per stable instance id', () => {
  const value = program({ phases: 4, synchronized: false });
  const first = phaseAt(value, 0, 'npc:stable-instance');
  assert.equal(phaseAt(value, 0, 'npc:stable-instance'), first);
  assert.ok(first >= 0 && first < 4);
});
