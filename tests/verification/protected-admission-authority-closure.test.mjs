import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildVerificationAuthorityIdentity} from '../../tools/verification/verification-authority.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/verification/verification-authority-manifest.json')));
const required=[
 'tools/verification/build-verification-plan.mjs',
 'tools/verification/verification-plan-schema.mjs',
 'tools/verification/verification-execution-contract.mjs',
 'tools/verification/proof-provenance.mjs',
 'tools/verification/complete-product-proof.mjs',
 'tools/verification/protected-candidate-snapshot.mjs',
 'tools/verification/protected-review-evidence.mjs',
 'tools/verification/deterministic-execution.mjs',
 'tools/verification/browser-execution.mjs',
 'tools/verification/verification-authority.mjs',
 'tools/verification/impact-manifest.json',
 'tools/verification/verification-catalog.json',
 'tools/verification/deterministic-test-ownership.json',
 'tools/verification/browser-semantic-ownership.json',
 'tools/verification/restoration-contract-ownership.json',
];
const read=relative=>fs.readFileSync(path.join(root,relative));
const declared=new Set(manifest.components.map(row=>row.path));

test('actual protected authority manifest covers the current execution chain and every declared byte exists',async()=>{
 for(const relative of required)assert.ok(declared.has(relative),`missing current authority component: ${relative}`);
 for(const {path:relative}of manifest.components){
  const file=path.join(root,relative),stat=fs.lstatSync(file);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink(),`authority must be a regular file: ${relative}`);
 }
 const identity=await buildVerificationAuthorityIdentity({manifest,readFile:read});
 assert.equal(identity.components.length,manifest.components.length);
 assert.match(identity.authorityDigest,/^sha256:[0-9a-f]{64}$/);
});

test('every static local JavaScript import in the authority closure is declared',()=>{
 for(const {path:relative}of manifest.components.filter(row=>/\.(?:mjs|js)$/.test(row.path))){
  const source=read(relative).toString('utf8');
  const imports=[...source.matchAll(/^\s*(?:import|export)\s+(?:[^;'"\n]*(?:\n[^;'"\n]*)*?\s+from\s*)?['"](\.[^'"]+)['"]/gm),...source.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g)];
  for(const match of imports){
   const target=path.resolve(root,path.dirname(relative),match[1].split(/[?#]/)[0]);
   const dependency=path.relative(root,target).split(path.sep).join('/');
   assert.ok(!dependency.startsWith('../')&&fs.existsSync(target),`unresolved local import ${relative} -> ${match[1]}`);
   assert.ok(declared.has(dependency),`authority import escapes manifest: ${relative} -> ${dependency}`);
  }
 }
});

test('resolvable repository-local Python imports are declared without executing Python components',()=>{
 const components=manifest.components.filter(row=>row.path.endsWith('.py')).map(row=>({path:row.path,source:read(row.path).toString('utf8')}));
 const script=`import ast,json,sys
rows=json.load(sys.stdin)
result=[]
for row in rows:
 for node in ast.walk(ast.parse(row['source'],filename=row['path'])):
  if isinstance(node,ast.Import):
   result.extend({'path':row['path'],'module':alias.name,'level':0} for alias in node.names)
  elif isinstance(node,ast.ImportFrom):
   result.append({'path':row['path'],'module':node.module or '', 'level':node.level})
   result.extend({'path':row['path'],'module':'.'.join(filter(None,[node.module,alias.name])),'level':node.level} for alias in node.names if alias.name!='*')
print(json.dumps(result))`;
 const imports=JSON.parse(execFileSync('python3',['-c',script],{input:JSON.stringify(components),encoding:'utf8'}));
 for(const entry of imports){
  let containing=path.dirname(path.join(root,entry.path));
  for(let i=1;i<entry.level;i++)containing=path.dirname(containing);
  const locations=entry.level?[containing]:[containing,root];
  for(const location of locations){
   const modulePath=path.join(location,...entry.module.split('.').filter(Boolean));
   for(const target of [modulePath+'.py',path.join(modulePath,'__init__.py')])if(fs.existsSync(target)){
    const dependency=path.relative(root,target).split(path.sep).join('/');
    assert.ok(!dependency.startsWith('../')&&declared.has(dependency),`authority Python import escapes manifest: ${entry.path} -> ${dependency}`);
   }
  }
 }
});

test('unavailable protected source rejects identity and changed execution bytes invalidate identity',async()=>{
 const relative='tools/verification/verification-execution-contract.mjs';
 assert.ok(declared.has(relative),`missing current authority component: ${relative}`);
 const original=await buildVerificationAuthorityIdentity({manifest,readFile:read});
 const changed=await buildVerificationAuthorityIdentity({manifest,readFile:p=>p===relative?Buffer.concat([read(p),Buffer.from('\n// changed execution contract')]):read(p)});
 assert.notEqual(changed.authorityDigest,original.authorityDigest);
 await assert.rejects(buildVerificationAuthorityIdentity({manifest,readFile:p=>{if(p===relative)throw Error('protected source unavailable');return read(p);}}),error=>error.message.includes(relative)&&error.message.includes('unreadable or missing'));
});
