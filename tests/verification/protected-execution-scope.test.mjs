import assert from 'node:assert/strict';
import test from 'node:test';
import * as policy from '../../tools/verification/protected-admission-policy.mjs';
const change = path => ({path,status:'modified'});
test('ordinary exact runtime and documentation changes use shared protected execution',()=>{
  assert.equal(typeof policy.validateProtectedExecutionScope,'function');
  for(const path of ['README.md','docs/design.md','src/browser/loader.mjs','web/index.html']) {
    assert.deepEqual(policy.validateProtectedExecutionScope({changedFiles:[change(path)],protectedPaths:[path]}).forceFull,false);
  }
});
test('repair and declarative control-plane transitions retain full proof',()=>{
  for(const path of ['tools/verification/qualification-world.mjs','tools/verification/protected-routing.json','.github/workflows/ci.yml']) {
    assert.equal(policy.validateProtectedExecutionScope({changedFiles:[change(path)],protectedPaths:[path]}).forceFull,true);
  }
});
test('shared execution cannot promote candidate-owned kernel or oracle weakening',()=>{
  for(const path of ['tools/verification/protected-admission-policy.mjs','tools/verification/protected-qualification-oracle.mjs','tools/verification/build-verification-plan.mjs','tools/verification/verification-catalog.json','Dockerfile','e2e/playwright.config.mjs']) {
    assert.throws(()=>policy.validateProtectedExecutionScope({changedFiles:[change(path)],protectedPaths:[path]}));
  }
});
test('existing deterministic oracle and helper bytes cannot be replaced while unused governance removals remain legal',()=>{
  for(const path of ['tests/browser-semantic.mjs','tests/verification/ordinary.test.mjs','tests/helpers/oracle.mjs'])for(const status of ['modified','removed'])assert.throws(()=>policy.validateProtectedExecutionScope({changedFiles:[{path,status}],protectedPaths:[path]}));
  assert.equal(policy.validateProtectedExecutionScope({changedFiles:[{path:'tools/governance/unused.py',status:'removed'}],protectedPaths:['tools/governance/unused.py']}).eligible,true);
  for(const path of ['tools/governance/verify_extraction_provenance.py','tools/governance/test_verify_extraction_provenance.py'])assert.throws(()=>policy.validateProtectedExecutionScope({changedFiles:[{path,status:'removed'}],protectedPaths:[path]}));
});
test('new deterministic regressions stay browserless while drift fails closed',()=>{
  const input={changedFiles:[{path:'tests/verification/future.test.mjs',status:'added'}],protectedPaths:[]};
  assert.equal(policy.validateProtectedExecutionScope(input).forceFull,false);
  assert.throws(()=>policy.validateProtectedExecutionScope({...input,changedFiles:[{path:'../escape',status:'added'}]}));
  assert.throws(()=>policy.validateProtectedExecutionScope({...input,changedFiles:[{path:'web/app.mjs',status:'invented'}]}));
});
