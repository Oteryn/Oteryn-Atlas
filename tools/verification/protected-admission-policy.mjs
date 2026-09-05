// Protected admission kernel. Candidate code is never imported by this module.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PRODUCT_PATHS = new Set([
  'src/browser/animation-runtime-service.mjs', 'src/browser/fullworld-trust.mjs',
  'src/browser/semantic-search.mjs', 'tools/verification/qualification-fixture-definition.mjs',
  'tools/verification/qualification-world.mjs', 'web/fullworld-app.mjs',
  'web/fullworld-creatures.mjs', 'web/fullworld-farm-explorer.mjs', 'web/fullworld-search.mjs',
  'tools/verification/protected-hosted-product-identities.json',
]);
const sha = /^[0-9a-f]{40}$/;
const fail = (message) => { throw new TypeError(`protected admission ${message}`); };
const ineligible = (message) => {
  const error = new TypeError(`protected admission ${message}`);
  error.code = 'ADMISSION_SCOPE_INELIGIBLE';
  throw error;
};
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export function validateProtectedAdmissionScope({ changedFiles, protectedPaths = [] } = {}) {
  if (!Array.isArray(changedFiles) || !changedFiles.length) fail('scope is empty');
  const basePaths = new Set(protectedPaths);
  const paths = new Set();
  let hasRepairChange = false;
  for (const item of changedFiles) {
    const p = item?.path;
    if (typeof p !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(p) || p.split('/').some((part) => !part || part === '.' || part === '..')) fail('path is unsafe');
    if (paths.has(p)) fail('duplicate path');
    if (!['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged'].includes(item.status)) fail('unknown status');
    const regression = /^tests\/verification\/[A-Za-z0-9][A-Za-z0-9._-]*\.test\.mjs$/.test(p)
      && (!basePaths.has(p) || ['tests/verification/qualification-world.test.mjs', 'tests/verification/protected-hosted-product-identities.test.mjs'].includes(p));
    const binding = basePaths.has(p) && (/^e2e\/tests\/[A-Za-z0-9._-]+\.mjs$/.test(p) || p === 'e2e/support/creature-presentation-fixtures.mjs');
    if (!PRODUCT_PATHS.has(p) && !regression && !binding) {
      ineligible(`scope cannot change authority: ${p}`);
    }
    if (!['added', 'modified'].includes(item.status) || item.previousPath) ineligible('status is not an admitted non-renaming transition');
    paths.add(p);
    if (PRODUCT_PATHS.has(p) || binding) hasRepairChange = true;
  }
  if (!hasRepairChange) ineligible('scope contains only regressions; use ordinary qualification');
  return freeze({ schemaVersion: 1, eligible: true, changedPaths: [...paths].sort(), requiredGroups: ['deterministic.core', 'e2e.full'], dataCapability: 'qualification_fixture', workers: 1, retries: 0 });
}

export function validateProtectedAdmissionRepin({ protectedIdentities, candidateIdentities, productDigest } = {}) {
  if (!/^sha256:[0-9a-f]{64}$/.test(productDigest ?? '')) fail('product identity digest is invalid');
  const expected = structuredClone(protectedIdentities);
  if (!expected?.qualification_fixture || typeof expected.qualification_fixture.id !== 'string') fail('protected identity is absent');
  expected.qualification_fixture.digest = productDigest;
  // Full recursive equality; a JSON replacer here would silently omit nested keys.
  const sorted = (v) => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, sorted(v[key])])) : v;
  if (JSON.stringify(sorted(expected)) !== JSON.stringify(sorted(candidateIdentities))) fail('identity repin changes protected identity beyond rebuilt fixture digest');
  return freeze({ productDigest });
}

function git(root, args) {
  return execFileSync('git', ['--no-replace-objects', '-C', root, '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

export function validateProtectedAdmissionCandidate({ protectedRoot, candidateRoot, currentCandidate } = {}) {
  const c = currentCandidate;
  if (!c || !sha.test(c.headSha ?? '') || !sha.test(c.baseSha ?? '') || !sha.test(c.treeSha ?? '')) fail('candidate identity is malformed');
  if (git(protectedRoot, ['rev-parse', 'HEAD']).trim() !== c.baseSha) fail('protected base drift');
  if (git(candidateRoot, ['rev-parse', 'HEAD']).trim() !== c.headSha) fail('candidate head drift');
  if (git(candidateRoot, ['rev-parse', 'HEAD^{tree}']).trim() !== c.treeSha) fail('candidate tree drift');
  if (git(candidateRoot, ['merge-base', 'HEAD', c.baseSha]).trim() !== c.baseSha) fail('candidate must incorporate exact current protected base');
  if (git(candidateRoot, ['status', '--porcelain', '--untracked-files=no']).trim()) fail('candidate execution bytes drift');
  const protectedPaths = git(protectedRoot, ['ls-tree', '-r', '--name-only', 'HEAD']).trim().split('\n');
  const result = validateProtectedAdmissionScope({ changedFiles: c.changedFiles, protectedPaths });
  const records = git(candidateRoot, ['diff', '--no-ext-diff', '--no-renames', '--name-status', '-z', c.baseSha, c.headSha, '--']).split('\0');
  records.pop();
  const derived = [];
  while (records.length) {
    const status = records.shift(); const p = records.shift();
    if (!p || !['M', 'A'].includes(status)) fail('unsupported candidate diff status');
    derived.push({ path: p, status: status === 'A' ? 'added' : 'modified' });
  }
  const canonical = (files) => JSON.stringify(files.map(({ path: p, status, previousPath }) => ({ path: p, status, previousPath: previousPath ?? null })).sort((a, b) => a.path.localeCompare(b.path)));
  if (canonical(derived) !== canonical(c.changedFiles)) fail('complete changed-file drift');
  for (const p of result.changedPaths) {
    const stat = fs.lstatSync(path.join(candidateRoot, p));
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`path must be a regular file: ${p}`);
    const entry = git(candidateRoot, ['ls-tree', c.headSha, '--', p]);
    if (!entry.startsWith('100644 blob ')) fail(`path mode is not regular: ${p}`);
  }
  return freeze({ ...result, candidate: structuredClone(c) });
}
