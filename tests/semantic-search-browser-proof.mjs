import { navigationSearchParams, validateSemanticSearchIndex } from '../src/browser/semantic-search.mjs';
import { searchCreatureRecords, validateCreatureSearchRecords } from '../src/browser/creature-search.mjs';

const out = document.querySelector('#qualification-result');
const EXPECTED_CREATURE_DIGEST = 'sha256:81505e91d7089f91e71813ec43f97118932db9cc7fd76d291fa399447ee2dfa4';
function assert(condition, message) { if (!condition) throw new Error(message); }
function tick() { return new Promise((resolve) => setTimeout(resolve, 0)); }

async function waitReady() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const state = globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__;
    if (state?.status === 'PASS') return state;
    if (state?.status === 'FAIL') throw new Error(state.error || 'semantic search boot failed');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('semantic search did not become ready');
}

async function query(value) {
  const input = document.querySelector('#search-input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
  return [...document.querySelectorAll('#semantic-search-results-desktop .semantic-search-result')]
    .map((button) => button.textContent.replace(/\s+/g, ' ').trim());
}

try {
  const ready = await waitReady();
  assert(ready.records === 51, `expected 51 non-creature navigation records, got ${ready.records}`);

  const index = validateSemanticSearchIndex(await (await fetch('../web/semantic-search/index.json', { cache: 'no-store' })).json());
  const towns = index.records.filter((record) => record.kind === 'town');
  const waypoints = index.records.filter((record) => record.kind === 'waypoint');
  assert(towns.length === 33, `expected 33 published towns, got ${towns.length}`);
  assert(waypoints.length === 18, `expected 18 published waypoints, got ${waypoints.length}`);

  const creatureCatalog = await (await fetch('../web/semantic-search/creatures.json', { cache: 'no-store' })).json();
  assert(creatureCatalog.schema_version === 1, 'creature catalog schema mismatch');
  assert(creatureCatalog.source?.contract_id === 'oteryn-game-atlas-export-v1', 'creature catalog contract mismatch');
  assert(creatureCatalog.source?.capability === 'static-creatures-v1', 'creature catalog capability mismatch');
  assert(creatureCatalog.source?.semantic_digest === EXPECTED_CREATURE_DIGEST, 'creature catalog digest mismatch');
  const creatureRecords = validateCreatureSearchRecords(creatureCatalog.records);
  assert(creatureRecords.length === 1945, `expected 1945 unique creature labels, got ${creatureRecords.length}`);
  assert(creatureRecords.filter((record) => record.entity_id).length === 1823, 'resolved creature entity-id coverage changed');
  assert(ready.creatureSearchRecords === creatureRecords.length, 'browser did not load committed creature catalog');

  let results = await query('Thais');
  assert(results.length >= 1 && /Thais.*Town.*32369, 32241, 7/i.test(results[0]), 'Thais result missing/wrong');

  const anotherTown = towns.find((record) => record.label !== 'Thais');
  assert(anotherTown, 'second town missing from full catalog');
  results = await query(`town:${anotherTown.label}`);
  assert(results.some((value) => value.includes(anotherTown.label) && /Town/i.test(value)), 'full town filter failed');

  results = await query('32369 32220 7');
  assert(results.length === 1 && /32369, 32220, 7.*Position/i.test(results[0]), 'coordinate alias result missing/wrong');

  results = await query('npc:Sam');
  assert(results.length >= 1 && /Sam.*NPC/i.test(results[0]) && results.every((value) => !/Town/i.test(value)), 'full NPC filter failed');

  results = await query('Dragon');
  assert(results.length >= 1 && /Dragon.*Monster/i.test(results[0]), 'monster name search failed');
  results = await query('monster:Dragon');
  assert(results.length >= 1 && /Dragon.*Monster/i.test(results[0]), 'monster filter failed');

  const samCreature = searchCreatureRecords(creatureRecords, 'Sam')[0];
  assert(samCreature?.label === 'Sam', 'Sam missing from committed creature catalog');
  results = await query(`id:${samCreature.id}`);
  assert(results.length === 1 && /Sam.*NPC/i.test(results[0]), 'creature entity id lookup failed');
  results = await query(`id:${samCreature.record_id}`);
  assert(results.length === 1 && /Sam.*NPC/i.test(results[0]), 'creature placement id lookup failed');

  const thais = towns.find((record) => record.label === 'Thais');
  results = await query(`id:${thais.id}`);
  assert(results.length === 1 && /Thais.*Town/i.test(results[0]), 'town stable id lookup failed');

  const params = navigationSearchParams(thais, '?mode=auto&layers=minimap-overview', index, 'town:Thais');
  assert(params.get('x') === '32369' && params.get('y') === '32241' && params.get('floor') === '-7', 'map navigation position failed');
  assert(params.get('selected') === '-7:32369:32241' && params.get('semantic') === thais.id, 'marker/inspector navigation state failed');

  out.dataset.status = 'PASS';
  out.textContent = JSON.stringify({
    status: 'PASS', towns: towns.length, waypoints: waypoints.length,
    creatureSearchRecords: creatureRecords.length, creatureEntityIds: creatureRecords.filter((record) => record.entity_id).length,
    queries: ['Thais', `town:${anotherTown.label}`, '32369 32220 7', 'npc:Sam', 'Dragon', 'monster:Dragon', `id:${samCreature.id}`, `id:${samCreature.record_id}`, `id:${thais.id}`],
    navigation: params.toString(),
  });
} catch (error) {
  out.dataset.status = 'FAIL';
  out.textContent = String(error.stack || error);
  throw error;
}
