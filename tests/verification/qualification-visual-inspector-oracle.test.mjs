import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

const desktopCall = "compareReviewedSnapshotOutsideLocators(page, testInfo, '#mobile-inspector-panel', 'desktop-inspector.png', ['#inspector-content'])";
const mobileCall = "compareReviewedSnapshotOutsideLocators(page, testInfo, '#mobile-inspector-panel', 'mobile-inspector-panel.png', ['#inspector-content'])";

test('qualification inspector visual acceptance preserves reviewed chrome while allowing fixture-owned facts', async () => {
  const helper = await read('e2e/support/visual-oracle.mjs');
  const desktop = await read('e2e/tests/visual-desktop.spec.mjs');
  const mobile = await read('e2e/tests/visual-mobile.spec.mjs');

  assert.match(helper, /export async function compareReviewedSnapshotOutsideLocators/);
  assert.match(helper, /testInfo\.snapshotPath/);
  assert.match(helper, /comparePngOutsideRects/);

  assert.ok(desktop.includes(desktopCall), 'desktop qualification must compare the reviewed production inspector outside fixture-owned facts');
  assert.ok(mobile.includes(mobileCall), 'mobile qualification must compare the reviewed production inspector outside fixture-owned facts');

  assert.match(desktop, /toHaveScreenshot\('desktop-inspector\.png'/, 'production desktop inspector must retain its complete exact golden');
  assert.match(mobile, /toHaveScreenshot\('mobile-inspector-panel\.png'/, 'production mobile inspector must retain its complete exact golden');
});
