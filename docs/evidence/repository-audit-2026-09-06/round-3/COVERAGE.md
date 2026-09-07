# Round 3 coverage reconciliation

The local reconciled ledger contains 234 evidence rows. This is not the full tracked-file denominator for the repository and must not be interpreted as a repository-wide coverage percentage.

## Counts

| Repository/surface | Rows | DIRECT | PARTIAL | UNVERIFIED |
|---|---:|---:|---:|---:|
| `Oteryn/Oteryn-Atlas` | 228 | 150 | 2 | 76 |
| `Oteryn/Oteryn` referenced authority | 1 | 0 | 0 | 1 |
| Platform references discovered from Atlas workflow | 5 | 1 | 0 | 4 |
| **Total** | **234** | **151** | **2** | **81** |

`DIRECT` means the relevant file content was inspected during the audit. It does not mean an executable test represented by that file was rerun. `PARTIAL` means only part of the file was visible or inspected. `UNVERIFIED` means the file/surface was identified but not semantically reviewed or could not be closed with the available evidence.

## Important direct-review groups

- all three active Atlas workflows on the audited main;
- the protected-base maintenance diff validator;
- substantial E2E harness configuration and Playwright support code;
- many desktop/mobile E2E specs including accessibility, search, creature gameplay, geometry, race/fault, performance, soak, user journeys and visual tests;
- numerous browser/runtime modules, product validators and generator/build scripts;
- selected governance and Platform reusable-workflow evidence;
- original round-1/round-2 audit manifests and preserved evidence.

## Important remaining gaps

- complete tracked-path inventory and disposition for every file;
- complete review of all `docs/**`, nested instructions, prompts and governance references;
- complete closure of all `src/**`, `web/**`, `tools/**` and test files not directly inspected;
- full Platform mutation-reusable and every called lifecycle script;
- current authoritative dependency/CVE/licensing audit;
- real-browser visual inspection and full product qualification for the audited SHA;
- current deployment/live rollback execution;
- independent byte-for-byte reconciliation of all 77 imported files against both original supplied archives in this continuation pass.

Because these gaps remain, the audit status is `INCOMPLETE`.
