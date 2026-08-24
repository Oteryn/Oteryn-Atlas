import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = await readFile(new URL('../../e2e/playwright.config.mjs', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../../.github/workflows/verification-depth.yml', import.meta.url), 'utf8');
const docs = await readFile(new URL('../../docs/testing/ATLAS-VERIFICATION-PLATFORM.md', import.meta.url), 'utf8');
const launchProof = new URL('../../e2e/support/cross-browser-launch-proof.mjs', import.meta.url);

function projectBlock(name) {
  const start = config.indexOf(`name: '${name}'`);
  assert.notEqual(start, -1, `missing Playwright project ${name}`);
  return config.slice(start, start + 700);
}

test('nightly depth defines bounded Firefox and WebKit desktop/mobile-like projects', () => {
  for (const [name, engine] of [
    ['nightly-firefox-desktop', 'firefox'],
    ['nightly-firefox-mobile-like', 'firefox'],
    ['nightly-webkit-desktop', 'webkit'],
    ['nightly-webkit-mobile-like', 'webkit'],
  ]) {
    const block = projectBlock(name);
    assert.match(block, new RegExp(`browserName: '${engine}'`));
    assert.match(block, /cross-browser-(desktop|mobile)\.spec\.mjs/);
    if (name.includes('mobile-like')) assert.doesNotMatch(block, /isMobile\s*:/);
  }
  assert.match(config, /retries:\s*0/);
  assert.match(config, /fullyParallel:\s*false/);
});

test('nightly workflow launches pinned non-Chromium engines and runs them sequentially', () => {
  assert.equal(existsSync(launchProof), true, 'missing executable Firefox/WebKit launch proof');
  assert.match(workflow, /cross-browser-launch-proof\.mjs/);
  for (const project of [
    'nightly-firefox-desktop', 'nightly-firefox-mobile-like',
    'nightly-webkit-desktop', 'nightly-webkit-mobile-like',
  ]) assert.match(workflow, new RegExp(`--project=${project}`));
  assert.match(workflow, /ATLAS_E2E_WORKERS:\s*'1'/);
});

test('verification docs distinguish Chromium pixel baselines from cross-engine acceptance', () => {
  assert.match(docs, /Firefox/i);
  assert.match(docs, /WebKit/i);
  assert.match(docs, /Chromium[^\n]*(pixel|baseline)/i);
  assert.match(docs, /(behavioral|user-facing)[^\n]*(cross-engine|Firefox|WebKit)/i);
});
