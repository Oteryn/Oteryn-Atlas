import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

async function publishedSemanticIndex(page) {
  return page.evaluate(async () => {
    const response = await fetch('/web/semantic-search/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`semantic index HTTP ${response.status}`);
    return response.json();
  });
}

function uniqueNavigableRecord(index) {
  const counts = new Map();
  for (const record of index.records) counts.set(record.label, (counts.get(record.label) ?? 0) + 1);
  return index.records.find((record) => record.capabilities.includes('navigation') && counts.get(record.label) === 1);
}

test('published semantic result navigates, survives reload, and restores through history', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  const initial = new URL(page.url());
  const index = await publishedSemanticIndex(page);
  const record = uniqueNavigableRecord(index);
  expect(record, 'published index needs a unique navigable record').toBeTruthy();

  const input = page.locator('#search-input');
  const results = page.locator('#semantic-search-results-desktop');
  await input.fill(record.label);
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.lastQuery)).toBe(record.label);
  const option = results.getByRole('option').filter({ hasText: record.label }).first();
  await expect(option).toBeVisible();

  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('semantic') === record.id
      && url.searchParams.get('x') === String(record.position.x)
      && url.searchParams.get('y') === String(record.position.y)
      && url.searchParams.get('floor') === String(record.position.floor)),
    option.click(),
  ]);
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText(record.label);
  await expect(page.locator('#inspector-content')).toContainText(record.id);
  expect(await page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.activeId)).toBe(record.id);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  expect(new URL(page.url()).searchParams.get('semantic')).toBe(record.id);
  await expect(page.locator('#inspector-content')).toContainText(record.id);

  await page.goBack({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  const restored = new URL(page.url());
  expect(restored.searchParams.get('x')).toBe(initial.searchParams.get('x'));
  expect(restored.searchParams.get('y')).toBe(initial.searchParams.get('y'));
  expect(restored.searchParams.get('floor')).toBe(initial.searchParams.get('floor'));
  expect(restored.searchParams.get('semantic')).toBeNull();
  assertNoRuntimeFailures(runtime);
});
