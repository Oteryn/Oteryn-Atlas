import { expect, test } from '@playwright/test';
import { MOBILE_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { assertUserVisibleSurface } from '../support/user-acceptance.mjs';

test('cross-engine mobile-like journey preserves drawers search touch layout and playback state', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${MOBILE_ENTRY}&creatures=npc,monster&animation=off`);
  await waitForAtlas(page);
  await assertUserVisibleSurface(page, {
    label: 'cross-engine mobile-like', minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '.topbar', label: 'topbar' },
      { selector: '#map-frame', label: 'map' },
      { selector: '#mobile-controls-toggle', label: 'controls', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#mobile-inspector-toggle', label: 'inspector', interactive: true, minWidth: 34, minHeight: 34 },
    ],
  });
  const controls = page.getByRole('button', { name: 'Open Atlas controls' });
  await controls.tap();
  await expect(controls).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#view-mode-control button[data-mode="minimap"]').tap();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('minimap');
  const playback = page.locator('#animation-toggle');
  await playback.check();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('on');
  await playback.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('off');
  const search = page.locator('#mobile-search-input');
  await search.fill('Thais');
  const option = page.locator('#semantic-search-results-mobile').getByRole('option').filter({ hasText: 'Thais' }).first();
  await expect(option).toBeVisible();
  await option.tap();
  await expect(page.locator('#inspector-content')).toContainText('Thais');
  const inspector = page.getByRole('button', { name: 'Open inspector' });
  await inspector.tap();
  await expect(inspector).toHaveAttribute('aria-expanded', 'true');
  await assertUserVisibleSurface(page, {
    label: 'cross-engine mobile-like inspector', minimumMapAreaRatio: 0.62,
    elements: [
      { selector: '#mobile-inspector-panel', label: 'inspector drawer' },
      { selector: '#mobile-inspector-close', label: 'close inspector', interactive: true, minWidth: 34, minHeight: 34 },
      { selector: '#inspector-content', label: 'inspector facts' },
    ],
  });
  await page.getByRole('button', { name: 'Close inspector' }).tap();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  assertNoRuntimeFailures(runtime);
});
