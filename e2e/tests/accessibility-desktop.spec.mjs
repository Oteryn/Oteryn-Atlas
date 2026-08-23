import { expect, test } from '@playwright/test';
import { DESKTOP_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

test('desktop critical controls expose truthful accessible names and disabled states', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await expect(page.getByRole('textbox', { name: 'Global semantic Atlas search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Higher floor' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Lower floor' })).toBeEnabled();

  for (const label of ['Areas', 'Subareas', 'Towns', 'Temples', 'Teleports / transitions', 'Houses', 'House doors', 'Action IDs', 'Unique IDs', 'Waypoints', 'Mechanics', 'Raids / encounters', 'Quest areas', 'POIs']) {
    const row = page.locator('#semantic-layer-list .layer').filter({ has: page.getByText(label, { exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('input')).toBeDisabled();
  }
  assertNoRuntimeFailures(runtime);
});

test('desktop keyboard navigation reaches search and zoom controls', async ({ page }) => {
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  await page.locator('body').focus();
  const reached = new Set();
  for (let step = 0; step < 18; step += 1) {
    await page.keyboard.press('Tab');
    reached.add(await page.evaluate(() => document.activeElement?.id ?? ''));
  }
  expect(reached.has('search-input')).toBe(true);
  expect(reached.has('zoom-out')).toBe(true);
  expect(reached.has('zoom-in')).toBe(true);
});
