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
  assert.match(workflow, /dynamic_presentations=\{p\['outfit_presentation_id'\] for p in programs\['creature_programs'\] if p\['phase_count'\]>1 and len\(set\(p\['phase_content_ids'\]\)\)>1\}/);
  assert.match(workflow, /presentation_id\(r\) in dynamic_presentations/);
});