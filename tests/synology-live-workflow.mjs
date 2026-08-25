import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/synology-live-acceptance.yml', import.meta.url), 'utf8');

test('Synology product validation uses the pinned Python container', () => {
  assert.match(workflow, /docker exec -i "\$python_container" sh -c 'cd \/ && python3 -' <<'PY'/);
  assert.doesNotMatch(workflow, /^\s{10}python3 - <<'PY'/m);
});

test('live creature fixtures are selected from visually dynamic published programs', () => {
  assert.match(workflow, /programs=json\.loads\(Path\('animation-runtime-a\/programs\.json'\)\.read_text\(\)\)/);
  assert.match(workflow, /dynamic_presentations=\{/);
  assert.match(workflow, /if p\.get\('walking_program'\) is not None/);
  assert.match(workflow, /p\['walking_program'\]\['phase_count'\]>1/);
  assert.match(workflow, /len\(set\(p\['walking_program'\]\['phase_content_ids'\]\)\)>1/);
  assert.match(workflow, /presentation_id\(r\) in dynamic_presentations/);
});