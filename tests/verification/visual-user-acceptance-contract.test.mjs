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
  assert.match(publisher, /VisualReviewPath/);
  assert.match(publisher, /visual-review\.json/);
  assert.match(publisher, /approved/);
});
