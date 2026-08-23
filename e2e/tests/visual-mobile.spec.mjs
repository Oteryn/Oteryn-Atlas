import { expect, test } from '@playwright/test';
import { MOBILE_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

test('mobile view-mode control retains reviewed visual contract inside the controls drawer', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);
  await page.locator('#mobile-controls-toggle').click();
  await expect(page.locator('#mobile-controls-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#view-mode-control')).toHaveScreenshot('mobile-view-mode.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
  assertNoRuntimeFailures(runtime);
});
