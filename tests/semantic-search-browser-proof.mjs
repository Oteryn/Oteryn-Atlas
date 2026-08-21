import { navigationSearchParams, validateSemanticSearchIndex } from '../src/browser/semantic-search.mjs';
import { searchCreatureRecords } from '../src/browser/creature-search.mjs';

const out = document.querySelector('#qualification-result');
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
  return [...document.querySelectorAll('#semantic-search-results-desktop .semantic-search-result')].map((button) => button.textContent.replace(/\s+/g, ' ').trim());
}

try {
  const ready = await waitReady();
  assert(ready.records >= 51, 'expected full non-creature semantic navigation catalog');
  assert(ready.creatureSearchRecords === 2, 'browser creature fixture did not load');

  const index = validateSemanticSearchIndex(await (await fetch('../web/semantic-search/index.json', { cache: 'no-store' })).json());
  const towns = index.records.filter((record) => record.kind === 'town');
  const waypoints = index.records.filter((record) => record.kind === 'waypoint');
  assert(towns.length === 33, `expected 33 published towns, got ${towns.length}`);
  assert(waypoints.length === 18, `expected 18 published waypoints, got ${waypoints.length}`);

  let results = await query('Thais');
  assert(results.length >= 1 && /Thais.*Town.*32369, 32241, 7/i.test(results[0]), 'Thais result missing/wrong');

  const anotherTown = towns.find((record) => record.label !== 'Thais');
  assert(anotherTown, 'second town missing from full catalog');
  results = await query(`town:${anotherTown.label}`);
  assert(results.length >= 1 && results.some((value) => value.includes(anotherTown.label) && /Town/i.test(value)), 'full town filter failed');

  results = await query('32369 32220 7');
  assert(results.length === 1 && /32369, 32220, 7.*Position/i.test(results[0]), 'coordinate alias result missing/wrong');

  results = await query('npc:Sam');
  assert(results.length >= 1 && results.every((value) => /NPC/i.test(value) && !/Town/i.test(value)), 'full NPC filter failed');

  results = await query('Dragon');
  assert(results.length === 1 && /Dragon.*Monster/i.test(results[0]), 'monster name search failed');
  results = await query('monster:Dragon');
  assert(results.length === 1 && /Dragon.*Monster/i.test(results[0]), 'monster filter failed');

  const creatureFixture = globalThis.__CREATURE_BROWSER_FIXTURE__;
  const samCreature = searchCreatureRecords(creatureFixture, 'Sam')[0];
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
    creatureSearchRecords: ready.creatureSearchRecords,
    queries: ['Thais', `town:${anotherTown.label}`, '32369 32220 7', 'npc:Sam', 'Dragon', 'monster:Dragon', `id:${samCreature.id}`, `id:${samCreature.record_id}`, `id:${thais.id}`],
    navigation: params.toString(),
  });
} catch (error) {
  out.dataset.status = 'FAIL';
  out.textContent = String(error.stack || error);
  throw error;
}