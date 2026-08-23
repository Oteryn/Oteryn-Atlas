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
test('creature overlay never paints previous-floor records during a view event', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, ENTRY);
  await waitForAtlas(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS'
    && globalThis.__OTERYN_ATLAS_CREATURES__?.render?.anchors?.length > 0, null, { timeout: 30_000 });
  expect(await overlayOpaquePixels(page)).toBeGreaterThan(0);

  const transition = await page.evaluate(() => {
    const current = globalThis.__OTERYN_ATLAS_VIEW__;
    const next = Object.freeze({ ...current, floor: current.floor + 1 });
    window.dispatchEvent(new CustomEvent('oteryn-atlas-view', { detail: { view: next } }));
    const canvas = document.querySelector('#creature-overlay');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) opaque += 1;
    return { opaque, fromFloor: current.floor, toFloor: next.floor };
  });

  expect(transition.toFloor).not.toBe(transition.fromFloor);
  expect(transition.opaque, 'previous-floor creature pixels must be absent immediately after the view event').toBe(0);
  assertNoRuntimeFailures(runtime);
});
