import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProtectedPlaywrightSelection } from '../../tools/verification/protected-playwright-selection.mjs';

const desktopA = 'desktop-chromium::e2e/tests/desktop.spec.mjs::suite › A';
const desktopB = 'desktop-chromium::e2e/tests/desktop.spec.mjs::suite › B';
const mobileA = 'mobile-chromium::e2e/tests/mobile.spec.mjs::mobile A';

const list = [
  'Listing tests:',
  '  [desktop-chromium] › desktop.spec.mjs:10:3 › suite › A',
  '  [desktop-chromium] › desktop.spec.mjs:20:3 › suite › B',
  '  [mobile-chromium] › mobile.spec.mjs:7:1 › mobile A',
  'Total: 3 tests in 2 files',
].join('\n');

function execution() {
  return {
    schemaVersion: 1,
    hosted: {
      groupIds: ['e2e.full'],
      stableTestIds: [desktopA, desktopB, mobileA],
      protectedStableTestIds: [desktopA, mobileA],
      candidateAdditionalStableTestIds: [desktopB],
    },
    specialist: { groupIds: [], stableTestIds: [] },
  };
}

test('protected placement emits only protected-base IDs from protected-base Playwright list', () => {
  const result = buildProtectedPlaywrightSelection(list, execution(), { placement: 'protected' });
  assert.deepEqual(result.stableTestIds, [desktopA, mobileA].sort());
  assert.equal(result.testListText, [
    '[desktop-chromium] › desktop.spec.mjs:10:3 › suite › A',
    '[mobile-chromium] › mobile.spec.mjs:7:1 › mobile A',
    '',
  ].join('\n'));
  assert(!result.testListText.includes('suite › B'));
});

test('candidate-additions placement emits only widen-only new IDs from candidate Playwright list', () => {
  const result = buildProtectedPlaywrightSelection(list, execution(), { placement: 'candidate-additions' });
  assert.deepEqual(result.stableTestIds, [desktopB]);
  assert.equal(result.testListText, '[desktop-chromium] › desktop.spec.mjs:20:3 › suite › B\n');
  assert(!result.testListText.includes('suite › A'));
});

test('selection fails closed when a required source-placement ID is absent from its exact census', () => {
  const withoutProtectedA = list.replace('  [desktop-chromium] › desktop.spec.mjs:10:3 › suite › A\n', '');
  assert.throws(() => buildProtectedPlaywrightSelection(withoutProtectedA, execution(), { placement: 'protected' }), /missing/i);
  const withoutAddition = list.replace('  [desktop-chromium] › desktop.spec.mjs:20:3 › suite › B\n', '');
  assert.throws(() => buildProtectedPlaywrightSelection(withoutAddition, execution(), { placement: 'candidate-additions' }), /missing/i);
});

test('selection rejects duplicate stable IDs in either source Playwright list', () => {
  const duplicate = `${list}\n  [desktop-chromium] › desktop.spec.mjs:10:3 › suite › A\n`;
  assert.throws(() => buildProtectedPlaywrightSelection(duplicate, execution(), { placement: 'protected' }), /duplicate/i);
});

test('selection never admits specialist IDs into either hosted test list', () => {
  const value = execution();
  value.specialist = { groupIds: ['fullworld.animation-census'], stableTestIds: [desktopA] };
  assert.throws(() => buildProtectedPlaywrightSelection(list, value, { placement: 'protected' }), /placement overlap/i);
  assert.throws(() => buildProtectedPlaywrightSelection(list, value, { placement: 'candidate-additions' }), /placement overlap/i);
});

test('unknown selection placement fails closed', () => {
  assert.throws(() => buildProtectedPlaywrightSelection(list, execution(), { placement: 'candidate-all' }), /placement/i);
});
