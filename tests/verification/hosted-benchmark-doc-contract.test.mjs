import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const experimentsUrl = new URL('../../tools/verification/hosted-benchmark-experiments.json', import.meta.url);
const guideUrl = new URL('../../docs/testing/ATLAS-PHASE-E-HOSTED-BENCHMARK-HARNESS.md', import.meta.url);

function readJson(url) {
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}

test('Phase E operator guide matches the versioned worker ladder and isolated multi-job candidates', () => {
  const experiments = readJson(experimentsUrl);
  const guide = fs.readFileSync(guideUrl, 'utf8').replace(/\r\n/g, '\n');

  const packedWorkers = experiments.executionShapeCandidates
    .filter((candidate) => candidate.shards === 1)
    .map((candidate) => candidate.workers);
  assert.deepEqual(packedWorkers, [1, 2, 4, 6, 8]);

  for (const workers of packedWorkers) {
    assert.match(guide, new RegExp(`workers=${workers}(?:\\D|$)`), `guide must document workers=${workers}`);
  }
  assert.match(guide, /workers=1\/2\/4\/6\/8/,
    'guide must state the complete packed worker measurement ladder');
  assert.doesNotMatch(guide, /there is no 6\/8 worker ladder/i,
    'guide must not contradict the versioned 6/8 worker candidates');

  const multiJobCandidates = experiments.executionShapeCandidates.filter((candidate) => candidate.shards > 1);
  assert.deepEqual(multiJobCandidates.map((candidate) => candidate.id), ['shards2-w1', 'shards4-w1']);
  for (const candidate of multiJobCandidates) {
    assert.match(guide, new RegExp(`${candidate.shards} shards`),
      `guide must document ${candidate.id}`);
  }
});
