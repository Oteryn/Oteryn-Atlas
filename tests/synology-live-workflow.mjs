import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/synology-live-acceptance.yml', import.meta.url), 'utf8');
const livePreview = readFileSync(new URL('../e2e/tests/live-creature-preview.cjs', import.meta.url), 'utf8');

test('Synology product validation uses the pinned Python container', () => {
  assert.match(workflow, /docker exec -i "\$python_container" sh -c 'cd \/ && python3 -' <<'PY'/);
  assert.doesNotMatch(workflow, /^\s{10}python3 - <<'PY'/m);
});

test('live creature fixtures are selected from visually dynamic published programs', () => {
  assert.match(workflow, /programs=json\.loads\(Path\('animation-runtime-a\/programs\.json'\)\.read_text\(\)\)/);
  assert.match(workflow, /dynamic_presentations=\{p\['outfit_presentation_id'\] for p in programs\['creature_programs'\] if p\['phase_count'\]>1 and len\(set\(p\['phase_content_ids'\]\)\)>1\}/);
  assert.match(workflow, /presentation_id\(r\) in dynamic_presentations/);
});

test('merged-main live acceptance verifies exact creature gameplay publication', () => {
  assert.match(workflow, /web\/creature-gameplay\/manifest\.json/);
  assert.match(workflow, /sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28/);
  assert.match(workflow, /1049/);
  assert.match(workflow, /1800/);
});

test('live Chromium enters Gameplay and proves real Sam trade plus Rat loot', () => {
  assert.match(livePreview, /npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e/);
  assert.match(livePreview, /monster-entity:80295e51265b3662bfbea2ea01ee3ccb/);
  assert.match(livePreview, /20 gold/);
  assert.match(livePreview, /gold coin/);
  assert.match(livePreview, /100%/);
  assert.match(livePreview, /inspector.*gameplay/i);
});
