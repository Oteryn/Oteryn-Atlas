export const PRODUCTION_FULLWORLD_TRUST = Object.freeze({
  gameSha: 'f79fd3b5c239fa13810338f1380539c4eac67d7d',
  publicationRoot: 'sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f',
  semanticRoot: 'sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9',
  pixelRoot: 'sha256:8b8228fcc4574903e547cb7d65b96f3d45e5a9e67045091c1bceb6e54d3690ad',
  overviewRoot: 'sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db',
  minimapRoot: 'sha256:23f4d2c3901673fb38980e2600828145a6d0626c0e44d1d9f5ca23bfbce02268',
  runtimeIndexRoot: 'sha256:fa30ae5fc47f0ca8a6d482ed87b5db2cd74f32f7f523df16187ca719b8e04f08',
  pixelBucketRoot: 'sha256:99cf23b01a0d652ff670a994a2b80cbef8d17036f514522d47f1aa98352d3116',
  sourceFingerprint: 'sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9',
});

const QUALIFICATION_TRUST_MARKER = 'oteryn-atlas-qualification-trust-v1';
const QUALIFICATION_FIXTURE_ID = 'atlas-qualification-world-v2';
const BOUNDED_REAL_TRUST_MARKER = 'oteryn-atlas-bounded-real-trust-v1';
const BOUNDED_REAL_FIXTURE_ID = 'atlas-bounded-real-world-v1';
const BOUNDED_REAL_SOURCE_CONTRACT = 'oteryn-atlas-bounded-real-runtime-v1';
const BOUNDED_REAL_CREATURE_CAPABILITY = 'bounded-real-creatures-v1';
const BOUNDED_REAL_GAME_SHA = 'bounded-fixture';
const CONTENT_ID = /^sha256:[0-9a-f]{64}$/;
const TRUST_ID_FIELDS = Object.freeze([
  'publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'minimapRoot',
  'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint', 'productDigest',
]);
const TRUST_DESCRIPTOR_KEYS = Object.freeze([
  'marker', 'fixtureId', 'dataCapability', ...TRUST_ID_FIELDS,
]);

function invalidQualificationTrust(detail) {
  throw new TypeError(`qualification trust invalid: ${detail}`);
}
function validateExactDescriptor(candidate) {
  const actualKeys = Object.keys(candidate).sort();
  const expectedKeys = [...TRUST_DESCRIPTOR_KEYS].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) invalidQualificationTrust('descriptor fields mismatch');
}
function validateRoots(candidate) {
  for (const field of TRUST_ID_FIELDS) {
    if (!CONTENT_ID.test(candidate[field])) invalidQualificationTrust(`${field} must be a sha256 content id`);
  }
}
function validateQualificationIdentity(candidate, { exactDescriptor = false } = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) invalidQualificationTrust('descriptor must be an object');
  if (candidate.fixtureId !== QUALIFICATION_FIXTURE_ID) invalidQualificationTrust('fixture identity mismatch');
  if (candidate.dataCapability !== 'qualification_fixture') invalidQualificationTrust('data capability mismatch');
  if (exactDescriptor) validateExactDescriptor(candidate);
  validateRoots(candidate);
  return candidate;
}
function validateBoundedRealIdentity(candidate, { exactDescriptor = false } = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) invalidQualificationTrust('descriptor must be an object');
  if (candidate.fixtureId !== BOUNDED_REAL_FIXTURE_ID) invalidQualificationTrust('bounded-real fixture identity mismatch');
  if (candidate.dataCapability !== 'bounded_real_world') invalidQualificationTrust('bounded-real data capability mismatch');
  if (exactDescriptor) validateExactDescriptor(candidate);
  validateRoots(candidate);
  return candidate;
}

function qualificationRuntimeTrust(candidate) {
  return Object.freeze({
    gameSha: 'fixture',
    publicationRoot: candidate.publicationRoot,
    semanticRoot: candidate.semanticRoot,
    pixelRoot: candidate.pixelRoot,
    overviewRoot: candidate.overviewRoot,
    minimapRoot: candidate.minimapRoot,
    runtimeIndexRoot: candidate.runtimeIndexRoot,
    pixelBucketRoot: candidate.pixelBucketRoot,
    sourceFingerprint: candidate.sourceFingerprint,
    qualificationFixtureId: candidate.fixtureId,
    qualificationProductDigest: candidate.productDigest,
  });
}
function boundedRealRuntimeTrust(candidate) {
  return Object.freeze({
    gameSha: BOUNDED_REAL_GAME_SHA,
    publicationRoot: candidate.publicationRoot,
    semanticRoot: candidate.semanticRoot,
    pixelRoot: candidate.pixelRoot,
    overviewRoot: candidate.overviewRoot,
    minimapRoot: candidate.minimapRoot,
    runtimeIndexRoot: candidate.runtimeIndexRoot,
    pixelBucketRoot: candidate.pixelBucketRoot,
    sourceFingerprint: candidate.sourceFingerprint,
    boundedRealFixtureId: candidate.fixtureId,
    boundedRealProductDigest: candidate.productDigest,
  });
}

export function resolveQualificationManifestTrust(candidate) {
  return qualificationRuntimeTrust(validateQualificationIdentity(candidate));
}
export function resolveBoundedRealManifestTrust(candidate) {
  return boundedRealRuntimeTrust(validateBoundedRealIdentity(candidate));
}

export function resolveFullWorldTrust(scope = globalThis) {
  const candidate = scope?.__OTERYN_ATLAS_QUALIFICATION_TRUST__;
  if (candidate == null) return PRODUCTION_FULLWORLD_TRUST;
  if (candidate.marker === QUALIFICATION_TRUST_MARKER) {
    validateQualificationIdentity(candidate, { exactDescriptor: true });
    return qualificationRuntimeTrust(candidate);
  }
  if (candidate.marker === BOUNDED_REAL_TRUST_MARKER) {
    validateBoundedRealIdentity(candidate, { exactDescriptor: true });
    return boundedRealRuntimeTrust(candidate);
  }
  invalidQualificationTrust('marker mismatch');
}

export const FULLWORLD_TRUST = resolveFullWorldTrust();

const QUALIFICATION_SOURCE_CONTRACT = 'oteryn-atlas-qualification-fixture-v1';
const PRODUCTION_ANCILLARY_SOURCES = Object.freeze({
  mode: 'production',
  animation: Object.freeze({ gameSha: '8f6a4fdea4487a61c4cdaf1889d421ecd2265a31', appearanceProductRoot: 'sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1', outfitSpatialProductRoot: 'sha256:62fdd7d0ce02652582f03bf971455f4a2f9ec1e472eaebfec5af739cf11a921e' }),
  creatures: Object.freeze({ contractId: 'oteryn-game-atlas-export-v1', capability: 'animated-creatures-v1', semanticDigest: 'sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8', npcRoleSchemaVersion: 1 }),
  semanticSearch: Object.freeze({ authority: 'Oteryn/Oteryn-Game', repository: 'Oteryn/Oteryn-Game', contractId: 'oteryn-game-atlas-export-v1', capability: 'semantic-search-source-v1', profileId: 'oteryn-game-atlas-semantic-search-v1', creatureContractId: 'oteryn-game-atlas-export-v1', creatureCapability: 'static-creatures-v1', creatureSemanticDigest: 'sha256:81505e91d7089f91e71813ec43f97118932db9cc7fd76d291fa399447ee2dfa4' }),
});

export function ancillarySourceExpectations(trust = PRODUCTION_FULLWORLD_TRUST) {
  if (trust?.boundedRealFixtureId === BOUNDED_REAL_FIXTURE_ID) {
    if (!CONTENT_ID.test(trust.semanticRoot) || !CONTENT_ID.test(trust.pixelRoot)) invalidQualificationTrust('ancillary source roots are not bounded-real-bound');
    return Object.freeze({
      mode: 'bounded_real_world', contractId: BOUNDED_REAL_SOURCE_CONTRACT,
      animation: Object.freeze({ gameSha: BOUNDED_REAL_GAME_SHA, appearanceProductRoot: trust.pixelRoot, outfitSpatialProductRoot: trust.semanticRoot }),
      creatures: Object.freeze({ contractId: BOUNDED_REAL_SOURCE_CONTRACT, capability: BOUNDED_REAL_CREATURE_CAPABILITY, semanticDigest: PRODUCTION_ANCILLARY_SOURCES.semanticSearch.creatureSemanticDigest, npcRoleSchemaVersion: 1, fixtureId: BOUNDED_REAL_FIXTURE_ID }),
      semanticSearch: PRODUCTION_ANCILLARY_SOURCES.semanticSearch,
    });
  }
  if (trust?.gameSha !== 'fixture') return PRODUCTION_ANCILLARY_SOURCES;
  if (!CONTENT_ID.test(trust.semanticRoot) || !CONTENT_ID.test(trust.pixelRoot) || trust.qualificationFixtureId !== QUALIFICATION_FIXTURE_ID) invalidQualificationTrust('ancillary source roots are not qualification-bound');
  return Object.freeze({
    mode: 'qualification_fixture', contractId: QUALIFICATION_SOURCE_CONTRACT,
    animation: Object.freeze({ gameSha: 'fixture', appearanceProductRoot: trust.pixelRoot, outfitSpatialProductRoot: trust.semanticRoot }),
    creatures: Object.freeze({ contractId: QUALIFICATION_SOURCE_CONTRACT, capability: 'qualification-creatures-v1', semanticDigest: trust.semanticRoot, npcRoleSchemaVersion: 1, fixtureId: QUALIFICATION_FIXTURE_ID }),
    semanticSearch: Object.freeze({ authority: 'Oteryn/Oteryn-Atlas', repository: 'Oteryn/Oteryn-Atlas', contractId: QUALIFICATION_SOURCE_CONTRACT, capability: 'qualification-semantic-search-v1', profileId: 'oteryn-atlas-qualification-semantic-search-v1', fixtureId: QUALIFICATION_FIXTURE_ID, gameRevision: 'fixture', semanticDigest: trust.semanticRoot, creatureContractId: QUALIFICATION_SOURCE_CONTRACT, creatureCapability: 'qualification-creatures-v1', creatureSemanticDigest: trust.semanticRoot }),
  });
}

export const FULLWORLD_PATHS = Object.freeze({
  animation: '/fullworld/animation/',
  minimap: '/fullworld/minimap/',
  overview: '/fullworld/overview/',
  publication: '/fullworld/publication/',
  pixelBuckets: '/fullworld/pixel-buckets/',
  runtimeIndex: '/fullworld/runtime-index/',
});

export const FULLWORLD_CAPABILITIES = Object.freeze({
  animation: Object.freeze({
    enabled: true,
    status: 'PROVEN',
    reason: 'Verified 15.32 Game-owned animation programs are available; playback remains opt-in and static when disabled.',
  }),
  layers: Object.freeze([
    Object.freeze({ id: 'minimap-overview', label: 'Overview / density', status: 'PROVEN', enabled: true }),
    Object.freeze({ id: 'areas', label: 'Areas', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'subareas', label: 'Subareas', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'towns', label: 'Towns', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'temples', label: 'Temples', status: 'UNKNOWN', enabled: false }),
    Object.freeze({ id: 'teleports-transitions', label: 'Teleports / transitions', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'houses', label: 'Houses', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'house-doors', label: 'House doors', status: 'UNKNOWN', enabled: false }),
    Object.freeze({ id: 'action-ids', label: 'Action IDs', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'unique-ids', label: 'Unique IDs', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'waypoints', label: 'Waypoints', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'mechanics', label: 'Mechanics', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'raids-encounters', label: 'Raids / encounters', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'quest-areas', label: 'Quest areas', status: 'UNKNOWN', enabled: false }),
    Object.freeze({ id: 'pois', label: 'POIs', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'npcs', label: 'NPCs', status: 'BLOCKED', enabled: false }),
    Object.freeze({ id: 'monsters-spawns', label: 'Monsters / spawns', status: 'BLOCKED', enabled: false }),
  ]),
});
