import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function source(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function exportedFunctionBody(text, name) {
  const start = text.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} must be exported`);
  const next = text.indexOf('\nexport ', start + 1);
  return text.slice(start, next === -1 ? text.length : next);
}

test('core Atlas readiness is independent from semantic-search readiness', () => {
  const runtime = source('e2e/tests/runtime.mjs');
  const atlas = exportedFunctionBody(runtime, 'waitForAtlas');
  const semanticResult = exportedFunctionBody(runtime, 'semanticSearchResult');
  const semanticPass = exportedFunctionBody(runtime, 'waitForSemanticSearch');

  assert.doesNotMatch(atlas, /__OTERYN_ATLAS_SEMANTIC_SEARCH__/);
  assert.match(semanticResult, /status === 'PASS' \|\| status === 'FAIL'/);
  assert.match(semanticPass, /semanticSearchResult\(page\)/);
  assert.match(semanticPass, /toBe\('PASS'\)/);
});

test('search consumers opt into semantic-search readiness explicitly', () => {
  const minimumCalls = new Map([
    ['e2e/tests/desktop.spec.mjs', 1],
    ['e2e/tests/mobile.spec.mjs', 1],
    ['e2e/tests/state-desktop.spec.mjs', 1],
    ['e2e/tests/scale-desktop.spec.mjs', 1],
    ['e2e/tests/workflows-desktop.spec.mjs', 1],
    ['e2e/tests/api-contract-desktop.spec.mjs', 2],
    ['e2e/tests/user-journey-desktop.spec.mjs', 1],
    ['e2e/tests/user-journey-mobile.spec.mjs', 1],
    ['e2e/tests/visual-desktop.spec.mjs', 1],
    ['e2e/tests/visual-mobile.spec.mjs', 1],
  ]);

  for (const [relative, minimum] of minimumCalls) {
    const text = source(relative);
    assert.match(text, /waitForSemanticSearch/ , `${relative} must import semantic readiness`);
    const calls = text.match(/waitForSemanticSearch\(page\)/g) ?? [];
    assert.ok(calls.length >= minimum, `${relative} must wait for semantic search before its search oracle`);
  }
});

test('semantic-search fault tests use terminal semantic state instead of a PASS-only global gate', () => {
  for (const relative of [
    'e2e/tests/degraded-search-desktop.spec.mjs',
    'e2e/tests/resilience-desktop.spec.mjs',
  ]) {
    const text = source(relative);
    assert.match(text, /semanticSearchResult/);
    assert.match(text, /waitForAtlas\(page\)/);
    assert.doesNotMatch(text, /waitForFunction\(\(\) => globalThis\.__OTERYN_ATLAS_SEMANTIC_SEARCH__\?\.status === 'FAIL'/);
  }
});