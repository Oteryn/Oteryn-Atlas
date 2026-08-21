import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

test('desktop FullWorld qualifies, streams verified ranges and navigates semantic search', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await expect(page.locator('#coord-x')).toHaveText('32369');
  await expect(page.locator('#coord-y')).toHaveText('32241');
  await expect(page.locator('#coord-floor')).toHaveText('-7');
  await expect.poll(() => runtime.partialResponses, { timeout: 30_000 }).toBeGreaterThan(0);

  await page.locator('#overview-toggle').check();
  await expect(page.locator('#status-layer')).toContainText('Overview PROVEN');

  const previousZoom = new URL(page.url()).searchParams.get('zoom');
  await page.locator('#zoom-in').click();
  await page.waitForFunction(
    (before) => new URL(location.href).searchParams.get('zoom') !== before,
    previousZoom,
  );

  const search = page.locator('#search-input');
  await search.fill('Thais');
  const results = page.locator('#semantic-search-results-desktop');
  await expect(results).toBeVisible();
  const thais = results.locator('.semantic-search-result').filter({ hasText: 'Thais' }).first();
  await expect(thais).toBeVisible();

  const semanticNavigation = page.waitForURL(
    (url) => Boolean(url.searchParams.get('semantic')),
    { timeout: 60_000 },
  );
  await thais.click();
  await semanticNavigation;
  await waitForAtlas(page);

  await expect(page.locator('#inspector-content')).toContainText('Thais');
  await expect(page.locator('#inspector-content')).toContainText('Stable export id');
  await expect(page.locator('[data-semantic-search-layer="town"]')).toContainText('Thais');
  assertNoRuntimeFailures(runtime);
});
