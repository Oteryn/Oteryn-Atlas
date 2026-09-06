import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const head='a'.repeat(40),base='b'.repeat(40);
const source=fs.readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');
const step=source.split('      - name: Classify exact PR changed paths\n')[1].split('\n      - name: Publish shadow verification plan')[0].split('        run: |\n')[1].replace(/^          /gm,'');
const beforePlanner=step.split('mkdir -p artifacts/verification')[0];
const finalFence=step.match(/^test "\$\(read_current_pr\)" = "\$initial_pr_identity"$/m)?.[0]??'';
function execute(t,mutate=()=>{}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-review-classifier-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const pr={number:7,state:'open',merged:false,head:{sha:head,repo:{full_name:'Example/Atlas'}},base:{sha:base,ref:'main',repo:{full_name:'Example/Atlas'}},changed_files:1};
  // GitHub review events legitimately omit changed_files; live PR metadata owns it.
  const event={action:'submitted',review:{commit_id:head,state:'commented'},pull_request:structuredClone(pr)};delete event.pull_request.changed_files;
  const config={pr,finalPr:structuredClone(pr),rows:'README.md\t\n'};mutate(config);
  const configPath=path.join(directory,'case.json');fs.writeFileSync(configPath,JSON.stringify(config));
  fs.writeFileSync(path.join(directory,'gh'),`#!/usr/bin/env node
const fs=require('fs'),c=JSON.parse(fs.readFileSync(process.env.ATLAS_TEST_CASE));
if(process.argv.slice(2).find(arg=>arg.startsWith('repos/')).includes('/files?'))process.stdout.write(c.rows);
else {const p=process.env.ATLAS_TEST_CASE+'.count',n=fs.existsSync(p)?Number(fs.readFileSync(p)):0;fs.writeFileSync(p,String(n+1));process.stdout.write(JSON.stringify(n?c.finalPr:c.pr));}
`,{mode:0o755});
  fs.writeFileSync(path.join(directory,'git'),`#!/usr/bin/env node
const a=process.argv.slice(2);
if(a[0]==='rev-parse')process.stdout.write(a[1]==='HEAD'?'${head}':'${base}');
else if(a[0]==='merge-base')process.stdout.write('${base}');
else if(a[0]==='diff')process.stdout.write('M\\0README.md\\0');
else if(a[0]==='show')process.stdout.write('{}');
else if(!['fetch','cat-file'].includes(a[0]))process.exit(2);
`,{mode:0o755});
  const env={...process.env,PATH:directory+path.delimiter+process.env.PATH,GITHUB_EVENT_NAME:'pull_request_review',GITHUB_REPOSITORY:'Example/Atlas',ATLAS_PR_NUMBER:String(event.pull_request.number),ATLAS_CODE_REVISION:event.pull_request.head.sha,ATLAS_INTEGRATION_BASE_REF:event.pull_request.base.ref,ATLAS_INTEGRATION_BASE_SHA:event.pull_request.base.sha,ATLAS_CHANGED_FILE_COUNT:event.pull_request.changed_files??'',ATLAS_TEST_CASE:configPath};
  const result=spawnSync('bash',['-c',beforePlanner+'\n'+finalFence+'\nprintf "CLASSIFIED\\n"'],{cwd:directory,env,encoding:'utf8'});
  return result;
}
test('actual classifier accepts review payload without changed_files using live PR metadata',t=>{
  const result=execute(t);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/CLASSIFIED/);
});
for(const [name,mutate] of Object.entries({
  'wrong live head':c=>c.pr.head.sha='c'.repeat(40),
  'wrong live base':c=>c.pr.base.sha='c'.repeat(40),
  'wrong repository':c=>c.pr.head.repo.full_name='Other/Atlas',
  'wrong PR':c=>c.pr.number=8,
  'closed PR':c=>c.pr.state='closed',
  'incomplete changed-file count':c=>c.pr.changed_files=2,
  'invalid changed-file count':c=>c.pr.changed_files=null,
  'head drift before publication':c=>c.finalPr.head.sha='c'.repeat(40),
  'base drift before publication':c=>c.finalPr.base.sha='c'.repeat(40),
  'count drift before publication':c=>c.finalPr.changed_files=2,
}))test(`actual classifier rejects ${name}`,t=>{const result=execute(t,mutate);assert.notEqual(result.status,0);assert.doesNotMatch(result.stdout,/CLASSIFIED/);});
