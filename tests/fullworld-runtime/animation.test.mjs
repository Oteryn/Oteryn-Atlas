import assert from 'node:assert/strict';
import test from 'node:test';
import {
  animationFrameUpdates,
  buildAnimationBindings,
  commitAnimationUpdates,
  createAnimationClock,
  createAnimationScheduler,
  phaseState,
} from '../../src/browser/animation-runtime.mjs';

function animation(overrides = {}) {
  return {
    default_start_phase: 0,
    loop_count: 0,
    loop_type: 'infinite',
    presentation_durations_ms: [100, 100],
    random_start_phase: false,
    synchronized: false,
    ...overrides,
  };
}
test('synchronized playback follows the pinned global phase order', () => {
  const value = animation({ default_start_phase: 1, synchronized: true });
  assert.equal(phaseState(value, 2, 0, 'a', false).phase, 0);
  assert.equal(phaseState(value, 2, 99, 'a', false).phase, 0);
  assert.equal(phaseState(value, 2, 100, 'a', false).phase, 1);
  assert.equal(phaseState(value, 2, 200, 'a', false).phase, 0);
});

test('unsynchronized creature playback starts at default phase without invented offset', () => {
  const value = animation({ default_start_phase: 1, synchronized: false });
  assert.equal(phaseState(value, 2, 0, 'creature:a', false).phase, 1);
  assert.equal(phaseState(value, 2, 0, 'creature:b', false).phase, 1);
  assert.equal(phaseState(value, 2, 100, 'creature:a', false).phase, 0);
});

test('ping-pong and counted loops terminate deterministically', () => {
  const ping = animation({ loop_type: 'pingpong', presentation_durations_ms: [10, 10, 10], default_start_phase: 1 });
  assert.deepEqual([0, 10, 20, 30, 40].map((ms) => phaseState(ping, 3, ms, 'x', false).phase), [1, 2, 1, 0, 1]);
  const counted = animation({ loop_type: 'counted', loop_count: 1 });
  assert.equal(phaseState(counted, 2, 200, 'x', false).complete, true);
});
test('animation clock freezes while playback is disabled', () => {
  let now = 1000;
  const clock = createAnimationClock(() => now);
  clock.setEnabled(true); now += 100;
  assert.equal(clock.elapsed(), 100);
  clock.setEnabled(false); now += 500;
  assert.equal(clock.elapsed(), 100);
  clock.setEnabled(true); now += 25;
  assert.equal(clock.elapsed(), 125);
});

test('dirty scheduler is idle when disabled and fires one RAF per phase deadline', () => {
  const timers = []; const frames = []; let calls = 0;
  const scheduler = createAnimationScheduler(() => { calls += 1; }, {
    setTimer: (fn, delay) => { timers.push({ fn, delay, active: true }); return timers.length - 1; },
    clearTimer: (id) => { if (timers[id]) timers[id].active = false; },
    requestFrame: (fn) => { frames.push(fn); return frames.length - 1; },
    cancelFrame: () => {},
  });
  scheduler.update(false, 10, 50);
  assert.equal(scheduler.stats().pending, false);
  scheduler.update(true, 2, 50);
  assert.equal(timers.at(-1).delay, 50);
  timers.at(-1).fn(); frames.at(-1)();
  assert.equal(calls, 1);
  assert.equal(scheduler.stats().fired, 1);
});
test('world bindings update only changed instance pixels', () => {
  const program = {
    animation: animation({ synchronized: true }),
    appearance_source_id: 100,
    layers: 1,
    patterns: { width: 1, height: 1, depth: 1 },
    phase_count: 2,
    sprite_source_ids: [10, 11],
  };
  const record = {
    presentation: { appearanceSourceId: 100, recordId: 'presentation:test' },
    primitive: { phase: 0, layerIndex: 0, pattern: { x: 0, y: 0, z: 0 } },
  };
  const runtime = {
    programs: new Map([[100, program]]),
    sprites: new Map([[11, { contentId: `sha256:${'1'.repeat(64)}`, width: 32, height: 32 }]]),
  };
  const bindings = buildAnimationBindings([record], runtime);
  const frame = animationFrameUpdates(bindings, runtime, 0, 100);
  assert.equal(frame.updates.length, 1);
  assert.equal(frame.updates[0].phase, 1);
  commitAnimationUpdates(bindings, frame.updates);
  assert.equal(bindings[0].currentPhase, 1);
});
