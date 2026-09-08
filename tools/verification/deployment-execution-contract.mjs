import assert from 'node:assert/strict';

// Inactive extracted policy, not a Docker/network executor or deployment grant.
// The caller must authenticate main/source observations and provide adapters.
// Source: suspended synology-live-acceptance staging, product validation,
// stop/rename/start and previous-container rollback. Live cutover is not atomic.
const sha = /^[0-9a-f]{40}$/;
const digest = /^sha256:[0-9a-f]{64}$/;
function requireValue(value, message) { if (!value) throw new Error(`deployment contract: ${message}`); }
export function planDeployment(input) {
  requireValue(input?.ref === 'refs/heads/main' && input.clean === true, 'clean merged main required');
  const revision = input.triggeringRevision;
  requireValue(sha.test(revision) && input.checkedOutRevision === revision && input.mergedMainRevision === revision, 'exact triggering main revision required');
  requireValue(sha.test(input.previousRevision) && input.previousMergedMainRevision === input.previousRevision, 'previous merged main revision required');
  requireValue(/^\d+$/.test(input.runId) && /^[1-9]\d*$/.test(input.runAttempt), 'run identity required');
  requireValue(typeof input.pythonImage === 'string' && /^\S+@sha256:[0-9a-f]{64}$/.test(input.pythonImage) && input.pythonNetwork === 'none', 'pinned isolated Python container required');
  requireValue(input.browserNetwork === 'bridge', 'browser bridge isolation required');
  let url; try { url = new URL(input.previewUrl); } catch { /* rejected below */ }
  requireValue(url && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'HTTP preview URL required');
  requireValue(input.products && JSON.stringify(Object.keys(input.products).sort()) === JSON.stringify(['animation', 'creatures', 'gameplay']) && Object.values(input.products).every(value => digest.test(value)), 'exact candidate products required');
  return Object.freeze({ ...structuredClone(input), revision, stagedName: `.staged-${revision}-${input.runId}-${input.runAttempt}`, products: Object.freeze({ ...input.products }) });
}
function exactRevision(observation, revision) {
  requireValue(observation?.labelRevision === revision && observation?.headerRevision === revision, 'container and HTTP revision mismatch');
}
function qualified(observation, plan) {
  exactRevision(observation, plan.revision);
  assert.deepEqual(observation.products, plan.products, 'deployment candidate products differ');
}
export async function runDeploymentTransaction(input, adapter) {
  const plan = planDeployment(input);
  for (const name of ['stage', 'qualifyCandidate', 'retainPrevious', 'startCandidate', 'acceptLive', 'restorePrevious', 'inspectPrevious', 'finalize', 'cleanupStage']) requireValue(typeof adapter?.[name] === 'function', `missing ${name} adapter`);
  let retained = false;
  let failure;
  try {
    await adapter.stage(plan);
    qualified(await adapter.qualifyCandidate(plan), plan);
    // The operation can mutate and then throw. Require restoration before
    // entering it; restorePrevious must be idempotent when no rename occurred.
    // inspectPrevious must independently verify the restored active revision.
    retained = true;
    await adapter.retainPrevious(plan);
    await adapter.startCandidate(plan);
    qualified(await adapter.acceptLive(plan), plan);
    await adapter.finalize(plan);
  } catch (error) {
    failure = error;
    if (retained) {
      try {
        await adapter.restorePrevious(plan);
        exactRevision(await adapter.inspectPrevious(plan), plan.previousRevision);
      } catch (rollbackError) {
        failure = new AggregateError([error, rollbackError], 'deployment failed and previous revision restoration is unproven');
      }
    }
  }
  try { await adapter.cleanupStage(plan); } catch (cleanupError) {
    failure = failure ? new AggregateError([failure, cleanupError], 'deployment and staged cleanup failed') : cleanupError;
  }
  if (failure) throw failure;
  return { revision: plan.revision, previousRevision: plan.previousRevision, qualified: true };
}

export function selectDynamicCreatureTargets({ programs, creatures, search, expectedDynamicCount }) {
  requireValue(Number.isSafeInteger(expectedDynamicCount) && expectedDynamicCount > 0, 'expected dynamic census required');
  const dynamic = new Set(programs.creature_programs.filter(row => row.phase_count > 1 && new Set(row.phase_content_ids).size > 1).map(row => row.outfit_presentation_id));
  requireValue(dynamic.size === expectedDynamicCount, 'dynamic presentation census mismatch');
  const byId = new Map(search.records.map(row => [row.record_id, row]));
  requireValue(byId.size === search.records.length, 'duplicate search identity');
  const pick = (rows, npc) => {
    const source = rows.find(row => (!npc || row.roles?.includes('shop')) && row.presentation_resolution_state === 'RESOLVED' && dynamic.has(row.outfit_presentation?.outfit_presentation_id));
    const record = byId.get(source?.record_id);
    requireValue(record && record.kind === (npc ? 'npc' : 'monster'), 'dynamic target missing exact search ownership');
    return structuredClone(record);
  };
  return { npc: pick(creatures.npcs, true), monster: pick(creatures.monster_spawns, false) };
}

export function validateGameplayPublication(manifest, expected) {
  requireValue(sha.test(expected?.gameRevision) && digest.test(expected?.semanticDigest), 'exact gameplay source required');
  requireValue(manifest?.capability === 'creature-gameplay-profiles-v1' && manifest.producer_repository_sha === expected.gameRevision && manifest.semantic_digest === expected.semanticDigest, 'gameplay publication identity mismatch');
  assert.deepEqual(manifest.counts, { monster_profiles: 1800, npc_profiles: 1049, referenced_items: 0 }, 'deployment gameplay census mismatch');
  return manifest;
}
