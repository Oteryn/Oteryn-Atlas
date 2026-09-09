# Atlas E2E harness

The `e2e/` tree contains the Playwright/Docker browser harness used by active Atlas selective verification and local diagnostics.

## Current authority

Do not infer verification authority from scripts in this directory. Protected `main` owns the active workflow, planner, catalog, impact routing, stable IDs, execution policy, and oracle definitions.

PR execution is initiated through protected `pull_request_target`; Merge Queue uses `merge_group: checks_requested`. Candidate checkout bytes are verification subjects, never policy authority, and checkout credentials are not persisted.

## Data capabilities

Verification profile and data capability are separate decisions:

- `qualification_fixture` is the default immutable product for ordinary functional/browser verification;
- `bounded_real_world` is for bounded compatibility/oracle checks that genuinely depend on selected real Game bytes;
- `real_fullworld` is specialist-only for complete-product/root/census, generator determinism, scale/performance/soak, overview/minimap consistency, release acceptance, or another explicit complete-world oracle.

A broad or full verification profile does not automatically require FullWorld. Use the minimum truthful data capability.

## Execution characteristics

The suite covers map navigation, floors/modes, semantic search, creature/NPC presentation and interaction, state/history, geometry, responsive/mobile behavior, accessibility, fault/race handling, performance, and reviewed visual scenarios where applicable.

Accepted browser retries are zero. Failures must remain visible; do not turn a first failure green with reruns, broad allowlists, enlarged tolerances, arbitrary sleeps, or unconditional skips.

## Local and specialist use

Local execution is supporting diagnostic/qualification evidence only; it does not replace protected GitHub checks. Common local entry points remain `./e2e/run.sh` and `e2e/run.ps1` with an explicitly selected publication origin or base URL.

Molehill-PC is not a default E2E farm. Use it only when the protected plan requires `real_fullworld`, native Windows/GPU, restricted visual review, or another explicit specialist capability. Synology is reserved for separately authorized merged-main live deployment/acceptance, not ordinary verification.

Before selecting a specialist/nightly profile or data capability, read `docs/agents/operations/VERIFICATION_CAPABILITY.md`. Publication/deployment remains a separate lifecycle and is never implied by a green E2E result.