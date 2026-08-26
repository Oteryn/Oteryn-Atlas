import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../../tools/verification/trust-admission.mjs', import.meta.url);

test('trusted same-repository member can reach Molehill for an exact current head', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing trust-admission module');
  const { decideTrustAdmission } = await import(moduleUrl);
  const result = decideTrustAdmission({
    repository: 'Oteryn/Oteryn-Atlas',
    eventName: 'pull_request_target',
    baseRef: 'main',
    headRepository: 'Oteryn/Oteryn-Atlas',
    headSha: '1'.repeat(40),
    currentHeadSha: '1'.repeat(40),
    actor: 'blakinio',
    author: 'blakinio',
    authorAssociation: 'MEMBER',
    resourceClass: 'browser-full',
  });
  assert.deepEqual(result, {
    schemaVersion: 1,
    decision: 'admit',
    state: 'admitted',
    reason: 'trusted-same-repository-member',
    trustLevel: 'trusted-same-repository',
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: '1'.repeat(40),
    resourceClass: 'browser-full',
  });
});

test('fork, bot and weak contributor trust fail closed before self-hosted execution', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing trust-admission module');
  const { decideTrustAdmission } = await import(moduleUrl);
  const base = {
    repository: 'Oteryn/Oteryn-Atlas',
    eventName: 'pull_request_target',
    baseRef: 'main',
    headRepository: 'Oteryn/Oteryn-Atlas',
    headSha: '2'.repeat(40),
    currentHeadSha: '2'.repeat(40),
    actor: 'blakinio',
    author: 'blakinio',
    authorAssociation: 'MEMBER',
    resourceClass: 'browser-full',
  };

  assert.equal(decideTrustAdmission({ ...base, headRepository: 'someone/fork' }).reason, 'fork-head-rejected');
  assert.equal(decideTrustAdmission({ ...base, author: 'dependabot[bot]' }).reason, 'bot-candidate-rejected');
  assert.equal(decideTrustAdmission({ ...base, actor: 'renovate[bot]' }).reason, 'bot-actor-rejected');
  assert.equal(decideTrustAdmission({ ...base, authorAssociation: 'CONTRIBUTOR' }).reason, 'author-association-not-authorized');
});

test('superseded malformed and non-base-owned events cannot become trusted evidence', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing trust-admission module');
  const { decideTrustAdmission } = await import(moduleUrl);
  const base = {
    repository: 'Oteryn/Oteryn-Atlas',
    eventName: 'pull_request_target',
    baseRef: 'main',
    headRepository: 'Oteryn/Oteryn-Atlas',
    headSha: '3'.repeat(40),
    currentHeadSha: '3'.repeat(40),
    actor: 'blakinio',
    author: 'blakinio',
    authorAssociation: 'MEMBER',
    resourceClass: 'browser-full',
  };

  assert.equal(decideTrustAdmission({ ...base, currentHeadSha: '4'.repeat(40) }).reason, 'superseded-head');
  assert.equal(decideTrustAdmission({ ...base, eventName: 'pull_request' }).reason, 'untrusted-workflow-context');
  assert.equal(decideTrustAdmission({ ...base, baseRef: 'dev' }).reason, 'protected-base-required');
  assert.equal(decideTrustAdmission({ ...base, headSha: 'nope' }).reason, 'invalid-head-sha');
});