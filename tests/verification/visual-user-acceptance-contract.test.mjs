import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

test('user-facing visual acceptance is a required repository contract', async () => {
  const agents = await read('AGENTS.md');
  const platform = await read('docs/testing/ATLAS-VERIFICATION-PLATFORM.md');
  assert.match(agents, /user-facing visual acceptance/i);
  assert.match(platform, /user-facing visual acceptance/i);
  assert.match(platform, /full-frame evidence/i);
  assert.match(platform, /occlusion|clipping/i);
});

test('desktop and mobile visual specs exercise complete user-facing surfaces', async () => {
  const desktop = await read('e2e/tests/visual-desktop.spec.mjs');
  const mobile = await read('e2e/tests/visual-mobile.spec.mjs');
  for (const source of [desktop, mobile]) {
    assert.match(source, /captureUserVisualEvidence/);
    assert.match(source, /assertUserVisibleSurface/);
  }
  assert.match(desktop, /desktop-inspector\.png/);
  assert.doesNotMatch(desktop, /toHaveScreenshot\('desktop-map-frame\.png'/, 'Game-derived map pixels must not become committed visual baselines');
  assert.match(mobile, /mobile-controls-panel\.png/);
  assert.match(mobile, /mobile-inspector-panel\.png/);
});

test('successful visual evidence is exact-revision qualified and must be reviewed before local E2E status publication', async () => {
  const helperPath = path.join(root, 'e2e/support/user-acceptance.mjs');
  assert.equal(existsSync(helperPath), true, 'visual user-acceptance helper must exist');
  const helper = await read('e2e/support/user-acceptance.mjs');
  const publisher = await read('e2e/publish-local-e2e-status.ps1');
  const approver = await read('e2e/approve-visual-user-acceptance.ps1');
  const runPs1 = await read('e2e/run.ps1');
  const runSh = await read('e2e/run.sh');
  assert.match(helper, /ATLAS_EXPECTED_REVISION/);
  assert.match(helper, /ATLAS_USER_VISUAL_EVIDENCE/);
  assert.match(runPs1, /ATLAS_USER_VISUAL_EVIDENCE/);
  assert.match(runSh, /ATLAS_USER_VISUAL_EVIDENCE/);
  assert.match(helper, /user-visual-evidence/);
  assert.match(helper, /screenshot/);
  assert.match(approver, /ConfirmReviewedAllScreenshots/);
  assert.match(approver, /summarySha256/);
  assert.match(approver, /user-visual-scenarios\.json/);
  assert.match(approver, /visualContractSha256/);
  assert.match(approver, /browserProfile/);
  assert.match(approver, /artifactRootPrefix/);
  assert.match(publisher, /reviewRootPrefix/);
  assert.match(publisher, /user-visual-scenarios\.json/);
  assert.match(publisher, /visualContractSha256/);
  assert.match(publisher, /browserProfile/);
  assert.match(publisher, /VisualReviewPath/);
  assert.match(publisher, /visual-review\.json/);
  assert.match(publisher, /approved/);
});

test('visual user acceptance contract enumerates complete primary user-facing states', async () => {
  const contractPath = path.join(root, 'e2e/user-visual-scenarios.json');
  assert.equal(existsSync(contractPath), true, 'visual scenario contract must exist');
  const contract = JSON.parse(await read('e2e/user-visual-scenarios.json'));
  assert.equal(contract.version, 1);
  assert.equal(contract.primaryBrowser, 'chromium');
  assert.deepEqual(contract.scenarios.map(({ id }) => id), [
    'desktop.initial',
    'desktop.search-inspector',
    'desktop.creature-gameplay',
    'desktop.layers',
    'desktop.playback',
    'desktop.minimap',
    'desktop.classic',
    'desktop.floor-mode',
    'desktop.coordinate-pan',
    'desktop.search-degraded',
    'desktop.fail-closed',
    'mobile.initial',
    'mobile.controls',
    'mobile.search',
    'mobile.inspector',
    'mobile.creature-gameplay',
    'mobile.landscape',
  ]);
  for (const scenario of contract.scenarios) {
    assert.equal(typeof scenario.project, 'string');
    assert.match(scenario.project, /-chromium$/);
  }

  const audit = await read('e2e/tests/audit-desktop.spec.mjs');
  const degraded = await read('e2e/tests/degraded-search-desktop.spec.mjs');
  const resilience = await read('e2e/tests/resilience-desktop.spec.mjs');
  const gameplayDesktop = await read('e2e/tests/creature-gameplay-fixture-desktop.spec.mjs');
  const gameplayMobile = await read('e2e/tests/creature-gameplay-fixture-mobile.spec.mjs');
  const gameplayRealDesktop = await read('e2e/tests/creature-gameplay-desktop.spec.mjs');
  for (const id of ['desktop.minimap', 'desktop.classic', 'desktop.floor-mode', 'desktop.coordinate-pan']) {
    assert.ok(audit.includes(id), `visual audit must cover ${id}`);
  }
  assert.match(degraded, /desktop\.search-degraded/);
  assert.match(resilience, /desktop\.fail-closed/);
  assert.match(gameplayDesktop, /captureUserVisualEvidence[\s\S]*?desktop\.creature-gameplay/);
  assert.match(gameplayMobile, /captureUserVisualEvidence[\s\S]*?mobile\.creature-gameplay/);
  assert.doesNotMatch(gameplayDesktop, /battle axe|235 gold|80 gold/,
    'primary desktop visual acceptance must remain qualification-fixture backed');
  assert.doesNotMatch(gameplayMobile, /battle axe|235 gold|80 gold/,
    'primary mobile visual acceptance must remain qualification-fixture backed');
  assert.ok(gameplayRealDesktop.includes(".fill('battle axe')"));
  assert.match(gameplayRealDesktop, /235 gold/);
  assert.match(gameplayRealDesktop, /80 gold/);
});

test('coordinate-pan evidence waits for the current detail scene rather than a stale render', async () => {
  const app = await read('web/fullworld-app.mjs');
  const helper = await read('e2e/support/user-acceptance.mjs');
  const audit = await read('e2e/tests/audit-desktop.spec.mjs');
  const coordinatePan = audit.slice(audit.indexOf("test('audit coordinate Go, wheel zoom and drag pan'"));

  assert.match(app, /let viewEpoch = 0;/);
  assert.match(app, /let detailSceneViewEpoch = null;/);
  assert.match(app, /function refreshIsCurrent\(epoch, floor, expectedViewEpoch\)/);
  assert.match(app, /viewEpoch === expectedViewEpoch/);
  assert.match(app, /const viewEpochAtStart = viewEpoch;/);
  assert.match(app, /detailSceneViewEpoch = viewEpochAtStart;\s*publishView\(\);/);
  assert.match(applyViewSource(app), /viewEpoch \+= 1;/);
  assert.match(wireInteractionSource(app), /view = clampView\(\{ \.\.\.view, x: dragging\.startX[\s\S]*?viewEpoch \+= 1;[\s\S]*?scheduleRefresh\(140\);/);
  assert.match(wireInteractionSource(app), /window\.addEventListener\('resize', \(\) => \{ viewEpoch \+= 1; scheduleRender\('resize'\); scheduleRefresh\(100\);/);
  assert.match(helper, /export async function waitForCurrentDetailScene/);
  assert.match(helper, /detailSceneViewEpoch === presentation\.viewEpoch/);
  assert.match(coordinatePan, /await waitForCurrentDetailScene\(page\);[\s\S]*?captureUserVisualEvidence\(page, testInfo, 'desktop\.coordinate-pan'/);
});

function applyViewSource(source) {
  const start = source.indexOf('function applyView(');
  const end = source.indexOf('\nfunction wireInteraction()', start);
  return source.slice(start, end);
}

function wireInteractionSource(source) {
  const start = source.indexOf('function wireInteraction()');
  const end = source.indexOf('\nasync function chooseInitialPublishedView()', start);
  return source.slice(start, end);
}
