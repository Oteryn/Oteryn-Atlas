import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detailQualificationSatisfied,
  recordsForResidentBuckets,
  renderRecordBucket,
} from '../../src/browser/fullworld-progressive.mjs';

function catalogs() {
  const pixelCatalog = {
    sprites: new Map([
      [10, { contentId: 'sha256:a', width: 32, height: 32 }],
      [20, { contentId: 'sha256:b', width: 64, height: 32 }],
    ]),
  };
  const runtimeCatalog = {
    blobs: new Map([
      ['sha256:a', { bucket: '0a', width: 32, height: 32 }],
      ['sha256:b', { bucket: '0b', width: 64, height: 32 }],
    ]),
  };
  return { pixelCatalog, runtimeCatalog };
}

test('progressive render records become eligible only after their authenticated bucket is resident', () => {
  const { pixelCatalog, runtimeCatalog } = catalogs();
  const records = [
    { primitive: { spriteSourceId: 10 } },
    { primitive: { spriteSourceId: 20 } },
  ];
  assert.equal(renderRecordBucket(records[0], pixelCatalog, runtimeCatalog), '0a');
  assert.deepEqual(recordsForResidentBuckets(records, pixelCatalog, runtimeCatalog, new Set()), []);
  assert.deepEqual(recordsForResidentBuckets(records, pixelCatalog, runtimeCatalog, new Set(['0b'])), [records[1]]);
  assert.deepEqual(recordsForResidentBuckets(records, pixelCatalog, runtimeCatalog, new Set(['0a', '0b'])), records);
});

test('detail qualification rejects a nominal PASS that painted no authenticated detail', () => {
  const base = {
    status: 'PASS',
    view: { zoom: 2 },
    measured: {
      visibleRangeGroups: 2,
      retainedTiles: 10,
      submittedPrimitives: 0,
      loadedPixelBuckets: 0,
      drawCalls: 0,
    },
  };
  assert.equal(detailQualificationSatisfied(base), false);
  assert.equal(detailQualificationSatisfied({
    ...base,
    measured: {
      ...base.measured,
      submittedPrimitives: 24,
      loadedPixelBuckets: 3,
      drawCalls: 1,
    },
  }), true);
});

test('overview-only and factually empty detail views remain valid', () => {
  assert.equal(detailQualificationSatisfied({ status: 'PASS', view: { zoom: 0.25 }, measured: {} }), true);
  assert.equal(detailQualificationSatisfied({
    status: 'PASS',
    view: { zoom: 2 },
    measured: { visibleRangeGroups: 0, retainedTiles: 0, submittedPrimitives: 0, loadedPixelBuckets: 0, drawCalls: 0 },
  }), true);
});
