import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const read=p=>fs.readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');
const queue=read('.github/workflows/merge-group-gate.yml');
const audit=read('.github/workflows/merge-authority-audit.yml');
test('current Merge Queue gate binds exact synthetic head and protected base to the maintenance validator',()=>{
 assert.match(queue,/merge_group:\s*\n\s*types: \[checks_requested\]/);
 assert.match(queue,/ATLAS_CODE_REVISION: \$\{\{ github\.event\.merge_group\.head_sha \}\}/);
 assert.match(queue,/ATLAS_PROTECTED_BASE_SHA: \$\{\{ github\.event\.merge_group\.base_sha \}\}/);
 assert.match(queue,/ref: \$\{\{ github\.event\.merge_group\.base_sha \}\}/);
 assert.match(queue,/ref: \$\{\{ github\.event\.merge_group\.head_sha \}\}/);
 assert.match(queue,/ATLAS_EVENT_ACTION: \$\{\{ github\.event\.action \}\}/);
 assert.match(queue,/ATLAS_BASE_REF: \$\{\{ github\.event\.merge_group\.base_ref \}\}/);
});
test('PR and Merge Queue both run only protected maintenance authority against inert candidate bytes',()=>{
 const command='node trusted-base/tools/maintenance/verify-maintenance-diff.mjs "$PWD/trusted-base" "$PWD/candidate"';
 for(const workflow of [queue,audit]){
  const commands=[...workflow.matchAll(/^\s+run: (.+)$/gm)].map(match=>match[1]);
  assert.deepEqual(commands,[command]);
  assert.equal((workflow.match(/persist-credentials: false/g)??[]).length,2);
  assert.match(workflow,/permissions: \{\}/);
  assert.match(workflow,/contents: read/);
  assert.doesNotMatch(workflow,/(?:contents|actions|checks|statuses|id-token):\s*write|continue-on-error:\s*true/);
  assert.doesNotMatch(workflow,/node candidate\/|docker run|npm (?:ci|test)|playwright test/);
 }
});
test('maintenance gates remain bounded with no product or historical status acceptance',()=>{
 for(const workflow of [queue,audit]){
  const timeout=Number(workflow.match(/timeout-minutes: (\d+)/)?.[1]);assert.ok(timeout>0&&timeout<=10);
  assert.doesNotMatch(workflow,/atlas-local-e2e|validateLegacyTransition|consume-protected-admission|run-protected-merge-group/);
 }
 assert.match(queue,/name: atlas-gate/);
 assert.match(audit,/name: Merge authority audit \/ protected-base validate/);
});
