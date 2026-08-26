import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../../tools/verification/resource-admission.mjs', import.meta.url);
const healthy = Object.freeze({
  cpu: 'ok',
  hostRam: 'ok',
  dockerMemory: 'ok',
  wslMemory: 'ok',
  sharedMemory: 'ok',
  diskReserve: 'ok',
  diskIo: 'ok',
  gpu: 'not-applicable',
});

test('authoritative browser-full admission preserves the measured two-job ceiling', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource-admission module');
  const { decideResourceAdmission } = await import(moduleUrl);
  const first = decideResourceAdmission({
    resourceClass: 'browser-full', authoritative: true,
    requestedSlotCount: 2, requestedSlot: 1,
    hostHealth: healthy, activeLeases: [],
  });
  assert.equal(first.state, 'admitted');
  assert.equal(first.evidenceEligibility, 'authoritative');

  const full = decideResourceAdmission({
    resourceClass: 'browser-full', authoritative: true,
    requestedSlotCount: 2, requestedSlot: 2,
    hostHealth: healthy,
    activeLeases: [
      { resourceClass: 'browser-full', state: 'running' },
      { resourceClass: 'browser-full', state: 'running' },
    ],
  });
  assert.equal(full.state, 'queued');
  assert.equal(full.reason, 'measured-browser-full-capacity-exhausted');
});

test('diagnostic slot three cannot bypass shared authoritative host capacity', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource-admission module');
  const { decideResourceAdmission } = await import(moduleUrl);
  const result = decideResourceAdmission({
    resourceClass: 'browser-full', authoritative: false,
    requestedSlotCount: 3, requestedSlot: 3,
    hostHealth: healthy,
    activeLeases: [
      { resourceClass: 'browser-full', state: 'running' },
      { resourceClass: 'browser-full', state: 'running' },
    ],
  });
  assert.equal(result.state, 'queued');
  assert.equal(result.reason, 'measured-browser-full-capacity-exhausted');
  assert.equal(result.evidenceEligibility, 'diagnostic-only');
});

test('slot three is never eligible to satisfy authoritative evidence', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource-admission module');
  const { decideResourceAdmission } = await import(moduleUrl);
  const result = decideResourceAdmission({
    resourceClass: 'browser-full', authoritative: true,
    requestedSlotCount: 3, requestedSlot: 3,
    hostHealth: healthy, activeLeases: [],
  });
  assert.equal(result.state, 'rejected');
  assert.equal(result.reason, 'unmeasured-authoritative-slot-capacity');
  assert.equal(result.evidenceEligibility, 'ineligible');
});

test('unknown or pressured host signals fail closed rather than inventing capacity', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource-admission module');
  const { decideResourceAdmission } = await import(moduleUrl);
  for (const [signal, value] of [['cpu', 'unknown'], ['diskReserve', 'exhausted'], ['sharedMemory', 'unknown']]) {
    const result = decideResourceAdmission({
      resourceClass: 'browser-full', authoritative: true,
      requestedSlotCount: 2, requestedSlot: 1,
      hostHealth: { ...healthy, [signal]: value }, activeLeases: [],
    });
    assert.equal(result.state, 'blocked');
    assert.equal(result.reason, `host-health-${signal}-${value}`);
  }
});

test('exclusive resource classes queue behind conflicting heavy work and remain unmeasured', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource-admission module');
  const { decideResourceAdmission } = await import(moduleUrl);
  for (const resourceClass of ['performance', 'soak', 'native-gpu']) {
    const queued = decideResourceAdmission({
      resourceClass, authoritative: false,
      hostHealth: { ...healthy, gpu: resourceClass === 'native-gpu' ? 'ok' : 'not-applicable' },
      activeLeases: [{ resourceClass: 'browser-full', state: 'running' }],
    });
    assert.equal(queued.state, 'queued');
    assert.equal(queued.reason, 'exclusive-resource-conflict');

    const empty = decideResourceAdmission({
      resourceClass, authoritative: true,
      hostHealth: { ...healthy, gpu: resourceClass === 'native-gpu' ? 'ok' : 'not-applicable' },
      activeLeases: [],
    });
    assert.equal(empty.state, 'blocked');
    assert.equal(empty.reason, 'resource-policy-unmeasured');
  }
});

test('deployment-live is never admitted as a heavy execution class', async () => {
  assert.equal(fs.existsSync(moduleUrl), true, 'missing resource-admission module');
  const { decideResourceAdmission } = await import(moduleUrl);
  const result = decideResourceAdmission({
    resourceClass: 'deployment-live', authoritative: true,
    hostHealth: healthy, activeLeases: [],
  });
  assert.equal(result.state, 'rejected');
  assert.equal(result.reason, 'deployment-live-not-heavy');
});