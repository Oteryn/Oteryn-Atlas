import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');
const controller = read('.github/workflows/protected-verification-controller.yml');
const executor = read('.github/workflows/protected-hosted-executor.yml');
const ci = read('.github/workflows/ci.yml');
const playwright = read('e2e/playwright.config.mjs');
const authorityManifest = JSON.parse(read('tools/verification/verification-authority-manifest.json'));
const environmentConfig = JSON.parse(read('tools/verification/protected-execution-environment.json'));
const probeUrl = new URL('../../tools/verification/protected-execution-environment-probe.mjs', import.meta.url);

function authorityPaths() {
  return new Set(authorityManifest.components.map(({ path }) => path));
}

test('protected controller derives authority and environment identity from protected-base bytes before plan publication', () => {
  assert.match(controller, /buildVerificationAuthorityIdentity/);
  assert.match(controller, /verification-authority-manifest\.json/);
  assert.match(controller, /buildProtectedExecutionEnvironmentIdentity/);
  assert.match(controller, /protected-execution-environment\.json/);
  assert.match(controller, /authorityIdentity,\s*\n\s*environmentIdentity/);
  assert.match(controller, /Build authoritative protected v3 plan/);
  assert.match(controller, /artifacts\/protected-controller\/verification-authority-identity\.json/);
  assert.match(controller, /artifacts\/protected-controller\/protected-execution-environment-identity\.json/);
});

test('protected authority manifest covers every file that can alter hosted execution or final acceptance', () => {
  const paths = authorityPaths();
  for (const path of [
    '.github/workflows/ci.yml',
    '.github/workflows/protected-hosted-executor.yml',
    '.github/workflows/protected-verification-controller.yml',
    'e2e/compose.github-hosted.yml',
    'e2e/compose.protected-hosted-executor.yml',
    'e2e/playwright.config.mjs',
    'e2e/summary-reporter.mjs',
    'tools/verification/assert-current-pr-head.mjs',
    'tools/verification/parse-playwright-test-list.mjs',
    'tools/verification/protected-execution-environment-probe.mjs',
    'tools/verification/protected-playwright-selection.mjs',
  ]) assert.equal(paths.has(path), true, path);
});

test('executable environment probe maps exact observations to the complete qualification contract', async () => {
  assert.equal(fs.existsSync(probeUrl), true, 'protected environment probe module must exist');
  const { buildProtectedExecutionEnvironmentProbeEvidence } = await import(probeUrl.href);
  const evidence = buildProtectedExecutionEnvironmentProbeEvidence(environmentConfig, {
    schemaVersion: 1,
    image: environmentConfig.container.image,
    nodeAvailable: true,
    npmAvailable: true,
    playwrightVersion: environmentConfig.runtime.playwright.version,
    chromiumLaunched: true,
    python3Path: '/usr/bin/python3',
    pythonPath: '/usr/bin/python3',
    writableTmp: true,
    writablePycache: true,
    dependencyMountExists: true,
    dependencyLinkTarget: environmentConfig.mounts.dependencies.target,
    dependencyReadOnly: true,
    candidateReadOnly: true,
    externalNetworkBlocked: true,
    loopbackSocket: true,
    uid: 1000,
    gid: 1000,
    artifactWrite: true,
    pidsLimit: environmentConfig.container.pidsLimit,
    memoryBytes: environmentConfig.container.memoryBytes,
    cpus: environmentConfig.container.cpus,
    noNewPrivileges: true,
    capabilitiesDropped: true,
  });
  assert.equal(evidence.status, 'QUALIFIED');
  assert.deepEqual(Object.values(evidence.checks), Object.values(evidence.checks).map(() => true));
  assert.match(evidence.probeDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(evidence.qualificationDigest, /^sha256:[a-f0-9]{64}$/);
  assert.throws(
    () => buildProtectedExecutionEnvironmentProbeEvidence(environmentConfig, {
      schemaVersion: 1,
      image: environmentConfig.container.image,
      nodeAvailable: true,
    }),
    /observation|qualification|check/i,
  );
});

test('executor qualifies the exact protected environment once before any hosted Chromium work', () => {
  assert.match(executor, /plan\.schemaVersion !== 3/);
  assert.match(executor, /atlas-protected-hosted-controller-v3/);
  assert.match(executor, /environment-qualification:/);
  assert.match(executor, /protected-execution-environment-probe\.mjs/);
  assert.match(executor, /--network\s+none/);
  assert.match(executor, /--read-only/);
  assert.match(executor, /--pids-limit\s+192/);
  assert.match(executor, /--memory\s+1536m/);
  assert.match(executor, /--cpus\s+2/);
  assert.match(executor, /atlas-python-bin/);
  assert.match(executor, /atlas-python-pycache/);
  assert.match(executor, /protected-environment-qualification\.json/);
  assert.match(executor, /buildEvidenceManifest/);
  assert.match(executor, /ENVIRONMENT_QUALIFICATION/);
  assert.match(executor, /hosted-shards:[\s\S]*needs:\s*\[preflight, reuse-evidence, environment-qualification\]/);
  assert.match(executor, /hosted-shards:[\s\S]*execute_environment[\s\S]*environment-qualification\.result == 'success' \|\| needs\.environment-qualification\.result == 'skipped'/);
  assert.match(executor, /fan-in:[\s\S]*needs:\s*\[preflight, reuse-evidence, environment-qualification, hosted-shards\]/);
});

test('Playwright summaries bind semantic, instance, authority and environment identities without the ambiguous planDigest alias', () => {
  for (const field of ['planSemanticDigest', 'planInstanceDigest', 'authorityDigest', 'environmentDigest']) {
    assert.match(playwright, new RegExp(field));
  }
  for (const variable of [
    'ATLAS_PLAN_SEMANTIC_DIGEST',
    'ATLAS_PLAN_INSTANCE_DIGEST',
    'ATLAS_AUTHORITY_DIGEST',
    'ATLAS_ENVIRONMENT_DIGEST',
  ]) assert.match(executor, new RegExp(variable));
  assert.match(playwright, /legacyVerificationPlanSha256 = process\.env\.ATLAS_VERIFICATION_PLAN_SHA256/);
  assert.doesNotMatch(executor, /ATLAS_VERIFICATION_PLAN_SHA256|\.planDigest/);
});

test('atlas-gate independently validates exact hosted fan-in and lifecycle state instead of the legacy local status', () => {
  assert.match(ci, /name:\s*Protected Hosted Playwright evidence/);
  assert.match(ci, /protected-hosted-fan-in/);
  assert.match(ci, /protected-verification-state/);
  assert.match(ci, /validateProtectedHostedGate/);
  assert.match(ci, /expectedCandidateHeadSha: process\.env\.ATLAS_CODE_REVISION/);
  assert.match(ci, /expectedProtectedBaseSha: process\.env\.ATLAS_PROTECTED_BASE_SHA/);
  assert.match(ci, /ATLAS_LEGACY_CUTOVER_BASE_SHA: e31015d0880e9f81a4b96f990658490af45e8fa6/);
  assert.match(ci, /ATLAS_LEGACY_CUTOVER_HEAD_REF: feat\/issue-179-legacy-transition-qualifier/);
  assert.match(ci, /validateLegacyTransitionBootstrapGate/);
});
