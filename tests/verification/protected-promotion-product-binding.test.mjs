import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { resolveProtectedPromotionQualification } from '../../tools/verification/protected-hosted-execution.mjs';

const productIdentities = JSON.parse(fs.readFileSync(
  new URL('../../tools/verification/protected-hosted-product-identities.json', import.meta.url),
  'utf8',
));

test('qualification trust promotion is bound to the canonical protected qualification fixture identity', () => {
  const promotion = resolveProtectedPromotionQualification('fix/issue-179-qualification-trust-descriptor');
  assert.equal(promotion.expectedProductDigest, productIdentities.qualification_fixture.digest);
});
