import { expect, test } from '@playwright/test';
import { DESKTOP_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { assertUserVisibleSurface, captureUserVisualEvidence, waitForCurrentDetailScene } from '../support/user-acceptance.mjs';

async function waitRep(page, expected) {
  await page.waitForFunction(
    (value) => globalThis.__OTERYN_ATLAS_MINIMAP__?.status === 'PASS'
      && globalThis.__OTERYN_ATLAS_MINIMAP__?.representation === value,
    expected,
    { timeout: 30_000 },
  );
}

test('audit desktop controls and LOD modes', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  await waitRep(page, 'detail');
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toMatch(/Ã|Â|â€¦|â€”/);
  const animationToggle = page.locator('#animation-toggle');
  await expect(animationToggle).toBeEnabled();
  await expect(animationToggle).not.toBeChecked();
  await animationToggle.check();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('on');
  await animationToggle.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('off');
  await expect(page.locator('#region-search')).toBeDisabled();
  await expect(page.locator('#region-zoom')).toBeDisabled();

  const z0 = Number(new URL(page.url()).searchParams.get('zoom'));
  await page.locator('#zoom-out').click();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).toBeLessThan(z0);
  await page.locator('#zoom-in').click();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).toBeCloseTo(z0, 6);

  await page.locator('[data-mode="minimap"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('minimap');
  await waitRep(page, 'minimap');
  await expect(page.locator('#minimap-layer')).toHaveCSS('opacity', '1');
  await expect(page.locator('#atlas')).toHaveCSS('opacity', '0');
  const minimapMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop minimap mode',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'minimap viewport' },
      { selector: '#view-mode-control', label: 'view mode control' },
      { selector: '#zoom-in', label: 'zoom in', interactive: true },
      { selector: '#zoom-out', label: 'zoom out', interactive: true },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.minimap', {
    surfaceMetrics: minimapMetrics,
    note: 'Explicit MINIMAP presentation mode after a real mode transition.',
  });

  await page.locator('[data-mode="classic"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('classic');
  await waitRep(page, 'classic');
  await expect(page.locator('#minimap-layer')).toHaveCSS('opacity', '1');
  await expect(page.locator('#atlas')).toHaveCSS('opacity', '0');
  await expect(page.locator('#status-detail')).toContainText('classic palette preview');
  const classicMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop classic mode',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'classic viewport' },
      { selector: '#status-detail', label: 'classic status' },
      { selector: '#view-mode-control', label: 'view mode control' },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.classic', {
    surfaceMetrics: classicMetrics,
    note: 'Explicit CLASSIC presentation mode and its truthful status presentation.',
  });

  await page.locator('[data-mode="map"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('map');
  await waitRep(page, 'detail');
  await expect(page.locator('#atlas')).toHaveCSS('opacity', '1');

  await page.locator('[data-mode="auto"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('auto');
  await waitRep(page, 'detail');

  const floor0 = new URL(page.url()).searchParams.get('floor');
  if (await page.locator('#floor-down').isEnabled()) {
    await page.locator('#floor-down').click();
  } else if (await page.locator('#floor-up').isEnabled()) {
    await page.locator('#floor-up').click();
  } else {
    throw new Error('visual acceptance fixture has no navigable adjacent floor');
  }
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe(floor0);
  const floorMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop changed floor',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'changed-floor world view' },
      { selector: '#floor-up', label: 'floor up', interactive: true },
      { selector: '#floor-down', label: 'floor down', interactive: true },
      { selector: '#coord-floor', label: 'floor coordinate' },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.floor-mode', {
    surfaceMetrics: floorMetrics,
    note: 'User-visible world after an actual adjacent-floor transition in AUTO mode.',
  });

  await page.locator('#overview-toggle').check();
  await expect(page.locator('#status-layer')).toContainText('Overview PROVEN');
  await page.locator('#overview-toggle').uncheck();
  assertNoRuntimeFailures(runtime);
});

test('audit coordinate Go, wheel zoom and drag pan', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await page.locator('#search-input').fill('32380 32250 -7');
  const coordinateResults = page.locator('#semantic-search-results-desktop');
  await expect(coordinateResults).toBeVisible();
  await page.locator('#search-form button[type="submit"]').click();
  await expect(coordinateResults).toBeHidden();
  await page.waitForTimeout(300);
  const afterGo = new URL(page.url());
  expect(afterGo.searchParams.get('x'), 'coordinate Go should navigate X').toBe('32380');
  expect(afterGo.searchParams.get('y'), 'coordinate Go should navigate Y').toBe('32250');

  const canvas = page.locator('#atlas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const z0 = Number(afterGo.searchParams.get('zoom'));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -500);
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).toBeGreaterThan(z0);

  const p0 = new URL(page.url());
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => new URL(page.url()).searchParams.get('x')).not.toBe(p0.searchParams.get('x'));
  await waitForCurrentDetailScene(page);
  const navigationMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop coordinate pan navigation',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'navigated world map' },
      { selector: '#search-input', label: 'coordinate/search input', interactive: true, minHeight: 30 },
      { selector: '#coord-x', label: 'x coordinate' },
      { selector: '#coord-y', label: 'y coordinate' },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.coordinate-pan', {
    surfaceMetrics: navigationMetrics,
    note: 'World after coordinate Go, wheel zoom and pointer drag pan as a user experiences it.',
  });
  assertNoRuntimeFailures(runtime);
});
