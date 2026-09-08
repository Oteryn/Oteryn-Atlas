import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const active='.github/workflows/verification-shadow.yml',template='tools/maintenance/verification-shadow.yml';
const git=(root,...args)=>execFileSync('git',['-C',root,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const put=(root,name,bytes)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),bytes);};
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-r4-admission-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const trusted=path.join(directory,'trusted'),candidate=path.join(directory,'candidate');fs.mkdirSync(trusted);git(trusted,'init','-q');
 for(const name of [template,'tools/maintenance/verify-maintenance-diff.mjs',...['merge-authority-audit','merge-group-gate','terminal-branch-lifecycle'].map(n=>`.github/workflows/${n}.yml`),...['ATLAS_VERIFICATION_RESTORATION_ALLOWLIST','ATLAS_REMEDIATION_ALLOWLIST','OBSOLETE_VERIFICATION_CONTRACTS'].map(n=>`docs/maintenance/${n}.json`)])put(trusted,name,fs.readFileSync(path.join(root,name)));
 git(trusted,'add','.');git(trusted,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','base');
 const base=git(trusted,'rev-parse','HEAD');git(trusted,'worktree','add','-q','-b','candidate',candidate,'HEAD');put(candidate,active,fs.readFileSync(path.join(trusted,template)));
 const invoke=()=>{git(candidate,'add','-A');git(candidate,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','candidate');const head=git(candidate,'rev-parse','HEAD');return ['pull_request_target','merge_group'].map(event=>spawnSync(process.execPath,[path.join(trusted,'tools/maintenance/verify-maintenance-diff.mjs'),trusted,candidate],{encoding:'utf8',env:{...process.env,GITHUB_REPOSITORY:'Oteryn/Oteryn-Atlas',ATLAS_EVENT_REPOSITORY:'Oteryn/Oteryn-Atlas',ATLAS_DEFAULT_BRANCH:'main',GITHUB_EVENT_NAME:event,ATLAS_EVENT_ACTION:event==='merge_group'?'checks_requested':'synchronize',ATLAS_BASE_REF:event==='merge_group'?'refs/heads/main':'main',ATLAS_PR_NUMBER:'7',GITHUB_SHA:head,ATLAS_CODE_REVISION:head,ATLAS_PROTECTED_BASE_SHA:base}}));};
 return {trusted,candidate,invoke};
}
test('only exact protected fourth workflow is admitted equally for PR and MQ',t=>{
 const f=fixture(t);put(f.candidate,'docs/maintenance/r4-note.md','Shadow only.\n');const results=f.invoke();for(const r of results){assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/verification-shadow-activation/);}assert.equal(results[0].stdout,results[1].stdout);
});
for(const [name,mutate] of Object.entries({
 byteDrift:f=>fs.appendFileSync(path.join(f.candidate,active),'# drift\n'),
 extraWorkflow:f=>put(f.candidate,'.github/workflows/rogue.yml','name: rogue\n'),
 removedRetained:f=>fs.unlinkSync(path.join(f.candidate,'.github/workflows/merge-group-gate.yml')),
 changedRetained:f=>fs.appendFileSync(path.join(f.candidate,'.github/workflows/merge-authority-audit.yml'),'# drift\n'),
 selfTemplate:f=>fs.appendFileSync(path.join(f.candidate,template),'# drift\n'),
 selfValidator:f=>fs.appendFileSync(path.join(f.candidate,'tools/maintenance/verify-maintenance-diff.mjs'),'// drift\n'),
 unrelatedCode:f=>put(f.candidate,'web/unlisted.mjs','export {};\n'),
 archivedChange:f=>put(f.candidate,'docs/maintenance/suspended-workflows/rogue.yml','name: rogue\n'),
 renamedActivation:f=>fs.renameSync(path.join(f.candidate,active),path.join(f.candidate,'.github/workflows/renamed-shadow.yml')),
}))test(`shadow admission rejects ${name} for PR and MQ`,t=>{const f=fixture(t);mutate(f);for(const r of f.invoke())assert.equal(r.status,1,r.stdout);});
