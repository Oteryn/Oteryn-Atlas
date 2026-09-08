import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { validateImpactManifest } from '../../tools/verification/verification-plan-schema.mjs';

// Explicit legacy-schema fixture: migration must preserve these historical group names.
const catalog = {schemaVersion:2,groups:Object.fromEntries(['deterministic.core','e2e.common-smoke','e2e.creatures','visual.creatures','e2e.full'].map(id=>[id,{specs:['tests/legacy-fixture.test.mjs'],projects:[],resourceClass:'cpu-light',evidence:'machine-summary',capabilities:{browser:false,hosted:true,requiresPublication:false,dataCapability:'qualification_fixture',visualReview:false,specialistReason:null}}]))};
const protectedMainImpactV1 = {
  schemaVersion: 1,
  entries: [
    { pathPrefix: 'docs/', domains: ['documentation'], minimumProfile: 'none', requiredGroups: [] },
    { pathPrefix: 'tools/dyn-atlas-semantic/', domains: ['generator'], minimumProfile: 'focused', requiredGroups: ['deterministic.core'] },
    { pathPrefix: 'src/browser/creature-', domains: ['creatures'], minimumProfile: 'targeted', requiredGroups: ['deterministic.core', 'e2e.common-smoke', 'e2e.creatures', 'visual.creatures'] },
    { pathPrefix: 'src/browser/', domains: ['browser-runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core', 'e2e.common-smoke'] },
    { pathPrefix: 'tools/verification/', domains: ['verification-governance'], minimumProfile: 'full', requiredGroups: ['deterministic.core', 'e2e.full'] },
  ],
};

test('exact historical impact schema v1 migrates exactly to v2 with no invented cross-domain rules', () => {
  const result = validateImpactManifest(protectedMainImpactV1, catalog);
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.entries, protectedMainImpactV1.entries);
  assert.deepEqual(result.crossDomainEscalations, []);
});

test('legacy impact migration rejects any non-exact v1 policy mutation', () => {
  const narrowed = structuredClone(protectedMainImpactV1);
  narrowed.entries[4].minimumProfile = 'none';
  narrowed.entries[4].requiredGroups = [];
  assert.throws(() => validateImpactManifest(narrowed, catalog), /legacy schemaVersion 1.*exact known protected manifest/i);
});
