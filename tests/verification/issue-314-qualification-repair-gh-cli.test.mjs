import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
const admission = workflow.split('      - name: Admit only exact-scope monotonic qualification repair')[1]?.split('      - name: Materialize protected execution context')[0] ?? '';

test('Issue #314: protected repair slurps paginated PR files before applying jq separately', () => {
  assert(admission.length > 0, 'protected repair admission step must exist');
  assert.doesNotMatch(admission, /gh api --paginate --slurp[\s\S]*?--jq/, 'gh api forbids combining --slurp with --jq');
  assert.match(admission, /gh api --paginate --slurp[\s\S]*?>\s*"\$pages"/);
  assert.match(admission, /jq\s+'\[\.\[\]\[\][\s\S]*?"\$pages"\s*>\s*"\$changes"/);
});
