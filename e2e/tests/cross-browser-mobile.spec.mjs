import { expect, test } from '@playwright/test';

import { assertUserVisibleSurface } from '../support/user-acceptance.mjs';
import {
  MOBILE_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

function requireSecondaryEngine(browserName) {
  expect(['firefox', 'webkit']).toContain(browserName);
}

function beginMainFrameNavigationRuntime(page, currentRuntime) {
  assertNoRuntimeFailures(currentRuntime);
  return new Promise((resolve) => {
    const listener = (frame) => {
      if (frame !== page.mainFrame()) return;
      page.off('framenavigated', listener);
      resolve(captureRuntimeFailures(page));
    };
    page.on('framenavigated', listener);
  });
}

async function waitForControlsDrawerSettled(page) {
  await page.waitForFunction(() => {
    const panel = document.querySelector('#mobile-controls-panel');
    if (!panel) return false;
    const rect = panel.getBoundingClientRect();
    return Math.abs(rect.left) <= 1
      && rect.right <= innerWidth + 1
      && rect.top >= -1
      && rect.bottom <= innerHeight + 1;
  }, null, { timeout: 5_000 });
}
async function attachMobileEvidence(page, testInfo, browserName, extra = {}) {
  await testInfo.attach('cross-browser-mobile-evidence', {
    body: Buffer.from(JSON.stringify({
      version: 1,
      atlasRevision: process.env.ATLAS_EXPECTED_REVISION ?? null,
      project: testInfo.project.name,
      browserName,
      viewport: page.viewportSize(),
      ...extra,
    }, null, 2)),
    contentType: 'application/json',
  });
}

test('secondary mobile-like engine supports touch drawers, search and inspector without clipping', async ({ page, browserName }, testInfo) => {
  requireSecondaryEngine(browserName);
  let runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${MOBILE_ENTRY}&creatures=npc,monster&animation=off`);
  await waitForAtlas(page);
  const initialMetrics = await assertUserVisibleSurface(page, {
    label: `${browserName} mobile-like initial`,
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '.topbar', label: 'topbar' },
      { selector: '#map-frame', label: 'world map' },
      { selector: '#zoom-out', label: 'zoom out', interactive: true, minWidth: 29, minHeight: 29 },
      { selector: '#zoom-in', label: 'zoom in', interactive: true, minWidth: 29, minHeight: 29 },
      { selector: '#mobile-controls-toggle', label: 'controls toggle', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#mobile-inspector-toggle', label: 'inspector toggle', interactive: true, minWidth: 34, minHeight: 34 },
    ],
  });

  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  const zoom0 = new URL(page.url()).searchParams.get('zoom');
  await zoomIn.tap();
  await expect.poll(() => new URL(page.url()).searchParams.get('zoom')).not.toBe(zoom0);

  const controls = page.getByRole('button', { name: 'Open Atlas controls' });
  await controls.tap();
  await expect(controls).toHaveAttribute('aria-expanded', 'true');
  const controlsClose = page.getByRole('button', { name: 'Close Atlas controls' });
  await expect(controlsClose).toBeFocused();
  await waitForControlsDrawerSettled(page);
  const floorSelect = page.getByRole('combobox', { name: 'Exported floor' });
  const mobileSearch = page.locator('#mobile-search-input');
  await expect(mobileSearch).toBeVisible();
  await assertUserVisibleSurface(page, {
    label: `${browserName} mobile-like controls`,
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '#mobile-controls-panel', label: 'controls drawer' },
      { selector: '#mobile-controls-close', label: 'close controls', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#mobile-search-input', label: 'search', interactive: true, minHeight: 34 },
    ],
  });

  const floor0 = new URL(page.url()).searchParams.get('floor');
  const higherFloor = page.getByRole('button', { name: 'Higher floor' });
  const lowerFloor = page.getByRole('button', { name: 'Lower floor' });
  await floorSelect.scrollIntoViewIfNeeded();
  await assertUserVisibleSurface(page, {
    label: `${browserName} mobile-like floor control`,
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '#floor-select', label: 'floor selector', interactive: true, minHeight: 34 },
      { selector: '#floor-up', label: 'higher floor', minWidth: 34, minHeight: 34 },
      { selector: '#floor-down', label: 'lower floor', minWidth: 34, minHeight: 34 },
    ],
  });
  if (await higherFloor.isEnabled()) await higherFloor.tap();
  else if (await lowerFloor.isEnabled()) await lowerFloor.tap();
  else throw new Error('cross-browser mobile fixture exposes no adjacent floor');
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe(floor0);

  await mobileSearch.scrollIntoViewIfNeeded();
  await assertUserVisibleSurface(page, {
    label: `${browserName} mobile-like search return`,
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '#mobile-search-input', label: 'search', interactive: true, minHeight: 34 },
    ],
  });
  await mobileSearch.fill('Thais');
  const results = page.locator('#semantic-search-results-mobile');
  await expect(results).toBeVisible();
  const thais = results.getByRole('option').filter({ hasText: 'Thais' }).first();
  await expect(thais).toBeVisible();
  const semanticRuntime = beginMainFrameNavigationRuntime(page, runtime);
  await Promise.all([
    page.waitForURL((url) => Boolean(url.searchParams.get('semantic'))),
    thais.tap(),
  ]);
  runtime = await semanticRuntime;
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText('Thais');
  await expect(page.locator('#inspector-content')).toContainText('Stable public id');

  const inspector = page.getByRole('button', { name: 'Open inspector' });
  await inspector.tap();
  await expect(inspector).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Close inspector' })).toBeFocused();
  await page.waitForFunction(() => {
    const panel = document.querySelector('#mobile-inspector-panel');
    if (!panel) return false;
    const rect = panel.getBoundingClientRect();
    return Math.abs(rect.right - innerWidth) <= 1 && rect.left >= -1;
  }, null, { timeout: 5_000 });
  await assertUserVisibleSurface(page, {
    label: `${browserName} mobile-like inspector`,
    minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '#mobile-inspector-panel', label: 'inspector drawer' },
      { selector: '#mobile-inspector-close', label: 'close inspector', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#inspector-content', label: 'inspector facts' },
    ],
  });
  await page.getByRole('button', { name: 'Close inspector' }).tap();

  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeMetrics = await assertUserVisibleSurface(page, {
    label: `${browserName} mobile-like landscape`,
    minimumMapAreaRatio: 0.58,
    elements: [
      { selector: '.topbar', label: 'landscape topbar' },
      { selector: '#map-frame', label: 'landscape world map' },
      { selector: '#mobile-controls-toggle', label: 'landscape controls', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#mobile-inspector-toggle', label: 'landscape inspector', interactive: true, minWidth: 34, minHeight: 34 },
    ],
  });
  await controls.tap();
  await expect(controls).toHaveAttribute('aria-expanded', 'true');
  await expect(controlsClose).toBeFocused();
  await waitForControlsDrawerSettled(page);
  await floorSelect.scrollIntoViewIfNeeded();
  await expect(floorSelect).toBeVisible();
  await mobileSearch.scrollIntoViewIfNeeded();
  await expect(mobileSearch).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(controls).toHaveAttribute('aria-expanded', 'false');
  await attachMobileEvidence(page, testInfo, browserName, { initialMetrics, landscape: landscapeMetrics });
  assertNoRuntimeFailures(runtime);
});
