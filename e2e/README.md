# Atlas E2E harness

The `e2e/` tree contains the Dockerized Playwright harness used by Atlas verification work. During the temporary maintenance state tracked by Issue #315, the historical product/E2E workflow stack is suspended and this harness is **not** a current required PR gate or an automatically scheduled qualification path.

## Current authority

Do not infer active CI or deployment topology from this directory. Current repository authority is:

1. protected `main`;
2. root `AGENTS.md`;
3. Issue #315 for the temporary maintenance lifecycle;
4. the workflows that actually exist under `.github/workflows/` on protected `main`.

Suspended workflow definitions are retained under `docs/maintenance/suspended-workflows/` as implementation/history material. Their old trigger, runner, status-publishing and deployment behavior is not current authority while suspended.

## Harness purpose

The harness runs the Atlas FullWorld portal in digest-pinned Playwright Chromium without requiring host-installed Node, Playwright or a browser. In checkout-overlay mode, an unprivileged Nginx container serves the selected `web/` and `src/` checkout while proxying approved publication paths from an explicitly selected origin. Runtime trust validation remains fail-closed on product-identity mismatches.

The harness is retained so verification groups can be repaired and re-qualified incrementally during the later #315 restoration phase. Reintroduction must follow the current repository policy: restore a bounded group in non-blocking/shadow execution, prove real PR/Merge Queue canaries, and only then make impact-applicable coverage blocking. Do not revive the retired aggregate stack merely because scripts or historical workflow files still exist.

## Manual/local use

Local execution is diagnostic or qualification evidence only when separately authorized by the current task and policy. Typical entry points are:

```bash
ATLAS_PUBLICATION_ORIGIN=http://<publication-origin> ./e2e/run.sh
```

```powershell
$env:ATLAS_PUBLICATION_ORIGIN = 'http://<publication-origin>'
$env:ATLAS_E2E_WORKERS = '1'
.\e2e\run.ps1
```

Direct deployed-preview mode uses `ATLAS_BASE_URL` and, for an exact-revision claim, `ATLAS_EXPECTED_REVISION`. Generated reports and visual evidence remain local/CI artifacts unless a current repository procedure explicitly accepts them.

## Verification characteristics

The retained suite covers FullWorld loading and range behavior, semantic search, navigation/history, map geometry, floors/modes, creature presentation and interaction, responsive/mobile behavior, failure handling, accessibility and reviewed visual scenarios. The suite is designed for zero-retry deterministic evidence; failures must remain visible rather than being converted to success through retries, broad allowlists or enlarged tolerances.

Before using any specialist/nightly profile, data capability, runner, status publisher or visual-approval flow, read `docs/agents/operations/VERIFICATION_CAPABILITY.md` and current Issue #315 state. Historical commands and artifacts are not authority for reactivating suspended verification.
