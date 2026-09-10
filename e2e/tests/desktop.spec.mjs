import { expect, test } from '@playwright/test';
import { discoverSemanticTarget } from '../support/user-journey-browser.mjs';
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

  const initial = new URL(page.url());
  await expect(page.locator('#coord-x')).toHaveText(initial.searchParams.get('x'));
  await expect(page.locator('#coord-y')).toHaveText(initial.searchParams.get('y'));
  await expect(page.locator('#coord-floor')).toHaveText(initial.searchParams.get('floor'));
  await expect.poll(() => runtime.partialResponses, { timeout: 30_000 }).toBeGreaterThan(0);

  await page.locator('#overview-toggle').check();
  await expect(page.locator('#status-layer')).toContainText('Overview PROVEN');

  const previousZoom = new URL(page.url()).searchParams.get('zoom');
  await page.locator('#zoom-in').click();
  await page.waitForFunction(
    (before) => new URL(location.href).searchParams.get('zoom') !== before,
    previousZoom,
  );

  const target = await discoverSemanticTarget(page);
  const search = page.locator('#search-input');
  await search.fill(target.label);
  const results = page.locator('#semantic-search-results-desktop');
  await expect(results).toBeVisible();
  const result = results.getByRole('option').filter({ hasText: target.label }).first();
  await expect(result).toBeVisible();

  const semanticNavigation = page.waitForURL(
    (url) => url.searchParams.get('semantic') === target.id,
    { timeout: 60_000 },
  );
  await result.click();
  await semanticNavigation;
  await waitForAtlas(page);

  await expect(page.locator('#inspector-content')).toContainText(target.label);
  await expect(page.locator('#inspector-content')).toContainText('Public ID');
  await expect(page.locator('[data-semantic-search-layer="town"]')).toContainText(target.label);
  assertNoRuntimeFailures(runtime);
});
