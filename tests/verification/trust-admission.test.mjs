import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../../tools/verification/trust-admission.mjs', import.meta.url);

function trusted(overrides = {}) {
  return {
    repository: 'Oteryn/Oteryn-Atlas',
    eventName: 'workflow_dispatch',
    baseRef: 'main',
    headRepository: 'Oteryn/Oteryn-Atlas',
    headSha: '1'.repeat(40),
    currentHeadSha: '1'.repeat(40),
    actor: 'blakinio',
    author: 'blakinio',
    authorAssociation: 'MEMBER',
    resourceClass: 'browser-full',
    reasonCode: 'user-facing-visual-review',
    requiredCapability: 'restricted-visual',
    ...overrides,
  };
}

test('trusted exact-head specialist dispatch can reach Molehill', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing trust-admission module');
  const { decideTrustAdmission } = await import(moduleUrl);
  assert.deepEqual(decideTrustAdmission(trusted()), {
    schemaVersion: 2,
    decision: 'admit',
    state: 'admitted',
    reason: 'trusted-specialist-exception',
    trustLevel: 'trusted-same-repository',
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: '1'.repeat(40),
    resourceClass: 'browser-full',
    reasonCode: 'user-facing-visual-review',
    requiredCapability: 'restricted-visual',
  });
});

test('ordinary PR events cannot become specialist self-hosted authority', async () => {
  const { decideTrustAdmission } = await import(moduleUrl);
  assert.equal(decideTrustAdmission(trusted({ eventName: 'pull_request_target' })).reason, 'untrusted-workflow-context');
  assert.equal(decideTrustAdmission(trusted({ eventName: 'pull_request' })).reason, 'untrusted-workflow-context');
});

test('fork, bot and weak contributor trust fail closed before specialist execution', async () => {
  const { decideTrustAdmission } = await import(moduleUrl);
  assert.equal(decideTrustAdmission(trusted({ headRepository: 'someone/fork' })).reason, 'fork-head-rejected');
  assert.equal(decideTrustAdmission(trusted({ author: 'dependabot[bot]' })).reason, 'bot-candidate-rejected');
  assert.equal(decideTrustAdmission(trusted({ actor: 'renovate[bot]' })).reason, 'bot-actor-rejected');
  assert.equal(decideTrustAdmission(trusted({ authorAssociation: 'CONTRIBUTOR' })).reason, 'author-association-not-authorized');
});

test('superseded malformed and non-main candidates fail closed', async () => {
  const { decideTrustAdmission } = await import(moduleUrl);
  assert.equal(decideTrustAdmission(trusted({ currentHeadSha: '2'.repeat(40) })).reason, 'superseded-head');
  assert.equal(decideTrustAdmission(trusted({ baseRef: 'dev' })).reason, 'protected-base-required');
  assert.equal(decideTrustAdmission(trusted({ headSha: 'nope' })).reason, 'invalid-head-sha');
});

test('specialist reason, capability and resource class must match exactly', async () => {
  const { decideTrustAdmission } = await import(moduleUrl);
  assert.equal(decideTrustAdmission(trusted({ reasonCode: 'ordinary-pr-e2e' })).reason, 'unsupported-specialist-reason');
  assert.equal(decideTrustAdmission(trusted({ requiredCapability: 'native-gpu' })).reason, 'reason-capability-mismatch');
  assert.equal(decideTrustAdmission(trusted({ resourceClass: 'performance' })).reason, 'resource-class-not-authorized-for-capability');

  const gpu = decideTrustAdmission(trusted({
    reasonCode: 'gpu-driver-render-truth',
    requiredCapability: 'native-gpu',
    resourceClass: 'native-gpu',
  }));
  assert.equal(gpu.state, 'admitted');
  assert.equal(gpu.requiredCapability, 'native-gpu');
});
