import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const sourceRoot=fileURLToPath(new URL('../..',import.meta.url));
const verifier=path.join(sourceRoot,'tools/maintenance/verify-maintenance-diff.mjs');
const suspended=['ci.yml','codeql.yml'];
const readSource=name=>fs.readFileSync(path.join(sourceRoot,name),'utf8');

function git(root,...args){return execFileSync('git',['-C',root,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function put(root,name,content,mode=0o644){const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content,{mode});}

function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-maintenance-policy-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const trusted=path.join(dir,'trusted'),candidate=path.join(dir,'candidate');
  fs.mkdirSync(trusted);
  git(trusted,'init','--quiet');
  put(trusted,'AGENTS.md','# Agents\n');
  put(trusted,'docs/agents/current.md','# Current\n');
  put(trusted,'docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json',readSource('docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json'));
  put(trusted,'docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json',readSource('docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json'));
  put(trusted,'tests/verification/anti-loop-transition-compose-contract.test.mjs','export {};\n');
  put(trusted,'tests/verification/bootstrap-catalog-workflow-contract.test.mjs','export {};\n');
  put(trusted,'tests/verification/unrelated.test.mjs','export {};\n');
  put(trusted,'src/browser/loader.mjs','export const loader=1;\n');
  put(trusted,'src/browser/semantic.mjs','export const semantic=1;\n');
  put(trusted,'tests/browser-semantic.mjs','export {};\n');
  put(trusted,'tools/fullworld-runtime/qualify_browser.mjs','export {};\n');
  put(trusted,'web/rogue.mjs','export const rogue=1;\n');
  put(trusted,'tools/maintenance/minimal-merge-group-gate.yml','name: Minimal MQ\n');
  put(trusted,'.github/workflows/merge-authority-audit.yml','name: Audit\n');
  put(trusted,'.github/workflows/merge-group-gate.yml','name: Heavy MQ\n');
  put(trusted,'.github/workflows/terminal-branch-lifecycle.yml','name: Terminal\n');
  put(trusted,'.github/workflows/ci.yml','name: CI\n');
  put(trusted,'.github/workflows/codeql.yml','name: CodeQL\n');
  git(trusted,'add','.');
  git(trusted,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','base');
  git(trusted,'worktree','add','--quiet','-b','candidate',candidate,'HEAD');
  const baseSha=git(trusted,'rev-parse','HEAD');
  const commit=()=>{
    git(candidate,'add','-A');
    git(candidate,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','candidate');
  };
  const invoke=(overrides={})=>{
    const headSha=git(candidate,'rev-parse','HEAD');
    const env={
      ...process.env,
      GITHUB_EVENT_NAME:'pull_request_target',
      GITHUB_REPOSITORY:'Example/Atlas',
      ATLAS_EVENT_REPOSITORY:'Example/Atlas',
      ATLAS_DEFAULT_BRANCH:'main',
      ATLAS_BASE_REF:'main',
      ATLAS_EVENT_ACTION:'synchronize',
      ATLAS_PR_NUMBER:'7',
      ATLAS_CODE_REVISION:headSha,
      ATLAS_PROTECTED_BASE_SHA:baseSha,
      ...overrides,
    };
    return spawnSync(process.execPath,[verifier,trusted,candidate],{encoding:'utf8',env});
  };
  const archiveCutover=({omit,alter}={})=>{
    put(candidate,'.github/workflows/merge-group-gate.yml','name: Minimal MQ\n');
    for(const name of suspended){
      if(name===omit)continue;
      const source=path.join(candidate,'.github/workflows',name);
      const bytes=fs.readFileSync(source);
      put(candidate,`docs/maintenance/suspended-workflows/${name}`,name===alter?Buffer.concat([bytes,Buffer.from('# changed\n')]):bytes);
      fs.rmSync(source);
    }
  };
  return {trusted,candidate,baseSha,commit,invoke,archiveCutover};
}

test('accepts a regular-text governance addition',t=>{
  const f=fixture(t);put(f.candidate,'docs/agents/prompts/example.md','# Prompt\n');f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"result":"PASS"/);assert.match(result.stdout,/"mode":"maintenance-only"/);
});

test('accepts deletion only for an exact protected obsolete verification contract',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.candidate,'tests/verification/anti-loop-transition-compose-contract.test.mjs'));f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"mode":"maintenance-only"/);
});

test('rejects deletion of an unrelated verification test',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.candidate,'tests/verification/unrelated.test.mjs'));f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/maintenance path is frozen/);
});

test('candidate obsolete inventory cannot authorize its own same-PR deletion',t=>{
  const f=fixture(t);
  const inventory=JSON.parse(fs.readFileSync(path.join(f.candidate,'docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json'),'utf8'));
  inventory.paths.push('tests/verification/unrelated.test.mjs');
  put(f.candidate,'docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json',`${JSON.stringify(inventory,null,2)}\n`);
  fs.rmSync(path.join(f.candidate,'tests/verification/unrelated.test.mjs'));
  f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/maintenance authority is immutable/);
});

test('accepts a single protected remediation lane',t=>{
  const f=fixture(t);put(f.candidate,'src/browser/loader.mjs','export const loader=2;\n');put(f.candidate,'tests/browser-semantic.mjs','export const canonical=true;\n');f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"mode":"bounded-remediation"/);assert.match(result.stdout,/"remediationLane":"canonical-foundation"/);
});

test('rejects a diff spanning independent remediation lanes',t=>{
  const f=fixture(t);put(f.candidate,'src/browser/semantic.mjs','export const semantic=2;\n');put(f.candidate,'tools/fullworld-runtime/qualify_browser.mjs','export const deadline=true;\n');f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/spans multiple remediation lanes/);
});

test('candidate remediation allowlist cannot self-authorize an extra runtime path',t=>{
  const f=fixture(t);
  const allowlist=JSON.parse(fs.readFileSync(path.join(f.candidate,'docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json'),'utf8'));
  allowlist.lanes['runtime-safety'].rules.push({path:'web/rogue.mjs',operations:['M']});
  put(f.candidate,'docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json',`${JSON.stringify(allowlist,null,2)}\n`);
  put(f.candidate,'web/rogue.mjs','export const rogue=2;\n');
  f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/maintenance authority is immutable/);
});

test('rejects a mixed governance and unrelated runtime diff',t=>{
  const f=fixture(t);put(f.candidate,'docs/agents/prompts/example.md','# Prompt\n');put(f.candidate,'web/rogue.mjs','export const rogue=2;\n');f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/maintenance path is frozen/);
});

test('rejects a rename escape from governance into runtime',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.candidate,'web'),{recursive:true});git(f.candidate,'mv','docs/agents/current.md','web/current.md');f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/rename or copy is forbidden/);
});

test('rejects symlinks and executable modes in allowed paths',t=>{
  const symlink=fixture(t);fs.symlinkSync('current.md',path.join(symlink.candidate,'docs/agents/link.md'));symlink.commit();
  assert.match(symlink.invoke().stderr,/regular 100644 file/);
  const executable=fixture(t);put(executable.candidate,'docs/agents/run.md','# Run\n',0o755);executable.commit();
  assert.match(executable.invoke().stderr,/regular 100644 file/);
});

test('rejects binary and oversized content in allowed paths',t=>{
  const binary=fixture(t);put(binary.candidate,'docs/agents/binary.md',Buffer.from([0x41,0,0x42]));binary.commit();
  assert.match(binary.invoke().stderr,/text content/);
  const oversized=fixture(t);put(oversized.candidate,'docs/evidence/large.md','x'.repeat(2*1024*1024+1));oversized.commit();
  assert.match(oversized.invoke().stderr,/size limit/);
});

test('rejects maintenance authority and ordinary workflow edits',t=>{
  const authority=fixture(t);put(authority.candidate,'tools/maintenance/minimal-merge-group-gate.yml','name: Weakened\n');authority.commit();
  assert.match(authority.invoke().stderr,/maintenance authority is immutable/);
  const workflow=fixture(t);put(workflow.candidate,'.github/workflows/ci.yml','name: Disabled by success\n');workflow.commit();
  assert.match(workflow.invoke().stderr,/workflow transition is not the complete suspension cutover/);
});

test('accepts only the complete byte-preserving workflow suspension cutover',t=>{
  const f=fixture(t);f.archiveCutover();f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"mode":"workflow-suspension-cutover"/);
});

test('rejects partial, altered, or extended workflow suspension cutovers',t=>{
  const partial=fixture(t);partial.archiveCutover({omit:'codeql.yml'});partial.commit();
  assert.match(partial.invoke().stderr,/active workflow inventory/);
  const altered=fixture(t);altered.archiveCutover({alter:'ci.yml'});altered.commit();
  assert.match(altered.invoke().stderr,/archived workflow bytes/);
  const extended=fixture(t);extended.archiveCutover();put(extended.candidate,'.github/workflows/new.yml','name: New\n');extended.commit();
  assert.match(extended.invoke().stderr,/active workflow inventory/);
});

test('rejects dirty worktrees, empty diffs, and false event identity',t=>{
  const dirty=fixture(t);put(dirty.candidate,'docs/agents/new.md','# New\n');dirty.commit();put(dirty.candidate,'docs/agents/new.md','# Dirty\n');
  assert.match(dirty.invoke().stderr,/candidate worktree is dirty/);
  const empty=fixture(t);git(empty.candidate,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','--allow-empty','-m','empty');
  assert.match(empty.invoke().stderr,/maintenance diff is empty/);
  const identity=fixture(t);put(identity.candidate,'docs/agents/new.md','# New\n');identity.commit();
  assert.match(identity.invoke({ATLAS_PROTECTED_BASE_SHA:'f'.repeat(40)}).stderr,/protected base identity/);
  assert.match(identity.invoke({ATLAS_EVENT_REPOSITORY:'Other/Repo'}).stderr,/repository identity/);
  assert.match(identity.invoke({ATLAS_BASE_REF:'release'}).stderr,/base ref identity/);
});

test('accepts the same inert policy for an exact merge-group event',t=>{
  const f=fixture(t);put(f.candidate,'docs/evidence/canary.md','# Canary\n');f.commit();const head=git(f.candidate,'rev-parse','HEAD');
  const result=f.invoke({GITHUB_EVENT_NAME:'merge_group',ATLAS_BASE_REF:'refs/heads/main',ATLAS_EVENT_ACTION:'checks_requested',ATLAS_PR_NUMBER:'',GITHUB_SHA:head});
  assert.equal(result.status,0,result.stderr);
});

test('organization-required entrypoint uses only protected maintenance authority',()=>{
  const workflow=readSource('.github/workflows/merge-authority-audit.yml');
  assert.match(workflow,/node trusted-base\/tools\/maintenance\/verify-maintenance-diff\.mjs/);
  assert.doesNotMatch(workflow,/run-protected-authority-audit|candidate\/tools\/|docker|playwright|npm |python/iu);
  assert.equal((workflow.match(/uses: actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/g)??[]).length,2);
});
