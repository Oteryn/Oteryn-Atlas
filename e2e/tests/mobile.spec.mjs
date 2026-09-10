import { expect, test } from '@playwright/test';
import { discoverSemanticTarget } from '../support/user-journey-browser.mjs';
import {
  MOBILE_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

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

  await page.keyboard.press('Escape');
  const target = await discoverSemanticTarget(page);
  const findToggle = page.locator('#mobile-find-toggle');
  await findToggle.tap();
  await expect(page.locator('#mobile-controls-panel')).toHaveClass(/find-mode/);
  const mobileSearch = page.locator('#mobile-search-input');
  await mobileSearch.fill(target.label);
  const results = page.locator('#semantic-search-results-mobile');
  await expect(results).toBeVisible();
  const result = results.getByRole('option').filter({ hasText: target.label }).first();
  await expect(result).toBeVisible();

  const semanticNavigation = page.waitForURL(
    (url) => url.searchParams.get('semantic') === target.id,
    { timeout: 60_000 },
  );
  await result.tap();
  await semanticNavigation;
  await waitForAtlas(page);

  const inspectorToggle = page.locator('#mobile-inspector-toggle');
  await inspectorToggle.click();
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#inspector-content')).toContainText(target.label);

  await page.keyboard.press('Escape');
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false');
  assertNoRuntimeFailures(runtime);
});
