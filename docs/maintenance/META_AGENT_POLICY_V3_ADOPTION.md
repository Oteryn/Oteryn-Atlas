# Atlas META Agent Policy v3 Adoption

**Lifecycle authority:** Oteryn/Oteryn-Atlas#315; organization programme Oteryn/Oteryn#140 and #142  
**Atlas admission main:** `51623c7dab2346cee39cd51e3caa845bf4b65426`  
**Bound META authority:** `8673d109d1a364efa7936133082a39750ca74cf9` (META PR #145)  
**Live META main observed by the adoption resolver:** `16a9718e5fe54ab1c153fe78aac789e9bc5da64e`

This maintenance-only adoption binds Atlas to `OTERYN_ORGANIZATION_AGENT_POLICY@3.0.0`, reduces the root instructions to an organization-policy bootstrap plus Atlas-owned invariants, and installs a fail-closed consumer for the binding, root overlay, and reusable prompt catalog. It does not change runtime, publication data, rendering, deployment, workflows, branch protection, or the suspended verification stack.

## Evidence levels

- **Contract checks:** the binding has the closed central schema; the authority pin resolves to a protected-META-main ancestor; central policy identity and human surfaces match; Atlas root and all 38 reusable prompts pass the authenticated validator from the pinned commit.
- **Adoption and delivery:** root `AGENTS.md` contains the affirmative binding bootstrap, and the provider consumer loads policy and validator bytes from that exact authenticated commit. This proves the repository delivery path used by the validator; it does not claim every external client automatically loads remote META text.
- **Behavior:** `ATLAS-LEAN-PROMPT-CANARY.md` remains the representative task-delta contract and its deterministic structural test passes. New controlled model trials were **NOT_EVALUATED** in this maintenance lane, so static checks and reduced text volume are not represented as behavioral improvement.

## Source volume

Counts use UTF-8 tracked source at Atlas admission main and this candidate worktree before commit. Lines use `splitlines()`; words use whitespace splitting.

| Surface | Files before → after | Lines before → after | Words before → after | Bytes before → after |
| --- | ---: | ---: | ---: | ---: |
| root `AGENTS.md` | 1 → 1 | 151 → 60 | 2,860 → 887 | 22,060 → 7,040 |
| reusable prompts | 38 → 38 | 9,008 → 9,009 | 51,587 → 51,602 | 403,160 → 403,288 |
| all `docs/agents/**` | 45 → 46 | 10,572 → 10,582 | 58,439 → 58,499 | 460,633 → 461,441 |
| `tools/governance/**` | 3 → 5 | 388 → 826 | 1,395 → 2,780 | 17,010 → 35,263 |

The always-loaded root is 68.1% smaller by words and 68.1% smaller by bytes. Total tracked adoption-surface size grows because the deterministic provider consumer and its regression suite are retained outside the always-loaded instruction surface.

## W4 prompt-cleanup inventory

The authenticated central validator accepts all 38 current reusable prompts. Seven still contain explicit GitHub-first procedure headings that are candidates for later semantic ablation and cleanup:

| Prompt | Words | Bytes | Candidate duplicated heading |
| --- | ---: | ---: | --- |
| `ATLAS-CREATURE-INTERACTION-CARDS.md` | 1,815 | 14,185 | Mandatory GitHub-first preflight |
| `ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md` | 2,680 | 19,835 | Mandatory GitHub-first preflight |
| `ATLAS-CREATURE-PRESENTATION-INTEGRATOR-RESUME.md` | 1,860 | 14,083 | Mandatory GitHub-first resume gate |
| `ATLAS-CREATURE-PRESENTATION-INTEGRATOR.md` | 1,266 | 9,939 | Mandatory GitHub-first refresh |
| `ATLAS-CREATURE-WALKING-IN-PLACE-ANIMATION.md` | 3,049 | 22,766 | Mandatory GitHub-first preflight |
| `ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md` | 5,610 | 45,564 | GitHub-first preflight |
| `ATLAS-PRODUCTION-UI-SHELL-V1.md` | 1,200 | 9,974 | Mandatory GitHub-first preflight |

This is a point-in-time cleanup inventory, not a dispatch or lifecycle registry. W4 must refresh each prompt's live Issue/ownership and preserve task-specific domain and acceptance content before editing or retiring it. The remaining 31 prompts have no heading match from this bounded scan; that is not a semantic-ablation verdict.

## Deferred execution configuration and W6

`.agents/**` and `.codex/**` are outside the active maintenance allowlist, so W3B execution-configuration changes are not admitted. The current maintenance workflows already keep the heavy runtime stack suspended and use protected-base diff validation; no W6 workflow/gate change is justified by this adoption.
