import { navigationSearchParams, validateSemanticSearchIndex } from '../src/browser/semantic-search.mjs';

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
  assert(ready.records >= 2, 'expected published semantic records');

  let results = await query('Sam');
  assert(results.length >= 1 && /Sam.*NPC.*32361, 32198, 7/i.test(results[0]), 'Sam result missing/wrong');

  results = await query('Thais');
  assert(results.length >= 1 && /Thais.*Town.*32369, 32241, 7/i.test(results[0]), 'Thais result missing/wrong');

  results = await query('32369 32220 7');
  assert(results.length === 1 && /32369, 32220, 7.*Position/i.test(results[0]), 'coordinate alias result missing/wrong');

  results = await query('npc:Sam');
  assert(results.length >= 1 && results.every((value) => /NPC/i.test(value) && !/Town/i.test(value)), 'npc filter failed');

  const index = validateSemanticSearchIndex(await (await fetch('../web/semantic-search/index.json', { cache: 'no-store' })).json());
  const sam = index.records.find((record) => record.label === 'Sam' && record.kind === 'npc');
  assert(sam, 'Sam stable record missing');
  results = await query(`id:${sam.id}`);
  assert(results.length === 1 && /Sam.*NPC/i.test(results[0]), 'stable id lookup failed');

  const params = navigationSearchParams(sam, '?mode=auto&layers=minimap-overview', index, 'npc:Sam');
  assert(params.get('x') === '32361' && params.get('y') === '32198' && params.get('floor') === '-7', 'map navigation position failed');
  assert(params.get('selected') === '-7:32361:32198' && params.get('semantic') === sam.id, 'marker/inspector navigation state failed');
  assert(params.get('creatures') === 'npc', 'NPC layer activation failed');

  out.dataset.status = 'PASS';
  out.textContent = JSON.stringify({ status: 'PASS', queries: ['Sam', 'Thais', '32369 32220 7', 'npc:Sam', `id:${sam.id}`], navigation: params.toString() });
} catch (error) {
  out.dataset.status = 'FAIL';
  out.textContent = String(error.stack || error);
  throw error;
}
