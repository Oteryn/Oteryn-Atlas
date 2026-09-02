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

const mergeGroupGateUrl = new URL('../../.github/workflows/merge-group-gate.yml', import.meta.url);
const provenanceWorkflow = new URL('../../.github/workflows/extraction-provenance.yml', import.meta.url);
const provenanceMapUrl = new URL('../../docs/migration/legacy-atlas-extraction-provenance.json', import.meta.url);

test('Merge Queue authority is provenance-pinned and emits only atlas-gate', () => {
  assert.equal(fs.existsSync(provenanceWorkflow), false, 'separate provenance gate must remain retired');
  assert.equal(fs.existsSync(mergeGroupGateUrl), true, 'merge-group aggregate gate workflow must exist');

  const workflow = readText(mergeGroupGateUrl);
  const provenanceMap = JSON.parse(readText(provenanceMapUrl));
  const pins = provenanceMap.rows.flatMap((row) => row.target_paths ?? [])
    .filter((target) => target.path === '.github/workflows/merge-group-gate.yml');

  assert.equal(pins.length, 1, 'merge-group gate must have exactly one provenance target pin');
  assert.equal(pins[0].blob, gitBlobSha(workflow), 'merge-group gate provenance pin must match exact workflow bytes');
  assert.match(workflow, /merge_group:\s*\n\s*types:\s*\[checks_requested\]/);
  assert.match(workflow, /name:\s*atlas-gate/);
  assert.match(workflow, /BASE_REF: \$\{\{ github\.event\.merge_group\.base_ref \|\| '' \}\}/);
  assert.match(workflow, /BASE_SHA: \$\{\{ github\.event\.merge_group\.base_sha \|\| '' \}\}/);
  assert.match(workflow, /HEAD_SHA: \$\{\{ github\.event\.merge_group\.head_sha \|\| '' \}\}/);
  assert.match(workflow, /HEAD_SHA.*GITHUB_SHA_VALUE/);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /verify_extraction_provenance\.py/);
  assert.doesNotMatch(workflow, /provenance-gate/);
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
  assert.match(workflow, /ATLAS_E2E_WORKERS=['"]?1['"]?/);
  assert.match(workflow, /ATLAS_E2E_SHARD=['"]?1\/1['"]?/);
  assert.match(workflow, /--retries=0/);
  assert.match(workflow, /compose run --no-deps --rm e2e/);
  assert.doesNotMatch(workflow, /labels:\s*oteryn-atlas-pc|synology|real_fullworld/i);
});
