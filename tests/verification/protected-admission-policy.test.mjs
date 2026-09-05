import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as policy from '../../tools/verification/protected-admission-policy.mjs';

const change = (path) => ({ path, status: 'modified' });
const valid = () => ({ changedFiles: [change('tools/verification/qualification-world.mjs'), change('e2e/tests/desktop.spec.mjs')], protectedPaths: ['e2e/tests/desktop.spec.mjs'] });
test('exact combined product and binding transition is admitted', () => {
  assert.equal(typeof policy.validateProtectedAdmissionScope, 'function');
  assert.equal(policy.validateProtectedAdmissionScope(valid()).eligible, true);
});
for (const path of ['.github/workflows/ci.yml', '.github/workflows/protected-admission.yml', 'tools/verification/protected-admission-policy.mjs', 'tools/verification/protected-admission-evidence.mjs', 'tools/verification/qualification-scenario-bindings.mjs', 'tools/verification/impact-manifest.json', 'tools/verification/verification-catalog.json', 'e2e/playwright.config.mjs', 'e2e/tests/new-oracle.spec.mjs', 'AGENTS.md', '../web/fullworld-app.mjs']) {
  test(`candidate cannot expand protected authority through ${path}`, () => {
    assert.throws(() => policy.validateProtectedAdmissionScope({ ...valid(), changedFiles: [...valid().changedFiles, change(path)] }), /scope|path|authority/);
  });
}
for (const status of ['removed', 'renamed', 'copied', 'unknown']) {
  test(`unaccounted ${status} change is rejected`, () => assert.throws(() => policy.validateProtectedAdmissionScope({ ...valid(), changedFiles: [{ ...change('tools/verification/qualification-world.mjs'), status }] }), /status/));
}
test('well-formed unsupported transitions remain eligible for ordinary qualification', () => {
  for (const status of ['removed', 'renamed', 'copied', 'changed']) {
    for (const p of ['README.md', 'tools/verification/qualification-world.mjs']) {
      assert.throws(() => policy.validateProtectedAdmissionScope({ ...valid(), changedFiles: [{ path: p, status }] }), error => error.code === 'ADMISSION_SCOPE_INELIGIBLE');
    }
  }
});
test('duplicate paths are rejected', () => assert.throws(() => policy.validateProtectedAdmissionScope({ ...valid(), changedFiles: [valid().changedFiles[0], valid().changedFiles[0]] }), /duplicate/));
test('ordinary docs change is not admitted into repair evidence', () => assert.throws(() => policy.validateProtectedAdmissionScope({ ...valid(), changedFiles: [change('README.md')] }), /scope/));
test('existing protected deterministic oracles cannot be removed by candidate tests', () => {
  const p = 'tests/verification/protected-admission-evidence.test.mjs';
  assert.throws(() => policy.validateProtectedAdmissionScope({ changedFiles: [change(p)], protectedPaths: [p] }), /scope/);
});
test('admission has no caller-controlled branch or PR allowlist', () => {
  const a = policy.validateProtectedAdmissionScope({ ...valid(), branch: 'feature/one', prNumber: 7 });
  const b = policy.validateProtectedAdmissionScope({ ...valid(), branch: 'arbitrary/two', prNumber: 910 });
  assert.deepEqual(a, b);
  assert.deepEqual(a.requiredGroups, ['deterministic.core', 'e2e.full']);
  assert.equal(a.workers, 1);
  assert.equal(a.retries, 0);
});
test('identity repin preserves all other authority', () => {
  const base = { qualification_fixture: { id: 'fixture', digest: `sha256:${'1'.repeat(64)}` }, bounded_real_world: { id: 'bounded', digest: `sha256:${'2'.repeat(64)}` } };
  const digest = `sha256:${'3'.repeat(64)}`;
  const candidate = structuredClone(base); candidate.qualification_fixture.digest = digest;
  assert.equal(policy.validateProtectedAdmissionRepin({ protectedIdentities: base, candidateIdentities: candidate, productDigest: digest }).productDigest, digest);
  candidate.bounded_real_world.digest = digest;
  assert.throws(() => policy.validateProtectedAdmissionRepin({ protectedIdentities: base, candidateIdentities: candidate, productDigest: digest }), /identity/);
});

test('filesystem admission fences git head, base, tree, complete diff and execution bytes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'admission-git-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = path.join(root, 'base'), candidate = path.join(root, 'candidate');
  fs.mkdirSync(base);
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Contract test', '-c', 'user.email=contract@example.invalid', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(base, 'init', '-q');
  const relative = 'tools/verification/qualification-world.mjs';
  fs.mkdirSync(path.dirname(path.join(base, relative)), { recursive: true });
  fs.writeFileSync(path.join(base, relative), 'export const value = 1;\n');
  git(base, 'add', '.'); git(base, 'commit', '-qm', 'base');
  const baseSha = git(base, 'rev-parse', 'HEAD');
  git(root, 'clone', '-q', base, candidate);
  fs.writeFileSync(path.join(candidate, relative), 'export const value = 2;\n');
  git(candidate, 'add', '.'); git(candidate, 'commit', '-qm', 'candidate');
  const c = { repository: 'owner/repo', prNumber: 4, headSha: git(candidate, 'rev-parse', 'HEAD'), baseSha, treeSha: git(candidate, 'rev-parse', 'HEAD^{tree}'), changedFiles: [change(relative)] };
  const validate = (value = c) => policy.validateProtectedAdmissionCandidate({ protectedRoot: base, candidateRoot: candidate, currentCandidate: value });
  assert.equal(validate().eligible, true);
  for (const field of ['headSha', 'baseSha', 'treeSha']) assert.throws(() => validate({ ...c, [field]: '0'.repeat(40) }), /drift/);
  assert.throws(() => validate({ ...c, changedFiles: [] }), /scope is empty|changed-file drift/);
  fs.appendFileSync(path.join(candidate, relative), '// uncommitted\n');
  assert.throws(() => validate(), /execution bytes drift/);
});
