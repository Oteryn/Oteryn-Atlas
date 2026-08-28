import { expect, test } from '@playwright/test';
import {
  MOBILE_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';
import { QUALIFICATION_SEMANTIC_RECORD } from '../support/qualification-fixture-scenarios.mjs';

test('mobile FullWorld exposes drawers and semantic navigation', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);

  await expect(page.locator('html')).toHaveAttribute('data-mobile-ui', 'ready');
  const controlsToggle = page.locator('#mobile-controls-toggle');
  await expect(controlsToggle).toBeVisible();
  await controlsToggle.click();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-controls-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#mobile-drawer-backdrop')).toBeVisible();

  const mobileSearch = page.locator('#mobile-search-input');
  await mobileSearch.fill(QUALIFICATION_SEMANTIC_RECORD.label);
  const results = page.locator('#semantic-search-results-mobile');
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

  const inspectorToggle = page.locator('#mobile-inspector-toggle');
  await inspectorToggle.click();
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#inspector-content')).toContainText(QUALIFICATION_SEMANTIC_RECORD.label);

  await page.keyboard.press('Escape');
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false');
  assertNoRuntimeFailures(runtime);
});
