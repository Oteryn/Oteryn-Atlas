import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : '';
}

const workflowPath = '.github/workflows/molehill-pr-e2e.yml';
const workflow = read(workflowPath);
const helper = read('e2e/heavy-slot-pool.ps1');
const run = read('e2e/run.ps1');
const nightly = read('.github/workflows/verification-depth.yml');

test('routine PR heavy execution is base-owned and trust-gated before Molehill', () => {
  assert.equal(fs.existsSync(workflowPath), true, `${workflowPath} is missing`);
  assert.match(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /trust-admission:/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /tools\/verification\/trust-admission\.mjs/);
  assert.match(workflow, /github\.event\.pull_request\.base\.sha/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/);
  assert.match(workflow, /needs\.trust-admission\.outputs\.admitted == 'true'/);
  assert.match(workflow, /group: atlas-runners/);
  assert.match(workflow, /labels: oteryn-atlas-pc/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /pull_request_target[\s\S]*secrets\.[A-Z0-9_]+[\s\S]*Run exact-head Molehill E2E/i);
});

test('superseded heads are cancelled per PR and rechecked before candidate execution', () => {
  assert.match(workflow, /group: atlas-molehill-pr-\$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /current_head_sha/);
  assert.match(workflow, /superseded-head/);
  assert.match(workflow, /git ls-remote/);
});

test('machine-wide host admission is independent from diagnostic slot numbering', () => {
  assert.match(helper, /Acquire-AtlasHostAdmission/);
  assert.match(helper, /oteryn-atlas-host-admission-/);
  assert.match(helper, /HostCapacity.*2|Capacity.*2/s);
  assert.match(run, /Acquire-AtlasHostAdmission/);
  assert.match(run, /Acquire-AtlasHostAdmission[\s\S]*Acquire-AtlasHeavySlot/);
  assert.match(run, /resource-admission\.json/);
  assert.match(run, /evidenceEligibility/);
  assert.match(run, /Release-AtlasHostAdmission \$hostAdmissionLease/);
});

test('authoritative evidence cannot opt into the historical unsafe third slot', () => {
  assert.match(run, /ATLAS_E2E_AUTHORITY_MODE/);
  assert.match(run, /authoritative/i);
  assert.match(run, /slotCount[\s\S]*-gt 2|SlotCount[\s\S]*-gt 2/);
  assert.match(run, /requestedSlot[\s\S]*-gt 2|RequestedSlot[\s\S]*-gt 2/);
  assert.match(run, /diagnostic-only/);
});

test('nightly browser depth participates in the same Molehill host admission', () => {
  const browserDepth = nightly.slice(nightly.indexOf('  browser-depth:\n'));
  assert.match(browserDepth, /heavy-slot-pool\.ps1/);
  assert.match(browserDepth, /Acquire-AtlasHostAdmission/);
  assert.match(browserDepth, /browser-full/);
  assert.match(browserDepth, /Release-AtlasHostAdmission \$hostAdmission/);
});


test('host-admission self-test proves exhaustion and reuse independently of slot ids', () => {
  const selfTest = read('e2e/test-heavy-slot-pool.ps1');
  assert.match(selfTest, /Acquire-AtlasHostAdmission/);
  assert.match(selfTest, /host-selftest-/);
  assert.match(selfTest, /third host admission/i);
  assert.match(selfTest, /released host admission/i);
});


test('new host admission fences historical diagnostic slot three during migration', () => {
  const selfTest = read('e2e/test-heavy-slot-pool.ps1');
  assert.match(helper, /DiagnosticSlotFencePath/);
  assert.match(helper, /oteryn-atlas-heavy-e2e-slot-3\.lock/);
  assert.match(helper, /FileShare\]::ReadWrite/);
  assert.match(helper, /Release-AtlasHostAdmission/);
  assert.match(selfTest, /diagnostic-slot3-migration-fence/);
  assert.match(selfTest, /legacy diagnostic slot three entered/i);
  assert.match(selfTest, /host admission entered while legacy diagnostic slot three was active/i);
  assert.match(run, /Release-AtlasHostAdmission/);
});
