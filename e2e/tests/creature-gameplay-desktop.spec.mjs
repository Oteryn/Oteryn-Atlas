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

async function clickCommittedTarget(page, record) {
  const state = await creatureState(page);
  expect(state.cardRecordId).toBe(record.record_id);
  expect(state.cardTargetRect).not.toBeNull();
  const targetRect = state.cardTargetRect;
  await page.locator('#creature-card-close').click();
  await expect(page.locator('#creature-quick-card')).toBeHidden();
  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + targetRect.x + targetRect.width / 2;
  const y = box.y + targetRect.y + targetRect.height / 2;
  await page.mouse.move(x, y);
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.hoveredRecordId)).toBe(record.record_id);
  await page.mouse.click(x, y);
  if ((await creatureState(page)).cardState === 'chooser') {
    await page.locator('#creature-card-choices button').filter({ hasText: record.label }).first().click();
  }
  await expect(page.locator('#creature-quick-card')).toBeVisible();
}

async function openFixtureRecord(page, request, kind) {
  const record = await discoverByKind(request, kind);
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  await clickCommittedTarget(page, record);
  return record;
}

test('desktop fixture creature activation preserves Gameplay and Semantic inspector URL state', async ({ page, request }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const record = await openFixtureRecord(page, request, 'npc');
  await page.locator('#creature-card-details').click();
  expect(new URL(page.url()).searchParams.get('inspector')).toBe('gameplay');
  await expect(page.locator('#inspector-tab-gameplay')).toHaveAttribute('aria-selected', 'true');

  const gameplayMetrics = await assertUserVisibleSurface(page, {
    label: 'Desktop fixture Gameplay inspector',
    elements: [
      { selector: '#mobile-inspector-panel', label: 'Gameplay inspector' },
      { selector: '#inspector-tab-gameplay', label: 'Gameplay tab', interactive: true },
      { selector: '#inspector-tab-semantic', label: 'Semantic tab', interactive: true },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.creature-gameplay-fixture', {
    surfaceMetrics: gameplayMetrics,
    note: 'Desktop fixture-backed Gameplay inspector shell and tab navigation.',
  });

  await page.locator('#inspector-tab-semantic').click();
  expect(new URL(page.url()).searchParams.get('inspector')).toBe('semantic');
  await expect(page.locator('#creature-inspector')).toContainText(`Record: ${record.record_id}`);
  await expect(page.locator('#creature-inspector')).toContainText(`Entity: ${record.entity_id}`);

  await page.locator('#inspector-tab-gameplay').click();
  expect(new URL(page.url()).searchParams.get('inspector')).toBe('gameplay');
  await expect(page.locator('#inspector-tab-gameplay')).toHaveAttribute('aria-selected', 'true');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  await expect(page.locator('#inspector-tab-gameplay')).toHaveAttribute('aria-selected', 'true');
  expect(new URL(page.url()).searchParams.get('creature')).toBe(record.record_id);
  assertNoRuntimeFailures(runtime);
});
