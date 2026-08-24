import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return fs.readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('creature animation equality is scoped to exact backing-canvas pixels', async () => {
  const oracle = await read('e2e/support/visual-oracle.mjs');
  const mobile = await read('e2e/tests/visual-mobile.spec.mjs');
  const live = await read('e2e/tests/live-creature-preview.cjs');

  assert.match(oracle, /canvas\.toDataURL\('image\/png'\)/);
  assert.match(oracle, /changedOutside === 0/);
  assert.match(mobile, /canvasPng\(page, '#creature-overlay'\)/);
  assert.match(mobile, /exactPngPixelsEqual\(page, staticMonsterPixels/);
  assert.doesNotMatch(mobile, /const staticMonsterPixels = await page\.locator\('#creature-overlay'\)\.screenshot/);
  assert.match(live, /captureCreaturePixelState\(page\)/);
  const waitBody = live.slice(live.indexOf('async function waitForCreaturePixelState'), live.indexOf('async function waitSemanticReady'));
  assert.match(waitBody, /exactPngPixelsEqual/);
  assert.doesNotMatch(waitBody, /\.screenshot\(/);
});
