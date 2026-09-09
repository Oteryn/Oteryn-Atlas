# Atlas META Agent Policy v3 Adoption

**Lifecycle authority:** Oteryn/Oteryn-Atlas#315; organization programme Oteryn/Oteryn#140 and #142

**Atlas admission main:** `51623c7dab2346cee39cd51e3caa845bf4b65426`

**Bound META authority:** `ed6c8c98605a7fbfea858e0ef616f89baa617262`

**Live META main observed by the corrected adoption resolver:** `ed6c8c98605a7fbfea858e0ef616f89baa617262`

This maintenance-only adoption binds Atlas to `OTERYN_ORGANIZATION_AGENT_POLICY@3.1.0`, reduces the root instructions to an organization-policy bootstrap plus Atlas-owned invariants, and installs a fail-closed consumer for the binding, root overlay, and reusable prompt catalog. It authors no Atlas runtime, publication-data, rendering, deployment, workflow, branch-protection, verification-code, verification-workflow, or verification-settings activation change. The binding itself is a declared verification-authority component, however, so this repin intentionally changes verification authority identity and invalidates reuse of verification evidence across this protected-base advance.

The initial #345 binding selected the v3 introduction merge `8673d109d1a364efa7936133082a39750ca74cf9`. The central human policy and validator were unchanged afterward, but referenced execution and continuation machine authorities received material corrections in META #155/#158 and META `main` advanced through #159/#160. The first follow-up binding therefore selected `1dedfc0f264fe0e23e5365dbe9280c2d96df50c5`. Protected META PR #188 later integrated as `d1caa3adba0fa4b32b84985bf1d6dcbe8055858c`. After protected META PR #192 integrated through the real Merge Queue as `ed6c8c98605a7fbfea858e0ef616f89baa617262`, this adoption repins to that exact protected revision so Atlas consumes policy 3.1.0 and its native exact-head `merge-async` Merge Queue contract, including receipt-bound causal readback, real `merge_group` verification and protected-main readback.

## Verification-authority effect

The reviewed protected-base verification-authority digest is `sha256:8b0fd509627c6e2e274061a8d4fa7cd8332f463935b5ce2df84ca62cc250bf26`; the reviewed 3.1 adoption candidate digest is `sha256:5ec2c8624a208e829566c2374759b42faef46c45640e150b4de14c1b74fdb2f3`. Because `docs/agents/META_AGENT_POLICY_BINDING.json` participates in the declared verification-authority manifest, `classifyBaseAdvance` must classify this authority transition as `FULL_RERUN`; prior verification evidence is not reusable across this protected-base advance. This maintenance PR does not itself re-enable or execute the suspended heavy verification stack. It only records the truthful authority-identity consequence of the repin and leaves execution to the repository's protected verification policy.

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

`.agents/**` and `.codex/**` are outside the active maintenance allowlist, so W3B execution-configuration changes are not admitted. The current maintenance workflows already keep the heavy runtime stack suspended and use protected-base diff validation; no W6 workflow/gate implementation change is authored by this adoption. The verification-authority identity change above is nevertheless real and must be handled by protected `FULL_RERUN` qualification rather than evidence reuse.
