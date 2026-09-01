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

test('atlas-gate consumes exact hosted lifecycle evidence without executing repository browser code', () => {
  const nodeJob = block(ci, '  verification-node:\n', '  verification-browser:\n');
  const browserJob = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));

  assert.match(nodeJob, /node --test/);
  assert.match(nodeJob, /tests\/verification\/\*\.test\.mjs/);
  assert.match(browserJob, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /actions: read/);
  assert.match(browserJob, /pull-requests: read/);
  assert.match(browserJob, /ATLAS_CODE_REVISION: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(browserJob, /expected_name="protected-hosted-fan-in-\$ATLAS_PROTECTED_BASE_SHA-\$ATLAS_CODE_REVISION"/);
  assert.match(browserJob, /pulls\/\$ATLAS_PR_NUMBER/);
  assert.match(browserJob, /\.github\/workflows\/protected-hosted-executor\.yml/);
  assert.match(browserJob, /protected-hosted-fan-in\.json/);
  assert.match(browserJob, /protected-verification-state\.json/);
  assert.match(browserJob, /validateProtectedHostedGate/);
  assert.match(browserJob, /ATLAS_LEGACY_CUTOVER_BASE_SHA: f8de8e42ca57112cf71100aa19322ef22527b168/);
  assert.match(browserJob, /ATLAS_PROTECTED_BASE_SHA.*ATLAS_LEGACY_CUTOVER_BASE_SHA/);
  assert.match(browserJob, /commits\/\$ATLAS_CODE_REVISION\/statuses/);
  assert.match(browserJob, /atlas-local-e2e/);
  assert.match(browserJob, /atlas-protected-product-qualification/);
  assert.match(browserJob, /validateProtectedProductQualificationGate/);
  assert.match(browserJob, /protected-execution-promotion-qualification\.yml|protected-product-qualification/);
  assert.doesNotMatch(browserJob, /docker compose|compose\.selfhosted\.yml/);
  assert.match(gate, /- verification-node/);
  assert.match(gate, /- verification-browser/);
  assert.match(gate, /VERIFICATION_BROWSER:.*needs\.verification-browser\.result/);
});

test('legacy local publisher remains exact while protected Playwright identity uses semantic digests', () => {
  const publisherUrl = new URL('../../e2e/publish-local-e2e-status.ps1', import.meta.url);
  assert.equal(fs.existsSync(publisherUrl), true, 'missing legacy local E2E status publisher');
  const publisher = readText(publisherUrl);
  assert.match(publisher, /git status --porcelain/);
  assert.match(publisher, /git ls-remote --heads origin/);
  assert.match(publisher, /metadata\.expectedRevision/);
  assert.match(publisher, /VerificationPlanPath/);
  assert.match(publisher, /validate-e2e-evidence\.mjs/);
  assert.match(publisher, /targetMode -ne 'checkout-overlay'/);
  assert.match(publisher, /metadata\.workers -ne 1/);
  assert.match(publisher, /atlas-local-e2e/);
  assert.match(localRunPs1, /ATLAS_VERIFICATION_PLAN_PATH/);
  assert.match(localCompose, /ATLAS_VERIFICATION_PLAN_SHA256:\s*\$\{ATLAS_VERIFICATION_PLAN_SHA256:-\}/);
  for (const field of ['planSemanticDigest', 'planInstanceDigest', 'authorityDigest', 'environmentDigest']) {
    assert.match(playwrightConfig, new RegExp(field));
  }
  assert.match(playwrightConfig, /ATLAS_VERIFICATION_PLAN_SHA256/);
  assert.match(playwrightConfig, /verificationPlanSha256:\s*legacyVerificationPlanSha256/);
  const executor = readText(new URL('../../.github/workflows/protected-hosted-executor.yml', import.meta.url));
  assert.doesNotMatch(executor, /ATLAS_VERIFICATION_PLAN_SHA256/);
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


test('Molehill local heavy qualification uses a bounded isolated slot pool', () => {
  assert.match(localRunPs1, /ATLAS_E2E_LOCK_TIMEOUT_SECONDS/);
  assert.match(localRunPs1, /heavy-slot-pool\.ps1/);
  assert.match(heavySlotPool, /ATLAS_E2E_SLOT_COUNT/);
  assert.match(heavySlotPool, /oteryn-atlas-heavy-e2e-slot-/);
  assert.match(heavySlotPool, /FileShare\]::None/);
  assert.match(heavySlotPool, /FileShare\]::ReadWrite/);
  assert.match(heavySlotPool, /oteryn-atlas-e2e-project-/);
  assert.match(heavySlotPool, /oteryn-atlas-e2e-artifacts-/);
  assert.match(agents, /bounded.*concurrent|concurrent.*bounded/i);
  assert.match(agents, /isolat/i);
  assert.match(agents, /77-scenario/i);
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

test('classification emits a trusted-base shadow plan without changing legacy gating', () => {
  const classifierJob = block(ci, '  change-classification:\n', '  verification-browser:\n');

  assert.match(classifierJob, /shadow_plan_digest:.*steps\.classify\.outputs\.shadow_plan_digest/);
  assert.match(classifierJob, /ATLAS_INTEGRATION_BASE_REF: \$\{\{ github\.event\.pull_request\.base\.ref \}\}/);
  assert.match(classifierJob, /fetch-depth: 0/);
  assert.match(classifierJob, /git fetch --no-tags origin "\$ATLAS_INTEGRATION_BASE_REF"/);
  assert.match(classifierJob, /integration_base_sha="\$\(git rev-parse "origin\/\$ATLAS_INTEGRATION_BASE_REF"\)"/);
  assert.match(classifierJob, /git merge-base "\$ATLAS_CODE_REVISION" "\$integration_base_sha"/);
  assert.match(classifierJob, /git diff --name-status -z --find-renames "\$merge_base_sha" "\$ATLAS_CODE_REVISION"/);
  assert.match(classifierJob, /GitHub changed-file evidence does not match exact merge-base diff/);
  assert.match(classifierJob, /git cat-file -e "\$integration_base_sha:tools\/verification\/impact-manifest\.json"/);
  assert.match(classifierJob, /git show "\$integration_base_sha:tools\/verification\/impact-manifest\.json"/);
  assert.match(classifierJob, /--trusted-impact/);
  assert.match(classifierJob, /--candidate-impact/);
  assert.match(classifierJob, /--trusted-catalog/);
  assert.match(classifierJob, /--candidate-catalog/);
  assert.match(classifierJob, /--merge-base-sha "\$merge_base_sha"/);
  assert.match(classifierJob, /npm ci --prefix e2e/);
  assert.match(classifierJob, /ATLAS_ARTIFACTS_DIR="\$PWD\/artifacts\/verification\/playwright-list"/);
  assert.match(classifierJob, /playwright test --config=e2e\/playwright\.config\.mjs --list/);
  assert.match(classifierJob, /parse-playwright-test-list\.mjs/);
  assert.match(classifierJob, /--stable-test-ids artifacts\/verification\/stable-test-ids\.json/);
  assert.match(classifierJob, /shadow_plan_digest=/);
  assert.match(classifierJob, /node tools\/verification\/classify-pr-changes\.mjs < "\$paths"/);
});
