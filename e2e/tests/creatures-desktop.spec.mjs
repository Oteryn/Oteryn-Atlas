import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

async function creatureState(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
}

test('desktop shipped creature controls persist independently and expose bounded diagnostics', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  let creatures = await creatureState(page);
  test.skip(creatures.status === 'FAIL' && /HTTP 404/.test(creatures.error ?? ''), 'Current target has no optional creature publication.');
  expect(creatures.status, creatures.error ?? 'creature runtime').toBe('PASS');

  const npc = page.locator('input[data-creature-kind="npc"]');
  const monster = page.locator('input[data-creature-kind="monster"]');
  await expect(npc).toBeChecked();
  await expect(monster).toBeChecked();
  await monster.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get('creatures')).toBe('npc');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  creatures = await creatureState(page);
  expect(creatures.status, creatures.error ?? 'creature runtime after reload').toBe('PASS');
  expect(creatures.enabled).toEqual({ npc: true, monster: false });
  expect(creatures.cacheChunks).toBeLessThanOrEqual(96);
  expect(creatures.drawnRecords).toBeGreaterThanOrEqual(0);
  await expect(page.locator('input[data-creature-kind="npc"]')).toBeChecked();
  await expect(page.locator('input[data-creature-kind="monster"]')).not.toBeChecked();
  assertNoRuntimeFailures(runtime);
});

test('desktop creature search creates a stable deep link and inspector state when published', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  const creatures = await creatureState(page);
  test.skip(creatures.status === 'FAIL' && /HTTP 404/.test(creatures.error ?? ''), 'Current target has no optional creature publication.');
  expect(creatures.status, creatures.error ?? 'creature runtime').toBe('PASS');

  const search = page.locator('#creature-search');
  await search.fill('Sam');
  const result = page.locator('#creature-results button').filter({ hasText: /Sam/i }).first();
  await expect(result).toBeVisible();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    result.click(),
  ]);
  await waitForAtlas(page);
  const selected = await creatureState(page);
  expect(selected.status, selected.error ?? 'creature runtime after selection').toBe('PASS');
  expect(new URL(page.url()).searchParams.get('creature')).toMatch(/^(?:npc|monster):[0-9a-f]{32}$/);
  await expect(page.locator('#creature-inspector')).toContainText(/Sam/i);
  assertNoRuntimeFailures(runtime);
});
