import { expect, test } from '@playwright/test';
import {
  MOBILE_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

test('mobile critical controls, backdrop close and responsive resize remain usable', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);

  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();

  const controls = page.locator('#mobile-controls-toggle');
  await controls.click();
  await expect(controls).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Higher floor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lower floor' })).toBeVisible();
  await expect(page.locator('#mobile-search-input')).toBeVisible();

  const backdrop = page.locator('#mobile-drawer-backdrop');
  await expect(backdrop).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  await page.mouse.click(viewport.width - 4, Math.floor(viewport.height / 2));
  await expect(controls).toHaveAttribute('aria-expanded', 'false');

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await expect(page.locator('#map-frame')).toBeVisible();
  await expect(controls).toBeVisible();
  await controls.click();
  await expect(controls).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-search-input')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(controls).toHaveAttribute('aria-expanded', 'false');
  assertNoRuntimeFailures(runtime);
});

test('mobile shipped creature controls are truthful when the optional product is present', async ({ page }) => {
  await gotoAtlas(page, `${MOBILE_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null, { timeout: 30_000 });
  const creatures = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  test.skip(creatures.status === 'FAIL' && /HTTP 404/.test(creatures.error ?? ''), 'Current target has no optional creature publication.');
  expect(creatures.status, creatures.error ?? 'creature runtime').toBe('PASS');

  await page.locator('#mobile-controls-toggle').click();
  const npc = page.locator('input[data-creature-kind="npc"]');
  const monster = page.locator('input[data-creature-kind="monster"]');
  await expect(npc).toBeVisible();
  await expect(monster).toBeVisible();
  await expect(npc).toBeChecked();
  await expect(monster).toBeChecked();
  await npc.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get('creatures')).toBe('monster');
  await expect(monster).toBeChecked();
});
