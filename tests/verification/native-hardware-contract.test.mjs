import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflowPath = '.github/workflows/atlas-native-hardware.yml';
const probePath = 'tools/verification/native-gpu-probe.mjs';
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n') : '';
const probe = fs.existsSync(probePath) ? fs.readFileSync(probePath, 'utf8').replace(/\r\n/g, '\n') : '';

test('native hardware workflow is base-owned, trust-gated and exact-head bound', () => {
  assert.equal(fs.existsSync(workflowPath), true, `${workflowPath} is missing`);
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /trust-admission:/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /tools\/verification\/trust-admission\.mjs/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /requiresNativeHardware/);
  assert.match(workflow, /verificationPlanSha256|PLAN_SHA256/);
  assert.match(workflow, /superseded-head/);
});

test('native GPU execution is exclusive on Molehill and does not duplicate Docker functional authority', () => {
  assert.match(workflow, /group: atlas-runners/);
  assert.match(workflow, /labels: oteryn-atlas-pc/);
  assert.match(workflow, /Acquire-AtlasExclusiveHostAdmission/);
  assert.match(workflow, /ResourceClass 'native-gpu'/);
  assert.match(workflow, /Release-AtlasExclusiveHostAdmission/);
  assert.doesNotMatch(workflow, /docker compose[\s\S]*playwright test/i);
  assert.doesNotMatch(workflow, /ATLAS_PUBLICATION_ORIGIN/);
});

test('native probe rejects software rendering and emits bounded exact machine evidence', () => {
  assert.equal(fs.existsSync(probePath), true, `${probePath} is missing`);
  assert.match(probe, /WEBGL_debug_renderer_info/);
  assert.match(probe, /SwiftShader|llvmpipe|Microsoft Basic/i);
  assert.match(probe, /hardwareAccelerated/);
  assert.match(probe, /driverVersion/);
  assert.match(probe, /browserVersion/);
  assert.match(probe, /atlasRevision/);
  assert.match(probe, /verificationPlanSha256/);
  assert.doesNotMatch(probe, /screenshot|png|jpeg|video/i);
});
