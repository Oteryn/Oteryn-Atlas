import { expect, test } from '@playwright/test';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { assertUserVisibleSurface, captureUserVisualEvidence } from '../support/user-acceptance.mjs';

const FIXTURES = Object.freeze({
  sam: Object.freeze({ entityId: 'npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e', label: 'Sam' }),
  rat: Object.freeze({ entityId: 'monster-entity:80295e51265b3662bfbea2ea01ee3ccb', label: 'Rat' }),
  sigurd: Object.freeze({ entityId: 'npc-entity:0e7857888218c9081fabdb469aa9349b', label: 'Sigurd' }),
  yasir: Object.freeze({ entityId: 'npc-entity:b486d5d7292f7acca539899a96e66016', label: 'Yasir' }),
});

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

async function openFixture(page, fixture, { directClick = true } = {}) {
  await gotoAtlas(page, '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map&creatures=npc,monster');
  await waitForAtlas(page);
  const record = await discoverByEntity(page, fixture);
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  if (directClick) await clickCommittedTarget(page, record);
  return record;
}

test('desktop Sam direct activation opens exact Gameplay shop, preserves Semantic, and round-trips URL state', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const record = await openFixture(page, FIXTURES.sam);
  await expect(page.locator('#creature-card-body')).toContainText('Shop · 71 sells · 67 buys');
  await page.locator('#creature-card-details').click();
  expect(new URL(page.url()).searchParams.get('inspector')).toBe('gameplay');
  await expect(page.locator('#inspector-tab-gameplay')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#creature-inspector')).toContainText('Sam');
  await expect(page.locator('#gameplay-section-sells')).toContainText('axe');
  await expect(page.locator('#gameplay-section-sells')).toContainText('20 gold');
  await expect(page.locator('#gameplay-section-buys')).toContainText('axe');
  await expect(page.locator('#gameplay-section-buys')).toContainText('7 gold');
  await expect(page.locator('#gameplay-section-services')).toContainText(/partially published/i);
  await page.locator('.creature-gameplay-search').fill('battle axe');
  await expect(page.locator('#gameplay-section-sells')).toContainText('battle axe');
  await expect(page.locator('#gameplay-section-sells')).toContainText('235 gold');
  await expect(page.locator('#gameplay-section-buys')).toContainText('battle axe');
  await expect(page.locator('#gameplay-section-buys')).toContainText('80 gold');
  const gameplayMetrics = await assertUserVisibleSurface(page, {
    label: 'Desktop creature Gameplay inspector',
    elements: [
      { selector: '#mobile-inspector-panel', label: 'Gameplay inspector' },
      { selector: '#inspector-tab-gameplay', label: 'Gameplay tab', interactive: true },
      { selector: '#gameplay-section-sells', label: 'Sells section' },
      { selector: '#gameplay-section-buys', label: 'Buys section' },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.creature-gameplay', {
    surfaceMetrics: gameplayMetrics,
    note: 'Desktop verified Sam Gameplay inspector with real Game-owned trade data.',
  });

  await page.locator('#inspector-tab-semantic').click();
  expect(new URL(page.url()).searchParams.get('inspector')).toBe('semantic');
  await expect(page.locator('#creature-inspector')).toContainText(`Record: ${record.record_id}`);
  await expect(page.locator('#creature-inspector')).toContainText(`Entity: ${FIXTURES.sam.entityId}`);
  await expect(page.locator('#creature-inspector')).toContainText('Semantic digest:');

  await page.locator('#inspector-tab-gameplay').click();
  expect(new URL(page.url()).searchParams.get('inspector')).toBe('gameplay');
  await expect(page.locator('#gameplay-section-sells')).toContainText('20 gold');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  await expect(page.locator('#inspector-tab-gameplay')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#gameplay-section-sells')).toContainText('20 gold');
  expect(new URL(page.url()).searchParams.get('creature')).toBe(record.record_id);
  assertNoRuntimeFailures(runtime);
});

test('desktop Rat direct activation renders exact Loot Stats and placement-backed Spawns', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  const record = await openFixture(page, FIXTURES.rat);
  await expect(page.locator('#creature-card-body')).toContainText('Loot · 2 entries');
  await page.locator('#creature-card-details').click();
  await expect(page.locator('#gameplay-section-loot')).toContainText('gold coin');
  await expect(page.locator('#gameplay-section-loot')).toContainText('100%');
  await expect(page.locator('#gameplay-section-loot')).toContainText('×1–4');
  await expect(page.locator('#gameplay-section-stats')).toContainText(/Health\s*20/);
  await expect(page.locator('#gameplay-section-stats')).toContainText(/Experience\s*5/);
  await expect(page.locator('#gameplay-section-spawns')).toContainText(`X ${record.position.x} · Y ${record.position.y} · F ${record.position.floor}`);
  await expect(page.locator('#gameplay-section-spawns')).toContainText(/currently loaded for this exact entity_id/i);
  await page.locator('#inspector-tab-semantic').click();
  await expect(page.locator('#creature-inspector')).toContainText(`Entity: ${FIXTURES.rat.entityId}`);
  await page.locator('#inspector-tab-gameplay').click();
  await expect(page.locator('#gameplay-section-loot')).toContainText('gold coin');
  assertNoRuntimeFailures(runtime);
});

test('desktop PARTIAL shop never becomes an authoritative empty claim', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await openFixture(page, FIXTURES.sigurd);
  await page.locator('#creature-card-details').click();
  await expect(page.locator('#gameplay-section-sells')).toContainText(/Shop data partially published by Game/i);
  await expect(page.locator('#gameplay-section-buys')).toContainText(/Shop data partially published by Game/i);
  await expect(page.locator('#gameplay-section-sells')).not.toContainText('No items sold.');
  await expect(page.locator('#gameplay-section-buys')).not.toContainText('No items bought.');
  assertNoRuntimeFailures(runtime);
});

test('desktop real large shop stays bounded at 100 rendered rows', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await openFixture(page, FIXTURES.yasir, { directClick: false });
  await page.locator('#creature-card-details').click();
  const buys = page.locator('#gameplay-section-buys .creature-gameplay-row');
  await expect(buys).toHaveCount(50);
  await expect(page.locator('#gameplay-section-buys')).toContainText('50 of 738');
  await page.locator('#gameplay-section-buys .creature-gameplay-more').click();
  await expect(buys).toHaveCount(100);
  await expect(page.locator('#gameplay-section-buys')).toContainText(/Refine the search or sort/i);
  await expect(page.locator('#gameplay-section-buys .creature-gameplay-more')).toHaveCount(0);
  assertNoRuntimeFailures(runtime);
});
