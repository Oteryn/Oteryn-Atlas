import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const catalog = {
  schemaVersion: 1,
  groups: {
    'producer.verify': {
      specs: ['tests/verification/producer.test.mjs'],
      projects: [],
      resourceClass: 'cpu-light',
      evidence: 'machine-summary',
    },
    'consumer.verify': {
      specs: ['e2e/tests/consumer.spec.mjs'],
      projects: ['desktop-chromium'],
      resourceClass: 'browser-targeted',
      evidence: 'machine-summary',
    },
    'visual.verify': {
      specs: ['e2e/tests/visual-desktop.spec.mjs'],
      projects: ['desktop-chromium'],
      resourceClass: 'browser-targeted',
      evidence: 'restricted-visual-review',
    },
    'e2e.full': {
      specs: ['e2e/tests/*.spec.mjs'],
      projects: ['desktop-chromium'],
      resourceClass: 'browser-full',
      evidence: 'restricted-visual-review',
    },
  },
};

function build(changedFiles, manifest) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles,
    trustedImpactManifest: manifest,
    candidateImpactManifest: manifest,
    verificationCatalog: catalog,
  });
}

test('planner expands explicit producer-consumer fan-out transitively', () => {
  const manifest = {
    schemaVersion: 1,
    entries: [
      {
        pathPrefix: 'producer/',
        domains: ['generated-product'],
        minimumProfile: 'focused',
        requiredGroups: ['producer.verify'],
      },
    ],
    dependencyRules: [
      {
        whenAllDomains: ['generated-product'],
        addDomains: ['consumer-runtime'],
        minimumProfile: 'targeted',
        requiredGroups: ['consumer.verify'],
      },
      {
        whenAllDomains: ['consumer-runtime'],
        addDomains: ['consumer-visual'],
        minimumProfile: 'broad',
        requiredGroups: ['visual.verify'],
      },
    ],
  };

  const plan = build([{ path: 'producer/output.mjs' }], manifest);

  assert.equal(plan.profile, 'broad');
  assert.deepEqual(plan.impactDomains, ['consumer-runtime', 'consumer-visual', 'generated-product']);
  assert.deepEqual(plan.requiredGroupIds, ['consumer.verify', 'producer.verify', 'visual.verify']);
});

test('planner applies explicit cross-domain escalation only when all trigger domains are present', () => {
  const manifest = {
    schemaVersion: 1,
    entries: [
      {
        pathPrefix: 'producer/',
        domains: ['generator'],
        minimumProfile: 'focused',
        requiredGroups: ['producer.verify'],
      },
      {
        pathPrefix: 'runtime/',
        domains: ['browser-runtime'],
        minimumProfile: 'targeted',
        requiredGroups: ['consumer.verify'],
      },
    ],
    dependencyRules: [
      {
        whenAllDomains: ['browser-runtime', 'generator'],
        addDomains: ['cross-domain-risk'],
        minimumProfile: 'full',
        requiredGroups: ['e2e.full'],
      },
    ],
  };

  const singleDomain = build([{ path: 'producer/output.mjs' }], manifest);
  assert.equal(singleDomain.profile, 'focused');
  assert.deepEqual(singleDomain.requiredGroupIds, ['producer.verify']);

  const crossDomain = build([
    { path: 'producer/output.mjs' },
    { path: 'runtime/app.mjs' },
  ], manifest);
  assert.equal(crossDomain.profile, 'full');
  assert.deepEqual(crossDomain.impactDomains, ['browser-runtime', 'cross-domain-risk', 'generator']);
  assert.deepEqual(crossDomain.requiredGroupIds, ['consumer.verify', 'e2e.full', 'producer.verify']);
});

test('impact dependency rules fail closed when they reference an unknown verification group', () => {
  const manifest = {
    schemaVersion: 1,
    entries: [
      {
        pathPrefix: 'producer/',
        domains: ['generated-product'],
        minimumProfile: 'focused',
        requiredGroups: ['producer.verify'],
      },
    ],
    dependencyRules: [
      {
        whenAllDomains: ['generated-product'],
        addDomains: ['consumer-runtime'],
        minimumProfile: 'broad',
        requiredGroups: ['missing.verify'],
      },
    ],
  };

  assert.throws(
    () => build([{ path: 'producer/output.mjs' }], manifest),
    /dependencyRules.*unknown group|dependency rule.*unknown group/i,
  );
});
