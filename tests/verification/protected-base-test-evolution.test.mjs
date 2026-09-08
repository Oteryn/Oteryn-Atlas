import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {resolveDeterministicCommands} from '../../tools/verification/deterministic-execution.mjs';

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-protected-evolution-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const root=path.join(dir,'candidate'),protectedRoot=path.join(dir,'protected');
  const oldParent="import './child.mjs';\n";
  const newParent="import test from 'node:test'; test('merged parent',()=>{});\n";
  const child="import test from 'node:test'; test('protected child',()=>{});\n";
  for(const base of [root,protectedRoot]) {
    fs.mkdirSync(path.join(base,'tests'),{recursive:true});
    fs.writeFileSync(path.join(base,'tests/parent.mjs'),newParent);
    fs.writeFileSync(path.join(base,'tests/child.mjs'),child);
  }
  const entries=[['tests/parent.mjs',oldParent,['tests/child.mjs']],['tests/child.mjs',child,[]]].map(([spec,bytes,imports])=>({spec,interpreter:'node',argv:['--test',spec],sourceSha256:createHash('sha256').update(bytes).digest('hex'),imports,subprocessTests:[]}));
  return {root,protectedRoot,ownership:{schemaVersion:1,entries},catalog:{groups:{'deterministic.core':{specs:['tests/parent.mjs'],capabilities:{browser:false}}}},groupIds:['deterministic.core']};
}

test('merged protected test evolution executes without repin and grants no stale child credit',t=>{
  const value=fixture(t),before=JSON.stringify(value.ownership);
  const commands=resolveDeterministicCommands(value);
  assert.deepEqual(commands.map(c=>c.coveredSpecs).sort(),[['tests/child.mjs'],['tests/parent.mjs']]);
  assert.equal(JSON.stringify(value.ownership),before);
});

test('unreported candidate drift fails even when candidate restores historical catalog bytes',t=>{
  const value=fixture(t);
  fs.writeFileSync(path.join(value.root,'tests/parent.mjs'),"import './child.mjs';\n");
  assert.throws(()=>resolveDeterministicCommands(value),/protected base source mismatch/);
});

test('missing authenticated protected source retains hash fail-closed behavior',t=>{
  const value=fixture(t);delete value.protectedRoot;
  assert.throws(()=>resolveDeterministicCommands(value),/source proof changed/);
});

test('protected symlinks cannot authenticate an unchanged candidate',t=>{
  const value=fixture(t);
  fs.rmSync(path.join(value.protectedRoot,'tests/parent.mjs'));
  fs.symlinkSync(path.join(value.root,'tests/parent.mjs'),path.join(value.protectedRoot,'tests/parent.mjs'));
  assert.throws(()=>resolveDeterministicCommands(value),/symlink or path escape/);
});

test('missing protected source cannot be replaced with candidate or catalog authority',t=>{
  const value=fixture(t);
  fs.rmSync(path.join(value.protectedRoot,'tests/parent.mjs'));
  assert.throws(()=>resolveDeterministicCommands(value),/missing file/);
});
