import assert from 'node:assert/strict';
import test from 'node:test';
import * as policy from '../../tools/verification/qualification-repair-policy.mjs';
import { stableTestId } from '../../tools/verification/stable-id.mjs';

function proof() {
  const candidateHeadSha = 'a'.repeat(40);
  const scenarios = Array.from({ length: 68 }, (_, i) => ({
    project: 'desktop', specPath: 'e2e/tests/repair.spec.mjs', scenario: `scenario ${i}`,
    stableTestId: stableTestId('desktop', 'e2e/tests/repair.spec.mjs', `scenario ${i}`),
    status: 'passed', retry: 0,
  }));
  return {
    candidateHeadSha,
    protectedTestList: scenarios.map((s, i) => `[desktop] › repair.spec.mjs:${i + 1}:1 › ${s.scenario}`).join('\n'),
    summary: { status: 'passed', metadata: { expectedRevision: candidateHeadSha, workers: 1 }, scenarios },
  };
}

test('repair evidence requires the complete exact-head protected 68/68 census', () => {
  assert.equal(typeof policy.validateQualificationRepairCensus, 'function');
  assert.deepEqual(policy.validateQualificationRepairCensus(proof()), { passed: 68, skipped: 0, retried: 0 });
});

for (const [name, mutate] of Object.entries({
  missing: (p) => p.summary.scenarios.pop(),
  duplicate: (p) => { p.summary.scenarios[1] = p.summary.scenarios[0]; },
  skipped: (p) => { p.summary.scenarios[0].status = 'skipped'; },
  retried: (p) => { p.summary.scenarios[0].retry = 1; },
  unexpected: (p) => { p.summary.scenarios[0].stableTestId += 'other'; },
  revision: (p) => { p.summary.metadata.expectedRevision = 'b'.repeat(40); },
  workers: (p) => { p.summary.metadata.workers = 2; },
  status: (p) => { p.summary.status = 'failed'; },
  malformedList: (p) => { p.protectedTestList += '\nnot a protected test'; },
  duplicateList: (p) => { p.protectedTestList += `\n${p.protectedTestList.split('\n')[0]}`; },
})) {
  test(`repair census rejects ${name}`, () => {
    assert.equal(typeof policy.validateQualificationRepairCensus, 'function');
    const input = proof();
    mutate(input);
    assert.throws(() => policy.validateQualificationRepairCensus(input), /qualification repair census/);
  });
}
