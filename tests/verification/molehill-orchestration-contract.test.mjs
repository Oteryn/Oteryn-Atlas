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

test('Molehill is an explicit specialist dispatch rather than an ordinary PR execution path', () => {
  assert.equal(fs.existsSync(workflowPath), true, `${workflowPath} is missing`);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /trust-admission:/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /tools\/verification\/trust-admission\.mjs/);
  assert.match(workflow, /reason_code/);
  assert.match(workflow, /required_capability/);
  assert.match(workflow, /restricted-visual/);
  assert.match(workflow, /group: atlas-runners/);
  assert.match(workflow, /labels: oteryn-atlas-pc/);
  assert.match(workflow, /persist-credentials: false/);
});

test('specialist dispatch re-resolves protected main and exact current PR head before scheduling Molehill', () => {
  assert.match(workflow, /branches\/main/);
  assert.match(workflow, /pulls\/\$PR_NUMBER/);
  assert.match(workflow, /current_head_sha/);
  assert.match(workflow, /superseded-head/);
  assert.match(workflow, /git ls-remote/);
  assert.match(workflow, /policy_sha/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test('capabilities not implemented by Phase D fail closed instead of borrowing the visual lane', () => {
  assert.match(workflow, /unsupported-specialist-capability:/);
  assert.match(workflow, /inputs\.required_capability != 'restricted-visual'/);
  assert.match(workflow, /exit 1/);
  const visual = workflow.slice(workflow.indexOf('  restricted-visual-e2e:\n'));
  assert.match(visual, /inputs\.required_capability == 'restricted-visual'/);
  assert.match(visual, /ATLAS_USER_VISUAL_EVIDENCE: '1'/);
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

test('exclusive host admission physically reserves both measured tokens and legacy slots', () => {
  const selfTest = read('e2e/test-heavy-slot-pool.ps1');
  assert.match(helper, /Acquire-AtlasExclusiveHostAdmission/);
  assert.match(helper, /Release-AtlasExclusiveHostAdmission/);
  assert.match(helper, /Acquire-AtlasHostAdmission[\s\S]*Acquire-AtlasHostAdmission/);
  assert.match(helper, /Acquire-AtlasHeavySlot[\s\S]*RequestedSlot 1[\s\S]*Acquire-AtlasHeavySlot[\s\S]*RequestedSlot 2/);
  assert.match(selfTest, /exclusive host admission/i);
  assert.match(selfTest, /browser admission entered while exclusive host admission was active/i);
  assert.match(selfTest, /exclusive host admission was not reusable/i);
});

test('authoritative evidence cannot opt into the historical unsafe third slot', () => {
  assert.match(run, /ATLAS_E2E_AUTHORITY_MODE/);
  assert.match(run, /authoritative/i);
  assert.match(run, /slotCount[\s\S]*-gt 2|SlotCount[\s\S]*-gt 2/);
  assert.match(run, /requestedSlot[\s\S]*-gt 2|RequestedSlot[\s\S]*-gt 2/);
  assert.match(run, /diagnostic-only/);
});

test('existing scheduled specialist depth participates in the same Molehill host admission', () => {
  const browserDepth = nightly.slice(nightly.indexOf('  browser-depth:\n'));
  assert.match(browserDepth, /heavy-slot-pool\.ps1/);
  assert.match(browserDepth, /Acquire-AtlasHostAdmission/);
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

test('specialist visual plan census captures Playwright list without PowerShell transcoding', () => {
  const planStep = workflow.slice(workflow.indexOf('      - name: Build exact trusted-main lower-bound plan'));
  assert.match(planStep, /cmd\.exe \/d \/s \/c/);
  assert.match(planStep, /playwright-test-list\.txt/);
  assert.doesNotMatch(planStep, /playwright[^\n]*--list\s*\|\s*\n?\s*Set-Content/);
  assert.match(planStep, /\.\.\/trusted-base\/tools\/verification\/parse-playwright-test-list\.mjs/);
});

test('restricted full-frame evidence remains local while GitHub artifacts stay metadata-only', () => {
  assert.match(workflow, /ATLAS_TRUSTED_EVIDENCE_ROOT/);
  assert.match(workflow, /ATLAS_E2E_ARTIFACTS_HOST\s*=\s*Join-Path/);
  assert.match(workflow, /Copy-Item[\s\S]*pr-verification-plan\.json/);
  const uploadStep = workflow.slice(workflow.indexOf('      - name: Publish bounded specialist metadata only'));
  assert.ok(uploadStep.length > 0, 'bounded specialist metadata upload step is missing');
  assert.match(uploadStep, /summary\.json/);
  assert.match(uploadStep, /resource-admission\.json/);
  assert.match(uploadStep, /slot-lease\.json/);
  assert.match(uploadStep, /pr-verification-plan\.json/);
  assert.match(uploadStep, /run-metadata\.json/);
  assert.doesNotMatch(uploadStep, /user-visual-evidence|\.png|\.webm|trace\.zip/i);
});

test('Phase D specialist workflow does not publish routine atlas-local-e2e authority', () => {
  assert.doesNotMatch(workflow, /statuses:\s*write/);
  assert.doesNotMatch(workflow, /publish-local-e2e-status\.ps1/);
  assert.doesNotMatch(workflow, /atlas-local-e2e/);
});
