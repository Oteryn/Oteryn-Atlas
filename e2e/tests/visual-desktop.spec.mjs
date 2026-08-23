import { expect, test } from '@playwright/test';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

const ENTRY = '/web/fullworld.html?x=32361&y=32198&floor=-7&zoom=2&mode=map&creatures=npc,monster&animation=off';

async function overlayOpaquePixels(page) {
  return page.locator('#creature-overlay').evaluate((canvas) => {
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) opaque += 1;
    return opaque;
  });
}

test('desktop stable view-mode control retains reviewed visual contract', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, ENTRY);
  await waitForAtlas(page);
  await expect(page.locator('#view-mode-control')).toHaveScreenshot('desktop-view-mode.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
  assertNoRuntimeFailures(runtime);
});

test('creature overlay clears previous-floor pixels synchronously before replacement data resolves', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, ENTRY);
  await waitForAtlas(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS'
    && globalThis.__OTERYN_ATLAS_CREATURES__?.drawnRecords > 0, null, { timeout: 30_000 });
  expect(await overlayOpaquePixels(page)).toBeGreaterThan(0);

  let releaseChunk;
  const chunkGate = new Promise((resolve) => { releaseChunk = resolve; });
  await page.route('**/data/creatures/chunks/**', async (route) => {
    await chunkGate;
    await route.continue();
  });

  await page.locator('#floor-up').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe('-7');
  await expect.poll(() => overlayOpaquePixels(page), {
    message: 'stale creature pixels from the previous floor must disappear immediately',
  }).toBe(0);

  releaseChunk();
  await page.unroute('**/data/creatures/chunks/**');
  assertNoRuntimeFailures(runtime);
});

