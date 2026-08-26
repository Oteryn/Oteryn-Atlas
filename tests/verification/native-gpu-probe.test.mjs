import assert from 'node:assert/strict';
import test from 'node:test';

import { assessNativeGpuEvidence } from '../../tools/verification/native-gpu-probe.mjs';

const good = Object.freeze({
  atlasRevision: 'a'.repeat(40),
  verificationPlanSha256: `sha256:${'b'.repeat(64)}`,
  adapterName: 'AMD Radeon RX 9070 XT',
  driverVersion: '32.0.21000.1',
  browserVersion: 'Google Chrome 151.0.0.0',
  webgl2: true,
  webglVendor: 'Google Inc. (AMD)',
  webglRenderer: 'ANGLE (AMD, AMD Radeon RX 9070 XT Direct3D11)',
  pixelSample: [64, 128, 191, 255],
});

test('bounded D3D hardware evidence qualifies without visual artifacts', () => {
  const evidence = assessNativeGpuEvidence(good);
  assert.equal(evidence.hardwareAccelerated, true);
  assert.equal(evidence.atlasRevision, good.atlasRevision);
  assert.equal(evidence.verificationPlanSha256, good.verificationPlanSha256);
  assert.equal(Object.hasOwn(evidence, 'screenshot'), false);
});

test('software renderers and missing WebGL2 fail closed', () => {
  for (const renderer of ['Google SwiftShader', 'llvmpipe LLVM 18', 'Microsoft Basic Render Driver', 'ANGLE WARP']) {
    assert.throws(() => assessNativeGpuEvidence({ ...good, webglRenderer: renderer }), /hardware acceleration not proven/);
  }
  assert.throws(() => assessNativeGpuEvidence({ ...good, webgl2: false }), /hardware acceleration not proven/);
});

test('forged plan identity and wrong render pixels are rejected', () => {
  assert.throws(() => assessNativeGpuEvidence({ ...good, verificationPlanSha256: 'sha256:nope' }), /plan digest/);
  assert.throws(() => assessNativeGpuEvidence({ ...good, pixelSample: [0, 0, 0, 255] }), /hardware acceleration not proven/);
});
