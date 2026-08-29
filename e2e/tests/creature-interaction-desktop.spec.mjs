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

async function discoverNpc(page) {
  return page.evaluate(async () => {
    const response = await fetch('/data/creatures/search.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`creature search HTTP ${response.status}`);
    const product = await response.json();
    return product.records.find((record) => record.kind === 'npc') ?? null;
  });
}

function targetEntry(record, zoom = 2) {
  const params = new URLSearchParams({
    x: String(record.position.x), y: String(record.position.y), floor: String(record.position.floor),
    zoom: String(zoom), mode: 'map', creatures: 'npc,monster', creature: record.record_id,
  });
  return `/web/fullworld.html?${params.toString()}`;
}

const OVERLAP_MONSTER_FIXTURE = Object.freeze(isQualificationFixtureExecution() ? {
  kind: 'monster',
  label: 'Fixture Raider One',
  record_id: `monster:${'b'.repeat(32)}`,
  position: Object.freeze({ floor: -7, x: 32283, y: 32158 }),
  record_ids: Object.freeze(['b', 'c', 'd'].map((hex) => `monster:${hex.repeat(32)}`)),
} : {
  kind: 'monster',
  label: 'Misguided Thief',
  record_id: 'monster:014cc0368c5989dd788e2af63e087e83',
  position: Object.freeze({ floor: -10, x: 32522, y: 32419 }),
  record_ids: Object.freeze([
    'monster:014cc0368c5989dd788e2af63e087e83',
    'monster:6c316dffde0b35aa6a9165eb46694374',
    'monster:7a7d419f84cf4eac5cad81f7cb266dae',
  ]),
});

async function clickCommittedTarget(page, expectedRecordId, expectedLabel) {
  const state = await creatureState(page);
  expect(state.cardRecordId).toBe(expectedRecordId);
  expect(state.cardTargetRect).not.toBeNull();
  const targetRect = state.cardTargetRect;
  await page.locator('#creature-card-close').click();
  await expect(page.locator('#creature-quick-card')).toBeHidden();
  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + targetRect.x + targetRect.width / 2;
  const y = box.y + targetRect.y + targetRect.height / 2;
  await page.mouse.move(x, y);
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.hoveredRecordId)).toBe(expectedRecordId);
  await page.mouse.click(x, y);
  if ((await creatureState(page)).cardState === 'chooser') {
    await page.locator('#creature-card-choices button').filter({ hasText: expectedLabel }).first().click();
  }
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  return { x, y, targetRect };
}

test('desktop NPC activation uses fresh committed geometry and does not select the base tile', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  const initial = await creatureState(page);
  test.skip(initial.status === 'FAIL' && /HTTP 404/.test(initial.error ?? ''), 'Current target has no optional creature publication.');
  const record = await discoverNpc(page);
  expect(record).not.toBeNull();

  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  await expect(page.locator('#creature-card-title')).toContainText(record.label);
  const baseSelection = await page.evaluate(() => globalThis.__OTERYN_ATLAS_VIEW__?.selected ?? null);
  await clickCommittedTarget(page, record.record_id, record.label);
  const after = await creatureState(page);
  expect(after.cardRecordId).toBe(record.record_id);
  expect(new URL(page.url()).searchParams.get('creature')).toBe(record.record_id);
  expect(await page.evaluate(() => globalThis.__OTERYN_ATLAS_VIEW__?.selected ?? null)).toEqual(baseSelection);
  await expect(page.locator('#creature-card-body')).toContainText(/Position:/);
  assertNoRuntimeFailures(runtime);
});

async function discoverMonster(page) {
  return page.evaluate(async () => {
    const response = await fetch('/data/creatures/search.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`creature search HTTP ${response.status}`);
    const product = await response.json();
    return product.records.find((record) => record.kind === 'monster') ?? null;
  });
}

test('desktop monster activation opens Monster spawn card and survives canonical reload', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  const initial = await creatureState(page);
  test.skip(initial.status === 'FAIL' && /HTTP 404/.test(initial.error ?? ''), 'Current target has no optional creature publication.');
  const record = await discoverMonster(page);
  expect(record).not.toBeNull();

  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  await expect(page.locator('#creature-card-kind')).toHaveText('Monster spawn');
  await clickCommittedTarget(page, record.record_id, record.label);
  await expect(page.locator('#creature-card-title')).toContainText(record.label);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  expect((await creatureState(page)).cardRecordId).toBe(record.record_id);

  await gotoAtlas(page, targetEntry(OVERLAP_MONSTER_FIXTURE));
  await waitForAtlas(page);
  const overlapState = await creatureState(page);
  expect(overlapState.cardRecordId).toBe(OVERLAP_MONSTER_FIXTURE.record_id);
  expect(overlapState.cardTargetRect).not.toBeNull();
  const atlasBox = await page.locator('#atlas').boundingBox();
  expect(atlasBox).not.toBeNull();
  await page.locator('#creature-card-close').click();
  await expect(page.locator('#creature-quick-card')).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const creatures = globalThis.__OTERYN_ATLAS_CREATURES__;
    const renderer = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
    return Boolean(creatures?.selectedTargetRect
      && creatures.interactionBaseGeneration === renderer?.generation);
  })).toBe(true);
  const freshOverlap = await creatureState(page);
  const overlapRect = freshOverlap.selectedTargetRect;
  const overlapX = atlasBox.x + overlapRect.x + overlapRect.width / 2;
  const overlapY = atlasBox.y + overlapRect.y + overlapRect.height / 2;
  await page.mouse.move(overlapX, overlapY);
  await expect.poll(() => page.evaluate((recordIds) => recordIds.includes(
    globalThis.__OTERYN_ATLAS_CREATURES__?.hoveredRecordId,
  ), OVERLAP_MONSTER_FIXTURE.record_ids)).toBe(true);
  await page.mouse.click(overlapX, overlapY);
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.cardState)).toBe('chooser');
  const choices = page.locator('#creature-card-choices button');
  expect(await choices.count()).toBeGreaterThanOrEqual(3);
  await expect(choices.first()).toContainText(OVERLAP_MONSTER_FIXTURE.label);
  await choices.first().click();
  expect(OVERLAP_MONSTER_FIXTURE.record_ids).toContain((await creatureState(page)).cardRecordId);
  await expect(page.locator('#creature-card-kind')).toHaveText('Monster spawn');
  assertNoRuntimeFailures(runtime);
});

test('desktop Details synchronizes inspector and Copy link exposes truthful manual fallback', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  const initial = await creatureState(page);
  test.skip(initial.status === 'FAIL' && /HTTP 404/.test(initial.error ?? ''), 'Current target has no optional creature publication.');
  const record = await discoverNpc(page);
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);

  await page.locator('#creature-card-details').click();
  await expect(page.locator('#creature-inspector')).toContainText(record.label);
  await page.locator('#creature-card-copy').click();
  await expect(page.locator('#creature-card-copy-status')).toContainText('Copy unavailable');
  const fallback = page.locator('#creature-card-link-fallback');
  await expect(fallback).toBeVisible();
  expect(await fallback.inputValue()).toBe(page.url());
  await expect(page.locator('#creature-card-copy-status')).not.toContainText('Copied link.');
  assertNoRuntimeFailures(runtime);
});

test('desktop pan invalidates stale creature geometry before the next activation', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  const initial = await creatureState(page);
  test.skip(initial.status === 'FAIL' && /HTTP 404/.test(initial.error ?? ''), 'Current target has no optional creature publication.');
  const record = await discoverNpc(page);
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  const before = await creatureState(page);
  const oldRect = before.cardTargetRect;
  const oldBaseGeneration = before.interactionBaseGeneration;
  await page.locator('#creature-card-close').click();

  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.interactionBaseGeneration)).not.toBe(oldBaseGeneration);

  await page.mouse.click(box.x + oldRect.x + oldRect.width / 2, box.y + oldRect.y + oldRect.height / 2);
  const after = await creatureState(page);
  expect(after.cardRecordId).not.toBe(record.record_id);
  assertNoRuntimeFailures(runtime);
});

test('desktop creature layer invalidation closes a card for a now-hidden placement', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  const initial = await creatureState(page);
  test.skip(initial.status === 'FAIL' && /HTTP 404/.test(initial.error ?? ''), 'Current target has no optional creature publication.');
  const record = await discoverNpc(page);
  await gotoAtlas(page, targetEntry(record));
  await waitForAtlas(page);
  await expect(page.locator('#creature-quick-card')).toBeVisible();

  await page.locator('input[data-creature-kind="npc"]').uncheck();
  await expect(page.locator('#creature-quick-card')).toBeHidden();
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.cardState)).toBe('closed');
  expect(new URL(page.url()).searchParams.get('creature')).toBe(record.record_id);
  assertNoRuntimeFailures(runtime);
});
