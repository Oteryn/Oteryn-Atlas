# Atlas META Agent Policy v3 Adoption

**Lifecycle authority:** Oteryn/Oteryn-Atlas#315; organization programme Oteryn/Oteryn#140 and #142

**Atlas admission main:** `51623c7dab2346cee39cd51e3caa845bf4b65426`

**Bound META authority:** `1dedfc0f264fe0e23e5365dbe9280c2d96df50c5`

**Live META main observed by the corrected adoption resolver:** `1dedfc0f264fe0e23e5365dbe9280c2d96df50c5`

This maintenance-only adoption binds Atlas to `OTERYN_ORGANIZATION_AGENT_POLICY@3.0.0`, reduces the root instructions to an organization-policy bootstrap plus Atlas-owned invariants, and installs a fail-closed consumer for the binding, root overlay, and reusable prompt catalog. It does not change runtime, publication data, rendering, deployment, workflows, branch protection, or the suspended verification stack.

The initial #345 binding selected the v3 introduction merge `8673d109d1a364efa7936133082a39750ca74cf9`. The central human policy and validator were unchanged afterward, but referenced execution and continuation machine authorities received material corrections in META #155/#158 and META `main` advanced through #159/#160. The follow-up binding therefore selects `1dedfc0f264fe0e23e5365dbe9280c2d96df50c5` so the immutable provider authority includes the corrected machine modules as well as policy v3.

## Evidence levels

- **Contract checks:** the binding has the closed central schema; the authority pin resolves to a protected-META-main ancestor; central policy identity and human surfaces match; Atlas root and all 38 reusable prompts pass the authenticated validator from the pinned commit.
- **Adoption and delivery:** root `AGENTS.md` contains the affirmative binding bootstrap, and the provider consumer loads policy and validator bytes from that exact authenticated commit. This proves the repository delivery path used by the validator; it does not claim every external client automatically loads remote META text.
- **Behavior:** `ATLAS-LEAN-PROMPT-CANARY.md` remains the representative task-delta contract and its deterministic structural test passes. New controlled model trials were **NOT_EVALUATED** in this maintenance lane, so static checks and reduced text volume are not represented as behavioral improvement.

## Initial-adoption source volume

These frozen #345 measurements compare UTF-8 tracked source at Atlas admission main with the initial META-adoption candidate before its commit. They do not include the later W4 prompt cleanup recorded below. Lines use `splitlines()`; words use whitespace splitting.

| Surface | Files before → after | Lines before → after | Words before → after | Bytes before → after |
| --- | ---: | ---: | ---: | ---: |
| root `AGENTS.md` | 1 → 1 | 151 → 62 | 2,860 → 947 | 22,060 → 7,447 |
| reusable prompts | 38 → 38 | 9,008 → 9,009 | 51,587 → 51,602 | 403,160 → 403,288 |
| all `docs/agents/**` | 45 → 46 | 10,572 → 10,582 | 58,439 → 58,499 | 460,633 → 461,441 |
| `tools/governance/**` | 3 → 5 | 388 → 826 | 1,395 → 2,780 | 17,010 → 35,263 |

The always-loaded root is 66.9% smaller by words and 66.2% smaller by bytes. Total tracked adoption-surface size grows because the deterministic provider consumer and its regression suite are retained outside the always-loaded instruction surface.

## W4 prompt-cleanup inventory

The authenticated central validator accepts all 38 current reusable prompts. The W4 scan found seven explicit GitHub-first procedure headings. Live ownership allowed six to be reduced to task-specific locators and dependencies while retaining their Atlas domain and acceptance contracts:

| Prompt | Words before → after | Bytes before → after | W4 result |
| --- | ---: | ---: | --- |
| `ATLAS-CREATURE-INTERACTION-CARDS.md` | 1,815 → 1,724 | 14,185 → 13,584 | duplicated procedure removed |
| `ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md` | 2,680 → 2,574 | 19,835 → 19,096 | duplicated procedure removed |
| `ATLAS-CREATURE-PRESENTATION-INTEGRATOR-RESUME.md` | 1,860 → 1,799 | 14,083 → 13,690 | duplicated procedure removed |
| `ATLAS-CREATURE-PRESENTATION-INTEGRATOR.md` | 1,266 → 1,217 | 9,939 → 9,599 | duplicated procedure removed |
| `ATLAS-CREATURE-WALKING-IN-PLACE-ANIMATION.md` | 3,049 → 2,993 | 22,766 → 22,428 | duplicated procedure removed |
| `ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md` | 5,610 → 5,610 | 45,564 → 45,564 | deferred: open PR #346 owns this path |
| `ATLAS-PRODUCTION-UI-SHELL-V1.md` | 1,200 → 1,147 | 9,974 → 9,550 | duplicated procedure removed |

Across the six edited prompts, this removes 416 words and 2,835 bytes. The open-PR overlap is a concrete ownership deferral, not a validator or freeze bypass. The remaining 31 prompts had no heading match in this bounded scan; that is not a semantic-ablation verdict. This table remains point-in-time cleanup evidence, not a dispatch or lifecycle registry.

## Deferred execution configuration and W6

`.agents/**` and `.codex/**` are outside the active maintenance allowlist, so W3B execution-configuration changes are not admitted. The current maintenance workflows already keep the heavy runtime stack suspended and use protected-base diff validation; no W6 workflow/gate change is justified by this adoption.
