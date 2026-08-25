import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readText(url) {
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

const ci = readText(new URL('../../.github/workflows/ci.yml', import.meta.url));
const nightly = readText(new URL('../../.github/workflows/verification-depth.yml', import.meta.url));
const provenance = readText(new URL('../../.github/workflows/extraction-provenance.yml', import.meta.url));
const synology = readText(new URL('../../.github/workflows/synology-live-acceptance.yml', import.meta.url));
const playwrightConfig = readText(new URL('../../e2e/playwright.config.mjs', import.meta.url));
const agents = readText(new URL('../../AGENTS.md', import.meta.url));
const localRunPs1 = readText(new URL('../../e2e/run.ps1', import.meta.url));

function block(source, start, end) {
  const begin = source.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  const finish = source.indexOf(end, begin + start.length);
  return source.slice(begin, finish === -1 ? source.length : finish);
}

test('atlas-gate requires exact-head local Docker browser evidence', () => {
  const nodeJob = block(ci, '  verification-node:\n', '  verification-browser:\n');
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const gateStart = ci.indexOf('  atlas-gate:\n');
  assert.notEqual(gateStart, -1, 'missing atlas-gate');
  const gate = ci.slice(gateStart);

  assert.match(nodeJob, /node --test/);
  assert.match(nodeJob, /tests\/verification\/\*\.test\.mjs/);
  assert.match(nodeJob, /tests\/properties\/\*\.test\.mjs/);
  for (const path of [
    'tests/creature-presentation-geometry.mjs',
    'tests/creature-interaction.mjs',
    'tests/creature-interaction-target.mjs',
    'tests/map-activation.mjs',
    'tests/creature-map-activation-contract.mjs',
    'tests/creature-interaction-runtime-contract.mjs',
  ]) assert.ok(nodeJob.includes(path), `verification-node missing ${path}`);
  assert.match(nodeJob, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);

  assert.match(browserJob, /github\.event_name == 'pull_request'/);
  assert.match(browserJob, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(browserJob, /- verification-node/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /statuses: read/);
  assert.match(browserJob, /ATLAS_CODE_REVISION: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(browserJob, /atlas-local-e2e/);
  assert.match(browserJob, /commits\/\$ATLAS_CODE_REVISION\/statuses/);
  assert.match(browserJob, /test "\$state" = success/);
  assert.doesNotMatch(browserJob, /group: atlas-runners/);
  assert.doesNotMatch(browserJob, /labels: oteryn-atlas/);
  assert.doesNotMatch(browserJob, /docker compose|compose\.selfhosted\.yml/);

  assert.match(gate, /- verification-node/);
  assert.match(gate, /- verification-browser/);
  assert.match(gate, /VERIFICATION_NODE:.*needs\.verification-node\.result/);
  assert.match(gate, /VERIFICATION_BROWSER:.*needs\.verification-browser\.result/);
  assert.match(gate, /GITHUB_EVENT_NAME/);
  assert.match(gate, /pull_request.*VERIFICATION_BROWSER.*success/s);
});

test('local Docker status publisher only accepts exact clean all-pass evidence', () => {
  const publisherUrl = new URL('../../e2e/publish-local-e2e-status.ps1', import.meta.url);
  assert.equal(fs.existsSync(publisherUrl), true, 'missing local E2E status publisher');
  const publisher = readText(publisherUrl);
  assert.match(publisher, /git status --porcelain/);
  assert.match(publisher, /git ls-remote --heads origin/);
  assert.match(publisher, /metadata\.expectedRevision/);
  assert.match(publisher, /^\$ExpectedScenarioCount = 77$/m);
  assert.match(publisher, /targetMode -ne 'checkout-overlay'/);
  assert.match(publisher, /metadata\.workers -ne 1/);
  assert.match(playwrightConfig, /metadata:\s*\{[\s\S]*workers,/);
  assert.match(publisher, /status -ne 'passed'/);
  assert.match(publisher, /\.status -ne 'passed'/);
  assert.match(publisher, /\.retry -ne 0/);
  assert.match(publisher, /atlas-local-e2e/);
  assert.match(publisher, /state = 'success'/);
  assert.match(publisher, /statuses\/\$sha/);
});

test('required workflows verify the exact pull-request head rather than a synthetic merge ref', () => {
  const checkoutCount = (ci.match(/uses: actions\/checkout@/g) ?? []).length;
  const generalExactHeadCount = (ci.match(/ref: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/g) ?? []).length;
  const prOnlyExactHeadCount = (ci.match(/ref: \${{ github\.event\.pull_request\.head\.sha }}/g) ?? []).length;
  const exactHeadCount = generalExactHeadCount + prOnlyExactHeadCount;
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
  assert.match(nightly, /labels: oteryn-atlas-pc/);
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

test('nightly depth is additive and does not duplicate the PR-gated full required matrix', () => {
  assert.doesNotMatch(nightly, /Invoke-DepthCase -Label ['"]required['"][\s\S]*?['"]npm['"], ['"]test['"]/);
  assert.match(nightly, /Invoke-DepthCase -Label ['"]repeated-critical['"]/);
  assert.match(nightly, /Invoke-DepthCase -Label "stress-\$seed"/);
  assert.match(nightly, /Invoke-DepthCase -Label ['"]extra-profiles['"]/);
  assert.match(nightly, /performance = @\('tests\/performance-desktop\.spec\.mjs'\)/);
  assert.match(nightly, /visual = @\('tests\/visual-desktop\.spec\.mjs'\)/);
  assert.match(nightly, /accessibility = @\('tests\/accessibility-desktop\.spec\.mjs'/);
  assert.match(nightly, /'race-fault' = @\('tests\/race-fault-desktop\.spec\.mjs'/);
  assert.match(nightly, /'soak-leak' = @\('tests\/soak-desktop\.spec\.mjs'/);
});

test('heavy browser verification is pinned to Molehill while Synology remains live-acceptance only', () => {
  const browserDepth = nightly.slice(nightly.indexOf('  browser-depth:\n'));
  assert.match(browserDepth, /group: atlas-runners/);
  assert.match(browserDepth, /labels: oteryn-atlas-pc/);
  assert.match(browserDepth, /oteryn-molehill-atlas/);
  assert.match(browserDepth, /RUNNER_OS -ne 'Windows'/);

  assert.match(synology, /group: atlas-runners/);
  assert.match(synology, /labels: oteryn-atlas/);
  assert.match(synology, /oteryn-synology-atlas/);
  assert.doesNotMatch(synology, /labels: oteryn-atlas-pc/);

  assert.match(agents, /Molehill-PC/);
  assert.match(agents, /heavy.*browser/i);
  assert.match(agents, /Synology.*live acceptance/i);
  assert.match(agents, /must not.*77-scenario/i);
});

test('nightly Molehill identity avoids pre-scheduling runner context expressions', () => {
  const browserDepth = nightly.slice(nightly.indexOf('  browser-depth:\n'));
  const jobEnv = block(browserDepth, '    env:\n', '    steps:\n');

  assert.doesNotMatch(jobEnv, /\$\{\{\s*runner\./);
  assert.doesNotMatch(jobEnv, /ATLAS_RUNNER_(?:NAME|OS):/);
  assert.match(browserDepth, /\$env:RUNNER_NAME -ne 'oteryn-molehill-atlas'/);
  assert.match(browserDepth, /\$env:RUNNER_OS -ne 'Windows'/);
});

test('nightly browser depth keeps a bounded self-hosted execution budget', () => {
  const browserDepthStart = nightly.indexOf('  browser-depth:\n');
  assert.notEqual(browserDepthStart, -1, 'missing browser-depth job');
  const browserDepth = nightly.slice(browserDepthStart);
  const match = browserDepth.match(/timeout-minutes:\s*(\d+)/);
  assert.ok(match, 'nightly browser-depth must declare a bounded timeout');
  assert.ok(Number(match[1]) >= 180, `nightly browser-depth timeout ${match[1]}m is below the measured self-hosted depth budget`);
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


test('Molehill local heavy qualification is machine-serialized to prevent publication overload', () => {
  assert.match(localRunPs1, /ATLAS_E2E_LOCK_TIMEOUT_SECONDS/);
  assert.match(localRunPs1, /oteryn-atlas-heavy-e2e\.lock/);
  assert.match(localRunPs1, /FileShare\]::None/);
  assert.match(localRunPs1, /Start-Sleep/);
  assert.match(localRunPs1, /Dispose\(\)/);
  assert.match(agents, /serializ/i);
  assert.match(agents, /concurrent.*77-scenario|77-scenario.*concurrent/i);
});

test('docs-only PR classification skips heavy browser proof only when proven safe', () => {
  const classifierJob = block(ci, '  change-classification:\n', '  verification-browser:\n');
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));

  assert.match(classifierJob, /github\.event_name == 'pull_request'/);
  assert.match(classifierJob, /pull-requests: read/);
  assert.match(classifierJob, /github\.event\.pull_request\.head\.sha/);
  assert.match(classifierJob, /gh api --paginate/);
  assert.match(classifierJob, /classify-pr-changes\.mjs/);
  assert.match(classifierJob, /docs_only:.*steps\.classify\.outputs\.docs_only/);
  assert.match(classifierJob, /requires_e2e:.*steps\.classify\.outputs\.requires_e2e/);

  assert.match(browserJob, /needs:\s*\n\s*- verification-node\s*\n\s*- change-classification/);
  assert.match(browserJob, /needs\.change-classification\.outputs\.requires_e2e == 'true'/);

  assert.match(gate, /- change-classification/);
  assert.match(gate, /CHANGE_CLASSIFICATION:.*needs\.change-classification\.result/);
  assert.match(gate, /DOCS_ONLY:.*needs\.change-classification\.outputs\.docs_only/);
  assert.match(gate, /REQUIRES_E2E:.*needs\.change-classification\.outputs\.requires_e2e/);
  assert.match(gate, /false:true[\s\S]*VERIFICATION_BROWSER[\s\S]*skipped/);
  assert.match(gate, /true:false[\s\S]*VERIFICATION_BROWSER[\s\S]*success/);
});
