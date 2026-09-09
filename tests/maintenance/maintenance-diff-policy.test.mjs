import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const sourceRoot=fileURLToPath(new URL('../..',import.meta.url));
const verifier=path.join(sourceRoot,'tools/maintenance/verify-maintenance-diff.mjs');
const authorityPath='docs/maintenance/ATLAS_LEGACY_RETIREMENT_AUTHORITY.json';
const authorityText=fs.readFileSync(path.join(sourceRoot,authorityPath),'utf8');
const historical='tests/verification/legacy-molehill-transition-workflow-contract.test.mjs';
const support='tools/verification/verification-catalog.json';
const archived='docs/maintenance/suspended-workflows/ci.yml';

function git(root,...args){return execFileSync('git',['-C',root,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function put(root,name,content,mode=0o644){const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content,{mode});}
function change(root,name){put(root,name,`changed:${name}\n`);}

function fixture(t,{authority=authorityText}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-steady-state-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const trusted=path.join(dir,'trusted'),candidate=path.join(dir,'candidate');
  fs.mkdirSync(trusted);
  git(trusted,'init','--quiet');
  if(authority!==null)put(trusted,authorityPath,authority);
  put(trusted,'web/app.mjs','export const app=1;\n');
  put(trusted,'web/delete-me.mjs','export const old=1;\n');
  put(trusted,'web/rename-me.mjs','export const renamed=1;\n');
  put(trusted,'web/copy-source.mjs','export const copy=1;\n');
  put(trusted,'docs/ordinary.md','# Ordinary\n');
  put(trusted,'AGENTS.md','# Agents\n');
  put(trusted,'.github/workflows/current.yml','name: Current\n');
  put(trusted,'tools/maintenance/other.mjs','export {};\n');
  put(trusted,historical,'export {};\n');
  put(trusted,support,'{}\n');
  put(trusted,'tools/verification/verification-authority-manifest.json','{}\n');
  put(trusted,archived,'name: CI\n');
  put(trusted,'docs/maintenance/suspended-workflows/unlisted.yml','name: Unlisted\n');
  put(trusted,'docs/maintenance/verification-restoration/README.md','# Historical\n');
  put(trusted,'docs/maintenance/ATLAS-MAINTENANCE-MODE.md','# Maintenance\n');
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
    const env={...process.env,GITHUB_EVENT_NAME:'pull_request_target',GITHUB_REPOSITORY:'Example/Atlas',
      ATLAS_EVENT_REPOSITORY:'Example/Atlas',ATLAS_DEFAULT_BRANCH:'main',ATLAS_BASE_REF:'main',
      ATLAS_EVENT_ACTION:'synchronize',ATLAS_PR_NUMBER:'7',ATLAS_CODE_REVISION:headSha,
      ATLAS_PROTECTED_BASE_SHA:baseSha,...overrides};
    return spawnSync(process.execPath,[verifier,trusted,candidate],{encoding:'utf8',env});
  };
  return {trusted,candidate,baseSha,commit,invoke};
}


test('repository retirement authority preserves the audited bounded wave census',()=>{
  const manifest=JSON.parse(authorityText);
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.programme,'atlas-legacy-retirement');
  assert.deepEqual(Object.keys(manifest.waves),['lr2-verification-contracts','lr3-suspended-workflows','lr4-governance-cleanup']);
  assert.equal(manifest.waves['lr2-verification-contracts'].retireModifyDelete.length,37);
  assert.equal(manifest.waves['lr2-verification-contracts'].retireDelete.length,0);
  assert.equal(manifest.waves['lr2-verification-contracts'].supportModify.length,3);
  assert.equal(manifest.waves['lr3-suspended-workflows'].retireModifyDelete.length,0);
  assert.equal(manifest.waves['lr3-suspended-workflows'].retireDelete.length,25);
  assert.equal(manifest.waves['lr3-suspended-workflows'].supportModify.length,0);
  assert.equal(manifest.waves['lr4-governance-cleanup'].retireModifyDelete.length,15);
  assert.equal(manifest.waves['lr4-governance-cleanup'].retireDelete.length,8);
  assert.equal(manifest.waves['lr4-governance-cleanup'].supportModify.length,12);
});

test('admits ordinary product changes in steady state',t=>{
  const f=fixture(t);change(f.candidate,'web/app.mjs');f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"mode":"steady-state"/);
});

test('admits ordinary additions deletions renames and copies as regular-file changes',t=>{
  const added=fixture(t);put(added.candidate,'web/new.mjs','export {};\n');added.commit();assert.equal(added.invoke().status,0,added.invoke().stderr);
  const deleted=fixture(t);fs.rmSync(path.join(deleted.candidate,'web/delete-me.mjs'));deleted.commit();assert.equal(deleted.invoke().status,0,deleted.invoke().stderr);
  const renamed=fixture(t);fs.renameSync(path.join(renamed.candidate,'web/rename-me.mjs'),path.join(renamed.candidate,'web/renamed.mjs'));renamed.commit();assert.equal(renamed.invoke().status,0,renamed.invoke().stderr);
  const copied=fixture(t);fs.copyFileSync(path.join(copied.candidate,'web/copy-source.mjs'),path.join(copied.candidate,'web/copied.mjs'));copied.commit();assert.equal(copied.invoke().status,0,copied.invoke().stderr);
});

test('rejects workflow and maintenance control-plane mutation',t=>{
  for(const name of ['.github/workflows/current.yml','tools/maintenance/other.mjs']){
    const f=fixture(t);change(f.candidate,name);f.commit();
    const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/protected control-plane path is immutable/);
  }
});

test('rejects symlink candidates',t=>{
  const f=fixture(t);fs.symlinkSync('app.mjs',path.join(f.candidate,'web/link.mjs'));f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/not a regular file/);
});

test('protected LR3 archive deletion is admitted only through its exact wave',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.candidate,archived));f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"mode":"legacy-retirement"/);assert.match(result.stdout,/"retirementWave":"lr3-suspended-workflows"/);
});

test('unlisted archive path remains fail closed',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.candidate,'docs/maintenance/suspended-workflows/unlisted.yml'));f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/legacy path requires protected retirement authority/);
});

test('LR2 can retire a historical contract with exact supporting catalog change',t=>{
  const f=fixture(t);change(f.candidate,historical);change(f.candidate,support);f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"retirementWave":"lr2-verification-contracts"/);
});

test('a supporting path remains an ordinary steady-state change when no retirement target is touched',t=>{
  const f=fixture(t);change(f.candidate,support);f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"mode":"steady-state"/);
});

test('retirement cannot mix waves or unrelated product scope',t=>{
  const mixedWave=fixture(t);change(mixedWave.candidate,historical);change(mixedWave.candidate,'AGENTS.md');mixedWave.commit();
  const waveResult=mixedWave.invoke();assert.equal(waveResult.status,1);assert.match(waveResult.stderr,/spans multiple waves/);
  const mixedProduct=fixture(t);fs.rmSync(path.join(mixedProduct.candidate,archived));change(mixedProduct.candidate,'web/app.mjs');mixedProduct.commit();
  const productResult=mixedProduct.invoke();assert.equal(productResult.status,1);assert.match(productResult.stderr,/outside protected wave authority/);
});

test('restoration namespace cannot be changed outside its protected retirement wave',t=>{
  const f=fixture(t);change(f.candidate,'docs/maintenance/verification-restoration/README.md');f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"retirementWave":"lr4-governance-cleanup"/);
});

test('retirement authority update is isolated and monotonic',t=>{
  const f=fixture(t);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.candidate,authorityPath),'utf8'));
  manifest.waves['lr5-extra-evidence']={retireModifyDelete:[],retireDelete:['docs/maintenance/old-note.md'],supportModify:[]};
  put(f.candidate,authorityPath,`${JSON.stringify(manifest,null,2)}\n`);f.commit();
  const result=f.invoke();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"mode":"legacy-retirement-authority-update"/);
});

test('retirement authority cannot remove or rewrite protected rules',t=>{
  const removed=fixture(t);
  const manifest=JSON.parse(fs.readFileSync(path.join(removed.candidate,authorityPath),'utf8'));
  manifest.waves['lr3-suspended-workflows'].retireDelete.shift();
  put(removed.candidate,authorityPath,`${JSON.stringify(manifest,null,2)}\n`);removed.commit();
  const removedResult=removed.invoke();assert.equal(removedResult.status,1);assert.match(removedResult.stderr,/changed protected rule|not monotonic|removed wave/);

  const rewritten=fixture(t);
  const changed=JSON.parse(fs.readFileSync(path.join(rewritten.candidate,authorityPath),'utf8'));
  const moved=changed.waves['lr2-verification-contracts'].retireModifyDelete.shift();
  changed.waves['lr2-verification-contracts'].retireDelete.push(moved);
  put(rewritten.candidate,authorityPath,`${JSON.stringify(changed,null,2)}\n`);rewritten.commit();
  const rewrittenResult=rewritten.invoke();assert.equal(rewrittenResult.status,1);assert.match(rewrittenResult.stderr,/changed protected rule/);
});

test('candidate authority cannot self-authorize a same-candidate deletion',t=>{
  const f=fixture(t);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.candidate,authorityPath),'utf8'));
  manifest.waves['lr3-suspended-workflows'].retireDelete.push('docs/maintenance/suspended-workflows/unlisted.yml');
  put(f.candidate,authorityPath,`${JSON.stringify(manifest,null,2)}\n`);
  fs.rmSync(path.join(f.candidate,'docs/maintenance/suspended-workflows/unlisted.yml'));
  f.commit();
  const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,/authority update must be one isolated modification/);
});

test('missing or malformed protected retirement authority fails closed',t=>{
  const missing=fixture(t,{authority:null});change(missing.candidate,'web/app.mjs');missing.commit();
  const missingResult=missing.invoke();assert.equal(missingResult.status,1);assert.match(missingResult.stderr,/retirement authority is absent/);

  const malformed=fixture(t,{authority:'{"schemaVersion":2}\n'});change(malformed.candidate,'web/app.mjs');malformed.commit();
  const malformedResult=malformed.invoke();assert.equal(malformedResult.status,1);assert.match(malformedResult.stderr,/legacy retirement authority/);
});

test('steady-state admission preserves equivalent PR and merge-group identity handling',t=>{
  const f=fixture(t);change(f.candidate,'web/app.mjs');f.commit();
  const pr=f.invoke();assert.equal(pr.status,0,pr.stderr);
  const head=git(f.candidate,'rev-parse','HEAD');
  const mq=f.invoke({GITHUB_EVENT_NAME:'merge_group',ATLAS_BASE_REF:'refs/heads/main',ATLAS_EVENT_ACTION:'checks_requested',ATLAS_PR_NUMBER:'',GITHUB_SHA:head});
  assert.equal(mq.status,0,mq.stderr);assert.equal(pr.stdout,mq.stdout);
});
