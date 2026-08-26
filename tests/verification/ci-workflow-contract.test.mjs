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
const localCompose = readText(new URL('../../e2e/compose.yml', import.meta.url));
const heavySlotPool = readText(new URL('../../e2e/heavy-slot-pool.ps1', import.meta.url));

function block(source, start, end) {
  const begin = source.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  const finish = source.indexOf(end, begin + start.length);
  return source.slice(begin, finish === -1 ? source.length : finish);
}

test('atlas-gate requires exact-head GitHub-hosted Docker browser evidence for ordinary PRs', () => {
  const nodeJob = block(ci, '  verification-node:\n', '  change-classification:\n');
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));

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
  assert.match(browserJob, /- change-classification/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(browserJob, /ATLAS_EXPECTED_REVISION/);
  assert.match(browserJob, /ATLAS_E2E_WORKERS: '1'/);
  assert.match(browserJob, /ATLAS_USER_VISUAL_EVIDENCE: '0'/);
  assert.match(browserJob, /docker compose -f e2e\/compose\.yml build e2e/);
  assert.match(browserJob, /docker compose -f e2e\/compose\.yml run --rm e2e/);
  assert.match(browserJob, /validate-github-hosted-e2e\.mjs/);
  assert.match(browserJob, /summary\.json/);
  assert.doesNotMatch(browserJob, /statuses: read/);
  assert.doesNotMatch(browserJob, /atlas-local-e2e/);
  assert.doesNotMatch(browserJob, /group: atlas-runners/);

  assert.match(gate, /- verification-node/);
  assert.match(gate, /- verification-browser/);
  assert.match(gate, /VERIFICATION_NODE:.*needs\.verification-node\.result/);
  assert.match(gate, /VERIFICATION_BROWSER:.*needs\.verification-browser\.result/);
  assert.match(gate, /pull_request.*VERIFICATION_BROWSER.*success/s);
});

test('specialist local status publisher remains fail closed but is not ordinary gate authority', () => {
  const publisherUrl = new URL('../../e2e/publish-local-e2e-status.ps1', import.meta.url);
  assert.equal(fs.existsSync(publisherUrl), true, 'missing specialist local E2E status publisher');
  const publisher = readText(publisherUrl);
  assert.match(publisher, /git status --porcelain/);
  assert.match(publisher, /git ls-remote --heads origin/);
  assert.match(publisher, /metadata\.expectedRevision/);
  assert.match(publisher, /VerificationPlanPath/);
  assert.match(publisher, /validate-e2e-evidence\.mjs/);
  assert.match(publisher, /merge-base/);
  assert.match(publisher, /metadata\.workers -ne 1/);
  assert.match(publisher, /status -ne 'passed'/);
  assert.match(playwrightConfig, /verificationPlanSha256/);
  assert.match(localRunPs1, /ATLAS_VERIFICATION_PLAN_PATH/);
  assert.match(localCompose, /ATLAS_VERIFICATION_PLAN_SHA256:\s*\$\{ATLAS_VERIFICATION_PLAN_SHA256:-\}/);
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  assert.doesNotMatch(browserJob, /publish-local-e2e-status|atlas-local-e2e/);
});

test('required workflows verify the exact pull-request head rather than a synthetic merge ref', () => {
  const checkoutCount = (ci.match(/uses: actions\/checkout@/g) ?? []).length;
  const generalExactHeadCount = (ci.match(/ref: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/g) ?? []).length;
  const prOnlyExactHeadCount = (ci.match(/ref: \${{ github\.event\.pull_request\.head\.sha }}/g) ?? []).length;
  assert.equal(generalExactHeadCount + prOnlyExactHeadCount, checkoutCount);

  const candidate = block(provenance, '      - name: Check out exact Atlas candidate\n', '      - name: Check out pinned legacy Atlas source as inert Git data\n');
  assert.match(candidate, /ref: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/);
});

test('scheduled depth remains bounded, replayable, read-only and evidence-producing while migration continues', () => {
  assert.match(nightly, /schedule:\s*\n\s*- cron:/);
  assert.match(nightly, /workflow_dispatch:/);
  assert.doesNotMatch(nightly, /pull_request:/);
  assert.match(nightly, /permissions:\s*\n\s*contents: read/);
  assert.match(nightly, /ATLAS_STRESS_LENGTH: ['"]?64['"]?/);
  for (const seed of ['133', '1096043585', '2779096485', '3735928559']) assert.match(nightly, new RegExp(`\\b${seed}\\b`));
  assert.match(nightly, /--repeat-each=3/);
  assert.match(nightly, /nightly-desktop-dpr2/);
  assert.match(nightly, /optional-depth-skips\.json/);
  assert.match(nightly, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
  assert.doesNotMatch(nightly, /docker\s+(?:stop|rename)\b/);
});

test('scheduled depth is additive and does not replay the generic required PR command', () => {
  assert.doesNotMatch(nightly, /Invoke-DepthCase -Label ['"]required['"][\s\S]*?['"]npm['"], ['"]test['"]/);
  assert.match(nightly, /Invoke-DepthCase -Label ['"]repeated-critical['"]/);
  assert.match(nightly, /Invoke-DepthCase -Label "stress-\$seed"/);
  assert.match(nightly, /Invoke-DepthCase -Label ['"]extra-profiles['"]/);
});

test('ordinary browser verification is GitHub-hosted and Synology remains deployment/live-acceptance only', () => {
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(browserJob, /oteryn-atlas-pc|oteryn-molehill-atlas/);

  assert.match(synology, /group: atlas-runners/);
  assert.match(synology, /labels: oteryn-atlas/);
  assert.match(synology, /oteryn-synology-atlas/);
  assert.doesNotMatch(synology, /labels: oteryn-atlas-pc/);

  assert.match(agents, /GitHub-hosted CI is the default execution plane/);
  assert.match(agents, /Molehill-PC[^\n]*specialist\/exception-only/);
  assert.match(agents, /Synology[^\n]*deployment-only/);
});

test('existing Molehill depth identity avoids pre-scheduling runner context expressions', () => {
  const browserDepth = nightly.slice(nightly.indexOf('  browser-depth:\n'));
  const jobEnv = block(browserDepth, '    env:\n', '    steps:\n');
  assert.doesNotMatch(jobEnv, /\$\{\{\s*runner\./);
  assert.doesNotMatch(jobEnv, /ATLAS_RUNNER_(?:NAME|OS):/);
  assert.match(browserDepth, /\$env:RUNNER_NAME -ne 'oteryn-molehill-atlas'/);
  assert.match(browserDepth, /\$env:RUNNER_OS -ne 'Windows'/);
});

test('existing specialist depth keeps a bounded self-hosted execution budget', () => {
  const browserDepth = nightly.slice(nightly.indexOf('  browser-depth:\n'));
  const match = browserDepth.match(/timeout-minutes:\s*(\d+)/);
  assert.ok(match, 'browser-depth must declare a bounded timeout');
  assert.ok(Number(match[1]) >= 180);
});

test('nightly Playwright profiles are opt-in and do not expand the ordinary PR suite implicitly', () => {
  assert.match(playwrightConfig, /ATLAS_E2E_DEPTH/);
  assert.match(playwrightConfig, /nightly-desktop-dpr2/);
  assert.match(playwrightConfig, /nightly-tablet/);
});

test('self-hosted specialist depth does not require host Python', () => {
  const browserDepth = nightly.slice(nightly.indexOf('  browser-depth:\n'));
  assert.doesNotMatch(browserDepth, /^\s*python(?:3)?\s/m);
});

test('Molehill specialist qualification retains bounded isolated host admission', () => {
  assert.match(localRunPs1, /ATLAS_E2E_LOCK_TIMEOUT_SECONDS/);
  assert.match(localRunPs1, /heavy-slot-pool\.ps1/);
  assert.match(heavySlotPool, /ATLAS_E2E_SLOT_COUNT/);
  assert.match(heavySlotPool, /oteryn-atlas-heavy-e2e-slot-/);
  assert.match(heavySlotPool, /FileShare\]::None/);
  assert.match(heavySlotPool, /FileShare\]::ReadWrite/);
  assert.match(heavySlotPool, /oteryn-atlas-e2e-project-/);
  assert.match(heavySlotPool, /oteryn-atlas-e2e-artifacts-/);
  assert.match(agents, /bounded machine-wide slot pool/i);
  assert.match(agents, /isolated Compose\/artifact namespaces/i);
});

test('docs-only PR classification skips GitHub-hosted browser proof only when proven safe', () => {
  const classifierJob = block(ci, '  change-classification:\n', '  verification-browser:\n');
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));

  assert.match(classifierJob, /github\.event_name == 'pull_request'/);
  assert.match(classifierJob, /pull-requests: read/);
  assert.match(classifierJob, /github\.event\.pull_request\.head\.sha/);
  assert.match(classifierJob, /gh api --paginate/);
  assert.match(classifierJob, /classify-pr-changes\.mjs/);
  assert.match(browserJob, /needs\.change-classification\.outputs\.requires_e2e == 'true'/);
  assert.match(gate, /false:true[\s\S]*VERIFICATION_BROWSER[\s\S]*skipped/);
  assert.match(gate, /true:false[\s\S]*VERIFICATION_BROWSER[\s\S]*success/);
});

test('classification emits a trusted-base shadow plan before selective cutover', () => {
  const classifierJob = block(ci, '  change-classification:\n', '  verification-browser:\n');
  assert.match(classifierJob, /shadow_plan_digest:.*steps\.classify\.outputs\.shadow_plan_digest/);
  assert.match(classifierJob, /ATLAS_INTEGRATION_BASE_REF/);
  assert.match(classifierJob, /fetch-depth: 0/);
  assert.match(classifierJob, /git fetch --no-tags origin "\$ATLAS_INTEGRATION_BASE_REF"/);
  assert.match(classifierJob, /git merge-base/);
  assert.match(classifierJob, /GitHub changed-file evidence does not match exact merge-base diff/);
  assert.match(classifierJob, /--trusted-impact/);
  assert.match(classifierJob, /--candidate-impact/);
  assert.match(classifierJob, /--trusted-catalog/);
  assert.match(classifierJob, /--candidate-catalog/);
  assert.match(classifierJob, /npm ci --prefix e2e/);
  assert.match(classifierJob, /playwright test --config=e2e\/playwright\.config\.mjs --list/);
  assert.match(classifierJob, /parse-playwright-test-list\.mjs/);
  assert.match(classifierJob, /--stable-test-ids artifacts\/verification\/stable-test-ids\.json/);
  assert.match(classifierJob, /shadow_plan_digest=/);
});
