const __atlasQualification = process.env.ATLAS_E2E_DATA_CAPABILITY === 'qualification_fixture';
import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

async function waitForFarm(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_FARM__?.status), null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_FARM__);
}
test('desktop Farm Explorer fails closed for upstream facts and keeps custom kill estimator usable', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  const farm = await waitForFarm(page);
  expect(farm.status, farm.error ?? 'farm runtime').toBe('PASS');
  expect(farm.itemTaskState).toBe('UPSTREAM_BLOCKED');
  expect(farm.mapInteractionState).toBe('AVAILABLE');
  expect(farm.presentationEnrichmentState).toBe('DEPENDENCY_BLOCKED');
  await expect(page.locator('#farm-explorer')).toContainText('Monster drop sources');
  await expect(page.locator('#farm-explorer')).toContainText('UPSTREAM_BLOCKED');
  await page.locator('#farm-creature-search').fill((__atlasQualification ? "Fixture Sentinel" : 'Cave Rat'));
  const caveRat = page.locator('#farm-creature-results .farm-creature-result').filter({ hasText: (__atlasQualification ? new RegExp("^Fixture Sentinel$", "") : /^Cave Rat$/) }).first();
  await expect(caveRat).toBeVisible();
  await caveRat.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('farmCreature')).toBe((__atlasQualification ? "monster-entity:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" : 'monster-entity:8b41afe4c98e72744557d7adc250f7e6'));
  await page.locator('#farm-target-kills').fill('120');
  await page.locator('#farm-kph').fill('60');
  await page.locator('#farm-time-base').selectOption('hunt_wall');
  await page.locator('#farm-estimate-button').click();
  await expect(page.locator('#farm-estimate-output')).toContainText('2.00 h');
  const url = new URL(page.url());
  expect(url.searchParams.get('farmKills')).toBe('120');
  expect(url.searchParams.get('farmKph')).toBe('60');
  expect(url.searchParams.get('farmKphScope')).toBe('selected_creature_kills');
  expect(url.searchParams.get('farmTimeBase')).toBe('hunt_wall');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  const reloaded = await waitForFarm(page);
  expect(reloaded.selectedCreatureId).toBe((__atlasQualification ? "monster-entity:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" : 'monster-entity:8b41afe4c98e72744557d7adc250f7e6'));
  await expect(page.locator('#farm-target-kills')).toHaveValue('120');
  await expect(page.locator('#farm-kph')).toHaveValue('60');
  await expect(page.locator('#farm-estimate-output')).toContainText('2.00 h');
  await expect(page.locator('#atlas')).toBeVisible();
  assertNoRuntimeFailures(runtime);
});
