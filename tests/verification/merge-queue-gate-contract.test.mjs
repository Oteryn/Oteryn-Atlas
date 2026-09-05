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
  assert.match(audit, /governance_prefix\s*=\s*['"]tools\/governance\//);
  assert.match(audit, /path\.startsWith\(governance_prefix\)|path\.startswith\(governance_prefix\)/);
  assert.match(audit, /unpinned_governance/);
  assert.match(audit, /unpinned Python import authority/);
  assert.match(audit, /\/git\/commits\/\{expected_head\}/);
  assert.match(audit, /candidate_tree_sha/);
  assert.match(audit, /\/git\/trees\/\{candidate_tree_sha\}\?recursive=1/);
  assert.match(audit, /candidate tree enumeration is truncated/);
  assert.match(audit, /entry\.get\('type'\) != 'blob'/);
  assert.match(audit, /entry\.get\('mode'\) != '100644'/);
  assert.match(audit, /regular non-symlink blob/);
  assert.match(audit, /pinned control-plane tree entry drift/);
  assert.doesNotMatch(audit, /^\s*(?:contents|pull-requests|actions|checks|statuses|id-token):\s*write\s*$/m);
});

test('candidate executable checks cannot mutate the atlas-gate runner state', () => {
  const workflow = readText(mergeGroupGateUrl);
  assert.match(workflow, /ATLAS_CANDIDATE_IMAGE:\s*mcr\.microsoft\.com\/playwright:v1\.62\.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07/);
  assert.match(workflow, /candidate-checks:\s*\n\s*name:\s*merge-group-candidate-checks/);
  assert.match(workflow, /name:\s*Run candidate executable contracts in networkless sandbox/);
  assert.match(workflow, /docker run --rm/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop ALL/);
  assert.match(workflow, /--security-opt no-new-privileges/);
  assert.match(workflow, /dst=\/candidate,readonly/);
  assert.match(workflow, /atlas-gate:\s*\n\s*name:\s*atlas-gate\s*\n\s*needs:\s*candidate-checks/);
  assert.match(workflow, /needs:\s*candidate-checks\s*\n\s*if:\s*\$\{\{\s*always\(\)\s*\}\}/);
  assert.match(workflow, /name:\s*Require isolated candidate checks to pass/);
  assert.match(workflow, /CANDIDATE_CHECKS_RESULT:\s*\$\{\{\s*needs\.candidate-checks\.result\s*\}\}/);
  assert.match(workflow, /\[\[\s*"\$CANDIDATE_CHECKS_RESULT"\s*==\s*success\s*\]\]/);

  const gate = workflow.slice(workflow.indexOf('  atlas-gate:'));
  assert.doesNotMatch(gate, /tools\/dyn-atlas-semantic\/self_test\.py/);
  assert.doesNotMatch(gate, /tests\/deployment-policy\.mjs/);
  assert.doesNotMatch(gate, /tests\/browser-semantic\.mjs/);
  assert.doesNotMatch(gate, /tests\/verification\/\*\.test\.mjs/);
});

test('one-shot PR 303 merge-group bootstrap consumes exact protected heavy proof and cannot widen to other queues', () => {
  const workflow = readText(mergeGroupGateUrl);
  const gate = workflow.slice(workflow.indexOf('  atlas-gate:'));

  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*read\s*\n\s*pull-requests:\s*read/);
  assert.match(gate, /name:\s*Validate one-shot PR 303 merge-group bootstrap proof/);
  assert.match(gate, /ATLAS_LEGACY_CUTOVER_BASE_SHA:\s*e31015d0880e9f81a4b96f990658490af45e8fa6/);
  assert.match(gate, /ATLAS_LEGACY_CUTOVER_PR_NUMBER:\s*['"]303['"]/);
  assert.match(gate, /ATLAS_LEGACY_CUTOVER_HEAD_REF:\s*feat\/issue-179-legacy-transition-qualifier/);
  assert.match(gate, /refs\/heads\/gh-readonly-queue\/main\/pr-\$ATLAS_LEGACY_CUTOVER_PR_NUMBER-\$ATLAS_LEGACY_CUTOVER_BASE_SHA/);
  assert.match(gate, /validateLegacyTransitionMergeGroupBootstrapGate/);
  assert.match(gate, /legacy-molehill-transition-qualification\.yml/);
  assert.match(gate, /git\/commits\/\$ATLAS_CODE_REVISION/);
  assert.match(gate, /git\/commits\/\$candidate_head_sha/);
  assert.match(gate, /branches\/main/);
  assert.match(gate, /use_legacy_proof=true/);
  assert.match(gate, /producer_run_id=/);
  assert.match(gate, /Prove complete protected-base browser qualification for synthetic candidate[\s\S]*if:\s*\$\{\{\s*steps\.legacy-bootstrap\.outputs\.use_legacy_proof != 'true' && steps\.generic-admission\.outputs\.admission_accepted != 'true'\s*\}\}/);
  assert.doesNotMatch(gate, /atlas-local-e2e/);
});

test('atlas-gate fully browser-qualifies the exact synthetic candidate with protected-base harness', () => {
  const workflow = readText(mergeGroupGateUrl);

  const prCi = readText(prCiUrl);
  const canonicalMaxAbsAssertion = `test "$(grep -c '"maxAbs": 0' /tmp/browser-proof.html)" -eq 5`;
  assert.ok(prCi.includes(canonicalMaxAbsAssertion), 'PR CI must retain the canonical Chrome parity assertion');
  assert.ok(workflow.includes(canonicalMaxAbsAssertion), 'Merge Queue Chrome parity assertion must match proven PR CI quoting');

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
