import { expect, test } from '@playwright/test';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { MIXED_SCENE, qualificationEntry, sceneEntry } from '../support/qualification-fixture-scenarios.mjs';

async function creatureState(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
}

async function discoverKind(page, kind) {
  return page.evaluate(async (wantedKind) => {
    const response = await fetch('/data/creatures/search.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`creature search HTTP ${response.status}`);
    const product = await response.json();
    return product.records.find((record) => record.kind === wantedKind) ?? null;
  }, kind);
}

function targetEntry(record) {
  return qualificationEntry(record.position, {
    zoom: 2, mode: 'map', creatures: 'npc,monster', creature: record.record_id,
  });
}

async function tapCommittedTarget(page, record) {
  const state = await creatureState(page);
  expect(state.cardRecordId).toBe(record.record_id);
  expect(state.cardTargetRect).not.toBeNull();
  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const rect = state.cardTargetRect;
  const x = box.x + rect.x + rect.width / 2;
  const y = box.y + rect.y + rect.height / 2;
  await page.locator('#creature-card-close').click();
  await expect(page.locator('#creature-quick-card')).toBeHidden();
  await page.touchscreen.tap(x, y);
  if ((await creatureState(page)).cardState === 'chooser') {
    await page.locator('#creature-card-choices button').filter({ hasText: record.label }).first().tap();
  }
  await expect(page.locator('#creature-quick-card')).toBeVisible();
}

for (const kind of ['npc', 'monster']) {
  test(`mobile ${kind} tap activates fresh creature geometry without base tile selection`, async ({ page }) => {
    const runtime = captureRuntimeFailures(page);
    await gotoAtlas(page, sceneEntry(MIXED_SCENE));
    await waitForAtlas(page);
    const initial = await creatureState(page);
    expect(initial.status, initial.error ?? 'creature runtime').toBe('PASS');
    const record = await discoverKind(page, kind);
    expect(record).not.toBeNull();

    await gotoAtlas(page, targetEntry(record));
    await waitForAtlas(page);
    await expect(page.locator('#creature-quick-card')).toBeVisible();
    const baseSelection = await page.evaluate(() => globalThis.__OTERYN_ATLAS_VIEW__?.selected ?? null);
    await tapCommittedTarget(page, record);
    const after = await creatureState(page);
    expect(after.cardRecordId).toBe(record.record_id);
    expect(await page.evaluate(() => globalThis.__OTERYN_ATLAS_VIEW__?.selected ?? null)).toEqual(baseSelection);
    await expect(page.locator('#zoom-in')).toBeVisible();
    assertNoRuntimeFailures(runtime);
  });
}

test('mobile Details opens the existing inspector above the card and Escape dismisses topmost only', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, sceneEntry(MIXED_SCENE));
  await waitForAtlas(page);
  const initial = await creatureState(page);
  expect(initial.status, initial.error ?? 'creature runtime').toBe('PASS');
  const record = await discoverKind(page, 'npc');
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  const card = page.locator('#creature-quick-card');
  await expect(card).toBeVisible();

  const details = page.locator('#creature-card-details');
  await details.tap();
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#mobile-drawer-backdrop')).toBeVisible();
  await expect(page.locator('#creature-inspector')).toContainText(record.label);
  await expect(page.locator('#mobile-inspector-close')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-inspector-panel')).not.toHaveClass(/mobile-open/);
  await expect(card).toBeVisible();
  await expect(details).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  expect((await creatureState(page)).cardState).toBe('closed');
  assertNoRuntimeFailures(runtime);
});
