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

function execution(ids = [desktopA, mobileA]) {
  return {
    schemaVersion: 1,
    hosted: { groupIds: ['e2e.full'], stableTestIds: ids },
    specialist: { groupIds: [], stableTestIds: [] },
  };
}

test('selection emits only exact protected hosted stable IDs in Playwright test-list syntax', () => {
  const result = buildProtectedPlaywrightSelection(list, execution());
  assert.deepEqual(result.stableTestIds, [desktopA, mobileA].sort());
  assert.equal(result.testListText, [
    '[desktop-chromium] › desktop.spec.mjs:10:3 › suite › A',
    '[mobile-chromium] › mobile.spec.mjs:7:1 › mobile A',
    '',
  ].join('\n'));
  assert(!result.testListText.includes('suite › B'));
});

test('selection fails closed when a planned hosted ID is missing from exact candidate census', () => {
  assert.throws(() => buildProtectedPlaywrightSelection(list, execution([desktopA, 'desktop-chromium::e2e/tests/missing.spec.mjs::missing'])), /missing/i);
});

test('selection rejects duplicate stable IDs in candidate Playwright list', () => {
  const duplicate = `${list}\n  [desktop-chromium] › desktop.spec.mjs:10:3 › suite › A\n`;
  assert.throws(() => buildProtectedPlaywrightSelection(duplicate, execution()), /duplicate/i);
});

test('selection never admits specialist IDs into hosted test list', () => {
  const value = execution([desktopA]);
  value.specialist = { groupIds: ['fullworld.animation-census'], stableTestIds: [desktopB] };
  const result = buildProtectedPlaywrightSelection(list, value);
  assert.deepEqual(result.stableTestIds, [desktopA]);
  assert(!result.testListText.includes('suite › B'));
});
