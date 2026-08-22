import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeFramebufferSamples } from '../../src/browser/framebuffer-probe.mjs';

const clear = [7, 11, 17, 255];

test('framebuffer probe classifies an all-clear sample as blank deterministically', () => {
  const samples = Array.from({ length: 12 }, (_, index) => ({
    recordId: `tile:${index}`,
    x: index,
    y: index + 1,
    rgba: clear,
  }));
  const result = summarizeFramebufferSamples(samples, clear);
  assert.equal(result.sampleCount, 12);
  assert.equal(result.nonClearSamples, 0);
  assert.equal(result.blank, true);
  assert.match(result.signature, /^[0-9a-f]{8}$/);
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.recordIds));
});

test('framebuffer probe detects non-clear pixels and changes signature', () => {
  const blank = summarizeFramebufferSamples([{ recordId: 'a', x: 1, y: 2, rgba: clear }], clear);
  const detail = summarizeFramebufferSamples([{ recordId: 'a', x: 1, y: 2, rgba: [120, 80, 40, 255] }], clear);
  assert.equal(detail.blank, false);
  assert.equal(detail.nonClearSamples, 1);
  assert.notEqual(detail.signature, blank.signature);
});

test('framebuffer probe rejects malformed or unbounded evidence', () => {
  assert.throws(() => summarizeFramebufferSamples([], clear), /sample/i);
  assert.throws(() => summarizeFramebufferSamples([{ recordId: 'a', x: 0, y: 0, rgba: [1, 2] }], clear), /rgba/i);
  assert.throws(() => summarizeFramebufferSamples(Array.from({ length: 513 }, (_, index) => ({ recordId: `x:${index}`, x: 0, y: 0, rgba: clear })), clear), /bounded/i);
});

test('framebuffer sampler probes only visible active-floor renderer records', async () => {
  const { sampleVisibleFramebufferRecords } = await import('../../src/browser/framebuffer-probe.mjs');
  const reads = [];
  const gl = {
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    readPixels(x, y, width, height, format, type, target) {
      reads.push({ x, y, width, height, format, type });
      target.set([100, 90, 80, 255]);
    },
  };
  const records = [
    { tileRecordId: 'visible', floor: -7, x: 100, y: 200, primitive: { widthUnits: 32, heightUnits: 32, displacement: { dxUnits: 0, dyUnits: 0 } } },
    { tileRecordId: 'wrong-floor', floor: -6, x: 100, y: 200, primitive: { widthUnits: 32, heightUnits: 32, displacement: { dxUnits: 0, dyUnits: 0 } } },
  ];
  const probe = sampleVisibleFramebufferRecords(gl, records, { x: 100, y: 200, floor: -7, zoom: 1 }, { width: 100, height: 100 }, 1, clear);
  assert(probe);
  assert.equal(probe.blank, false);
  assert.deepEqual(probe.recordIds, ['visible']);
  assert.equal(reads.length, 9);
  assert(reads.every((entry) => entry.x >= 0 && entry.x < 100 && entry.y >= 0 && entry.y < 100));
});

test('framebuffer sampler returns null when no current-floor primitive intersects the framebuffer', async () => {
  const { sampleVisibleFramebufferRecords } = await import('../../src/browser/framebuffer-probe.mjs');
  const gl = { RGBA: 1, UNSIGNED_BYTE: 2, readPixels() { throw new Error('must not read'); } };
  const records = [{ tileRecordId: 'far', floor: -7, x: 1000, y: 2000, primitive: { widthUnits: 32, heightUnits: 32, displacement: { dxUnits: 0, dyUnits: 0 } } }];
  assert.equal(sampleVisibleFramebufferRecords(gl, records, { x: 100, y: 200, floor: -7, zoom: 1 }, { width: 100, height: 100 }, 1, clear), null);
});