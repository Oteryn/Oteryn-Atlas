import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';
import { QUALIFICATION_FIXTURE_CENTER, QUALIFICATION_SEMANTIC_RECORD } from '../support/qualification-fixture-scenarios.mjs';

test('desktop FullWorld qualifies, streams verified ranges and navigates semantic search', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await expect(page.locator('#coord-x')).toHaveText(String(QUALIFICATION_FIXTURE_CENTER.x));
  await expect(page.locator('#coord-y')).toHaveText(String(QUALIFICATION_FIXTURE_CENTER.y));
  await expect(page.locator('#coord-floor')).toHaveText(String(QUALIFICATION_FIXTURE_CENTER.floor));
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
  await search.fill(QUALIFICATION_SEMANTIC_RECORD.label);
  const results = page.locator('#semantic-search-results-desktop');
  await expect(results).toBeVisible();
  const fixtureHarbor = results.locator('.semantic-search-result').filter({ hasText: QUALIFICATION_SEMANTIC_RECORD.label }).first();
  await expect(fixtureHarbor).toBeVisible();

  const semanticNavigation = page.waitForURL(
    (url) => Boolean(url.searchParams.get('semantic')),
    { timeout: 60_000 },
  );
  await fixtureHarbor.click();
  await semanticNavigation;
  await waitForAtlas(page);

  await expect(page.locator('#inspector-content')).toContainText(QUALIFICATION_SEMANTIC_RECORD.label);
  await expect(page.locator('#inspector-content')).toContainText('Stable public id');
  await expect(page.locator('[data-semantic-search-layer="town"]')).toContainText(QUALIFICATION_SEMANTIC_RECORD.label);
  assertNoRuntimeFailures(runtime);
});
