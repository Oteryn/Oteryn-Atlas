import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveProtectedComposeServiceImage} from '../../tools/verification/run-verification-shadow.mjs';

const composeArgs=['compose','-p','atlas-r5-test','-f','/protected/base.yml'];
const identity=`sha256:${'e'.repeat(64)}`;
const normalized='atlas-r5-test-e2e';

function runWithModel(image) {
  const calls=[];
  const run=(file,args)=>{
    calls.push([file,args]);
    if(args[0]==='image') return {status:0,signal:null,stdout:`${identity}\n`};
    if(args.includes('--images')) return {status:0,signal:null,stdout:''};
    return {status:0,signal:null,stdout:JSON.stringify({services:{e2e:{build:{context:'/candidate'},image}}})};
  };
  return {calls,run};
}

test('protected collector accepts the exact Compose-normalized default build image',()=>{
  const {calls,run}=runWithModel(normalized);
  assert.equal(resolveProtectedComposeServiceImage({composeArgs,service:'e2e',run}),identity);
  assert.deepEqual(calls,[
    ['docker',[...composeArgs,'config','--images','e2e']],
    ['docker',[...composeArgs,'config','--format','json','e2e']],
    ['docker',['image','inspect','--format','{{.Id}}',normalized]],
  ]);
});

test('protected collector still rejects a different modeled image in the build-only fallback',()=>{
  const {run}=runWithModel('mutable:tag');
  assert.throws(()=>resolveProtectedComposeServiceImage({composeArgs,service:'e2e',run}),/service image reference/);
});
