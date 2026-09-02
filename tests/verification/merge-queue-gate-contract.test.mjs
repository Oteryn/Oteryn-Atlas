import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

function readText(url) {
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

function gitBlobSha(text) {
  const bytes = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

const mergeAuthorityAuditUrl = new URL('../../.github/workflows/merge-authority-audit.yml', import.meta.url);
const mergeGroupGateUrl = new URL('../../.github/workflows/merge-group-gate.yml', import.meta.url);
const prCiUrl = new URL('../../.github/workflows/ci.yml', import.meta.url);
const provenanceMapUrl = new URL('../../docs/migration/legacy-atlas-extraction-provenance.json', import.meta.url);
const provenanceWorkflow = new URL('../../.github/workflows/extraction-provenance.yml', import.meta.url);
const provenanceVerifierUrl = new URL('../../tools/governance/verify_extraction_provenance.py', import.meta.url);
const provenanceTestUrl = new URL('../../tools/governance/test_verify_extraction_provenance.py', import.meta.url);

test('Merge Queue authority is exact-blob pinned and emits only atlas-gate', () => {
  assert.equal(fs.existsSync(provenanceWorkflow), false, 'separate provenance gate must remain retired');
  assert.equal(fs.existsSync(mergeGroupGateUrl), true, 'merge-group aggregate gate workflow must exist');

  const workflow = readText(mergeGroupGateUrl);
  const verifier = readText(provenanceVerifierUrl);
  const blob = gitBlobSha(workflow);

  assert.match(verifier, /MERGE_GROUP_GATE_PATH\s*=\s*["']\.github\/workflows\/merge-group-gate\.yml["']/);
  assert.match(verifier, new RegExp(`MERGE_GROUP_GATE_BLOB\\s*=\\s*["']${blob}["']`));
  assert.match(verifier, /verify_control_plane_pin\(MERGE_GROUP_GATE_PATH, MERGE_GROUP_GATE_BLOB\)/);
  assert.match(workflow, /merge_group:\s*\n\s*types:\s*\[checks_requested\]/);
  assert.match(workflow, /name:\s*atlas-gate/);
  assert.match(workflow, /BASE_REF: \$\{\{ github\.event\.merge_group\.base_ref \|\| '' \}\}/);
  assert.match(workflow, /BASE_SHA: \$\{\{ github\.event\.merge_group\.base_sha \|\| '' \}\}/);
  assert.match(workflow, /HEAD_SHA: \$\{\{ github\.event\.merge_group\.head_sha \|\| '' \}\}/);
  assert.match(workflow, /HEAD_SHA.*GITHUB_SHA_VALUE/);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /verify_extraction_provenance\.py/);
  assert.match(workflow, /test_verify_extraction_provenance\.py/);
  assert.doesNotMatch(workflow, /provenance-gate/);
});

test('protected-base audit owns Atlas merge-authority pins outside candidate checkout', () => {
  assert.equal(fs.existsSync(mergeAuthorityAuditUrl), true, 'protected-base merge-authority audit must exist');

  const audit = readText(mergeAuthorityAuditUrl);
  const expectedPins = [
    ['EXPECTED_PR_CI_BLOB', gitBlobSha(readText(prCiUrl))],
    ['EXPECTED_MERGE_GROUP_GATE_BLOB', gitBlobSha(readText(mergeGroupGateUrl))],
    ['EXPECTED_PROVENANCE_VERIFIER_BLOB', gitBlobSha(readText(provenanceVerifierUrl))],
    ['EXPECTED_PROVENANCE_TEST_BLOB', gitBlobSha(readText(provenanceTestUrl))],
    ['EXPECTED_PROVENANCE_MAP_BLOB', gitBlobSha(readText(provenanceMapUrl))],
  ];

  assert.match(audit, /pull_request_target:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(audit, /permissions:\s*\{\}/);
  assert.match(audit, /contents:\s*read/);
  assert.match(audit, /pull-requests:\s*read/);
  assert.doesNotMatch(audit, /^\s*uses:\s*actions\/checkout@/m);
  for (const [name, blob] of expectedPins) {
    assert.match(audit, new RegExp(`${name}:\\s*["']${blob}["']`));
  }
  assert.match(audit, /candidate modifies the protected-base audit itself/);
  assert.match(audit, /read_candidate_text/);
  assert.match(audit, /actual_blob != expected_blob/);
  assert.match(audit, /expected_atlas_gate_paths/);
  assert.match(audit, /\.github\/workflows\/ci\.yml/);
  assert.match(audit, /\.github\/workflows\/merge-group-gate\.yml/);
  assert.match(audit, /tools\/governance\/test_verify_extraction_provenance\.py/);
  assert.match(audit, /provenance_gate_paths/);
  assert.doesNotMatch(audit, /^\s*(?:contents|pull-requests|actions|checks|statuses|id-token):\s*write\s*$/m);
});

test('atlas-gate fully browser-qualifies the exact synthetic candidate with protected-base harness', () => {
  const workflow = readText(mergeGroupGateUrl);

  assert.match(workflow, /name: Check out exact protected merge-group base/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.merge_group\.base_sha \}\}/);
  assert.match(workflow, /path:\s*trusted-base/);
  assert.match(workflow, /buildQualificationWorld/);
  assert.match(workflow, /qualificationTrustDescriptor/);
  assert.match(workflow, /trusted-base\/tools\/verification\/verification-catalog\.json/);
  assert.match(workflow, /e2e\.full/);
  assert.match(workflow, /trusted-base\/e2e\/compose\.protected-hosted-executor\.yml/);
  assert.match(workflow, /trusted-base\/e2e\/compose\.github-hosted\.yml/);
  assert.match(workflow, /ATLAS_EXECUTION_CONTEXT/);
  assert.match(workflow, /ATLAS_PROTECTED_TEST_LIST/);
  assert.match(workflow, /ATLAS_CODE_REVISION/);
  assert.match(workflow, /ATLAS_E2E_WORKERS:\s*['"]1['"]/);
  assert.match(workflow, /ATLAS_E2E_SHARD:\s*['"]1\/1['"]/);
  assert.match(workflow, /--retries=0/);
  assert.match(workflow, /compose run --no-deps --rm e2e/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /runs-on:\s*\[[^\]]*(?:oteryn-atlas-pc|synology)[^\]]*\]/i);
  assert.doesNotMatch(workflow, /dataCapability:\s*real_fullworld|ATLAS_DATA_CAPABILITY:\s*real_fullworld/i);
});
