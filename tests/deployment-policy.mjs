import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { planDeployment, runDeploymentTransaction } from '../tools/verification/deployment-execution-contract.mjs';
const revision = 'a'.repeat(40), previousRevision = 'b'.repeat(40);
const digest = `sha256:${'c'.repeat(64)}`;
const source = () => ({ ref: 'refs/heads/main', triggeringRevision: revision, checkedOutRevision: revision, mergedMainRevision: revision, clean: true, previousRevision, previousMergedMainRevision: previousRevision, pythonNetwork: 'none', browserNetwork: 'bridge', previewUrl: 'http://127.0.0.1:8097', products: { animation: digest, creatures: digest, gameplay: digest } });
const observation = plan => ({ labelRevision: plan.revision, headerRevision: plan.revision, products: plan.products });

test('deployment plans require exact clean merged main and isolated execution', () => {
  const plan = planDeployment(source());
  assert.equal(plan.revision, revision);
  for (const patch of [{ ref: 'refs/heads/task' }, { clean: false }, { checkedOutRevision: previousRevision }, { mergedMainRevision: previousRevision }, { pythonNetwork: 'host' }, { browserNetwork: 'host' }, { previewUrl: 'file:///etc/passwd' }, { previousRevision: '' }, { previousMergedMainRevision: revision }, { products: { gameplay: digest } }]) {
    assert.throws(() => planDeployment({ ...source(), ...patch }), /deployment/);
  }
});

function transaction(t, failAt = null, sameRevision = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-deploy-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const plan = planDeployment({ ...source(), previousRevision: sameRevision ? revision : previousRevision, previousMergedMainRevision: sameRevision ? revision : previousRevision });
  const live = path.join(root, 'live'), backup = path.join(root, 'previous'), staged = path.join(root, 'candidate');
  fs.mkdirSync(live); fs.writeFileSync(path.join(live, 'revision'), plan.previousRevision); fs.writeFileSync(path.join(live, 'creatures'), 'existing catalog');
  const calls = [];
  const adapter = {
    async stage() { calls.push('stage'); fs.mkdirSync(staged); fs.writeFileSync(path.join(staged, 'revision'), revision); },
    async qualifyCandidate() { calls.push('qualify'); assert.ok(fs.existsSync(live)); if (failAt === 'qualify') throw Error('qualification failed'); return observation(plan); },
    async retainPrevious() { calls.push('retain'); if (failAt === 'retain-before') throw Error('retain failed before rename'); fs.renameSync(live, backup); if (failAt === 'retain-after') throw Error('retain failed after rename'); },
    async startCandidate() { calls.push('start'); if (failAt === 'start') throw Error('start failed'); fs.renameSync(staged, live); },
    async acceptLive() { calls.push('accept'); if (failAt === 'accept') throw Error('acceptance failed'); return observation(plan); },
    async restorePrevious() { calls.push('restore'); if (fs.existsSync(backup)) { if (fs.existsSync(live)) fs.rmSync(live, { recursive: true }); fs.renameSync(backup, live); } },
    async inspectPrevious() { calls.push('inspect'); const actual = fs.readFileSync(path.join(live, 'revision'), 'utf8'); return { labelRevision: actual, headerRevision: failAt === 'rollback' ? revision : actual }; },
  };
  return { plan, adapter, calls, live, backup };
}

test('candidate products qualify before previous revision is retained and prior revision remains retained after live acceptance', async t => {
  const f = transaction(t);
  await runDeploymentTransaction(f.plan, f.adapter);
  assert.deepEqual(f.calls, ['stage', 'qualify', 'retain', 'start', 'accept']);
  assert.equal(fs.readFileSync(path.join(f.live, 'revision'), 'utf8'), revision);
  assert.equal(fs.existsSync(f.backup), true);
});

test('qualification failure leaves live untouched; start and acceptance failures restore exact previous revision and catalog', async t => {
  for (const failure of ['qualify', 'start', 'accept']) {
    const f = transaction(t, failure);
    await assert.rejects(runDeploymentTransaction(f.plan, f.adapter), /failed/);
    assert.equal(fs.readFileSync(path.join(f.live, 'revision'), 'utf8'), previousRevision);
    assert.equal(fs.readFileSync(path.join(f.live, 'creatures'), 'utf8'), 'existing catalog');
    assert.equal(f.calls.includes('restore'), failure !== 'qualify');
  }
});

test('same-revision failed rerun restores original catalog; changed products and rollback revision mismatch fail visibly', async t => {
  const same = transaction(t, 'accept', true);
  await assert.rejects(runDeploymentTransaction(same.plan, same.adapter), /acceptance failed/);
  assert.equal(fs.readFileSync(path.join(same.live, 'creatures'), 'utf8'), 'existing catalog');
  const changed = transaction(t);
  changed.adapter.qualifyCandidate = async () => ({ ...observation(changed.plan), products: {} });
  await assert.rejects(runDeploymentTransaction(changed.plan, changed.adapter), /products/);
  assert.equal(changed.calls.includes('retain'), false);
  const rollback = transaction(t, 'rollback');
  rollback.adapter.acceptLive = async () => { throw Error('acceptance failed'); };
  await assert.rejects(runDeploymentTransaction(rollback.plan, rollback.adapter), AggregateError);
});

test('candidate revision mismatch blocks cutover and missing adapters cannot begin staging', async t => {
  const f = transaction(t);
  f.adapter.qualifyCandidate = async () => ({ ...observation(f.plan), headerRevision: previousRevision });
  await assert.rejects(runDeploymentTransaction(f.plan, f.adapter), /revision mismatch/);
  assert.equal(f.calls.includes('retain'), false);
  const missing = transaction(t);
  delete missing.adapter.restorePrevious;
  await assert.rejects(runDeploymentTransaction(missing.plan, missing.adapter), /missing restorePrevious/);
  assert.deepEqual(missing.calls, []);
});

test('retain failures before and after rename preserve the exact original live catalog', async t => {
  for (const failure of ['retain-after', 'retain-before']) {
    const f = transaction(t, failure);
    await assert.rejects(runDeploymentTransaction(f.plan, f.adapter), /retain failed/);
    assert.equal(fs.readFileSync(path.join(f.live, 'revision'), 'utf8'), previousRevision);
    assert.equal(fs.readFileSync(path.join(f.live, 'creatures'), 'utf8'), 'existing catalog');
    assert.ok(f.calls.includes('restore'));
    assert.ok(f.calls.includes('inspect'));
    assert.equal(f.calls.includes('start'), false);
  }
});
