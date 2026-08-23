import { expect, test } from '@playwright/test';
import {
  MOBILE_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

test('mobile Atlas-owned chrome matches reviewed visual baseline', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);
  await expect(page.locator('.topbar')).toHaveScreenshot('mobile-topbar.png', { animations: 'disabled', caret: 'hide' });

  const controlsToggle = page.getByRole('button', { name: 'Open Atlas controls' });
  await controlsToggle.tap();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  const modes = page.locator('#view-mode-control');
  await modes.scrollIntoViewIfNeeded();
  await expect(modes).toHaveScreenshot('mobile-view-mode.png', { animations: 'disabled', caret: 'hide' });
  assertNoRuntimeFailures(runtime);
});