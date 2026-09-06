import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../../',import.meta.url);
const paths=[
 '.github/workflows/merge-authority-audit.yml','.github/workflows/merge-group-gate.yml',
 '.github/workflows/protected-admission.yml','.github/workflows/protected-main-depth.yml',
 ...['consume-protected-admission.mjs','protected-admission-evidence.mjs','protected-admission-policy.mjs',
 'protected-bounded-oracle.mjs','protected-candidate-snapshot.mjs','protected-qualification-oracle.mjs',
 'protected-routing.json','protected-scenario-inventory.json','protected-scenario-properties.json',
 'protected-semantic-routing.mjs','protected-workflow-configuration.json','protected-workflow-contract.mjs',
 'qualification-scenario-bindings.mjs','run-protected-admission.mjs','run-protected-authority-audit.mjs',
 'run-protected-main-depth.mjs','run-protected-merge-group.mjs'].map(p=>'tools/verification/'+p),
];
test('authority identity covers shared producer consumers and immutable oracle routing closure',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('tools/verification/verification-authority-manifest.json',root)));
 for(const path of paths){assert.ok(manifest.components.some(row=>row.path===path),path);assert.ok(fs.statSync(new URL(path,root)).isFile());}
});
