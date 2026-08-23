import { expect, test } from '@playwright/test';
import { MOBILE_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

test('mobile drawer is keyboard operable and exposes reachable critical controls', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);

  const toggle = page.locator('#mobile-controls-toggle');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('textbox', { name: 'Global semantic Atlas search' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  assertNoRuntimeFailures(runtime);
});

test('mobile touch zoom remains reachable and changes the real URL state', async ({ page }) => {
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);
  const before = Number(new URL(page.url()).searchParams.get('zoom'));
  await page.getByRole('button', { name: 'Zoom in' }).tap();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).toBeGreaterThan(before);
});
