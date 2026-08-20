export const FULLWORLD_TRUST = Object.freeze({
  gameSha: 'f79fd3b5c239fa13810338f1380539c4eac67d7d',
  publicationRoot: 'sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f',
  semanticRoot: 'sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9',
  pixelRoot: 'sha256:8b8228fcc4574903e547cb7d65b96f3d45e5a9e67045091c1bceb6e54d3690ad',
  overviewRoot: 'sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db',
  runtimeIndexRoot: 'sha256:98fa66118d49e3d440d8b14643d020542fadeff522ada69d6fb342d1f82547ed',
  pixelBucketRoot: 'sha256:99cf23b01a0d652ff670a994a2b80cbef8d17036f514522d47f1aa98352d3116',
  sourceFingerprint: 'sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9',
});

export const FULLWORLD_PATHS = Object.freeze({
  overview: '/fullworld/overview/',
  publication: '/fullworld/publication/',
  pixelBuckets: '/fullworld/pixel-buckets/',
  runtimeIndex: '/fullworld/runtime-index/',
});

export const FULLWORLD_CAPABILITIES = Object.freeze({
  animation: Object.freeze({
    enabled: false,
    status: 'BLOCKED',
    reason: 'Authoritative animation phase/timing publication is not available yet; static verified phases remain visible.',
  }),
  layers: Object.freeze([
    Object.freeze({ id: 'minimap-overview', label: 'Overview / density', status: 'PROVEN', enabled: true }),
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
