import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimationRuntime, phaseAt } from '../src/browser/animation-runtime.mjs';
import { sha256ContentId } from '../src/browser/loader.mjs';

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

test('creature playback keeps static OFF deterministic and advances authoritative walking ON on the shared logical clock', () => {
  const staticId = `sha256:${'1'.repeat(64)}`;
  const moving0 = `sha256:${'2'.repeat(64)}`;
  const moving1 = `sha256:${'3'.repeat(64)}`;
  const staticProgram = Object.freeze({
    ...program({ phases: 1 }),
    phase_content_ids: [staticId],
    presentation_mode: 'static',
    width: 32,
    height: 32,
  });
  const walkingProgram = Object.freeze({
    ...program({ phases: 2, durations: [100, 100] }),
    phase_content_ids: [moving0, moving1],
    presentation_mode: 'moving-in-place',
    width: 32,
    height: 32,
  });
  const record = Object.freeze({
    record_id: 'npc:fixture',
    x: 100,
    y: 200,
    floor: 7,
    outfit_presentation: Object.freeze({ outfit_presentation_id: 'outfit-presentation:fixture' }),
  });
  const runtime = createAnimationRuntime(new URL('https://atlas.invalid/animation/'), {
    manifest: {}, objects: new Map(), sprites: new Map(), blobs: new Map(), buckets: new Map(), fetcher: fetch,
    creatures: new Map([['outfit-presentation:fixture', Object.freeze({
      outfit_presentation_id: 'outfit-presentation:fixture',
      static_program: staticProgram,
      walking_program: walkingProgram,
    })]]),
  });

  const staticFirst = runtime.creatureFrame(record, 0, 'static');
  const staticLater = runtime.creatureFrame(record, 10_000, 'static');
  assert.equal(staticFirst.contentId, staticId);
  assert.equal(staticLater.contentId, staticId);
  assert.equal(staticFirst.phase, 0);
  assert.equal(staticFirst.presentationMode, 'static');

  const walkingFirst = runtime.creatureFrame(record, 0, 'moving-in-place');
  const walkingSecond = runtime.creatureFrame(record, 100, 'moving-in-place');
  assert.equal(walkingFirst.contentId, moving0);
  assert.equal(walkingSecond.contentId, moving1);
  assert.equal(walkingFirst.presentationMode, 'moving-in-place');
  assert.equal(walkingSecond.presentationMode, 'moving-in-place');

  const implicitFirst = runtime.creatureFrame(record, 0);
  const implicitLater = runtime.creatureFrame(record, 10_000);
  assert.equal(implicitFirst.contentId, staticId);
  assert.equal(implicitLater.contentId, staticId);
  assert.equal(implicitFirst.presentationMode, 'static');
  assert.equal(implicitLater.presentationMode, 'static');
  assert.deepEqual({ record_id: record.record_id, x: record.x, y: record.y, floor: record.floor }, { record_id: 'npc:fixture', x: 100, y: 200, floor: 7 });
});

test('walking playback fails closed to the verified static program when moving authority is unavailable', () => {
  const staticId = `sha256:${'4'.repeat(64)}`;
  const staticProgram = Object.freeze({
    ...program({ phases: 1 }),
    phase_content_ids: [staticId],
    presentation_mode: 'static',
    width: 32,
    height: 32,
  });
  const record = Object.freeze({
    record_id: 'npc:fallback',
    outfit_presentation: Object.freeze({ outfit_presentation_id: 'outfit-presentation:fallback' }),
  });
  const runtime = createAnimationRuntime(new URL('https://atlas.invalid/animation/'), {
    manifest: {}, objects: new Map(), sprites: new Map(), blobs: new Map(), buckets: new Map(), fetcher: fetch,
    creatures: new Map([['outfit-presentation:fallback', Object.freeze({
      outfit_presentation_id: 'outfit-presentation:fallback',
      static_program: staticProgram,
      walking_program: null,
      walking_fallback_reason: 'MOVING_GROUP_UNAVAILABLE',
    })]]),
  });
  const frame = runtime.creatureFrame(record, 9999, 'moving-in-place');
  assert.equal(frame.contentId, staticId);
  assert.equal(frame.phase, 0);
  assert.equal(frame.presentationMode, 'static-fallback');
  assert.equal(frame.fallbackReason, 'MOVING_GROUP_UNAVAILABLE');
});

test('concurrent bitmap loads sharing one animation bucket perform one verified fetch', async () => {
  const bucketBytes = new Uint8Array([1, 2, 3, 255, 5, 6, 7, 255]);
  const firstBytes = bucketBytes.slice(0, 4);
  const secondBytes = bucketBytes.slice(4, 8);
  const bucketDigest = await sha256ContentId(bucketBytes);
  const firstId = await sha256ContentId(firstBytes);
  const secondId = await sha256ContentId(secondBytes);
  let fetches = 0;
  const fetcher = async () => {
    fetches += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(bucketBytes, { status: 200, headers: { 'content-length': String(bucketBytes.byteLength) } });
  };
  const runtime = createAnimationRuntime(new URL('https://atlas.invalid/animation/'), {
    manifest: {}, objects: new Map(), creatures: new Map(), sprites: new Map(),
    blobs: new Map([
      [firstId, Object.freeze({ bucket: 'b0000', offset: 0, bytes: 4, width: 1, height: 1 })],
      [secondId, Object.freeze({ bucket: 'b0000', offset: 4, bytes: 4, width: 1, height: 1 })],
    ]),
    buckets: new Map([['b0000', Object.freeze({ id: 'b0000', path: 'buckets/b0000.rgba', bytes: 8, digest: bucketDigest })]]),
    fetcher,
  });

  const results = await Promise.all(Array.from({ length: 40 }, (_, index) => runtime.bitmap(index % 2 ? firstId : secondId)));
  assert.equal(results.length, 40);
  assert.equal(fetches, 1);
  assert.equal(runtime.stats().bucketLoads, 1);
  assert.equal(runtime.stats().cachedBuckets, 1);
  assert.equal(runtime.stats().cachedBitmaps, 2);
});
