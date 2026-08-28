import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml');
const catalogPath = path.join(ROOT, 'tools/verification/verification-catalog.json');
const impactPath = path.join(ROOT, 'tools/verification/impact-manifest.json');
const fullSafetyCensusPath = path.join(ROOT, 'tools/verification/full-safety-net-stable-ids.json');

const RETAINED_LEGACY_SPECIALIST_IDS = Object.freeze([
  'desktop-chromium::e2e/tests/api-contract-desktop.spec.mjs::browser search diagnostics match published semantic API contracts',
  'desktop-chromium::e2e/tests/api-contract-desktop.spec.mjs::published API records render unchanged through browser search',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop PARTIAL shop never becomes an authoritative empty claim',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop Rat direct activation renders exact Loot Stats and placement-backed Spawns',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop real large shop stays bounded at 100 rendered rows',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop Sam direct activation opens exact Gameplay shop, preserves Semantic, and round-trips URL state',
  'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::published creature animation product passes the full authoritative coverage census',
  'mobile-chromium::e2e/tests/creature-gameplay-mobile.spec.mjs::mobile Rat direct tap renders exact loot stats and keeps topmost Escape behavior',
  'mobile-chromium::e2e/tests/creature-gameplay-mobile.spec.mjs::mobile Sam direct tap reaches readable Gameplay trade data and tabs',
]);

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function retainedLegacyRunnerStableTestIds() {
  const ordinary = readJson(fullSafetyCensusPath).stableTestIds;
  return [...new Set([...ordinary, ...RETAINED_LEGACY_SPECIALIST_IDS])].sort();
}

test('legacy atlas-local-e2e transition qualifier is bounded, exact-head and repository-approved-runner only', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'legacy transition workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /pull_request:\s*\n\s*types:\s*\[labeled\]/);
  assert.doesNotMatch(workflow, /\b(?:opened|synchronize|reopened|ready_for_review)\b/,
    'the legacy capture must not start on ordinary PR lifecycle events or pushes');
  assert.match(workflow, /github\.event\.label\.name == 'atlas-legacy-transition-qualification'/,
    'a maintainer must explicitly add the qualification label before a legacy capture can start');
  assert.match(workflow, /feat\/issue-179-legacy-transition-qualifier/);
  assert.match(workflow, /feat\/issue-179-protected-controller-v2-promotion/);
  assert.match(workflow, /fix\/issue-179-protected-census-readonly-mount/);
  assert.match(workflow, /group:\s*atlas-runners/);
  assert.match(workflow, /labels:\s*oteryn-atlas-pc/);
  assert.match(workflow, /shell:\s*powershell/);
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /\\e2e\\run\.ps1/);
  assert.match(workflow, /ATLAS_E2E_WORKERS:\s*'1'/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /publish-local-e2e-status\.ps1/);
  assert.match(workflow, /visual-review\.json/);
  assert.match(workflow, /atlas-local-e2e/);
  assert.doesNotMatch(workflow, /^\s*\.\\e2e\\approve-visual-user-acceptance\.ps1\b/m, 'workflow must never auto-approve visual evidence');
  assert.doesNotMatch(workflow, /user-visual-evidence[\s\S]{0,500}upload-artifact|upload-artifact[\s\S]{0,500}user-visual-evidence/, 'full-frame visual evidence must remain in the trusted local acceptance directory');
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.doesNotMatch(workflow, /retries?\s*[:=]\s*[1-9]/i);
  assert.doesNotMatch(workflow, /synology/i);
});

test('legacy transition plan binds every stable ID executed by its retained full runner', () => {
  const stableTestIds = retainedLegacyRunnerStableTestIds();
  const catalog = readJson(catalogPath);
  const impact = readJson(impactPath);
  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: '.github/workflows/legacy-molehill-transition-qualification.yml' }],
    trustedImpactManifest: impact,
    candidateImpactManifest: impact,
    trustedVerificationCatalog: catalog,
    candidateVerificationCatalog: catalog,
    stableTestIds,
  });

  assert.deepEqual(plan.stableTestIds, stableTestIds,
    'the status validator requires an exact plan-to-summary census, not a lower bound');
  assert.deepEqual(plan.requiredDataCapabilities,
    ['bounded_real_world', 'qualification_fixture', 'real_fullworld']);
  assert.equal(plan.requiresRealFullWorld, true);
});

test('PowerShell PR-head fences write JSON as UTF-8 without BOM before Node parses it', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /\[Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.doesNotMatch(workflow, /gh api[^\r\n]*>\s*artifacts-current-pr(?:-after)?\.json/);
});

test('PowerShell transition planner writes its plan JSON as UTF-8 without BOM', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /\$planOutput = @\(\s*& node \.\.\\trusted-base\\tools\\verification\\build-verification-plan\.mjs/s);
  assert.match(workflow, /\[IO\.File\]::WriteAllText\(\s*\$planPath,\s*\(\(\$planOutput -join "`n"\) \+ "`n"\),\s*\[Text\.UTF8Encoding\]::new\(\$false\)\s*\)/s);
  assert.doesNotMatch(workflow, /--stable-test-ids artifacts\/verification\/stable-test-ids\.json\s*`?\s*> artifacts\/verification\/pr-verification-plan\.json/);
});

test('PowerShell transition steps never embed Bash heredoc redirection', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /<<\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?/, 'PowerShell cannot parse Bash heredoc redirection');
});

test('PowerShell transition planner uses the exported stable-ID parser instead of its POSIX-only CLI guard', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /node\s+\.\.\\trusted-base\\tools\\verification\\parse-playwright-test-list\.mjs\s+`/);
  assert.match(workflow, /parsePlaywrightStableTestIds/);
});

test('legacy transition qualification retains bounded publication-forwarder diagnostics', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /@\{ Source = \(Join-Path \$runRoot 'publication-forwarder\.log'\); Name = 'publication-forwarder\.log' \},/);
  assert.match(workflow, /@\{ Source = \(Join-Path \$runRoot 'publication-forwarder\.err\.log'\); Name = 'publication-forwarder\.err\.log' \},/);
  assert.match(workflow, /candidate\/artifacts\/github-evidence\/publication-forwarder\.log/);
  assert.match(workflow, /candidate\/artifacts\/github-evidence\/publication-forwarder\.err\.log/);
});

test('reviewed status fence keeps the candidate checkout clean before protected publication', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const statusJob = workflow.split('  publish-reviewed-status:')[1] ?? '';

  assert.match(statusJob, /Join-Path \$env:RUNNER_TEMP/);
  assert.match(statusJob, /--payload \$currentPrPayload/);
  assert.doesNotMatch(statusJob, /Join-Path \$PWD 'artifacts-current-pr\.json'/);
});
