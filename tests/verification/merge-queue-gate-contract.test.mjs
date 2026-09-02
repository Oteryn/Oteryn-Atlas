import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readText(url) {
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

function block(source, start, end) {
  const begin = source.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  const finish = source.indexOf(end, begin + start.length);
  return source.slice(begin, finish === -1 ? source.length : finish);
}

const ci = readText(new URL('../../.github/workflows/ci.yml', import.meta.url));
const standaloneMergeGroupGate = new URL('../../.github/workflows/merge-group-gate.yml', import.meta.url);
const provenanceWorkflow = new URL('../../.github/workflows/extraction-provenance.yml', import.meta.url);

test('Merge Queue authority stays in the existing aggregate CI workflow', () => {
  assert.equal(fs.existsSync(provenanceWorkflow), false, 'separate provenance gate must remain retired');
  assert.equal(fs.existsSync(standaloneMergeGroupGate), false, 'candidate-defined standalone Merge Queue gate must be retired');
  assert.match(ci, /merge_group:\s*\n\s*types:\s*\[checks_requested\]/);

  const repositoryContract = block(ci, '  repository-contract:\n', '  semantic-proof:\n');
  assert.match(repositoryContract, /github\.event_name/);
  assert.match(repositoryContract, /github\.event\.merge_group\.base_ref/);
  assert.match(repositoryContract, /github\.event\.merge_group\.base_sha/);
  assert.match(repositoryContract, /github\.event\.merge_group\.head_sha/);
  assert.match(repositoryContract, /github\.sha/);
  assert.match(repositoryContract, /refs\/heads\/main/);
  assert.match(repositoryContract, /verify_extraction_provenance\.py/);
});

test('atlas-gate requires protected-base full browser qualification for every merge-group candidate', () => {
  const mergeBrowser = block(ci, '  verification-merge-group-browser:\n', '  atlas-gate:\n');
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));

  assert.match(mergeBrowser, /github\.event_name == 'merge_group'/);
  assert.match(mergeBrowser, /github\.event\.merge_group\.base_sha/);
  assert.match(mergeBrowser, /github\.event\.merge_group\.head_sha/);
  assert.match(mergeBrowser, /path:\s*trusted-base/);
  assert.match(mergeBrowser, /path:\s*candidate/);
  assert.match(mergeBrowser, /qualification-world\.mjs/);
  assert.match(mergeBrowser, /compose\.protected-hosted-executor\.yml/);
  assert.match(mergeBrowser, /compose\.github-hosted\.yml/);
  assert.match(mergeBrowser, /--retries=0/);
  assert.match(mergeBrowser, /--workers=1/);

  assert.match(gate, /- verification-merge-group-browser/);
  assert.match(gate, /MERGE_GROUP_BROWSER:.*needs\.verification-merge-group-browser\.result/);
  assert.match(gate, /GITHUB_EVENT_NAME.*merge_group[\s\S]*MERGE_GROUP_BROWSER[\s\S]*success/);
});
