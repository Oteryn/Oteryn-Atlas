import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github/workflows/merge-group-gate.yml'), 'utf8');

function stepBody(name) {
  const marker = `      - name: ${name}\n`;
  const start = WORKFLOW.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = WORKFLOW.indexOf('\n      - name: ', start + marker.length);
  return WORKFLOW.slice(start, next === -1 ? WORKFLOW.length : next);
}

test('one-shot bootstrap does not import future policy exports from protected main', () => {
  const bootstrap = stepBody('Validate exact protected qualification repair bootstrap evidence');
  const oneShot = bootstrap.slice(0, bootstrap.indexOf('gh api "repos/$GITHUB_REPOSITORY/commits/$candidate_head_sha/status"'));
  assert.doesNotMatch(oneShot, /validateQualificationRepairControlPlaneBootstrap/);
  assert.match(oneShot, /exactControlPlanePaths/);
  for (const blob of [
    '2f4ef822b34b1699af70e8142365ee5fc1afdc84',
    '8abcf380d6746b9aa095ec5a792638f2ce1b6314',
    '3f9565eaf26577cf36b30475fea61f9fcce66535',
    '4c49d2ed861d4928bf869aeb35f43215c31a42d4',
  ]) assert.match(oneShot, new RegExp(blob));
  assert.match(oneShot, /protected bootstrap authority advanced/);
});

test('one-shot bootstrap is bound to pre-328 protected authority bytes and retires after any byte advance', () => {
  const bootstrap = stepBody('Validate exact protected qualification repair bootstrap evidence');
  const oneShot = bootstrap.slice(0, bootstrap.indexOf('gh api "repos/$GITHUB_REPOSITORY/commits/$candidate_head_sha/status"'));
  const expected = new Map([
    ['.github/workflows/merge-group-gate.yml', '2f4ef822b34b1699af70e8142365ee5fc1afdc84'],
    ['tools/governance/verify_extraction_provenance.py', '8abcf380d6746b9aa095ec5a792638f2ce1b6314'],
    ['.github/workflows/merge-authority-audit.yml', '3f9565eaf26577cf36b30475fea61f9fcce66535'],
    ['tools/verification/qualification-repair-policy.mjs', '4c49d2ed861d4928bf869aeb35f43215c31a42d4'],
  ]);
  for (const [relative, sha] of expected) {
    const literal = `'${relative}': '${sha}'`;
    assert.ok(oneShot.includes(literal), `${relative} pre-328 authority pin must be exact`);
  }
  const start = oneShot.indexOf('const read = ');
  const end = oneShot.indexOf('const exactOne = ', start);
  assert.ok(start >= 0 && end > start, 'protected authority validation must be executable');
  const authorityCheck = oneShot.slice(start, end);
  // Exercise the actual workflow hash/loop with controlled file I/O. The
  // expected Git blob was independently computed for "protected authority\n".
  const fixtureText = 'protected authority\n';
  const fixtureBlob = '77e48505023c9e47f0b2b9142b5b355d7875cda0';
  const verify = (changedPath = null) => {
    const reads = [];
    vm.runInNewContext(authorityCheck, {
      crypto, Buffer,
      protectedAuthorityBlobs: Object.fromEntries([...expected.keys()].map((relative) => [relative, fixtureBlob])),
      fs: { readFileSync(file, encoding) {
        assert.equal(encoding, 'utf8');
        assert.ok([...expected.keys()].some((relative) => file === `trusted-base/${relative}`));
        reads.push(file);
        return file === `trusted-base/${changedPath}` ? `${fixtureText}!` : fixtureText;
      } },
    }, { timeout: 1000 });
    assert.deepEqual(reads, [...expected.keys()].map((relative) => `trusted-base/${relative}`));
  };
  assert.doesNotThrow(() => verify());
  for (const relative of expected.keys()) {
    assert.throws(() => verify(relative), (error) =>
      error.name === 'TypeError' && error.message === `protected bootstrap authority advanced: ${relative}`);
  }
  assert.match(oneShot, /throw new TypeError\(`protected bootstrap authority advanced: \$\{relative\}`\)/);
});

test('merge queue consumes exact protected qualification repair evidence before stale-base full fixture proof', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  const full = stepBody('Prove complete protected-base browser qualification for synthetic candidate');

  assert.match(repair, /validateProtectedProductQualificationGate/);
  assert.match(repair, /validateQualificationRepairTransition/);
  assert.match(repair, /pulls\/\$ATLAS_PR_NUMBER/);
  assert.match(repair, /git\/commits\/\$ATLAS_CODE_REVISION/);
  assert.match(repair, /git\/commits\/\$candidate_head_sha/);
  assert.match(repair, /candidateTreeSha|candidate_tree_sha/);
  assert.match(repair, /syntheticTreeSha|synthetic_tree_sha/);
  assert.match(repair, /use_repair_proof=true/);
  assert.match(repair, /refs\/heads\/gh-readonly-queue\/main\/pr-\(\[1-9\]\[0-9\]\*\\d*\)|gh-readonly-queue\/main\/pr-/);
  assert.match(repair, /current_main_sha/);
  assert.match(repair, /producerJobs/);
  assert.match(repair, /producerRun:\s*read\('run\.json'\)/);
  assert.doesNotMatch(repair, /fix\/issue-|ATLAS_REPAIR_PR_NUMBER|pull_request\.number\s*==/);

  assert.match(full, /steps\.qualification-repair\.outputs\.use_repair_proof != 'true'/);
  assert.ok(
    WORKFLOW.indexOf('Validate exact protected qualification repair bootstrap evidence')
      < WORKFLOW.indexOf('Prove complete protected-base browser qualification for synthetic candidate'),
    'repair evidence must be checked before stale-base full qualification',
  );
});

test('protected repair producer executes the entire protected e2e.full stable-ID census', () => {
  const repairWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  assert.match(repairWorkflow, /catalog\.groups\?\.\['e2e\.full'\]/);
  assert.match(repairWorkflow, /selected\.length !== 68/);
  assert.doesNotMatch(repairWorkflow, /candidateCensus|candidate-list-artifacts/);
  assert.doesNotMatch(repairWorkflow, /selected\.length\s*!==\s*1/);
  assert.match(repairWorkflow, /--workers=1 --retries=0/);
});

test('self-retiring bootstrap remains a closed control-plane-only path', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  assert.match(repair, /exactControlPlanePaths/);
  assert.doesNotMatch(repair, /from '\.\/tools\/verification\/qualification-repair-policy\.mjs'/);
  assert.match(repair, /candidate provenance verifier is not an exact gate-pin rotation/);
  assert.match(repair, /regions\.size !== 1/);
  assert.match(repair, /QUALIFICATION_SEMANTIC_RECORD/);
  assert.match(repair, /self-retiring-control-plane-bootstrap/);
});

test('candidate policy bytes cannot self-authorize bootstrap', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  assert.doesNotMatch(repair, /import .* from '\.\/tools\/verification\/qualification-repair-policy\.mjs'/);
  assert.match(repair, /trusted-base\/tools\/verification\/qualification-repair-policy\.mjs/);
});
