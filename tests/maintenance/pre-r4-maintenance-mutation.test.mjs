import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const sourceRoot=fileURLToPath(new URL('../..',import.meta.url));
const verifier=path.join(sourceRoot,'tools/maintenance/verify-maintenance-diff.mjs');
const restoration='docs/maintenance/ATLAS_VERIFICATION_RESTORATION_ALLOWLIST.json';
const remediation='docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json';
const obsolete='docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json';
const readSource=name=>fs.readFileSync(path.join(sourceRoot,name),'utf8');
function git(root,...args){return execFileSync('git',['-C',root,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function put(root,name,content='export {};\n'){const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-pre-r4-maintenance-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const trusted=path.join(dir,'trusted'),candidate=path.join(dir,'candidate');
  fs.mkdirSync(trusted);git(trusted,'init','--quiet');
  put(trusted,restoration,readSource(restoration));put(trusted,remediation,readSource(remediation));put(trusted,obsolete,readSource(obsolete));
  put(trusted,'tools/verification/verification-execution-contract.mjs');
  put(trusted,'tools/verification/build-verification-plan.mjs');
  put(trusted,'src/verification.mjs');
  put(trusted,'tests/existing.mjs',"import test from 'node:test';test('existing',()=>{});\n");
  put(trusted,'tests/old.mjs',"import test from 'node:test';test('old',()=>{});\n");
  put(trusted,'tools/maintenance/helper.mjs');put(trusted,'web/rogue.mjs');
  git(trusted,'add','.');git(trusted,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','base');
  git(trusted,'worktree','add','--quiet','-b','candidate',candidate,'HEAD');
  const baseSha=git(trusted,'rev-parse','HEAD');
  const commit=()=>{git(candidate,'add','-A');git(candidate,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','candidate');};
  const invoke=(overrides={})=>{
    const headSha=git(candidate,'rev-parse','HEAD');
    return spawnSync(process.execPath,[verifier,trusted,candidate],{encoding:'utf8',env:{...process.env,
      GITHUB_EVENT_NAME:'pull_request_target',GITHUB_REPOSITORY:'Example/Atlas',ATLAS_EVENT_REPOSITORY:'Example/Atlas',ATLAS_DEFAULT_BRANCH:'main',ATLAS_BASE_REF:'main',ATLAS_EVENT_ACTION:'synchronize',ATLAS_PR_NUMBER:'7',ATLAS_CODE_REVISION:headSha,ATLAS_PROTECTED_BASE_SHA:baseSha,...overrides}});
  };
  return {trusted,candidate,baseSha,commit,invoke};
}
function pass(result){assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/"result":"PASS"/);assert.match(result.stdout,/"mode":"verification-restoration-r1-r3"/);}

test('existing exact restoration path admitted historically as A may evolve through M',t=>{
  const f=fixture(t);put(f.candidate,'tools/verification/verification-execution-contract.mjs','// modified\n');f.commit();pass(f.invoke());
});

test('safe deterministic test subjects admit A and M without becoming restoration authority paths',t=>{
  const added=fixture(t);put(added.candidate,'tests/new-subject.mjs');added.commit();pass(added.invoke());
  const modified=fixture(t);put(modified.candidate,'tests/existing.mjs','// candidate subject bytes\n');modified.commit();pass(modified.invoke());
});

test('safe same-runtime deterministic test rename is admitted',t=>{
  const f=fixture(t);git(f.candidate,'mv','tests/old.mjs','tests/renamed.mjs');f.commit();pass(f.invoke());
});

test('test delete, runtime-changing rename and control-plane rename fail closed',t=>{
  const deleted=fixture(t);fs.rmSync(path.join(deleted.candidate,'tests/existing.mjs'));deleted.commit();let r=deleted.invoke();assert.equal(r.status,1);assert.match(r.stderr,/maintenance path is frozen/);
  const runtime=fixture(t);git(runtime.candidate,'mv','tests/old.mjs','tests/renamed.py');runtime.commit();r=runtime.invoke();assert.equal(r.status,1);assert.match(r.stderr,/rename or copy is forbidden/);
  const control=fixture(t);git(control.candidate,'mv','tools/maintenance/helper.mjs','tools/maintenance/renamed-helper.mjs');control.commit();r=control.invoke();assert.equal(r.status,1);assert.match(r.stderr,/maintenance authority is immutable/);
});

test('candidate restoration authority cannot self-admit unrelated code',t=>{
  const f=fixture(t);const manifest=JSON.parse(fs.readFileSync(path.join(f.candidate,restoration),'utf8'));manifest.rules.push({path:'web/rogue.mjs',operations:['M']});put(f.candidate,restoration,`${JSON.stringify(manifest)}\n`);put(f.candidate,'web/rogue.mjs','// candidate\n');f.commit();const r=f.invoke();assert.equal(r.status,1);assert.match(r.stderr,/maintenance authority is immutable/);
});

test('test-subject authority does not open unrelated runtime or mixed remediation lanes',t=>{
  const unrelated=fixture(t);put(unrelated.candidate,'web/rogue.mjs','// changed\n');unrelated.commit();let r=unrelated.invoke();assert.equal(r.status,1);assert.match(r.stderr,/maintenance path is frozen/);
  const mixed=fixture(t);put(mixed.candidate,'tests/new-subject.py','assert True\n');put(mixed.candidate,'src/verification.mjs','// remediation\n');mixed.commit();r=mixed.invoke();assert.equal(r.status,1);assert.match(r.stderr,/spans multiple authority lanes/);
});

test('PR and merge-group identities produce equivalent restoration result for a safe rename',t=>{
  const f=fixture(t);git(f.candidate,'mv','tests/old.mjs','tests/renamed.mjs');f.commit();const pr=f.invoke();pass(pr);const head=git(f.candidate,'rev-parse','HEAD');const mq=f.invoke({GITHUB_EVENT_NAME:'merge_group',ATLAS_BASE_REF:'refs/heads/main',ATLAS_EVENT_ACTION:'checks_requested',ATLAS_PR_NUMBER:'',GITHUB_SHA:head});pass(mq);assert.equal(pr.stdout,mq.stdout);
});
