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
  assert.match(workflow, /Stage exact merged main candidate/);
  assert.match(workflow, /Atomically publish and cut over qualified animated candidate/);
  assert.match(workflow, /CANDIDATE_CONTAINER/);
  assert.match(workflow, /deployment-rollback=PASS/);
});

test('repository policy forbids live deployment from task branches or dirty worktrees', () => {
  assert.match(agents, /Live Atlas deployments originate only from merged `main`/);
  assert.match(agents, /task branches.*must never be deployed/i);
  assert.match(agents, /dirty working trees.*must never be deployed/i);
  assert.match(agents, /deployed revision.*container.*header/i);
});

test('failed live acceptance restores the previous exact revision without assuming the previous creature catalog is absent', () => {
  const dollar = String.fromCharCode(36);
  assert.ok(workflow.includes('previous_revision=' + dollar + 'OLD_REV'));
  assert.ok(workflow.includes('PREVIOUS_REVISION: ' + dollar + '{{ steps.product.outputs.previous_revision }}'));
  assert.match(workflow, /deployment-rollback-revision=PASS/);
  assert.doesNotMatch(workflow, /atlas-after-rollback/);
});

test('live Chromium acceptance is isolated from host network churn', () => {
  const start = workflow.indexOf('- name: Run live desktop and mobile Chromium E2E');
  const end = workflow.indexOf('- name: Publish bounded browser evidence', start);
  assert.ok(start >= 0 && end > start);
  const e2eStep = workflow.slice(start, end);
  assert.doesNotMatch(e2eStep, /--network host/);
  assert.match(e2eStep, /--network bridge/);
  assert.match(e2eStep, /-e "PREVIEW_URL=\$PREVIEW_URL"/);
});

test('live cutover waits for staged and qualified animation products', () => {
  const stagedAnimation = workflow.indexOf('tar -C animation-runtime-a -cf - .');
  const candidateAnimation = workflow.indexOf('http://192.168.1.2:18098/fullworld/animation/manifest.json');
  const liveStop = workflow.indexOf('docker stop "$C" >/dev/null');
  assert.notEqual(stagedAnimation, -1, 'animation staging command must exist');
  assert.notEqual(candidateAnimation, -1, 'candidate animation verification must exist');
  assert.notEqual(liveStop, -1, 'live cutover command must exist');
  assert.ok(candidateAnimation > stagedAnimation, 'candidate animation must be verified after staging');
  assert.ok(liveStop > candidateAnimation, 'live container must remain untouched until candidate product verification passes');
});

test('same-revision reruns stage into a run-scoped root without deleting the live revision root', () => {
  assert.match(workflow, /NEW_ROOT="\$REVISION_ROOT\/\.staged-\$\{ATLAS_REV\}-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}"/);
  assert.doesNotMatch(workflow, /rm -rf \/revisions\/\$ATLAS_REV/);
  assert.match(workflow, /staged-root-cleanup=PASS/);
});
