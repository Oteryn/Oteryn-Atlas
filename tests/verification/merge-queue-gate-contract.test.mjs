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
const provenanceWorkflow = new URL('../../.github/workflows/extraction-provenance.yml', import.meta.url);
const provenanceVerifierUrl = new URL('../../tools/governance/verify_extraction_provenance.py', import.meta.url);

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
  assert.match(workflow, /refs\/heads\/\*/);
  assert.match(workflow, /verify_extraction_provenance\.py/);
  const executor = readText(new URL('../../tools/verification/run-protected-merge-group.mjs', import.meta.url));
  assert.match(executor, /validateProtectedExecutionCandidate[\s\S]*python3/);
  assert.doesNotMatch(workflow, /provenance-gate/);
});

test('protected-base audit validates inert candidate against immutable authority and exact workflow renderer', () => {
  const audit = readText(mergeAuthorityAuditUrl);
  const runner = readText(new URL('../../tools/verification/run-protected-authority-audit.mjs', import.meta.url));
  const policy = readText(new URL('../../tools/verification/protected-admission-policy.mjs', import.meta.url));
  assert.match(audit, /pull_request_target:/);
  assert.match(audit, /merge_group:\n\s+types: \[checks_requested\]/);
  assert.match(audit, /github\.event\.merge_group\.head_sha == github\.sha/);
  assert.match(runner, /gitChangedFiles\(candidateRoot,options\.baseSha,options\.headSha\)/);
  assert.match(runner, /prNumber:queue\?null:Number/);
  assert.match(audit, /github\.event\.pull_request\.base\.ref == github\.event\.repository\.default_branch/);
  assert.match(audit, /permissions: \{\}/);
  assert.match(audit, /contents: read/);
  assert.match(audit, /pull-requests: read/);
  assert.match(audit, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.merge_group\.base_sha \}\}[\s\S]*path: trusted-base/);
  assert.match(audit, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.event\.merge_group\.head_sha \}\}[\s\S]*path: candidate/);
  assert.equal((audit.match(/persist-credentials: false/g) ?? []).length, 2);
  assert.match(audit, /node trusted-base\/tools\/verification\/run-protected-authority-audit\.mjs "\$PWD\/trusted-base" "\$PWD\/candidate"/);
  assert.doesNotMatch(audit, /node candidate\/|python candidate\/|(?:contents|pull-requests|actions|checks|statuses|id-token):\s*write/);
  assert.match(runner, /validateProtectedExecutionCandidate\(\{protectedRoot,candidateRoot,currentCandidate:candidate\}\)/);
  assert.match(runner, /assertSameCandidate\(candidate,await snapshot\(\)\)/);
  assert.match(policy, /validateProtectedWorkflowTransition\(\{protectedSources:workflowSources\(protectedRoot\),candidateSources:workflowSources\(candidateRoot\)/);
  assert.match(policy, /immutable execution authority/);
  assert.match(policy, /stat\.isSymbolicLink\(\)/);
  assert.match(policy, /100644 blob/);
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

test('Merge Queue uses the same exact evidence consumer as PR with no historical bootstrap exception', () => {
  const workflow = readText(mergeGroupGateUrl);
  const prCi = readText(prCiUrl);
  const gate = workflow.slice(workflow.indexOf('  atlas-gate:'));
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*read\s*\n\s*pull-requests:\s*read/);
  assert.match(gate, /node trusted-base\/tools\/verification\/consume-protected-admission\.mjs/);
  assert.match(prCi, /node admission-authority\/tools\/verification\/consume-protected-admission\.mjs/);
  assert.match(gate, /ATLAS_CODE_REVISION: \$\{\{ github\.event\.merge_group\.head_sha \}\}/);
  assert.match(gate, /ATLAS_PROTECTED_BASE_SHA: \$\{\{ github\.event\.merge_group\.base_sha \}\}/);
  assert.match(gate, /if: steps\.generic-admission\.outputs\.admission_accepted != 'true'/);
  assert.doesNotMatch(gate, /ATLAS_LEGACY_CUTOVER|legacy-bootstrap|validateLegacyTransition|use_legacy_proof|atlas-local-e2e|pr-303|one-shot PR/);
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
  const executor = readText(new URL('../../tools/verification/run-protected-merge-group.mjs', import.meta.url));
  const producer = readText(new URL('../../tools/verification/run-protected-admission.mjs', import.meta.url));
  assert.match(workflow, /node trusted-base\/tools\/verification\/run-protected-merge-group\.mjs/);
  assert.match(executor, /GITHUB_EVENT_NAME!=='merge_group'/);
  assert.match(executor, /readCandidateSnapshot/);
  assert.match(executor, /validateProtectedExecutionCandidate/);
  assert.match(executor, /executeProtectedCandidateProof\(\{protectedRoot,candidateRoot,outputRoot,candidate,admission\}\)/);
  assert.match(executor, /assertSameCandidate\(candidate,await readCandidateSnapshot/);
  assert.match(producer, /evaluateProtectedRouting/);
  assert.match(producer, /runtime browser list differs from protected stable census/);
  assert.match(producer, /validateBrowserSummary/);
  assert.match(producer, /--workers=1 --retries=0/);
  assert.match(producer, /protected execution lower bounds invalid/);
  assert.match(producer, /hostedPartitions/);
  assert.match(producer, /'qualification_fixture','bounded_real_world'/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /runs-on:\s*\[[^\]]*(?:oteryn-atlas-pc|synology)[^\]]*\]/i);
  assert.doesNotMatch(workflow, /dataCapability:\s*real_fullworld|ATLAS_DATA_CAPABILITY:\s*real_fullworld/i);
});
