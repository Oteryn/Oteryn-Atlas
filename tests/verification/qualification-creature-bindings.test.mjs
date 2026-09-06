import { qualificationBindingFixture } from './fixtures/qualification-binding-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { resolveQualificationScenarioBindings, renderQualificationHarnessBindings } from '../../tools/verification/qualification-scenario-bindings.mjs';
function fixture(t) {
  const f = qualificationBindingFixture(t);
  return {...f,resolve:()=>resolveQualificationScenarioBindings({productRoot:f.root,expectedProductDigest:f.seal()})};
}
test('overlap expected topmost is bound to publication draw order independently of search order', async t => {
  const f = await fixture(t);
  assert.equal(f.resolve().overlapTopmost.label, 'Raider d');
  const search = f.read('data/creatures/search.json'); search.records.reverse(); f.write('data/creatures/search.json', search);
  assert.equal(f.resolve().overlapTopmost.label, 'Raider d');
  const chunk = f.read(f.chunkPath); chunk.records.reverse(); f.write(f.chunkPath, chunk);
  assert.equal(f.resolve().overlapTopmost.label, 'Raider b');
});
test('fixture isolates the long-name edge target from other NPC annotations', async t => {
  const b = (await fixture(t)).resolve();
  for (const npc of b.creatures.filter(r => r.kind === 'npc' && r.record_id !== b.longNpc.record_id)) {
    assert.ok(Math.abs(npc.position.y - b.longNpc.position.y) >= 4);
  }
});
test('protected binding rejects a long-name target sharing nearby NPC annotation space', async t => {
  const f = await fixture(t);
  for (const file of ['data/creatures/search.json', f.chunkPath]) {
    const data = f.read(file); const target = data.records.find(r => (r.label ?? r.name).length >= 32);
    target.position.y = data.records.find(r => (r.label ?? r.name) === 'Walker').position.y;
    f.write(file, data);
  }
  assert.throws(() => f.resolve(), /isolated long-name/);
});
test('rendered first-choice label uses protected topmost binding while retaining production expectation', async t => {
  const f = await fixture(t), source = {};
  for (const dir of ['tests','support']) for (const name of fs.readdirSync('e2e/' + dir)) if (name.endsWith('.mjs')) source[dir + '/' + name] = fs.readFileSync('e2e/' + dir + '/' + name, 'utf8');
  const rendered = renderQualificationHarnessBindings({ protectedSources: source, bindings: f.resolve() });
  assert.match(rendered['tests/creature-interaction-desktop.spec.mjs'], /label: \(__atlasQualification \? "Raider b" : 'Misguided Thief'\)/);
  assert.match(rendered['tests/creature-interaction-desktop.spec.mjs'], /expect\(choices\.first\(\)\)\.toContainText\(\(__atlasQualification \? "Raider d" : 'Misguided Thief'\)\)/);
});
