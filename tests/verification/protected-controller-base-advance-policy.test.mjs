import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-verification-controller.yml'), 'utf8').replace(/\r\n/g, '\n');

test('base-advance controller safely inherits protected planning policy when a long-lived candidate predates policy files', () => {
  assert.match(workflow, /git cat-file -e "\$ATLAS_CANDIDATE_HEAD_SHA:\$path"/);
  assert.match(workflow, /artifacts\/protected-controller\/changed-files\.json "\$path"/);
  assert.match(workflow, /Candidate changed or removed protected planning policy/);
  assert.match(workflow, /cp "\$trusted" "\$target"/);
  assert.match(workflow, /snapshot_candidate_policy tools\/verification\/impact-manifest\.json/);
  assert.match(workflow, /snapshot_candidate_policy tools\/verification\/verification-catalog\.json/);
});
