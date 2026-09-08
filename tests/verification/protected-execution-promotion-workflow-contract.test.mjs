import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {candidateSandboxArgs,CANDIDATE_IMAGE} from '../../tools/verification/run-protected-admission.mjs';
import {buildProtectedExecutionEnvironmentIdentity} from '../../tools/verification/protected-execution-environment.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../../tools/verification/protected-execution-environment.json',import.meta.url)));
test('candidate proof runs with a pinned image and immutable script and candidate mounts',()=>{
 const args=candidateSandboxArgs({source:'/exact-candidate',output:'/proof-output',script:'/protected-proof.mjs'});
 assert.match(CANDIDATE_IMAGE,/@sha256:[0-9a-f]{64}$/);assert.ok(args.includes(CANDIDATE_IMAGE));
 assert.ok(args.includes('type=bind,src=/exact-candidate,dst=/candidate,readonly'));
 assert.ok(args.includes('type=bind,src=/protected-proof.mjs,dst=/run-proof.mjs,readonly'));
 assert.deepEqual(args.slice(-2),['node','/run-proof.mjs']);
 assert.ok(!args.some(arg=>/TOKEN|SECRET|docker.sock/.test(arg)));
 for(const [flag,value]of [['--network','none'],['--cap-drop','ALL'],['--security-opt','no-new-privileges'],['--user','1000:1000']])assert.equal(args[args.indexOf(flag)+1],value);
});
test('protected runtime keeps Python compatibility in writable tmp and rejects candidate sandbox weakening',()=>{
 const identity=buildProtectedExecutionEnvironmentIdentity(config);
 assert.equal(identity.config.runtime.python.target,'/usr/bin/python3');
 assert.match(identity.config.runtime.python.shimRoot,/^\/tmp\//);assert.match(identity.config.runtime.python.pycacheRoot,/^\/tmp\//);
 assert.equal(identity.config.mounts.dependencies.readOnly,true);assert.equal(identity.config.execution.retries,0);
 for(const mutate of [c=>c.container.network='host',c=>c.container.user='0:0',c=>c.container.capDrop=[],c=>c.mounts.candidate.readOnly=false,c=>c.execution.retries=1]){
  const bad=structuredClone(config);mutate(bad);assert.throws(()=>buildProtectedExecutionEnvironmentIdentity(bad));
 }
});
