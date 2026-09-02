import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
  waitForSemanticSearch,
} from './runtime.mjs';

async function publishedSearchCorpus(page) {
  return page.evaluate(async () => {
    const [indexResponse, creatureResponse] = await Promise.all([
      fetch('/web/semantic-search/index.json', { cache: 'no-store' }),
      fetch('/web/semantic-search/creatures.json', { cache: 'no-store' }),
    ]);
    if (!indexResponse.ok || !creatureResponse.ok) throw new Error('published search corpus unavailable');
    const index = await indexResponse.json();
    const creatures = await creatureResponse.json();
    return [...index.records, ...creatures.records]
      .filter((record) => typeof record.label === 'string' && record.label.trim())
      .map((record) => ({ id: record.id ?? record.record_id, label: record.label }));
  });
}

test('repeated searches over published corpus stay bounded without DOM growth', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  await waitForSemanticSearch(page);
  const corpus = await publishedSearchCorpus(page);
  expect(corpus.length).toBeGreaterThan(50);

  const input = page.locator('#search-input');
  const results = page.locator('#semantic-search-results-desktop');
  const sampleCount = Math.min(60, corpus.length);
  const stride = Math.max(1, Math.floor(corpus.length / sampleCount));
  const sample = corpus.filter((_, index) => index % stride === 0).slice(0, sampleCount);
  expect(sample.length).toBeGreaterThanOrEqual(Math.min(25, sampleCount));

  for (const record of sample) {
    await input.fill(record.label);
    await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.lastQuery)).toBe(record.label.trim());
    const diagnostics = await page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__);
    expect(diagnostics.lastResults).toBeGreaterThan(0);
    expect(diagnostics.lastResults).toBeLessThanOrEqual(12);
    expect(await results.getByRole('option').count()).toBeLessThanOrEqual(12);
  }

  await input.fill('x'.repeat(257));
  await expect(results).toBeVisible();
  await expect(results).toContainText(/search query invalid/i);
  expect(await results.getByRole('option').count()).toBe(0);

  await input.fill('');
  await expect(results).toBeHidden();
  expect(await results.getByRole('option').count()).toBe(0);
  assertNoRuntimeFailures(runtime);
});
