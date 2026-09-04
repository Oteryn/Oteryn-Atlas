import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

const desktopTopbarCall = "compareReviewedSnapshotOutsideLocators(page, testInfo, '.topbar', 'desktop-topbar.png', ['.coordinate-strip'])";
const desktopCall = "compareReviewedSnapshotOutsideLocators(page, testInfo, '#mobile-inspector-panel', 'desktop-inspector.png', ['#inspector-content'])";
const mobileCall = "compareReviewedSnapshotOutsideLocators(page, testInfo, '#mobile-inspector-panel', 'mobile-inspector-panel.png', ['#inspector-content'])";

test('qualification visual acceptance compares positive stable chrome independently from fixture-owned facts', async () => {
  const helper = await read('e2e/support/visual-oracle.mjs');
  const desktop = await read('e2e/tests/visual-desktop.spec.mjs');
  const mobile = await read('e2e/tests/visual-mobile.spec.mjs');

  assert.match(helper, /export async function compareReviewedSnapshotOutsideLocators/);
  assert.match(helper, /readFile\(testInfo\.snapshotPath\(snapshotName\)\)/, 'Playwright snapshotPath must own project/platform suffixing exactly once');
  assert.doesNotMatch(helper, /testInfo\.project\.name|process\.platform/, 'reviewed snapshot helper must not duplicate Playwright project/platform suffixes');
  assert.match(helper, /container\.locator\(':scope > \*'\)/, 'qualification chrome must be an explicit positive set of stable direct children');
  assert.match(helper, /node\.matches\(selector\)\s*\|\|\s*node\.querySelector\(selector\)/, 'a direct child containing fixture-owned content must be excluded from the stable chrome set');
  assert.match(helper, /stableRectangles/, 'stable chrome rectangles must be modeled separately from fixture-owned rectangles');
  assert.match(helper, /dynamicRectangles/, 'fixture-owned rectangles must retain a separate comparison channel');
  assert.doesNotMatch(helper, /atlas-reviewed-snapshot-normalize-scrollbars|scrollbar-width:\s*none\s*!important|::-webkit-scrollbar/, 'qualification chrome must not mutate rendering to chase a production snapshot');

  assert.ok(desktop.includes(desktopTopbarCall), 'desktop qualification must keep fixture-owned coordinates separate from stable topbar chrome');
  assert.ok(desktop.includes(desktopCall), 'desktop qualification inspector must keep fixture-owned facts separate from stable chrome');
  assert.ok(mobile.includes(mobileCall), 'mobile qualification inspector must keep fixture-owned facts separate from stable chrome');
  assert.match(desktop, /toContainText\(semanticLabel\)/, 'desktop fixture-owned inspector facts must retain their semantic oracle');
  assert.match(mobile, /toContainText\(semanticLabel\)/, 'mobile fixture-owned inspector facts must retain their semantic oracle');

  assert.match(desktop, /toHaveScreenshot\('desktop-topbar\.png'/, 'production desktop topbar must retain its complete exact golden');
  assert.match(desktop, /toHaveScreenshot\('desktop-inspector\.png'/, 'production desktop inspector must retain its complete exact golden');
  assert.match(mobile, /toHaveScreenshot\('mobile-inspector-panel\.png'/, 'production mobile inspector must retain its complete exact golden');
});
