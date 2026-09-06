// Protected admission kernel. Candidate code is never imported by this module.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateProtectedRouting } from './protected-semantic-routing.mjs';
import { validateProtectedWorkflowTransition } from './protected-workflow-contract.mjs';

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

const ROUTING_PATH = 'tools/verification/protected-routing.json';
const WORKFLOW_CONFIGURATION = 'tools/verification/protected-workflow-configuration.json';
const MECHANICAL_PATHS = new Set(['tools/governance/verify_extraction_provenance.py', 'docs/migration/legacy-atlas-extraction-provenance.json']);
export function validateProtectedExecutionScope({changedFiles,protectedPaths=[]}={}) {
  if(!Array.isArray(changedFiles)||!changedFiles.length) fail('scope is empty');
  const known=new Set(protectedPaths), seen=new Set();let forceFull=false;
  for(const item of changedFiles) {
    const p=item?.path;
    if(typeof p!=='string'||p.split('/').some(s=>!s||s==='.'||s==='..')||p.includes('\\')||/[\x00-\x1f]/.test(p)||seen.has(p)) fail('unsafe or duplicate execution path');
    if(!['added','modified','removed','renamed'].includes(item.status)) fail('unknown execution status');
    seen.add(p);
    if(item.previousPath) {
      // Classify both ends independently; renames cannot hide an authority removal.
      validateProtectedExecutionScope({changedFiles:[{path:item.previousPath,status:'removed'}],protectedPaths});
    }
    const workflow=p.startsWith('.github/workflows/');
    const configuration=[ROUTING_PATH,WORKFLOW_CONFIGURATION].includes(p);
    const binding=known.has(p)&&(/^e2e\/tests\/[A-Za-z0-9._-]+\.mjs$/.test(p)||p==='e2e/support/creature-presentation-fixtures.mjs');
    const productTest=['tests/verification/qualification-world.test.mjs','tests/verification/protected-hosted-product-identities.test.mjs'].includes(p);
    if(PRODUCT_PATHS.has(p)||configuration||binding||productTest||MECHANICAL_PATHS.has(p)||workflow) {
      if(!['added','modified'].includes(item.status)||item.previousPath||workflow&&!known.has(p)) ineligible('unsupported authority transition');
      forceFull=true;continue;
    }
    if(p.startsWith('tests/')&&known.has(p))ineligible(`immutable deterministic oracle: ${p}`);
    if(p.startsWith('tools/governance/')&&item.status==='removed'&&!['tools/governance/verify_extraction_provenance.py','tools/governance/test_verify_extraction_provenance.py'].includes(p))continue;
    if(p.startsWith('tools/verification/')||p.startsWith('tools/governance/')||p.startsWith('e2e/')||p.startsWith('.github/')||['Dockerfile','.dockerignore','package.json','package-lock.json'].includes(p)) ineligible(`immutable execution authority: ${p}`);
  }
  return freeze({schemaVersion:1,eligible:true,forceFull,changedPaths:[...seen].sort()});
}

export function validateProtectedExecutionCandidate({protectedRoot,candidateRoot,currentCandidate:c}={}) {
  if(!c||!sha.test(c.headSha??'')||!sha.test(c.baseSha??'')||!sha.test(c.treeSha??'')) fail('candidate identity is malformed');
  if(git(protectedRoot,['rev-parse','HEAD']).trim()!==c.baseSha) fail('protected base drift');
  if(git(candidateRoot,['rev-parse','HEAD']).trim()!==c.headSha||git(candidateRoot,['rev-parse','HEAD^{tree}']).trim()!==c.treeSha) fail('candidate head or tree drift');
  if(git(candidateRoot,['merge-base','HEAD',c.baseSha]).trim()!==c.baseSha) fail('candidate must incorporate exact protected base');
  if(git(candidateRoot,['status','--porcelain','--untracked-files=no']).trim()) fail('candidate execution bytes drift');
  const protectedPaths=git(protectedRoot,['ls-tree','-r','--name-only','HEAD']).trim().split('\n');
  const result=validateProtectedExecutionScope({changedFiles:c.changedFiles,protectedPaths});
  const records=git(candidateRoot,['diff','--no-ext-diff','--no-renames','--name-status','-z',c.baseSha,c.headSha,'--']).split('\0');records.pop();
  const derived=[];
  while(records.length){const status=records.shift(),p=records.shift();if(!p||!['A','M','D'].includes(status))fail('unsupported exact diff');derived.push({path:p,status:{A:'added',M:'modified',D:'removed'}[status]});}
  const expanded=c.changedFiles.flatMap(f=>f.status==='renamed'?[{path:f.previousPath,status:'removed'},{path:f.path,status:'added'}]:[{path:f.path,status:f.status}]);
  const canonical=files=>JSON.stringify(files.sort((a,b)=>a.path.localeCompare(b.path)));
  if(canonical(derived)!==canonical(expanded)) fail('complete changed-file drift');
  for(const f of derived)if(f.status!=='removed'){
    const stat=fs.lstatSync(path.join(candidateRoot,f.path));
    if(!stat.isFile()||stat.isSymbolicLink()||!git(candidateRoot,['ls-tree',c.headSha,'--',f.path]).startsWith('100644 blob '))fail('candidate path is not regular');
  }
  const read=(root,p)=>fs.readFileSync(path.join(root,p),'utf8');
  validateProtectedRouting(JSON.parse(read(candidateRoot,ROUTING_PATH)),JSON.parse(read(protectedRoot,'tools/verification/full-safety-net-stable-ids.json')));
  const workflowSources=root=>Object.fromEntries(git(root,['ls-tree','-r','--name-only','HEAD','--','.github/workflows']).trim().split('\n').filter(Boolean).map(p=>[p,read(root,p)]));
  validateProtectedWorkflowTransition({protectedSources:workflowSources(protectedRoot),candidateSources:workflowSources(candidateRoot),configuration:JSON.parse(read(candidateRoot,WORKFLOW_CONFIGURATION))});
  // Provenance updates are mechanically derived from rendered workflow bytes.
  const blob=(root,p)=>git(root,['hash-object','--',p]).trim();
  const mq='.github/workflows/merge-group-gate.yml',ci='.github/workflows/ci.yml';
  const verifier='tools/governance/verify_extraction_provenance.py';
  const expectedVerifier=read(protectedRoot,verifier).replace(`MERGE_GROUP_GATE_BLOB = "${blob(protectedRoot,mq)}"`,`MERGE_GROUP_GATE_BLOB = "${blob(candidateRoot,mq)}"`);
  if(read(candidateRoot,verifier)!==expectedVerifier)fail('provenance verifier is not exact mechanical pin rotation');
  const provenance='docs/migration/legacy-atlas-extraction-provenance.json';
  const expectedMap=JSON.parse(read(protectedRoot,provenance));
  for(const row of expectedMap.rows)for(const target of row.target_paths??[])if(target.path===ci){if(target.blob!==blob(protectedRoot,ci))fail('protected provenance target pin drift');target.blob=blob(candidateRoot,ci);}
  if(JSON.stringify(JSON.parse(read(candidateRoot,provenance)))!==JSON.stringify(expectedMap))fail('provenance map is not exact mechanical pin rotation');
  return freeze({...result,candidate:structuredClone(c)});
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
