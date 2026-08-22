# Atomic Animation Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent merged-main deployments from exposing the new Atlas frontend before its matching creature and animation products are available.

**Architecture:** Keep the current live revision untouched while staging the exact merged-main repository and generated products into a revision-scoped candidate root. Qualify that candidate, then atomically replace the live container and retain the previous container for rollback until Chromium E2E passes.

**Tech Stack:** GitHub Actions YAML, Docker, Node.js `node:test`, Playwright/Chromium acceptance.

**Spec:** `Oteryn/Oteryn-Atlas#49` plus repository `AGENTS.md` live deployment authority.

## Global Constraints
- Deploy only merged `main` and exact `github.sha`.
- Preserve rollback to the previous merged-main container.
- Keep exact-source deterministic animation generation.
- Do not weaken repository gates or provenance checks.

## Task 1: Regression guard
- [ ] Add a failing workflow-order test proving live cutover occurs only after staged products and candidate product verification.
- [ ] Run the focused test and record the expected failure.

## Task 2: Atomic candidate publication
- [ ] Change the early deployment step to stage code/config only and export candidate paths.
- [ ] Stage creature/animation products into the candidate revision root.
- [ ] Qualify the candidate product endpoints before stopping the existing live container.
- [ ] Cut over only after candidate qualification, preserving rollback outputs for cleanup.

## Task 3: Verification and integration
- [ ] Run focused workflow tests and repository-selected checks.
- [ ] Review the complete diff, commit, push one task branch, open one PR, and wait for exact-head gates.
- [ ] Squash merge, wait for merged-main Synology live acceptance, independently verify no 404 and exact revision/product linkage, then close #49.
