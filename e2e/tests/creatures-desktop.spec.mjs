import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  isQualificationFixtureExecution,
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
  const creatureLabel = isQualificationFixtureExecution() ? 'Fixture Guide' : 'Sam';
  await search.fill(creatureLabel);
  const result = page.locator('#creature-results button').filter({ hasText: new RegExp(creatureLabel, 'i') }).first();
  await expect(result).toBeVisible();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    result.click(),
  ]);
  await waitForAtlas(page);
  const selected = await creatureState(page);
  expect(selected.status, selected.error ?? 'creature runtime after selection').toBe('PASS');
  expect(new URL(page.url()).searchParams.get('creature')).toMatch(/^(?:npc|monster):[0-9a-f]{32}$/);
  await expect(page.locator('#creature-inspector')).toContainText(creatureLabel);
  assertNoRuntimeFailures(runtime);
});

test('desktop NPC category filter persists and uses functional icon rendering when published', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  const entry = `${DESKTOP_ENTRY}&creatures=npc&npcRole=shop`;
  await gotoAtlas(page, entry);
  await waitForAtlas(page);
  let creatures = await creatureState(page);
  test.skip(creatures.status === 'FAIL' && /HTTP 404/.test(creatures.error ?? ''), 'Current target has no optional creature publication.');
  expect(creatures.status, creatures.error ?? 'creature runtime').toBe('PASS');
  await expect(page.locator('#npc-role-filter')).toBeVisible();
  await expect(page.locator('#npc-role-filter')).toHaveValue('shop');
  expect(creatures.npcRole).toBe('shop');
  expect(creatures.npcMarkerStyle).toBe('functional-icons-v2');
  expect(creatures.drawnNpcIcons).toBeGreaterThan(0);

  await page.locator('#npc-role-filter').selectOption('all');
  await expect.poll(() => new URL(page.url()).searchParams.has('npcRole')).toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  creatures = await creatureState(page);
  expect(creatures.npcRole).toBe('all');
  await expect(page.locator('#npc-role-filter')).toHaveValue('all');
  assertNoRuntimeFailures(runtime);
});


test('desktop creature overlay repaints in the same turn as continuous pan', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await page.addInitScript(() => {
    const probe = { active: false, clears: 0, viewEvents: 0, missedImmediatePaints: 0 };
    globalThis.__OTERYN_CREATURE_PAN_PROBE__ = probe;
    const originalClearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas?.id === 'creature-overlay') probe.clears += 1;
      return originalClearRect.apply(this, args);
    };
    window.addEventListener('oteryn-atlas-view', () => {
      if (!probe.active) return;
      probe.viewEvents += 1;
      const clearsBefore = probe.clears;
      queueMicrotask(() => {
        if (probe.clears === clearsBefore) probe.missedImmediatePaints += 1;
      });
    });
  });
  await gotoAtlas(page, '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=1.04&mode=map&creatures=npc,monster');
  await waitForAtlas(page);
  const creatures = await creatureState(page);
  test.skip(creatures.status === 'FAIL' && /HTTP 404/.test(creatures.error ?? ''), 'Current target has no optional creature publication.');
  expect(creatures.status, creatures.error ?? 'creature runtime').toBe('PASS');
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.drawnRecords ?? 0)).toBeGreaterThan(0);
  await page.evaluate(() => { globalThis.__OTERYN_CREATURE_PAN_PROBE__.active = true; });

  const canvas = page.locator('#atlas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 90, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(50);

  const probe = await page.evaluate(() => globalThis.__OTERYN_CREATURE_PAN_PROBE__);
  expect(probe.viewEvents).toBeGreaterThanOrEqual(4);
  expect(probe.missedImmediatePaints, `creature overlay missed ${probe.missedImmediatePaints}/${probe.viewEvents} synchronous viewport paints`).toBe(0);
  assertNoRuntimeFailures(runtime);
});
