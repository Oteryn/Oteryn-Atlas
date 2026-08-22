export const FULLWORLD_TRUST = Object.freeze({
  gameSha: 'f79fd3b5c239fa13810338f1380539c4eac67d7d',
  publicationRoot: 'sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f',
  semanticRoot: 'sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9',
  pixelRoot: 'sha256:8b8228fcc4574903e547cb7d65b96f3d45e5a9e67045091c1bceb6e54d3690ad',
  overviewRoot: 'sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db',
  minimapRoot: 'sha256:23f4d2c3901673fb38980e2600828145a6d0626c0e44d1d9f5ca23bfbce02268',
  runtimeIndexRoot: 'sha256:fa30ae5fc47f0ca8a6d482ed87b5db2cd74f32f7f523df16187ca719b8e04f08',
  pixelBucketRoot: 'sha256:99cf23b01a0d652ff670a994a2b80cbef8d17036f514522d47f1aa98352d3116',
  sourceFingerprint: 'sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9',
  animationGameSha: '8f6a4fdea4487a61c4cdaf1889d421ecd2265a31',
  animationProductRoot: 'sha256:43ca727af914da89bba591a9e3c7324bfc72ffe96bd4ba0524bdf71a6c6a4caf',
  appearanceProductRoot: 'sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1',
});

export const FULLWORLD_PATHS = Object.freeze({
  animation: '/data/animation/',
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
    capability: 'animated-world-and-creatures-v1',
    productRoot: 'sha256:43ca727af914da89bba591a9e3c7324bfc72ffe96bd4ba0524bdf71a6c6a4caf',
    rightsScope: 'PRIVATE_PREVIEW_VALIDATION_ONLY',
    reason: 'Game-owned exact-15.32 animation semantics are supported; missing/corrupt delivery degrades to verified static presentation.',
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
