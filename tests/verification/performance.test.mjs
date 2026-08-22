import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertStructuralBudgets,
  deterministicPerformanceActions,
  deterministicSoakCycleActions,
  detectMonotonicGrowth,
  findDuplicates,
  runtimeResourceSnapshot,
  summarizeNumericSeries,
} from '../../e2e/support/performance.mjs';

function factualRuntime(overrides = {}) {
  const input = {
    fullworld: {
      performanceProfile: {
        drawCallTarget: 1,
        maxLoadedChunks: 16,
        maxLoadedGroups: 96,
        gpuTextureBudgetBytes: 384 * 1024 * 1024,
        semanticCacheBytes: 24 * 1024 * 1024,
      },
      measured: {
        drawCalls: 1,
        drawCallTarget: 1,
        retainedChunkCount: 7,
        maxLoadedChunks: 16,
        retainedRangeGroups: 28,
        maxLoadedGroups: 96,
        gpuTextureAllocatedBytes: 48 * 1024 * 1024,
        gpuTextureBudgetBytes: 384 * 1024 * 1024,
        jsHeapBytes: 32 * 1024 * 1024,
        peakJsHeapBytes: 36 * 1024 * 1024,
        rangeRequests: 12,
        rangeAuthenticatedBytes: 2_000_000,
        rangeCacheBytes: 1_000_000,
        pixelNetworkBytes: 500_000,
        retainedPrimitives: 800,
        visiblePrimitives: 320,
      },
    },
    renderer: {
      generation: 12,
      drawCalls: 1,
      retainedChunks: 7,
      retainedGroups: 28,
      renderMs: 3.5,
      gpuRenderMs: null,
      visiblePrimitives: 320,
      retainedPrimitives: 800,
    },
    creatures: {
      status: 'PASS',
      cacheChunks: 8,
      visibleRecords: 14,
      drawnRecords: 9,
      pixelDrawnRecords: 5,
      markerDrawnRecords: 4,
      drawnNpcIcons: 3,
      render: {
        generation: 5,
        anchors: [
          { id: 'npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
          { id: 'monster:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        ],
      },
    },
    heap: { usedJSHeapSize: 31 * 1024 * 1024, totalJSHeapSize: 48 * 1024 * 1024 },
  };
  return { ...input, ...overrides };
}

test('runtime resource snapshot normalizes structural budgets and bounded evidence', () => {
  const snapshot = runtimeResourceSnapshot(factualRuntime());
  assert.equal(snapshot.drawCalls, 1);
  assert.equal(snapshot.drawCallTarget, 1);
  assert.equal(snapshot.retainedChunks, 7);
  assert.equal(snapshot.maxLoadedChunks, 16);
  assert.equal(snapshot.retainedGroups, 28);
  assert.equal(snapshot.maxLoadedGroups, 96);
  assert.equal(snapshot.gpuTextureAllocatedBytes, 48 * 1024 * 1024);
  assert.equal(snapshot.gpuTextureBudgetBytes, 384 * 1024 * 1024);
  assert.equal(snapshot.semanticCacheBytes, 24 * 1024 * 1024);
  assert.equal(snapshot.rangeCacheBytes, 1_000_000);
  assert.equal(snapshot.creatureCacheChunks, 8);
  assert.equal(snapshot.jsHeapBytes, 32 * 1024 * 1024);
  assert.equal(snapshot.rangeRequests, 12);
  assert.deepEqual(snapshot.creatureAnchorIds, [
    'npc:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'monster:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ]);
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.creatureAnchorIds));
});

test('accepted structural budgets pass and controlled violations fail closed', () => {
  const sample = runtimeResourceSnapshot(factualRuntime());
  assert.doesNotThrow(() => assertStructuralBudgets(sample));
  for (const [field, value, pattern] of [
    ['drawCalls', 2, /drawCalls.*2.*1/i],
    ['retainedChunks', 17, /retainedChunks.*17.*16/i],
    ['retainedGroups', 97, /retainedGroups.*97.*96/i],
    ['gpuTextureAllocatedBytes', 384 * 1024 * 1024 + 1, /gpuTextureAllocatedBytes/i],
    ['rangeCacheBytes', 24 * 1024 * 1024 + 1, /rangeCacheBytes/i],
  ]) {
    assert.throws(() => assertStructuralBudgets({ ...sample, [field]: value }), pattern);
  }
  assert.throws(() => assertStructuralBudgets({ ...sample, maxLoadedChunks: null }), /maxLoadedChunks.*missing/i);
});

test('monotonic growth detector catches injected unbounded growth but accepts a plateau', () => {
  const injected = detectMonotonicGrowth([8, 9, 10, 11], { warmup: 1, minPoints: 3 });
  assert.equal(injected.growing, true);
  assert.deepEqual(injected.observed, [9, 10, 11]);
  assert.deepEqual(injected.deltas, [1, 1]);

  const plateau = detectMonotonicGrowth([8, 10, 10, 10], { warmup: 1, minPoints: 3 });
  assert.equal(plateau.growing, false);
  assert.deepEqual(plateau.deltas, [0, 0]);

  assert.throws(() => detectMonotonicGrowth([1, 2], { minPoints: 3 }), /at least 3/i);
  assert.throws(() => detectMonotonicGrowth([1, Number.NaN, 3]), /finite/i);
});

test('duplicate detector exposes injected overlay duplication deterministically', () => {
  assert.deepEqual(findDuplicates(['a', 'b', 'c']), []);
  assert.deepEqual(findDuplicates(['a', 'b', 'a', 'c', 'b']), ['a', 'b']);
});


test('normalized performance and soak workloads are frozen and byte-replayable', () => {
  const performanceA = deterministicPerformanceActions();
  const performanceB = deterministicPerformanceActions();
  const soakA = deterministicSoakCycleActions();
  const soakB = deterministicSoakCycleActions();
  assert.equal(JSON.stringify(performanceA), JSON.stringify(performanceB));
  assert.equal(JSON.stringify(soakA), JSON.stringify(soakB));
  assert(Object.isFrozen(performanceA));
  assert(Object.isFrozen(performanceA[0]));
  assert(Object.isFrozen(soakA));
  assert(Object.isFrozen(soakA[0]));
  assert.deepEqual(performanceA.map((action) => action.type), [
    'pan', 'pan', 'wheelZoom', 'wheelZoom', 'buttonZoom', 'buttonZoom',
    'creatures', 'creatures', 'mode', 'mode', 'floor', 'floor',
    'resize', 'resize', 'animation', 'animation',
  ]);
  assert.deepEqual(soakA.map((action) => action.type), [
    'pan', 'pan', 'wheelZoom', 'wheelZoom', 'creatures', 'creatures',
    'mode', 'mode', 'floor', 'floor', 'resize', 'resize',
  ]);
});

test('numeric summaries retain distributions without turning timing into an SLO', () => {
  const summary = summarizeNumericSeries([12, 4, 8, 16]);
  assert.deepEqual(summary, {
    count: 4,
    min: 4,
    max: 16,
    mean: 10,
    p50: 10,
    p95: 15.4,
  });
  assert.equal(summarizeNumericSeries([]), null);
  assert.throws(() => summarizeNumericSeries([1, Infinity]), /finite/i);
});
