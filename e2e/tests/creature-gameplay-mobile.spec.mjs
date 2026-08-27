import { expect, test } from '@playwright/test';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { assertUserVisibleSurface, captureUserVisualEvidence } from '../support/user-acceptance.mjs';

const SAM = Object.freeze({ entityId: 'npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e', label: 'Sam' });
const RAT = Object.freeze({ entityId: 'monster-entity:80295e51265b3662bfbea2ea01ee3ccb', label: 'Rat' });

async function creatureState(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
}

async function discoverByEntity(page, fixture) {
  const record = await page.evaluate(async (entityId) => {
    const response = await fetch('/data/creatures/search.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`creature search HTTP ${response.status}`);
    const product = await response.json();
    return product.records.find((row) => row.entity_id === entityId) ?? null;
  }, fixture.entityId);
  expect(record, `missing exact fixture ${fixture.label}`).not.toBeNull();
  expect(record.label).toBe(fixture.label);
  return record;
}

function targetEntry(record) {
  const params = new URLSearchParams({
    x: String(record.position.x), y: String(record.position.y), floor: String(record.position.floor),
    zoom: '2', mode: 'map', creatures: 'npc,monster', creature: record.record_id, inspector: 'gameplay',
  });
  return `/web/fullworld.html?${params.toString()}`;
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
  await page.locator('#creature-card-close').tap();
  await expect(page.locator('#creature-quick-card')).toBeHidden();
  await page.touchscreen.tap(x, y);
  if ((await creatureState(page)).cardState === 'chooser') {
    await page.locator('#creature-card-choices button').filter({ hasText: record.label }).first().tap();
  }
  await expect(page.locator('#creature-quick-card')).toBeVisible();
}

async function openFixture(page, fixture) {
  await gotoAtlas(page, '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map&creatures=npc,monster');
  await waitForAtlas(page);
  const record = await discoverByEntity(page, fixture);
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  await tapCommittedTarget(page, record);
  return record;
}

test('mobile Sam direct tap reaches readable Gameplay trade data and tabs', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await openFixture(page, SAM);
  await expect(page.locator('#creature-card-body')).toContainText('Shop · 71 sells · 67 buys');
  await page.locator('#creature-card-details').tap();
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#gameplay-section-sells')).toContainText('20 gold');
  await expect(page.locator('#gameplay-section-buys')).toContainText('7 gold');
  const gameplayTab = page.locator('#inspector-tab-gameplay');
  const semanticTab = page.locator('#inspector-tab-semantic');
  const liveTab = page.locator('#inspector-tab-live');
  for (const tab of [gameplayTab, semanticTab, liveTab]) {
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await semanticTab.tap();
  await expect(page.locator('#creature-inspector')).toContainText(`Entity: ${SAM.entityId}`);
  await gameplayTab.tap();
  await expect(page.locator('#gameplay-section-sells')).toContainText('20 gold');
  await expect(liveTab).toBeDisabled();
  await page.locator('.creature-gameplay-search').fill('battle axe');
  await expect(page.locator('#gameplay-section-sells')).toContainText('235 gold');
  await expect(page.locator('#gameplay-section-buys')).toContainText('80 gold');
  const gameplayMetrics = await assertUserVisibleSurface(page, {
    label: 'Mobile creature Gameplay inspector',
    elements: [
      { selector: '#mobile-inspector-panel', label: 'Gameplay inspector' },
      { selector: '#inspector-tab-gameplay', label: 'Gameplay tab', interactive: true, minWidth: 44, minHeight: 44 },
      { selector: '#gameplay-section-sells', label: 'Sells section' },
      { selector: '#gameplay-section-buys', label: 'Buys section' },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'mobile.creature-gameplay', {
    surfaceMetrics: gameplayMetrics,
    note: 'Mobile verified Sam Gameplay drawer with readable trade data and touch-sized tabs.',
  });
  assertNoRuntimeFailures(runtime);
});

test('mobile Rat direct tap renders exact loot stats and keeps topmost Escape behavior', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await openFixture(page, RAT);
  const card = page.locator('#creature-quick-card');
  const details = page.locator('#creature-card-details');
  await expect(card).toBeVisible();
  await details.tap();
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#gameplay-section-loot')).toContainText('gold coin');
  await expect(page.locator('#gameplay-section-loot')).toContainText('100%');
  await expect(page.locator('#gameplay-section-stats')).toContainText(/Health\s*20/);
  await expect(page.locator('#gameplay-section-stats')).toContainText(/Experience\s*5/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-inspector-panel')).not.toHaveClass(/mobile-open/);
  await expect(card).toBeVisible();
  await expect(details).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  expect((await creatureState(page)).cardState).toBe('closed');
  assertNoRuntimeFailures(runtime);
});