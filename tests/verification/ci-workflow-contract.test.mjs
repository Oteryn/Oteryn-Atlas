import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readText(url) {
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

const ci = readText(new URL('../../.github/workflows/ci.yml', import.meta.url));
const nightly = readText(new URL('../../.github/workflows/verification-depth.yml', import.meta.url));
const provenance = readText(new URL('../../.github/workflows/extraction-provenance.yml', import.meta.url));
const playwrightConfig = readText(new URL('../../e2e/playwright.config.mjs', import.meta.url));

function block(source, start, end) {
  const begin = source.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  const finish = source.indexOf(end, begin + start.length);
  return source.slice(begin, finish === -1 ? source.length : finish);
}

test('atlas-gate requires deterministic verification and full Docker browser qualification', () => {
  const nodeJob = block(ci, '  verification-node:\n', '  verification-browser:\n');
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const gateStart = ci.indexOf('  atlas-gate:\n');
  assert.notEqual(gateStart, -1, 'missing atlas-gate');
  const gate = ci.slice(gateStart);

  assert.match(nodeJob, /node --test/);
  assert.match(nodeJob, /tests\/verification\/\*\.test\.mjs/);
  assert.match(nodeJob, /tests\/properties\/\*\.test\.mjs/);
  assert.match(nodeJob, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);

  assert.match(browserJob, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(browserJob, /group: atlas-runners/);
  assert.match(browserJob, /labels: oteryn-atlas/);
  assert.match(browserJob, /ATLAS_PUBLICATION_ORIGIN: http:\/\/192\.168\.1\.2:8097/);
  assert.match(browserJob, /ATLAS_E2E_WORKERS: ['"]?1['"]?/);
  assert.match(browserJob, /\.\/e2e\/run\.sh/);
  assert.match(browserJob, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);

  assert.match(gate, /- verification-node/);
  assert.match(gate, /- verification-browser/);
  assert.match(gate, /VERIFICATION_NODE:.*needs\.verification-node\.result/);
  assert.match(gate, /VERIFICATION_BROWSER:.*needs\.verification-browser\.result/);
});

test('required workflows verify the exact pull-request head rather than a synthetic merge ref', () => {
  const checkoutCount = (ci.match(/uses: actions\/checkout@/g) ?? []).length;
  const exactHeadCount = (ci.match(/ref: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/g) ?? []).length;
  assert.equal(exactHeadCount, checkoutCount);

  const candidate = block(provenance, '      - name: Check out exact Atlas candidate\n', '      - name: Check out pinned legacy Atlas source as inert Git data\n');
  assert.match(candidate, /ref: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/);
});

test('nightly depth is scheduled, bounded, replayable, read-only and evidence-producing', () => {
  assert.match(nightly, /schedule:\s*\n\s*- cron:/);
  assert.match(nightly, /workflow_dispatch:/);
  assert.doesNotMatch(nightly, /pull_request:/);
  assert.match(nightly, /permissions:\s*\n\s*contents: read/);
  assert.match(nightly, /group: atlas-runners/);
  assert.match(nightly, /labels: oteryn-atlas/);
  assert.match(nightly, /ATLAS_PUBLICATION_ORIGIN: http:\/\/192\.168\.1\.2:8097/);
  assert.match(nightly, /ATLAS_STRESS_LENGTH: ['"]?64['"]?/);
  for (const seed of ['133', '1096043585', '2779096485', '3735928559']) {
    assert.match(nightly, new RegExp(`\\b${seed}\\b`));
  }
  assert.match(nightly, /--repeat-each=3/);
  assert.match(nightly, /nightly-desktop-dpr2/);
  assert.match(nightly, /optional-depth-skips\.json/);
  assert.match(nightly, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
  assert.doesNotMatch(nightly, /docker\s+(?:stop|rename)\b/);
  assert.doesNotMatch(nightly, /PREVIEW_CONTAINER/);
});

test('nightly Playwright profiles are opt-in and do not expand the PR suite implicitly', () => {
  assert.match(playwrightConfig, /ATLAS_E2E_DEPTH/);
  assert.match(playwrightConfig, /nightly-desktop-dpr2/);
  assert.match(playwrightConfig, /deviceScaleFactor:\s*2/);
  assert.match(playwrightConfig, /nightly-tablet/);
  assert.match(playwrightConfig, /viewport:\s*\{ width: 820, height: 1180 \}/);
  assert.match(playwrightConfig, /isMobile:\s*true/);
});

test('self-hosted nightly browser depth does not require host Python', () => {
  const start = nightly.indexOf('  browser-depth:\n');
  assert.notEqual(start, -1, 'missing browser-depth job');
  const browserDepth = nightly.slice(start);
  assert.doesNotMatch(browserDepth, /^\s*python(?:3)?\s/m);
});
