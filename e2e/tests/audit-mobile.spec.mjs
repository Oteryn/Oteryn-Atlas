import { expect, test } from '@playwright/test';
import { MOBILE_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

async function waitRep(page, expected) {
  await page.waitForFunction(
    (value) => globalThis.__OTERYN_ATLAS_MINIMAP__?.status === 'PASS'
      && globalThis.__OTERYN_ATLAS_MINIMAP__?.representation === value,
    expected,
    { timeout: 30_000 },
  );
}

test('audit mobile drawers and auto/minimap/classic/map transitions', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);
  await waitRep(page, 'minimap');
  await expect(page.locator('#minimap-layer')).toHaveCSS('opacity', '1');

  await page.locator('#mobile-controls-toggle').click();
  await expect(page.locator('#mobile-controls-panel')).toHaveClass(/mobile-open/);
  await page.locator('[data-mode="map"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('map');
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).toBeGreaterThanOrEqual(0.5);
  await waitRep(page, 'detail');
  await expect(page.locator('#atlas')).toHaveCSS('opacity', '1');

  await page.locator('[data-mode="minimap"]').click();
  await waitRep(page, 'minimap');
  await expect(page.locator('#atlas')).toHaveCSS('opacity', '0');

  await page.locator('[data-mode="classic"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('classic');
  await waitRep(page, 'classic');
  await expect(page.locator('#minimap-layer')).toHaveCSS('opacity', '1');
  await expect(page.locator('#atlas')).toHaveCSS('opacity', '0');

  await page.locator('[data-mode="auto"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('auto');
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-controls-toggle')).toHaveAttribute('aria-expanded', 'false');
  assertNoRuntimeFailures(runtime);
});
