# Atlas Documentation and Agent Information Architecture

**Artifact class:** `GOVERNANCE_POLICY`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Status:** ACTIVE

## Purpose

Keep Atlas agent documentation simple by assigning one authority to each concern. This policy does not change product/runtime behavior, verification gates, provenance, deployment authority, branch protection, or Oteryn-Game ownership of World/Content facts.

## Authority model

- `docs/agents/prompts/*.md` are reusable prompt contracts. They describe task outcomes, bounded scope, Atlas-specific invariants, and observable acceptance.
- GitHub Issues are mutable lifecycle authority. Open/closed state, current ownership, blockers, and terminal disposition come from live GitHub state rather than a repository-maintained mirror.
- Git history is provenance. Merged commits, pull requests, and historical files preserve what was authorized and delivered without a second mutable status database.
- `docs/agents/tasks/active` is a convenience cache. A packet there may help execution, but it cannot override its owning GitHub Issue, current protected `main`, or newer merged authority.

There is no machine-readable prompt/task lifecycle registry. Do not recreate `DOCUMENTATION_AGENT_IA.json` or an equivalent mutable mirror merely to duplicate GitHub state.

## Prompt contract

Reusable task prompts should be task-specific deltas. Prefer only the information that materially changes execution: outcome, bounded scope, provider-specific invariants, and acceptance. Repository-wide authorization, tool routing, review, verification, Merge Queue, credential, and deployment rules are inherited from current repository authority rather than copied into every prompt.

A historical prompt may remain in Git as provenance. Its presence does not make it dispatchable. Starting or continuing mutable work requires a live GitHub Issue or other current repository authority.

## Task lifecycle

Keep a task packet under `docs/agents/tasks/active` only while its owning Issue is live and the packet remains useful. When the Issue is terminal, archive the packet without rewriting its historical bytes.

Live-state reconciliation on 2026-09-04 established:

- `ATLAS-FULLWORLD-COORDINATOR.md` remains active under open Issue #11.
- `ATLAS-HUNT-INTELLIGENCE-PROJECT.md` remains active under open Issue #117.
- `ATLAS-CREATURE-GAMEPLAY-PROFILES.md` is archived because Issue #165 is completed.
- `ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md` is archived because Issue #115 is completed.
- `ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING.md` is archived because Issue #272 is completed.

If cached text conflicts with live Issue state or protected `main`, use live GitHub and merged repository state and repair/archive the cache as maintenance; do not invent another registry.

## Atlas invariants

- Oteryn-Game remains canonical World/Content authority; Atlas is a derived semantic projection.
- Preserve accepted provenance and publication boundaries.
- Ordinary browser verification remains GitHub-hosted and capability-scoped; specialist FullWorld execution remains explicitly routed.
- Live deployment authority remains merged-main-only under the repository's current deployment policy.
- Historical handoffs, task packets, prompts, or local paths never override current protected repository and GitHub lifecycle authority.

## Validation and supersession

Deterministic repository tests may validate structural invariants such as the absence of duplicate mutable authority, active/archive placement, and lean prompt shape. They must not become a second lifecycle database.

A successor changes this policy only when the authority model itself changes. Ordinary task lifecycle changes belong in GitHub Issues and Git history, not in a synchronized registry snapshot.
