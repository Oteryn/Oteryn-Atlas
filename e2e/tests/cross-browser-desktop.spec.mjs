import { expect, test } from '@playwright/test';
import { DESKTOP_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { assertUserVisibleSurface } from '../support/user-acceptance.mjs';

test('cross-engine desktop journey preserves navigation search layout and runtime state', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  await assertUserVisibleSurface(page, {
    label: 'cross-engine desktop', minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '.topbar', label: 'topbar' },
      { selector: '#search-input', label: 'search', interactive: true, minHeight: 30 },
      { selector: '#zoom-in', label: 'zoom in', interactive: true },
      { selector: '#map-frame', label: 'map' },
      { selector: '#mobile-inspector-panel', label: 'inspector' },
    ],
  });
  const initialZoom = new URL(page.url()).searchParams.get('zoom');
  await page.locator('#zoom-in').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('zoom')).not.toBe(initialZoom);
  await page.locator('#view-mode-control button[data-mode="minimap"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('minimap');
  const initialFloor = new URL(page.url()).searchParams.get('floor');
  await page.locator('#floor-up').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe(initialFloor);
  const search = page.locator('#search-input');
  await search.fill('Thais');
  const option = page.locator('#semantic-search-results-desktop').getByRole('option').filter({ hasText: 'Thais' }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('#inspector-content')).toContainText('Thais');
  await page.goBack();
  await waitForAtlas(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  assertNoRuntimeFailures(runtime);
});
