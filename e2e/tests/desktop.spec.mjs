import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  isQualificationFixtureExecution,
  qualificationAnchor,
  waitForAtlas,
} from './runtime.mjs';

test('desktop FullWorld qualifies, streams verified ranges and navigates semantic search', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  const anchor = await qualificationAnchor(page);
  await expect(page.locator('#coord-x')).toHaveText(String(anchor?.x ?? 32369));
  await expect(page.locator('#coord-y')).toHaveText(String(anchor?.y ?? 32241));
  await expect(page.locator('#coord-floor')).toHaveText(String(anchor?.floor ?? -7));
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
  const semanticLabel = isQualificationFixtureExecution() ? 'Fixture Harbor' : 'Thais';
  await search.fill(semanticLabel);
  const results = page.locator('#semantic-search-results-desktop');
  await expect(results).toBeVisible();
  const thais = results.locator('.semantic-search-result').filter({ hasText: semanticLabel }).first();
  await expect(thais).toBeVisible();

  const semanticNavigation = page.waitForURL(
    (url) => Boolean(url.searchParams.get('semantic')),
    { timeout: 60_000 },
  );
  await thais.click();
  await semanticNavigation;
  await waitForAtlas(page);

  await expect(page.locator('#inspector-content')).toContainText(semanticLabel);
  await expect(page.locator('#inspector-content')).toContainText('Stable public id');
  await expect(page.locator('[data-semantic-search-layer="town"]')).toContainText(semanticLabel);
  assertNoRuntimeFailures(runtime);
});
