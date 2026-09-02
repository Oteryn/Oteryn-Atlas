import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
  waitForSemanticSearch,
} from './runtime.mjs';

async function publishedCatalogs(page) {
  return page.evaluate(async () => {
    const [indexResponse, creatureResponse] = await Promise.all([
      fetch('/web/semantic-search/index.json', { cache: 'no-store' }),
      fetch('/web/semantic-search/creatures.json', { cache: 'no-store' }),
    ]);
    if (!indexResponse.ok) throw new Error(`semantic index HTTP ${indexResponse.status}`);
    if (!creatureResponse.ok) throw new Error(`creature search HTTP ${creatureResponse.status}`);
    return {
      index: await indexResponse.json(),
      creatures: await creatureResponse.json(),
    };
  });
}

test('browser search diagnostics match published semantic API contracts', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  await waitForSemanticSearch(page);
  const { index, creatures } = await publishedCatalogs(page);

  expect(index.schema_version).toBe(1);
  expect(index.source?.authority).toBe('Oteryn/Oteryn-Game');
  expect(index.source?.repository).toBe('Oteryn/Oteryn-Game');
  expect(index.source?.contract_id).toBe('oteryn-game-atlas-export-v1');
  expect(index.source?.capability).toBe('semantic-search-source-v1');
  expect(index.counts?.records).toBe(index.records.length);

  expect(creatures.schema_version).toBe(1);
  expect(creatures.source?.contract_id).toBe('oteryn-game-atlas-export-v1');
  expect(creatures.source?.capability).toBe('static-creatures-v1');
  expect(creatures.source?.coordinate_profile).toBe('oteryn-native-floor-v1');
  expect(Array.isArray(creatures.records)).toBeTruthy();

  const diagnostics = await page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__);
  expect(diagnostics.status).toBe('PASS');
  expect(diagnostics.records).toBe(index.records.length);
  expect(diagnostics.creatureSearchRecords).toBe(creatures.records.length);

  const ids = new Set(index.records.map((record) => record.id));
  const indexedIds = Object.values(index.by_kind ?? {}).flat();
  expect(indexedIds.length).toBe(index.records.length);
  expect(indexedIds.every((id) => ids.has(id))).toBeTruthy();
  assertNoRuntimeFailures(runtime);
});

test('published API records render unchanged through browser search', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  await waitForSemanticSearch(page);
  const { index } = await publishedCatalogs(page);
  const records = index.records.slice(0, Math.min(5, index.records.length));
  expect(records.length).toBeGreaterThan(0);

  const input = page.locator('#search-input');
  const results = page.locator('#semantic-search-results-desktop');
  for (const record of records) {
    await input.fill(`id:${record.id}`);
    await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.lastResults)).toBe(1);
    const option = results.getByRole('option');
    await expect(option).toHaveCount(1);
    await expect(option.locator('strong')).toHaveText(record.label);
    await expect(option.locator('small')).toContainText(`${record.position.x}, ${record.position.y}`);
  }
  assertNoRuntimeFailures(runtime);
});
