import { expect, test } from '@playwright/test';
import { MOBILE_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

async function expectClosedDrawer(panel, toggle) {
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  expect(await panel.evaluate((element) => element.inert), 'closed mobile drawer must be removed from keyboard focus order').toBeTruthy();
}

async function expectElementInsideViewport(locator, page) {
  await locator.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    const viewport = page.viewportSize();
    return Boolean(box && viewport
      && box.x >= 0
      && box.y >= 0
      && box.x + box.width <= viewport.width + 1
      && box.y + box.height <= viewport.height + 1);
  }).toBeTruthy();
}

test('mobile drawers expose truthful hidden state and restore keyboard focus', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);

  const controlsToggle = page.locator('#mobile-controls-toggle');
  const controlsPanel = page.locator('#mobile-controls-panel');
  const controlsClose = page.getByRole('button', { name: 'Close Atlas controls' });
  await expectClosedDrawer(controlsPanel, controlsToggle);

  await controlsToggle.focus();
  await page.keyboard.press('Enter');
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(controlsToggle).toHaveAccessibleName('Hide Atlas controls');
  await expect(controlsPanel).not.toHaveAttribute('aria-hidden', 'true');
  expect(await controlsPanel.evaluate((element) => element.inert)).toBeFalsy();
  await expect(controlsClose).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Global semantic Atlas search' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectClosedDrawer(controlsPanel, controlsToggle);
  await expect(controlsToggle).toBeFocused();

  const inspectorToggle = page.locator('#mobile-inspector-toggle');
  const inspectorPanel = page.locator('#mobile-inspector-panel');
  const inspectorClose = page.getByRole('button', { name: 'Close inspector' });
  await expectClosedDrawer(inspectorPanel, inspectorToggle);
  await inspectorToggle.focus();
  await page.keyboard.press('Enter');
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(inspectorToggle).toHaveAccessibleName('Hide inspector');
  await expect(inspectorPanel).not.toHaveAttribute('aria-hidden', 'true');
  expect(await inspectorPanel.evaluate((element) => element.inert)).toBeFalsy();
  await expect(inspectorClose).toBeFocused();
  await page.keyboard.press('Escape');
  await expectClosedDrawer(inspectorPanel, inspectorToggle);
  await expect(inspectorToggle).toBeFocused();

  assertNoRuntimeFailures(runtime);
});

test('mobile core controls are touch-reachable in portrait and landscape', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);

  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  const zoomBefore = Number(new URL(page.url()).searchParams.get('zoom'));
  await zoomIn.tap();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).toBeGreaterThan(zoomBefore);

  const controlsToggle = page.locator('#mobile-controls-toggle');
  await controlsToggle.tap();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(controlsToggle).toHaveAccessibleName('Hide Atlas controls');
  await expectElementInsideViewport(page.getByRole('combobox', { name: 'Exported floor' }), page);
  await expectElementInsideViewport(page.locator('#mobile-search-input'), page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.getByRole('button', { name: 'Close Atlas controls' }).tap();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(controlsToggle).toBeVisible();
  await controlsToggle.tap();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(controlsToggle).toHaveAccessibleName('Hide Atlas controls');
  await expectElementInsideViewport(page.getByRole('button', { name: 'Close Atlas controls' }), page);
  await expectElementInsideViewport(page.locator('#mobile-search-input'), page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  assertNoRuntimeFailures(runtime);
});

test('layout crossing redirects focus from controls that become hidden', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);
  await page.locator('#mobile-find-toggle').tap();
  await expect(page.locator('#mobile-controls-panel')).toHaveClass(/find-mode/);
  await page.locator('#mobile-search-input').focus();
  await expect(page.locator('#mobile-search-input')).toBeFocused();
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(page.locator('#search-input')).toBeFocused();
  await page.locator('#desktop-inspector-toggle').focus();
  await expect(page.locator('#desktop-inspector-toggle')).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#mobile-inspector-toggle')).toBeFocused();
  assertNoRuntimeFailures(runtime);
});
