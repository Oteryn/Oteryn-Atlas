import { expect, test } from '@playwright/test';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { assertUserVisibleSurface, captureUserVisualEvidence } from '../support/user-acceptance.mjs';

async function discoverByKind(request, kind) {
  const response = await request.get('/data/creatures/search.json');
  expect(response.ok(), `creature search HTTP ${response.status()}`).toBeTruthy();
  const product = await response.json();
  const record = product.records.find((row) => row.kind === kind && typeof row.entity_id === 'string' && row.entity_id.length > 0) ?? null;
  expect(record, `missing ${kind} fixture with entity identity`).not.toBeNull();
  return record;
}

async function creatureState(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
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

async function openFixtureRecord(page, request, kind) {
  const record = await discoverByKind(request, kind);
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  await tapCommittedTarget(page, record);
  return record;
}

test('mobile fixture NPC tap reaches Gameplay shell with touch-sized tabs', async ({ page, request }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const record = await openFixtureRecord(page, request, 'npc');
  await page.locator('#creature-card-details').tap();
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  const gameplayTab = page.locator('#inspector-tab-gameplay');
  const semanticTab = page.locator('#inspector-tab-semantic');
  const liveTab = page.locator('#inspector-tab-live');
  for (const tab of [gameplayTab, semanticTab, liveTab]) {
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await semanticTab.tap();
  await expect(page.locator('#creature-inspector')).toContainText(`Record: ${record.record_id}`);
  await expect(page.locator('#creature-inspector')).toContainText(`Entity: ${record.entity_id}`);
  await gameplayTab.tap();
  await expect(gameplayTab).toHaveAttribute('aria-selected', 'true');
  await expect(liveTab).toBeDisabled();
  const gameplayMetrics = await assertUserVisibleSurface(page, {
    label: 'Mobile fixture Gameplay inspector',
    elements: [
      { selector: '#mobile-inspector-panel', label: 'Gameplay inspector' },
      { selector: '#inspector-tab-gameplay', label: 'Gameplay tab', interactive: true, minWidth: 44, minHeight: 44 },
      { selector: '#inspector-tab-semantic', label: 'Semantic tab', interactive: true, minWidth: 44, minHeight: 44 },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'mobile.creature-gameplay-fixture', {
    surfaceMetrics: gameplayMetrics,
    note: 'Mobile fixture-backed Gameplay drawer with touch-sized tab navigation.',
  });
  assertNoRuntimeFailures(runtime);
});

test('mobile fixture monster tap keeps topmost Escape behavior', async ({ page, request }) => {
  const runtime = captureRuntimeFailures(page);
  await openFixtureRecord(page, request, 'monster');
  const card = page.locator('#creature-quick-card');
  const details = page.locator('#creature-card-details');
  await expect(card).toBeVisible();
  await details.tap();
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-inspector-panel')).not.toHaveClass(/mobile-open/);
  await expect(card).toBeVisible();
  await expect(details).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  expect((await creatureState(page)).cardState).toBe('closed');
  assertNoRuntimeFailures(runtime);
});
