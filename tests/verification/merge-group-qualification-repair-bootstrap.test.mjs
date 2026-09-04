import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github/workflows/merge-group-gate.yml'), 'utf8');

function stepBody(name) {
  const marker = `      - name: ${name}\n`;
  const start = WORKFLOW.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = WORKFLOW.indexOf('\n      - name: ', start + marker.length);
  return WORKFLOW.slice(start, next === -1 ? WORKFLOW.length : next);
}

test('merge queue consumes exact protected qualification repair evidence before stale-base full fixture proof', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  const full = stepBody('Prove complete protected-base browser qualification for synthetic candidate');

  assert.match(repair, /validateProtectedProductQualificationGate/);
  assert.match(repair, /validateQualificationRepairTransition/);
  assert.match(repair, /pulls\/\$ATLAS_PR_NUMBER/);
  assert.match(repair, /git\/commits\/\$ATLAS_CODE_REVISION/);
  assert.match(repair, /git\/commits\/\$candidate_head_sha/);
  assert.match(repair, /candidateTreeSha|candidate_tree_sha/);
  assert.match(repair, /syntheticTreeSha|synthetic_tree_sha/);
  assert.match(repair, /use_repair_proof=true/);
  assert.doesNotMatch(repair, /fix\/issue-|ATLAS_REPAIR_PR_NUMBER|pull_request\.number\s*==/);

  assert.match(full, /steps\.qualification-repair\.outputs\.use_repair_proof != 'true'/);
  assert.ok(
    WORKFLOW.indexOf('Validate exact protected qualification repair bootstrap evidence')
      < WORKFLOW.indexOf('Prove complete protected-base browser qualification for synthetic candidate'),
    'repair evidence must be checked before stale-base full qualification',
  );
});
