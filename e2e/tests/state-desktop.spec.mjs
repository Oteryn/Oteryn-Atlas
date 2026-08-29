import { expect, test } from '@playwright/test';
import { DESKTOP_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { NAVIGATION_A, NAVIGATION_B } from '../support/qualification-fixture-scenarios.mjs';

test('desktop invalid search and out-of-bounds coordinates fail safely', async ({ page }) => {
  const runtime = captureRuntimeFailures(page); await gotoAtlas(page, DESKTOP_ENTRY); await waitForAtlas(page);
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled(); await expect(page.getByRole('button', { name: 'Zoom out' })).toBeEnabled(); await expect(page.getByRole('button', { name: 'Higher floor' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Lower floor' })).toBeVisible(); await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeVisible();
  const before = new URL(page.url()); const search = page.locator('#search-input'); await search.fill('definitely-not-a-published-entity'); const results = page.locator('#semantic-search-results-desktop'); await expect(results).toBeVisible(); await expect(results).toContainText('No published semantic result.'); await page.locator('#search-form button[type="submit"]').click();
  const afterInvalid = new URL(page.url()); expect(afterInvalid.searchParams.get('x')).toBe(before.searchParams.get('x')); expect(afterInvalid.searchParams.get('y')).toBe(before.searchParams.get('y')); expect(afterInvalid.searchParams.get('floor')).toBe(before.searchParams.get('floor'));
  await search.fill('999999 999999 -7'); await page.locator('#search-form button[type="submit"]').click(); await expect.poll(() => Number(new URL(page.url()).searchParams.get('x'))).toBeLessThan(999999); await expect.poll(() => Number(new URL(page.url()).searchParams.get('y'))).toBeLessThan(999999); await expect(page.locator('#runtime-badge')).toContainText('VERIFIED FULL-WORLD'); assertNoRuntimeFailures(runtime);
});

test('desktop coordinate replace-state, reload and browser history remain coherent', async ({ page }) => {
  const runtime = captureRuntimeFailures(page); await gotoAtlas(page, DESKTOP_ENTRY); await waitForAtlas(page); const historyLength = await page.evaluate(() => history.length);
  await page.locator('#search-input').fill(`${NAVIGATION_B.center.x} ${NAVIGATION_B.center.y} ${NAVIGATION_B.center.floor}`); await page.locator('#search-form button[type="submit"]').click(); await expect.poll(() => new URL(page.url()).searchParams.get('x')).toBe(String(NAVIGATION_B.center.x)); expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.reload({ waitUntil: 'domcontentloaded' }); await waitForAtlas(page); expect(new URL(page.url()).searchParams.get('x')).toBe(String(NAVIGATION_B.center.x));
  const second = new URL(page.url()); second.searchParams.set('x', String(NAVIGATION_A.center.x)); second.searchParams.set('y', String(NAVIGATION_A.center.y)); await gotoAtlas(page, second.href); await waitForAtlas(page); expect(new URL(page.url()).searchParams.get('x')).toBe(String(NAVIGATION_A.center.x));
  await page.goBack({ waitUntil: 'domcontentloaded' }); await waitForAtlas(page); expect(new URL(page.url()).searchParams.get('x')).toBe(String(NAVIGATION_B.center.x)); await page.goForward({ waitUntil: 'domcontentloaded' }); await waitForAtlas(page);
  const forward = new URL(page.url()); expect(forward.searchParams.get('x')).toBe(String(NAVIGATION_A.center.x)); expect(forward.searchParams.get('y')).toBe(String(NAVIGATION_A.center.y)); expect(forward.searchParams.get('floor')).toBe('-7'); assertNoRuntimeFailures(runtime);
});
