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

  const controlsToggle = page.getByRole('button', { name: 'Open Atlas controls' });
  const controlsPanel = page.locator('#mobile-controls-panel');
  const controlsClose = page.getByRole('button', { name: 'Close Atlas controls' });
  await expectClosedDrawer(controlsPanel, controlsToggle);

  await controlsToggle.focus();
  await page.keyboard.press('Enter');
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(controlsPanel).toHaveAttribute('aria-hidden', 'false');
  expect(await controlsPanel.evaluate((element) => element.inert)).toBeFalsy();
  await expect(controlsClose).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Global semantic Atlas search' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectClosedDrawer(controlsPanel, controlsToggle);
  await expect(controlsToggle).toBeFocused();

  const inspectorToggle = page.getByRole('button', { name: 'Open inspector' });
  const inspectorPanel = page.locator('#mobile-inspector-panel');
  const inspectorClose = page.getByRole('button', { name: 'Close inspector' });
  await expectClosedDrawer(inspectorPanel, inspectorToggle);
  await inspectorToggle.focus();
  await page.keyboard.press('Enter');
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(inspectorPanel).toHaveAttribute('aria-hidden', 'false');
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

  const controlsToggle = page.getByRole('button', { name: 'Open Atlas controls' });
  await controlsToggle.tap();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  await expectElementInsideViewport(page.getByRole('combobox', { name: 'Exported floor' }), page);
  await expectElementInsideViewport(page.locator('#mobile-search-input'), page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.getByRole('button', { name: 'Close Atlas controls' }).tap();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(controlsToggle).toBeVisible();
  await controlsToggle.tap();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  await expectElementInsideViewport(page.getByRole('button', { name: 'Close Atlas controls' }), page);
  await expectElementInsideViewport(page.locator('#mobile-search-input'), page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  assertNoRuntimeFailures(runtime);
});