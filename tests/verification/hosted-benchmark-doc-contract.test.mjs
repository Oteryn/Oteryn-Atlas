import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const experimentsUrl = new URL('../../tools/verification/hosted-benchmark-experiments.json', import.meta.url);
const guideUrl = new URL('../../docs/testing/ATLAS-PHASE-E-HOSTED-BENCHMARK-HARNESS.md', import.meta.url);
const implementationPlanUrl = new URL('../../docs/superpowers/plans/2026-08-27-phase-e-hosted-benchmark-harness.md', import.meta.url);

function readJson(url) {
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}

function readText(url) {
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

test('Phase E docs match the versioned worker ladder and isolated multi-job candidates', () => {
  const experiments = readJson(experimentsUrl);
  const docs = [
    ['operator guide', readText(guideUrl)],
    ['implementation plan', readText(implementationPlanUrl)],
  ];

  const packedWorkers = experiments.executionShapeCandidates
    .filter((candidate) => candidate.shards === 1)
    .map((candidate) => candidate.workers);
  assert.deepEqual(packedWorkers, [1, 2, 4, 6, 8]);

  for (const [name, text] of docs) {
    for (const workers of packedWorkers) {
      assert.match(text, new RegExp(`workers=${workers}(?:\\D|$)`), `${name} must document workers=${workers}`);
    }
    assert.match(text, /workers=1\/2\/4\/6\/8/,
      `${name} must state the complete packed worker measurement ladder`);
    assert.doesNotMatch(text, /(?:no|forbid(?:s|den)?|without)\s+(?:a\s+)?(?:universal\s+)?(?:workers?\s*)?1\/2\/4\/6\/8|no 6\/8 worker/i,
      `${name} must not contradict the versioned 6/8 worker candidates`);
  }

  const multiJobCandidates = experiments.executionShapeCandidates.filter((candidate) => candidate.shards > 1);
  assert.deepEqual(multiJobCandidates.map((candidate) => candidate.id), ['shards2-w1', 'shards4-w1']);
  for (const [name, text] of docs) {
    for (const candidate of multiJobCandidates) {
      assert.match(text, new RegExp(`${candidate.shards} shards`),
        `${name} must document ${candidate.id}`);
    }
  }
});
