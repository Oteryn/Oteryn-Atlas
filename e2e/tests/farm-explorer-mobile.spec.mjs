import { expect, test } from '@playwright/test';
import {
  MOBILE_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';
import { FARM_MONSTER, qualificationEntry } from '../support/qualification-fixture-scenarios.mjs';

async function waitForFarm(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_FARM__?.status), null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_FARM__);
}
test('mobile Farm Explorer remains reachable and truthful in the existing controls drawer', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, qualificationEntry(FARM_MONSTER.position, { creatures: 'npc,monster' }));
  await waitForAtlas(page);
  const farm = await waitForFarm(page);
  expect(farm.status, farm.error ?? 'farm runtime').toBe('PASS');
  expect(farm.itemTaskState).toBe('UPSTREAM_BLOCKED');
  expect(farm.mapInteractionState).toBe('AVAILABLE');
  expect(farm.presentationEnrichmentState).toBe('DEPENDENCY_BLOCKED');
  await page.locator('#mobile-controls-toggle').click();
  await expect(page.locator('#mobile-controls-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#farm-explorer')).toBeVisible();
  await page.locator('#farm-creature-search').fill(FARM_MONSTER.label);
  const fixtureMonster = page.locator('#farm-creature-results .farm-creature-result').filter({ hasText: FARM_MONSTER.label }).first();
  await expect(fixtureMonster).toBeVisible();
  await fixtureMonster.click();
  await page.locator('#farm-target-kills').fill('90');
  await page.locator('#farm-kph').fill('45');
  await page.locator('#farm-time-base').selectOption('trip_wall');
  await page.locator('#farm-estimate-button').click();
  await expect(page.locator('#farm-estimate-output')).toContainText('2.00 h');
  await expect(page.locator('#farm-explorer')).toContainText('PRESENTATION DEPENDENCY');
  expect(new URL(page.url()).searchParams.get('farmTimeBase')).toBe('trip_wall');
  await expect(page.locator('#farm-explorer')).toHaveCSS('overflow-x', /visible|hidden|clip|auto/);
  assertNoRuntimeFailures(runtime);
});
