import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/synology-live-acceptance.yml', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../tools/release/build-merged-main-release.ps1', import.meta.url), 'utf8');

test('Synology consumes exact release evidence and performs no Game/Atlas product build', () => {
  assert.match(workflow, /release-manifest\.json|manifest\.json/);
  assert.match(workflow, /artifactSha256/);
  assert.match(workflow, /sourceTreeSha256/);
  assert.doesNotMatch(workflow, /game-atlas-appearances\/export\.py/);
  assert.doesNotMatch(workflow, /build-creature-index\.py/);
  assert.doesNotMatch(workflow, /animation-runtime\/build\.py/);
  assert.doesNotMatch(workflow, /Build exact animated Game and Atlas products/);
});

test('off-Synology release builder keeps the pinned Python product oracle and deterministic A/B construction', () => {
  assert.match(builder, /python@sha256:/);
  assert.match(builder, /appearance-a/);
  assert.match(builder, /appearance-b/);
  assert.match(builder, /Assert-TreeEqual/);
  assert.match(builder, /dynamic=\{p\['outfit_presentation_id'\] for p in programs\['creature_programs'\] if p\['phase_count'\]>1 and len\(set\(p\['phase_content_ids'\]\)\)>1\}/);
  assert.match(builder, /pid\(r\) in dynamic/);
  assert.match(builder, /e2e-targets\.json/);
});
