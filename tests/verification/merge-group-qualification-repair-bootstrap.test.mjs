import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github/workflows/merge-group-gate.yml'), 'utf8');

function stepBody(name) {
  const marker = `      - name: ${name}\n`;
  const start = WORKFLOW.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = WORKFLOW.indexOf('\n      - name: ', start + marker.length);
  return WORKFLOW.slice(start, next === -1 ? WORKFLOW.length : next);
}

for (const exactTree of [true, false]) test(`missing repair evidence retains ordinary qualification for ${exactTree ? 'single-candidate' : 'combined'} tree`, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-repair-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  const base = 'a'.repeat(40), head = 'b'.repeat(40), tree = 'c'.repeat(40);
  const responses = {
    'repos/Oteryn/Oteryn-Atlas/pulls/42': { head: { sha: head }, base: { sha: base } },
    [`repos/Oteryn/Oteryn-Atlas/git/commits/${head}`]: { tree: { sha: tree } },
    [`repos/Oteryn/Oteryn-Atlas/git/commits/${'d'.repeat(40)}`]: { tree: { sha: exactTree ? tree : 'e'.repeat(40) }, parents: [{ sha: base }] },
    [`repos/Oteryn/Oteryn-Atlas/commits/${head}/status`]: { statuses: [] },
    'repos/Oteryn/Oteryn-Atlas/pulls/42/files?per_page=100': [[{ filename: 'tools/verification/qualification-repair-policy.mjs' }]],
  };
  const command = (name, source) => {
    fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\n${source}`, { mode: 0o755 });
  };
  command('gh', `
    const args = process.argv.slice(2);
    const endpoint = args.find((arg) => arg.startsWith('repos/'));
    if (endpoint === 'repos/Oteryn/Oteryn-Atlas/branches/main') console.log('${base}');
    else {
      const responses = ${JSON.stringify(responses)};
      if (!(endpoint in responses)) throw new Error('unexpected API call: ' + endpoint);
      console.log(JSON.stringify(responses[endpoint]));
    }
  `);
  command('jq', `
    const fs = require('node:fs');
    const args = process.argv.slice(2);
    const input = JSON.parse(fs.readFileSync(args.at(-1), 'utf8'));
    const expression = args.at(-2);
    if (expression === '.head.sha') console.log(input.head.sha);
    else if (expression === '.base.sha') console.log(input.base.sha);
    else if (expression === '.tree.sha') console.log(input.tree.sha);
    else if (expression === '.parents | any(.sha == $base)') { if (!input.parents.some((p) => p.sha === args[args.indexOf('--arg') + 2])) process.exit(1); }
    else if (expression === '[.[][] | {path: .filename, previousPath: (.previous_filename // null)}]') console.log(JSON.stringify(input.flat().map((p) => ({path:p.filename,previousPath:p.previous_filename??null}))));
    else if (expression === '.[] | [.path, .previousPath] | .[] | select(. != null)') console.log(input.flatMap((p) => [p.path,p.previousPath]).filter(Boolean).join('\\n'));
    else if (expression === '[.statuses[] | select(.context == "atlas-protected-product-qualification")] | length') console.log(input.statuses.filter((s) => s.context === 'atlas-protected-product-qualification').length);
    else throw new Error('unexpected jq expression: ' + expression);
  `);
  // Even if candidate code reports success, only protected evidence may grant
  // use_repair_proof. The ordinary missing-status path must not execute it.
  command('node', "require('node:fs').appendFileSync(process.env.NODE_CALLS, 'called\\n'); process.stdin.resume();");
  const step = stepBody('Validate exact protected qualification repair bootstrap evidence');
  const body = step.slice(step.indexOf('        run: |\n') + '        run: |\n'.length).split('\n').map((line) => line.replace(/^          /, '')).join('\n');
  const output = path.join(root, 'output');
  const calls = path.join(root, 'node-calls');
  const result = spawnSync('bash', ['-c', body], { cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, NODE_CALLS: calls,
      RUNNER_TEMP: root, GITHUB_OUTPUT: output, GITHUB_REPOSITORY: 'Oteryn/Oteryn-Atlas',
      ATLAS_MERGE_GROUP_HEAD_REF: `refs/heads/gh-readonly-queue/main/pr-42-${base}`,
      ATLAS_PROTECTED_BASE_SHA: base, ATLAS_CODE_REVISION: 'd'.repeat(40) } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(output, 'utf8'), 'use_repair_proof=false\n');
  assert.equal(fs.existsSync(calls), false, 'missing evidence must not invoke candidate code');
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

test('candidate policy bytes cannot self-authorize bootstrap', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  assert.doesNotMatch(repair, /import .* from '\.\/tools\/verification\/qualification-repair-policy\.mjs'/);
  assert.match(repair, /trusted-base\/tools\/verification\/qualification-repair-policy\.mjs/);
});
