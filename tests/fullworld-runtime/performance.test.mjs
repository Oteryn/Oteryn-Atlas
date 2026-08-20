import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameScheduler } from '../../src/browser/frame-scheduler.mjs';
import { resolvePerformanceProfile } from '../../src/browser/fullworld-performance.mjs';
import { VerifiedContentCache } from '../../src/browser/verified-content-cache.mjs';
import { sha256ContentId } from '../../src/browser/loader.mjs';

test('reference and local-max profiles preserve deterministic behavior while changing only budgets', () => {
  const reference = resolvePerformanceProfile('?perf=reference', { hardwareConcurrency: 16, deviceMemoryGiB: 64 });
  const local = resolvePerformanceProfile('?perf=local-max', { hardwareConcurrency: 16, deviceMemoryGiB: 64 });
  assert.equal(reference.name, 'reference');
  assert.equal(reference.groupConcurrency, 4);
  assert.equal(reference.prefetchTiles, 4);
  assert.equal(reference.semanticCacheBytes, 24 * 1024 * 1024);
  assert.equal(reference.maxLoadedChunks, 16);
  assert.equal(reference.maxLoadedGroups, 96);
  assert.equal(reference.gpuTextureBudgetBytes, 384 * 1024 * 1024);
  assert.equal(reference.drawCallTarget, 1);
  assert.equal(local.name, 'local-max');
  assert.equal(local.groupConcurrency, 12);
  assert.equal(local.prefetchTiles, 12);
  assert.equal(local.semanticCacheBytes, 256 * 1024 * 1024);
  assert.equal(local.maxLoadedChunks, 64);
  assert.equal(local.maxLoadedGroups, 384);
  assert.equal(local.gpuTextureBudgetBytes, 768 * 1024 * 1024);
  assert.equal(local.drawCallTarget, 1);
  assert.equal(local.capture, false);
  assert.equal(local.synchronousEvidence, false);
});

test('auto profile is capability-driven rather than machine-model hardcoded', () => {
  assert.equal(resolvePerformanceProfile('?perf=auto', { hardwareConcurrency: 4, deviceMemoryGiB: 4 }).name, 'reference');
  assert.equal(resolvePerformanceProfile('?perf=auto', { hardwareConcurrency: 12, deviceMemoryGiB: 16 }).name, 'local-max');
  assert.throws(() => resolvePerformanceProfile('?perf=turbo', { hardwareConcurrency: 12 }), /unsupported Atlas performance profile/);
});

test('frame scheduler coalesces repeated dirty signals into one animation frame', () => {
  const queue = [];
  const reasons = [];
  const scheduler = createFrameScheduler((_timestamp, reason) => reasons.push(reason), {
    requestFrame: (callback) => { queue.push(callback); return queue.length; },
    cancelFrame: () => {},
  });
  scheduler.schedule('drag-1');
  scheduler.schedule('drag-2');
  scheduler.schedule('drag-3');
  assert.equal(queue.length, 1);
  queue.shift()(1);
  assert.deepEqual(reasons, ['drag-3']);
  assert.equal(scheduler.stats().rendered, 1);
  assert.equal(scheduler.stats().coalesced, 2);
});

test('verified persistent cache re-hashes bytes before reuse and rejects corruption', async () => {
  const responses = new Map();
  const cacheStorage = {
    async open() {
      return {
        match: async (key) => responses.get(String(key))?.clone() ?? undefined,
        put: async (key, response) => { responses.set(String(key), response.clone()); },
        delete: async (key) => responses.delete(String(key)),
      };
    },
  };
  const cache = new VerifiedContentCache({ cacheStorage, enabled: true, maxEntryBytes: 1024 });
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const contentId = await sha256ContentId(bytes);
  assert.equal(await cache.put(contentId, bytes), true);
  assert.deepEqual([...await cache.get(contentId, 4)], [1, 2, 3, 4]);
  const key = cache.key(contentId);
  responses.set(key, new Response(new Uint8Array([1, 2, 3, 5])));
  assert.equal(await cache.get(contentId, 4), null);
  assert.equal(cache.stats().rejected, 1);
});
