import { expect, test } from '@playwright/test';
import { MOBILE_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { assertUserVisibleSurface, captureUserVisualEvidence } from '../support/user-acceptance.mjs';

test('mobile Atlas-owned chrome and drawers retain reviewed user-facing visual contracts', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${MOBILE_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);

  const initialMetrics = await assertUserVisibleSurface(page, {
    label: 'mobile initial Atlas',
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '.topbar', label: 'mobile topbar' },
      { selector: '#zoom-out', label: 'zoom out', interactive: true, minWidth: 29, minHeight: 29 },
      { selector: '#zoom-in', label: 'zoom in', interactive: true, minWidth: 29, minHeight: 29 },
      { selector: '#mobile-controls-toggle', label: 'open controls', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#mobile-inspector-toggle', label: 'open inspector', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#map-frame', label: 'mobile world map' },
    ],
  });
  await expect(page.locator('.topbar')).toHaveScreenshot('mobile-topbar.png', {
    animations: 'disabled', caret: 'hide', scale: 'css',
  });
  await captureUserVisualEvidence(page, testInfo, 'mobile.initial', {
    surfaceMetrics: initialMetrics,
    note: 'Initial mobile world view with primary zoom and drawer controls reachable.',
  });

  const controlsToggle = page.getByRole('button', { name: 'Open Atlas controls' });
  await controlsToggle.tap();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  const modes = page.locator('#view-mode-control');
  await modes.scrollIntoViewIfNeeded();
  await expect(modes).toHaveScreenshot('mobile-view-mode.png', {
    animations: 'disabled', caret: 'hide', scale: 'css',
  });
  const controlsMetrics = await assertUserVisibleSurface(page, {
    label: 'mobile controls drawer',
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '#mobile-controls-panel', label: 'controls drawer' },
      { selector: '#mobile-controls-close', label: 'close controls', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#mobile-search-input', label: 'mobile search', interactive: true, minHeight: 34 },
      { selector: '#view-mode-control', label: 'view modes' },
    ],
  });
  await expect(page.locator('#mobile-controls-panel')).toHaveScreenshot('mobile-controls-panel.png', {
    animations: 'disabled', caret: 'hide', scale: 'css',
  });
  await captureUserVisualEvidence(page, testInfo, 'mobile.controls', {
    surfaceMetrics: controlsMetrics,
    note: 'Open mobile controls drawer with search and view-mode controls visible and hit-testable.',
  });

  const mobileSearch = page.locator('#mobile-search-input');
  await mobileSearch.fill('Thais');
  const results = page.locator('#semantic-search-results-mobile');
  await expect(results).toBeVisible();
  const thais = results.getByRole('option').filter({ hasText: 'Thais' }).first();
  await expect(thais).toBeVisible();
  await captureUserVisualEvidence(page, testInfo, 'mobile.search', {
    note: 'Mobile semantic-search result list as presented inside the controls drawer.',
  });
  await Promise.all([
    page.waitForURL((url) => Boolean(url.searchParams.get('semantic'))),
    thais.tap(),
  ]);
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText('Thais');

  const inspectorToggle = page.getByRole('button', { name: 'Open inspector' });
  await inspectorToggle.tap();
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.locator('#mobile-inspector-panel').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.right - innerWidth) <= 1 && rect.left >= -1;
  }), { message: 'mobile inspector drawer must finish its open transition inside the viewport' }).toBeTruthy();
  const inspectorMetrics = await assertUserVisibleSurface(page, {
    label: 'mobile inspector drawer',
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '#mobile-inspector-panel', label: 'inspector drawer' },
      { selector: '#mobile-inspector-close', label: 'close inspector', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#inspector-content', label: 'inspector facts' },
    ],
  });
  await expect(page.locator('#mobile-inspector-panel')).toHaveScreenshot('mobile-inspector-panel.png', {
    animations: 'disabled', caret: 'hide', scale: 'css',
  });
  await captureUserVisualEvidence(page, testInfo, 'mobile.inspector', {
    surfaceMetrics: inspectorMetrics,
    note: 'Mobile inspector drawer after a real semantic navigation.',
  });
  await page.getByRole('button', { name: 'Close inspector' }).tap();

  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeMetrics = await assertUserVisibleSurface(page, {
    label: 'mobile landscape Atlas',
    minimumMapAreaRatio: 0.58,
    elements: [
      { selector: '.topbar', label: 'landscape topbar' },
      { selector: '#map-frame', label: 'landscape world map' },
      { selector: '#mobile-controls-toggle', label: 'landscape controls toggle', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#mobile-inspector-toggle', label: 'landscape inspector toggle', interactive: true, minWidth: 34, minHeight: 34 },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'mobile.landscape', {
    surfaceMetrics: landscapeMetrics,
    note: 'Landscape-like mobile resize with the map and primary controls still usable.',
  });
  assertNoRuntimeFailures(runtime);
});
