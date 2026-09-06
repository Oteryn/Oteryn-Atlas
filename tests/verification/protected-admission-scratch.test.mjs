import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {candidateSandboxArgs} from '../../tools/verification/run-protected-admission.mjs';

test('sandbox binds temporary executable fixtures to its existing isolated output without relaxing noexec',()=>{
  const args=candidateSandboxArgs({source:'/source',output:'/isolated-output',script:'/proof.mjs'});
  assert.deepEqual(args.flatMap((value,index)=>value==='--env'?[args[index+1]]:[]),['TMPDIR=/out']);
  assert.equal(args[args.indexOf('--tmpfs')+1],'/tmp:rw,nosuid,nodev,size=256m');
  assert.equal(args[args.indexOf('--network')+1],'none');
  assert.ok(args.includes('--read-only'));
  assert.ok(args.includes('no-new-privileges'));
  assert.ok(args.includes('type=bind,src=/source,dst=/candidate,readonly'));
  assert.ok(args.includes('type=bind,src=/isolated-output,dst=/out'));
});

test('generated candidate test child preserves only protected scratch and interpreter bindings',()=>{
  const source=fs.readFileSync(new URL('../../tools/verification/run-protected-admission.mjs',import.meta.url),'utf8');
  const match=source.match(/execFileSync\('node',\['--test',\.\.\.files\],[^\n]*env:(\{[^\n]*?\})\}\);/);
  assert.ok(match,'candidate test execution must declare a bounded child environment');
  const actual=vm.runInNewContext('('+match[1]+')',{process:{env:{PATH:'/trusted/bin',GH_TOKEN:'must-not-propagate',TMPDIR:'/attacker'}}});
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),{PATH:'/tmp/bin:/trusted/bin',PYTHONPYCACHEPREFIX:'/tmp/pycache',TMPDIR:'/out'});
});
