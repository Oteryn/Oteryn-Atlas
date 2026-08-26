import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../../tools/verification/validate-resource-admission.mjs', import.meta.url);

function evidence(overrides = {}) {
  return {
    version: 1,
    policyId: 'molehill-bootstrap-safe-v1',
    resourceClass: 'browser-full',
    authorityMode: 'authoritative',
    evidenceEligibility: 'authoritative',
    hostAdmissionToken: 1,
    hostCapacity: 2,
    slotId: 1,
    slotCount: 2,
    project: 'atlas-test',
    revision: 'a'.repeat(40),
    verificationPlanSha256: `sha256:${'b'.repeat(64)}`,
    ...overrides,
  };
}

test('publisher resource evidence accepts only exact authoritative measured admission', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource evidence validator');
  const { validateResourceAdmissionEvidence } = await import(moduleUrl);
  const result = validateResourceAdmissionEvidence({
    evidence: evidence(),
    headSha: 'a'.repeat(40),
    verificationPlanSha256: `sha256:${'b'.repeat(64)}`,
  });
  assert.deepEqual(result, {
    policyId: 'molehill-bootstrap-safe-v1',
    resourceClass: 'browser-full',
    hostCapacity: 2,
    slotId: 1,
  });
});
test('diagnostic, stale, copied or unmeasured resource evidence is rejected', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource evidence validator');
  const { validateResourceAdmissionEvidence } = await import(moduleUrl);
  const input = (overrides = {}) => ({
    evidence: evidence(overrides),
    headSha: 'a'.repeat(40),
    verificationPlanSha256: `sha256:${'b'.repeat(64)}`,
  });

  assert.throws(() => validateResourceAdmissionEvidence(input({ authorityMode: 'diagnostic', evidenceEligibility: 'diagnostic-only' })), /authoritative/);
  assert.throws(() => validateResourceAdmissionEvidence(input({ revision: 'c'.repeat(40) })), /revision/);
  assert.throws(() => validateResourceAdmissionEvidence(input({ verificationPlanSha256: `sha256:${'d'.repeat(64)}` })), /plan/);
  assert.throws(() => validateResourceAdmissionEvidence(input({ hostCapacity: 3, slotCount: 3, slotId: 3 })), /capacity/);
  assert.throws(() => validateResourceAdmissionEvidence(input({ slotId: 3 })), /slot/);
  assert.throws(() => validateResourceAdmissionEvidence(input({ policyId: 'invented' })), /policy/);
});

test('status publisher invokes resource evidence validation from the summary artifact root', () => {
  const source = fs.readFileSync(new URL('../../e2e/publish-local-e2e-status.ps1', import.meta.url), 'utf8');
  assert.match(source, /resource-admission\.json/);
  assert.match(source, /validate-resource-admission\.mjs/);
  assert.match(source, /ATLAS resource admission evidence validation failed/);
});
