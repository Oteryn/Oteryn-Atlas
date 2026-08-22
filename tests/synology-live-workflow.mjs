import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/synology-live-acceptance.yml', import.meta.url), 'utf8');

test('Synology product validation uses the pinned Python container', () => {
  assert.match(workflow, /docker exec -i "\$python_container" sh -c 'cd \/ && python3 -' <<'PY'/);
  assert.doesNotMatch(workflow, /^\s{10}python3 - <<'PY'/m);
});
