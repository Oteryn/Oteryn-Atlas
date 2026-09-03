import { ancillarySourceExpectations, resolveFullWorldTrust } from './fullworld-trust.mjs';
import {
  CreatureGameplayProfileError,
  createCreatureGameplayProfileService as createCoreGameplayProfileService,
} from './creature-gameplay-profiles-core.mjs';

export * from './creature-gameplay-profiles-core.mjs';

const REQUIRED_SOURCE = Object.freeze({ availability: 'required' });
const QUALIFICATION_UNAVAILABLE_SOURCE = Object.freeze({
  availability: 'unavailable',
  reason: 'qualification-fixture',
});
const EMPTY_STATS = Object.freeze({ cacheShards: 0, cacheBytes: 0 });
const QUALIFICATION_UNAVAILABLE_RESULT = Object.freeze({
  status: 'unavailable',
  reason: 'qualification-fixture',
});

function normalizedSourceExpectation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CreatureGameplayProfileError('gameplay source expectation invalid');
  }
  const keys = Object.keys(value).sort();
  if (value.availability === 'required'
    && JSON.stringify(keys) === JSON.stringify(['availability'])) return REQUIRED_SOURCE;
  if (value.availability === 'unavailable'
    && value.reason === 'qualification-fixture'
    && JSON.stringify(keys) === JSON.stringify(['availability', 'reason'])) return QUALIFICATION_UNAVAILABLE_SOURCE;
  throw new CreatureGameplayProfileError('gameplay source expectation invalid');
}

export function createCreatureGameplayProfileService(options = {}) {
  const {
    sourceExpectation = ancillarySourceExpectations(resolveFullWorldTrust()).creatureGameplay,
    ...coreOptions
  } = options;
  const source = normalizedSourceExpectation(sourceExpectation);
  if (source.availability === 'unavailable') {
    return Object.freeze({
      async get() { return QUALIFICATION_UNAVAILABLE_RESULT; },
      stats() { return EMPTY_STATS; },
    });
  }
  return createCoreGameplayProfileService(coreOptions);
}
