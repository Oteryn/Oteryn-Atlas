import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const read=p=>fs.readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');
const workflow=read('.github/workflows/protected-admission.yml');
const resolver=workflow.match(/node --input-type=module <<'NODE'\n([\s\S]*?)          NODE/)[1].replace(/^          /gm,'');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-dispatch-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const repository='Example/Atlas',base='a'.repeat(40),head='b'.repeat(40);
 const pr={number:7,state:'open',merged:false,head:{sha:head,repo:{full_name:repository}},base:{sha:base,ref:'release/default',repo:{full_name:repository}}};
 const responses={['repos/'+repository]:{full_name:repository,default_branch:'release/default'},['repos/'+repository+'/pulls/7']:pr,['repos/'+repository+'/git/ref/heads/release%2Fdefault']:{object:{sha:base}}};
 fs.writeFileSync(path.join(dir,'gh'),'#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify(JSON.parse(process.env.MOCK_RESPONSES)[process.argv[3]]));\n',{mode:0o755});
 const event=path.join(dir,'event.json');fs.writeFileSync(event,JSON.stringify({pull_request:pr}));
 const env={...process.env,PATH:dir+path.delimiter+process.env.PATH,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:repository,INPUT_PR_NUMBER:'7',INPUT_HEAD_SHA:head,WORKFLOW_SOURCE_SHA:base,GITHUB_REF:'refs/heads/release/default',GITHUB_EVENT_PATH:event,GITHUB_OUTPUT:path.join(dir,'output')};
 return {pr,responses,env,run(){return execFileSync(process.execPath,['--input-type=module'],{input:resolver,env:{...env,MOCK_RESPONSES:JSON.stringify(responses)},stdio:['pipe','pipe','pipe']});}};
}
test('dispatch resolves exact current PR from protected default source without candidate execution',t=>{
 const f=fixture(t);f.run();assert.equal(fs.readFileSync(f.env.GITHUB_OUTPUT,'utf8'),`pr_number=7\nhead_sha=${'b'.repeat(40)}\nbase_sha=${'a'.repeat(40)}\n`);
});
for(const [name,mutate] of Object.entries({
 source:f=>f.env.WORKFLOW_SOURCE_SHA='d'.repeat(40),
 head:f=>f.env.INPUT_HEAD_SHA='d'.repeat(40),
 branch:f=>f.env.GITHUB_REF='refs/heads/candidate',
 PR:f=>f.pr.number=8,
 headRepository:f=>f.pr.head.repo.full_name='Other/Atlas',
 baseRepository:f=>f.pr.base.repo.full_name='Other/Atlas',
 protectedBase:f=>f.pr.base.sha='d'.repeat(40),
 targetBranch:f=>f.pr.base.ref='candidate',
 closed:f=>f.pr.state='closed',
 merged:f=>f.pr.merged=true,
 event:f=>f.env.GITHUB_EVENT_NAME='pull_request',
}))test(`dispatch rejects ${name} drift before publishing checkout identities`,t=>{
 const f=fixture(t);mutate(f);assert.throws(()=>f.run());assert.equal(fs.existsSync(f.env.GITHUB_OUTPUT),false);
});
test('PR event is independently checked against live head before publishing identity',t=>{
 const f=fixture(t);f.env.GITHUB_EVENT_NAME='pull_request_target';f.pr.head.sha='d'.repeat(40);assert.throws(()=>f.run());assert.equal(fs.existsSync(f.env.GITHUB_OUTPUT),false);
});
test('legacy qualification repair cannot automatically duplicate the new producer',()=>{
 const legacy=read('.github/workflows/protected-qualification-repair.yml');
 assert.match(legacy,/workflow_dispatch:/);assert.doesNotMatch(legacy,/^  (?:pull_request_target|pull_request|workflow_run|push|schedule):/m);
 assert.match(workflow,/needs: resolve-candidate/);
 assert.match(workflow,/ref: \$\{\{ needs.resolve-candidate.outputs.base_sha \}\}/);
 assert.match(workflow,/ref: \$\{\{ needs.resolve-candidate.outputs.head_sha \}\}/);
 assert.match(workflow,/run-name:.*protected-admission:\{0\}:\{1\}:\{2\}:\{3\}/);
});
