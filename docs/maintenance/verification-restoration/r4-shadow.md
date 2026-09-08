# R4 shadow execution

Lifecycle: #315. Owner invoked `Oteryn: Atlas R4 Shadow Lead` using the prompt in #394. Scope is R4 only; R5, required-check/ruleset changes, real FullWorld, publication and deployment are excluded.

Admission base: `1e68e3ca2d1bf94c18ed37d79fcf7f0424e31fc2`; tree `ddfaeb1355d4fde03901d81b16194086984cc51d`.

## Verified preparation findings

- The protected maintenance validator admits only the three retained workflows. A fourth workflow cannot pass its suspension-cutover predicate. No bypass is authorized.
- Clean-main focused execution (`node --test tests/maintenance/pre-r4-maintenance-mutation.test.mjs tests/verification/verification-execution-contract.test.mjs`) produced 21 PASS / 1 FAIL / zero skips. ADD execution fails with `source proof changed: tests/verification/deterministic-execution.test.mjs`.
- Three catalog leaf source hashes disagree with already-merged #393 bytes: `deterministic-execution.test.mjs`, `plan-execution-readiness.test.mjs`, and `verification-execution-contract.test.mjs` beneath `tests/verification/`. Their declared import/subprocess edges are empty. A new source-proof exception must not convert candidate bytes into coverage authority.

## Acceptance still outstanding

S0 docs/no-work, S1 real deterministic, S2 real qualification browser, S3 authenticated bounded source, real PR/MQ equivalence, runner measurements and independent Sol High acceptance remain unqualified. No shadow workflow is active. This document does not certify R4 completion.
