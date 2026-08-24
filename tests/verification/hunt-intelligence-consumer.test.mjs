import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HuntIntelligenceError,
  AVAILABILITY_STATES,
  TRUST_CLASSES,
  validateHuntCatalogPublication,
  validateHuntPerformancePublication,
  buildHuntReadiness,
  projectHuntReadinessForBrowser,
  evaluateHuntRecommendation,
} from '../../src/hunt-intelligence/consumer.mjs';

const GAME_SHA = '3'.repeat(40);
const CATALOG_CONTRACT = 'oteryn-game-hunt-catalog-test-v1';
const PERFORMANCE_CONTRACT = 'oteryn-game-hunt-performance-test-v1';
const digest = (digit = '4') => `sha256:${digit.repeat(64)}`;

function catalogFixture() {
  return {
    schema_version: 1,
    capability: 'hunt-catalog-v1',
    source: {
      authority: 'Oteryn/Oteryn-Game',
      game_revision: GAME_SHA,
      contract_id: CATALOG_CONTRACT,
      publication_digest: digest('4'),
    },
    scope: {
      world_id: 'oteryn:world.reference',
      world_profile_revision: 'reference-v1',
      content_revision: 'content-v1',
    },
    hunts: [{
      hunt_id: 'oteryn:hunt.synthetic.alpha',
      name: 'Synthetic Alpha',
      area_refs: ['oteryn:area.synthetic.alpha'],
      subarea_refs: [],
      encounter_zone_refs: [],
      floor_geometry_refs: ['geom:synthetic-alpha'],
      entrance_refs: ['entrance:synthetic-alpha'],
      spawn_group_refs: ['spawn:synthetic-alpha'],
      creature_refs: ['oteryn:creature.synthetic'],
      requirement_refs: [],
      route_refs: [],
    }],
  };
}

function performanceFixture() {
  return {
    schema_version: 1,
    capability: 'hunt-performance-v1',
    source: {
      authority: 'Oteryn/Oteryn-Game',
      game_revision: GAME_SHA,
      contract_id: PERFORMANCE_CONTRACT,
      publication_digest: digest('5'),
    },
    scope: {
      world_id: 'oteryn:world.reference',
      world_profile_revision: 'reference-v1',
      content_revision: 'content-v1',
      ruleset_revision: 'rules-v1',
    },
    hunt_attribution_policy_revision: 'attribution-v1',
    quality_policy_revision: 'quality-v1',
    privacy_policy_revision: 'privacy-v1',
    observations: [{
      observation_id: 'obs:player-xp',
      hunt_id: 'oteryn:hunt.synthetic.alpha',
      cohort_signature: 'cohort:synthetic-alpha',
      measurement_scope: 'PLAYER',
      metric_id: 'player.awarded_xp_per_active_hour',
      metric_revision: 1,
      time_base: 'ACTIVE_EXPOSURE',
      modifier_bucket: 'baseline',
      window: { from: '2026-08-01T00:00:00Z', through: '2026-08-08T00:00:00Z' },
      sample: { sessions: 20, segments: 24, player_hours: 40, team_hours: 0 },
      completeness_state: 'NO_KNOWN_GAP_BEST_EFFORT',
      quality_state: 'MEDIUM',
      privacy_state: 'PUBLISHABLE',
      freshness_state: 'CURRENT',
      availability_state: 'AVAILABLE',
      trust_class: 'MEASURED',
      value: { unit: 'xp/hour', median: 1000, p25: 900, p75: 1100 },
    }],
  };
}

const catalogExpectations = { acceptedContractId: CATALOG_CONTRACT, acceptedGameRevision: GAME_SHA, verifiedPublicationDigest: digest('4') };
const performanceExpectations = { acceptedContractId: PERFORMANCE_CONTRACT, acceptedGameRevision: GAME_SHA, verifiedPublicationDigest: digest('5') };

test('trust and availability vocabularies keep UNKNOWN separate from unavailable states', () => {
  assert.deepEqual([...TRUST_CLASSES], ['VERIFIED', 'MEASURED', 'ESTIMATE', 'UNKNOWN']);
  assert.deepEqual([...AVAILABILITY_STATES], ['AVAILABLE', 'UPSTREAM_BLOCKED', 'INSUFFICIENT', 'SUPPRESSED', 'INCOMPATIBLE', 'MALFORMED', 'STALE']);
});

test('catalog candidate validates only against an explicitly accepted upstream contract and revision', () => {
  const catalog = catalogFixture();
  assert.equal(validateHuntCatalogPublication(catalog, catalogExpectations), catalog);
  assert.throws(() => validateHuntCatalogPublication(catalog, {}), HuntIntelligenceError);
  assert.throws(() => validateHuntCatalogPublication(catalog, { ...catalogExpectations, acceptedGameRevision: '9'.repeat(40) }), HuntIntelligenceError);
});

test('publication digest mismatch fails closed', () => {
  assert.throws(() => validateHuntCatalogPublication(catalogFixture(), { ...catalogExpectations, verifiedPublicationDigest: digest('8') }), /digest mismatch/i);
  assert.throws(() => validateHuntPerformancePublication(performanceFixture(), { ...performanceExpectations, verifiedPublicationDigest: digest('8') }), /digest mismatch/i);
});

test('catalog rejects duplicate stable Hunt IDs and unbounded references', () => {
  const duplicate = catalogFixture();
  duplicate.hunts.push(structuredClone(duplicate.hunts[0]));
  assert.throws(() => validateHuntCatalogPublication(duplicate, catalogExpectations), /duplicate/i);
  const oversized = catalogFixture();
  oversized.hunts[0].creature_refs = Array.from({ length: 4097 }, (_, i) => `creature:${i}`);
  assert.throws(() => validateHuntCatalogPublication(oversized, catalogExpectations), /creature_refs/i);
});

test('catalog rejects repository/path shaped provenance and invented inline performance facts', () => {
  const badPath = catalogFixture();
  badPath.hunts[0].source_path = 'data/world/hunts.xml';
  assert.throws(() => validateHuntCatalogPublication(badPath, catalogExpectations), /unknown field/i);
  const fakePerf = catalogFixture();
  fakePerf.hunts[0].exp_per_hour = 123456;
  assert.throws(() => validateHuntCatalogPublication(fakePerf, catalogExpectations), /unknown field/i);
});

test('performance candidate validates aggregate-only PLAYER evidence', () => {
  const performance = performanceFixture();
  assert.equal(validateHuntPerformancePublication(performance, performanceExpectations), performance);
});

test('performance keeps PLAYER, PARTY and HUNT_AREA metric namespaces separate', () => {
  const bad = performanceFixture();
  bad.observations[0].metric_id = 'party.awarded_xp_per_active_hour';
  assert.throws(() => validateHuntPerformancePublication(bad, performanceExpectations), /scope/i);
});

test('performance never treats unavailable as numeric zero', () => {
  const bad = performanceFixture();
  bad.observations[0].availability_state = 'INSUFFICIENT';
  bad.observations[0].value = { unit: 'xp/hour', median: 0, p25: 0, p75: 0 };
  assert.throws(() => validateHuntPerformancePublication(bad, performanceExpectations), /unavailable/i);
  const validZero = performanceFixture();
  validZero.observations[0].value = { unit: 'xp/hour', median: 0, p25: 0, p75: 0 };
  assert.equal(validateHuntPerformancePublication(validZero, performanceExpectations), validZero);
});

test('HIGH quality is forbidden when telemetry completeness is unknown or partial', () => {
  for (const completeness of ['UNKNOWN', 'PARTIAL']) {
    const bad = performanceFixture();
    bad.observations[0].quality_state = 'HIGH';
    bad.observations[0].completeness_state = completeness;
    assert.throws(() => validateHuntPerformancePublication(bad, performanceExpectations), /HIGH quality/i);
  }
});

test('profit/value metrics require explicit world-aware valuation identity', () => {
  const bad = performanceFixture();
  bad.observations[0].metric_id = 'player.net_profit_per_active_hour';
  bad.observations[0].value = { unit: 'gp/hour', median: 10, p25: 0, p75: 20 };
  assert.throws(() => validateHuntPerformancePublication(bad, performanceExpectations), /valuation/i);
  bad.observations[0].valuation = { type: 'MARKET', world_id: 'oteryn:world.reference', policy_revision: 'market-v1', price_as_of: '2026-08-08T00:00:00Z', price_quality_state: 'CURRENT' };
  assert.equal(validateHuntPerformancePublication(bad, performanceExpectations), bad);
});

test('raw player identifiers and character names are rejected from measured publications', () => {
  for (const key of ['player_guid', 'character_name']) {
    const bad = performanceFixture();
    bad.observations[0][key] = 'forbidden';
    assert.throws(() => validateHuntPerformancePublication(bad, performanceExpectations), /unknown field/i);
  }
});

test('readiness fails closed when upstream catalog/performance publications are absent', () => {
  const readiness = buildHuntReadiness({
    gameRevision: GAME_SHA,
    catalog: { state: 'UPSTREAM_BLOCKED', reason: 'No accepted hunt catalog publication.' },
    performance: { state: 'UPSTREAM_BLOCKED', reason: 'No accepted hunt performance publication.' },
  });
  assert.equal(readiness.catalog.state, 'UPSTREAM_BLOCKED');
  assert.equal(readiness.performance.state, 'UPSTREAM_BLOCKED');
  assert.equal(readiness.verifiedHuntNavigation.state, 'UPSTREAM_BLOCKED');
  assert.equal(readiness.measuredPanels.state, 'UPSTREAM_BLOCKED');
  assert.equal(readiness.recommender.state, 'UPSTREAM_BLOCKED');
});

test('browser readiness projection strips Game SHA and internal evidence details', () => {
  const readiness = buildHuntReadiness({
    gameRevision: GAME_SHA,
    catalog: { state: 'UPSTREAM_BLOCKED', reason: 'No accepted hunt catalog publication.', evidence: ['repo path', 'internal note'] },
    performance: { state: 'UPSTREAM_BLOCKED', reason: 'No accepted hunt performance publication.', evidence: ['private checkpoint'] },
  });
  const browser = projectHuntReadinessForBrowser(readiness);
  assert.equal(JSON.stringify(browser).includes(GAME_SHA), false);
  assert.equal(JSON.stringify(browser).includes('repo path'), false);
  assert.equal(browser.recommender.state, 'UPSTREAM_BLOCKED');
});

test('recommender is observational and returns no candidates until both real sources are usable', () => {
  const readiness = buildHuntReadiness({
    gameRevision: GAME_SHA,
    catalog: { state: 'UPSTREAM_BLOCKED', reason: 'missing' },
    performance: { state: 'UPSTREAM_BLOCKED', reason: 'missing' },
  });
  const result = evaluateHuntRecommendation({ readiness, objective: 'EXP', profile: { world_id: 'oteryn:world.reference' } });
  assert.deepEqual(result.candidates, []);
  assert.equal(result.state, 'UPSTREAM_BLOCKED');
  assert.equal(result.trust_class, 'UNKNOWN');
});
