import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

test('desktop invalid search and out-of-bounds coordinates fail safely', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Higher floor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lower floor' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeVisible();

  const before = new URL(page.url());
  const search = page.locator('#search-input');
  await search.fill('definitely-not-a-published-entity');
  const results = page.locator('#semantic-search-results-desktop');
  await expect(results).toBeVisible();
  await expect(results).toContainText('No published semantic result.');
  await page.locator('#search-form button[type="submit"]').click();
  const afterInvalid = new URL(page.url());
  expect(afterInvalid.searchParams.get('x')).toBe(before.searchParams.get('x'));
  expect(afterInvalid.searchParams.get('y')).toBe(before.searchParams.get('y'));
  expect(afterInvalid.searchParams.get('floor')).toBe(before.searchParams.get('floor'));

  await search.fill('999999 999999 -7');
  await page.locator('#search-form button[type="submit"]').click();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('x'))).toBeLessThan(999999);
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('y'))).toBeLessThan(999999);
  await expect(page.locator('#runtime-badge')).toContainText('VERIFIED FULL-WORLD');
  assertNoRuntimeFailures(runtime);
});

test('desktop coordinate replace-state, reload and browser history remain coherent', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  const historyLength = await page.evaluate(() => history.length);

  await page.locator('#search-input').fill('32380 32250 -7');
  await page.locator('#search-form button[type="submit"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('x')).toBe('32380');
  expect(await page.evaluate(() => history.length)).toBe(historyLength);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  expect(new URL(page.url()).searchParams.get('x')).toBe('32380');

  const second = new URL(page.url());
  second.searchParams.set('x', '32390');
  second.searchParams.set('y', '32260');
  await gotoAtlas(page, second.href);
  await waitForAtlas(page);
  expect(new URL(page.url()).searchParams.get('x')).toBe('32390');

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  expect(new URL(page.url()).searchParams.get('x')).toBe('32380');

  await page.goForward({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  const forward = new URL(page.url());
  expect(forward.searchParams.get('x')).toBe('32390');
  expect(forward.searchParams.get('y')).toBe('32260');
  expect(forward.searchParams.get('floor')).toBe('-7');
  assertNoRuntimeFailures(runtime);
});
