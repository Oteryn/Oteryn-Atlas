# Round 4 verification record

This file separates live readback, current execution, static inspection and historical evidence.

## LIVE_SERVICE_READBACK

- Protected/current `main`: `5ea38a62fe1af8b8068adcb84350e9644905943c`, tree `1024b0a7c32cab87e74655fba2a8cb7463cb3d44`.
- PR #342 before persistence: open, draft, branch `docs/issue-315-audit-evidence-20260906`, head `d128a7da4f394a4b2fa2d56cc1728d25d36b87c2`.
- Issue #315: open; current root/maintenance authority records the maintenance freeze as active.
- Repository ruleset `22103758`: active, strict required check `Merge authority audit / protected-base validate` (GitHub Actions app 15368), Merge Queue SQUASH/ALLGREEN.
- Organization ruleset `22352928`: active required workflow `.github/workflows/merge-authority-audit.yml` from protected main.
- Active workflow inventory on current main: `.github/workflows/merge-authority-audit.yml`, `.github/workflows/merge-group-gate.yml`, `.github/workflows/terminal-branch-lifecycle.yml`.
- Latest read merge-group evidence for current main: run `34139939000`, event `merge_group`, head `5ea38a62...`, `Merge authority audit`, conclusion `success`; companion maintenance Merge Queue gate run `34139938934`, conclusion `success`.
- Current open PR census returned 8 open PRs. PR #344 is an overlapping product/UI draft but does not change current main; PR #342 remains the audit evidence branch.

## EXECUTED_THIS_AUDIT

Two pure, non-destructive local semantic probes were executed from current inspected logic:

1. Canonical JSON ordering vector `{ "10": "a", "2": "b" }`:
   - JavaScript object reconstruction/sort + `JSON.stringify` -> `{"2":"b","10":"a"}`;
   - Python `json.dumps(..., sort_keys=True, separators=(",", ":"))` -> `{"10":"a","2":"b"}`.
   - Result: cross-language bytes disagree.
2. URL resolution against base `https://atlas.example/pub/semantic/`:
   - `chunks/a.json` -> same directory;
   - `%2e%2e/evil.json` -> `https://atlas.example/pub/evil.json`;
   - `a/%2e%2e/evil.json` -> `https://atlas.example/pub/semantic/evil.json`;
   - `http:evil.example/x` -> `http://evil.example/x`.
   - Result: textual segment validation alone does not establish resolved-directory/origin confinement.

No product build, browser E2E, deployment, publication or destructive mutation experiment was executed.

## STATIC_CODE_INSPECTION

Current-source inspection covered the material active/controller and product seams, including:

- root authority, binding, active task/operation docs and maintenance authority;
- all three active Atlas workflows and ruleset contracts;
- pinned Platform branch-lifecycle reusable workflows and their transitive Python implementations at `Oteryn/Oteryn-Platform@e145f7c03bd0b15f0b0fecc0f6fae7884fe3e0db`;
- bound META organization/prompt/eval policy and central validator family at `Oteryn/Oteryn@1dedfc0f264fe0e23e5365dbe9280c2d96df50c5`;
- current runtime/load/trust/cache/render/search/creature/farm/browser seams under `src/**`, authored `web/**`, and non-suspended build/governance tooling;
- maintenance validator/test;
- E2E configuration, capability inventory/catalog, representative oracle/config files;
- current security, rights, deployment/recovery and dependency-update documentation.

The current delta from original audited main `51623c7...` to final audited main is five commits and 22 paths, all governance/documentation/tool-governance changes; runtime/product/E2E/build data-path source is unchanged. The changed active authority surfaces were re-read at the current revision.

## HISTORICAL_RECORDED_RESULT

Rounds 1–3 retain historical TAP/JSON/log/browser/probe results. They remain useful reproduction evidence only where source identity still matches. They were **not rerun** during this closure and are not represented as current product qualification.

In particular:

- historical performance/probe PASS results are not new PASS results;
- historical Synology acceptance is not current deployment acceptance;
- prior maintenance mutation probes support F03 but current static inspection independently confirms the broad path rule;
- previous browser failures/successes are not current browser status.

## NOT EXECUTED / NOT CLAIMED

- full current `npm`/Python/unit suite;
- exact-head Playwright/E2E product suite;
- current real_fullworld generation/census/soak;
- CodeQL/SAST/secret-history/SBOM/CVE scan;
- current Synology deployment or live acceptance;
- rollback exercise;
- visual screenshot approval.

These omissions limit product/deployment/security qualification claims, not repository audit coverage. The current maintenance state intentionally suspends those execution paths.
