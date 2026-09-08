# R4 shadow execution

Lifecycle: #315. Owner invoked `Oteryn: Atlas R4 Shadow Lead` using the prompt in #394. Canonical preparation PR: #395, branch `feat/atlas-r4-shadow`. R4 only; R5, required-check/ruleset changes, real FullWorld, publication and deployment are excluded.

Admission base: `1e68e3ca2d1bf94c18ed37d79fcf7f0424e31fc2`; tree `ddfaeb1355d4fde03901d81b16194086984cc51d`. Source was cloned and both Git identities checked. Bound META revision: `1dedfc0f264fe0e23e5365dbe9280c2d96df50c5`.

## Protected test evolution correction

Clean-main focused execution of `tests/maintenance/pre-r4-maintenance-mutation.test.mjs` and `tests/verification/verification-execution-contract.test.mjs` produced 21 PASS / 1 FAIL / zero skips. ADD execution failed with `source proof changed: tests/verification/deterministic-execution.test.mjs`.

Exactly three catalog leaf hashes disagree with already-merged #393 bytes: `deterministic-execution.test.mjs`, `plan-execution-readiness.test.mjs`, and `verification-execution-contract.test.mjs` beneath `tests/verification/`. Their declared import/subprocess edges are empty. Repinning those rows would repair only this snapshot and recreate metadata churn after the next merged test edit.

The correction adds optional `protectedRoot` to the existing resolver and execution-contract seam. An authenticated protected caller may provide the exact protected-base checkout. Every unchanged candidate test must match its safe regular protected-base file, including when the candidate restores old catalog-matching bytes. Stale catalog hashes remain stale: the test gets self-only coverage and historical children remain independent obligations. Missing/symlinked protected files and unreported candidate drift fail closed. Without `protectedRoot`, the existing hash rejection remains. No catalog, interpreter, ownership, impact or required-check authority changes.

The new five filesystem regressions are inside the already-owned deterministic-execution test, so later protected plans retain them. Initial new regression run: 1 PASS / 3 RED. Corrected focused suite: 35/35 PASS, zero skips/todos/retries. The live R4 caller must still authenticate `protectedRoot` against `candidate.baseSha`; this pure API does not authenticate a caller-supplied directory.

The broader suite also exposed three historical maintenance tests expecting arbitrary deterministic-test additions to remain forbidden after #392 explicitly admitted them. Their negative probes now target unlisted verification implementation modules instead. The validator itself is unchanged; positive safe-test mutation coverage remains in `pre-r4-maintenance-mutation.test.mjs`.

## Proven control-plane admission barrier

Independent Sol High reproduced both PR and Merge Queue rejection using the exact protected main above and a synthetic descendant with only `A .github/workflows/verification-shadow.yml`:

- local candidate `2b2179fdd4a198358ed73ee82d13957b5cdc69df`;
- local tree `bc71c602e2ba75811cfc92aee18297b7c984b715`;
- PR and `merge_group/checks_requested`: exit 1;
- error: `workflow transition is not the complete suspension cutover: active workflow inventory is not the required three-file set`.

These are local Git policy reproductions, not GitHub run IDs or product verification. Protected validator blob: `65dbf246e1286c87a856c16f3810fa56feb4986d`.

### Concrete smallest structural transition proposal

A separately reviewed protected admission candidate would establish one protected template for `.github/workflows/verification-shadow.yml`. The protected validator would admit one narrow activation predicate:

1. Exactly `A .github/workflows/verification-shadow.yml` among workflow changes.
2. Active inventory equals the existing three workflows plus that exact path.
3. All three existing workflows remain byte-identical.
4. New workflow bytes equal the template read from the protected base.
5. Candidate edits to the template or validator cannot authorize activation.
6. No other workflow/archive addition, deletion, rename or modification.
7. Non-workflow paths still pass ordinary protected `verifyNormal` and lane checks.
8. PR and MQ content produce the same admission decision.

Required regressions cover template-byte drift, extra/removed/renamed workflow, same-candidate template change, unrelated implementation path, and PR/MQ parity. This is a proposal, not implemented admission or an approved template. The eventual template must consume the real qualified R4 caller; an inert template or future generic framework is not sufficient.

The validator and template namespace are themselves frozen. #392 bypass is consumed; no new bypass is inferred or requested by this document. Ordinary current required checks cannot integrate that structural transition. Exact owner-authorized repository admission must be established separately once the complete activation template and transition are independently reviewed.

## Minimal browser and source routes

| Stage | Smallest existing route | Data capability | Current evidence |
| --- | --- | --- | --- |
| S0 | Docs-only plan, zero commands | None | Local contract only; no real shadow run |
| S1 | Protected deterministic resolution | qualification_fixture | Resolver regressions; no real shadow run |
| S2 | e2e.layer-availability; layer-audit-desktop.spec.mjs; desktop-chromium | qualification_fixture | Existing real application/harness route identified; not executed |
| S3 | integration.source-contract-http; creature-gameplay-source-contract-desktop.spec.mjs; two HTTP cases | bounded_real_world | Source-to-product authority unresolved; not executed |

Existing `e2e/compose.protected-hosted-executor.yml` plus `e2e/compose.github-hosted.yml` provides the candidate application/protected test context, immutable publication mount, readiness and trust-bootstrap seams. Reuse requires exact identity/census bindings and separate capability volumes/artifacts. No historical workflow is restored by this finding. Chromium workers=1 and retries=0 remain mandatory for S2. S3 is request-only and does not need a full world or browser process.

### S3 external source boundary

`buildBoundedRealWorld` currently copies cached Atlas ancillary projections and emits publication `source.gameSha: "fixture"`. `authenticatePublicationProof` instead requires exact canonical Game repository/revision/selected bytes and matching product `sourceDigests`. Replacing the string with a SHA would falsely claim lineage.

The smallest selected gameplay surface is the manifest plus `web/creature-gameplay/shards/npc-f8.json` (Sam) and `web/creature-gameplay/shards/monster-80.json` (Rat). The canonical Game exporter is accessible at `Oteryn/Oteryn-Game@b56ce339281d252a9e01a5a2bed583582bf29e68:tools/game-atlas-creature-gameplay/export.py`, with identity helper under `tools/game-atlas-creatures/identity.py`. It derives outputs from legacy evidence `blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce`. Access to exporter code does not prove the selected generated files are committed Game-owned product bytes.

The current bounded product also includes semantic-search data attributed to Game `0161b80c351b644b47c28b290a6f54b44f775de7`, while creature-catalog metadata supplies legacy provenance. No authenticated single-revision source binding for this mixed product was established.

Required upstream input: exact immutable Game-owned selected gameplay product paths/revision/digests, or an independently authorized and reproducible source-to-product derivation contract covering exporter, identity helper and selected legacy input closure. Atlas must verify that binding before producing S3 evidence. No provider-owned source contract, Game publication or provenance is invented here.

## Outstanding acceptance

No shadow workflow is active or integrated. Real S0–S3, real MQ shadow, authenticated machine evidence, actual runner minutes and wall-time savings remain unqualified. Source and control-plane prerequisites above remain unresolved. A passing preparation PR proves neither activation nor product verification. State: `R4_PREPARATION / ACTIVATION_BLOCKED`; `R5_NOT_AUTHORIZED`.
