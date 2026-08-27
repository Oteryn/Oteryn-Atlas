import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/creature-overlays.yml'), 'utf8');

test('creature overlay workflow validates the current qualification-aware trust seam instead of stale generated constants', () => {
  assert.doesNotMatch(workflow, /EXPECTED_SEMANTIC_DIGEST|EXPECTED_CAPABILITY|EXPECTED_NPC_ROLE_SCHEMA/,
    'workflow must not pin removed browser-local generated constants');
  assert.match(workflow, /qualification-creature-browser-wiring\.test\.mjs/);
  assert.match(workflow, /qualification-creature-source-trust\.test\.mjs/);
  assert.match(workflow, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/);
  assert.match(workflow, /validateCreaturePublicationSource/);
});

test('creature overlay workflow preserves browser/deep-link and legacy-input fail-closed checks', () => {
  for (const boundary of [
    'getAnimationRuntime',
    "NPC_BADGE_STYLE = 'functional-icons-v2'",
    'createCreaturePresentationController',
    'npc-role-filter',
    '__OTERYN_ATLAS_CREATURES__',
    "panel.id = 'creature-inspector'",
    "params.set('creature', item.record_id)",
    'MAX_CACHE_CHUNKS',
  ]) assert.ok(workflow.includes(boundary), `missing creature overlay boundary check: ${boundary}`);
  assert.match(workflow, /Browser creature consumer must not reference legacy world inputs/);
});
