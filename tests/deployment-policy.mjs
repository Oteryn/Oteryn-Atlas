import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/synology-live-acceptance.yml', 'utf8');
const agents = readFileSync('AGENTS.md', 'utf8');

test('live Atlas deployment is bound to the triggering main SHA', () => {
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.doesNotMatch(workflow.slice(0, workflow.indexOf('permissions:')), /^\s+paths:/m);
  assert.match(workflow, /if:\s*github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ATLAS_REV:\s*\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /^\s+ATLAS_REV:\s*[0-9a-f]{40}\s*$/m);
  assert.match(workflow, /main-only deployment authority=PASS/);
  assert.match(workflow, /test "\$GITHUB_REF" = 'refs\/heads\/main'/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$ATLAS_REV"/);
  assert.match(workflow, /Atomically deploy exact merged main/);
  assert.match(workflow, /CANDIDATE_CONTAINER/);
  assert.match(workflow, /deployment-rollback=PASS/);
});

test('repository policy forbids live deployment from task branches or dirty worktrees', () => {
  assert.match(agents, /Live Atlas deployments originate only from merged `main`/);
  assert.match(agents, /task branches.*must never be deployed/i);
  assert.match(agents, /dirty working trees.*must never be deployed/i);
  assert.match(agents, /deployed revision.*container.*header/i);
});
