#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "docs/agents/DOCUMENTATION_AGENT_IA.json"
CANARY = ROOT / "docs/agents/prompts/ATLAS-LEAN-PROMPT-CANARY.md"

EXPECTED_SECTIONS = ["Outcome", "Scope", "Atlas invariants", "Acceptance"]
EXPECTED_HISTORICAL = {
    "ATLAS-CREATURE-GAMEPLAY-PROFILES.md",
    "ATLAS-CREATURE-INTERACTION-CARDS.md",
    "ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md",
    "ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING.md",
    "ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md",
    "ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION-P0-AMENDMENT.md",
    "ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION-DATA-CAPABILITY-AMENDMENT.md",
    "ATLAS-E2E-VERIFICATION-OPTIMIZATION-PRO-REVIEW.md",
    "ATLAS-ITEM-SPAWN-FARM-EXPLORER.md",
}


def fail(message: str) -> None:
    raise AssertionError(message)


def main() -> int:
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    contract = data.get("lean_prompt_contract")
    if not isinstance(contract, dict):
        fail("missing lean_prompt_contract")
    if contract.get("mode") != "task_delta":
        fail("lean prompt mode must be task_delta")
    if contract.get("required_sections") != EXPECTED_SECTIONS:
        fail("lean prompt required sections changed")
    if contract.get("inherits_repository_policy") is not True:
        fail("lean prompts must inherit repository policy")

    text = CANARY.read_text(encoding="utf-8")
    sections = [line[3:].strip() for line in text.splitlines() if line.startswith("## ")]
    if sections != EXPECTED_SECTIONS:
        fail(f"canary must contain only the lean task-delta sections: {sections}")

    for forbidden in contract.get("forbidden_copied_sections", []):
        if f"## {forbidden}" in text:
            fail(f"canary copied repository-wide policy section: {forbidden}")

    records = {item["file"]: item for item in data["prompts"]}
    canary = records.get(CANARY.name)
    if not canary:
        fail("lean canary is not registered")
    if canary["status"] != "ACTIVE" or canary["class"] != "PROMPT_TASK_EXECUTION":
        fail("lean canary must be an active execution prompt")
    if not canary["lifecycle_issue"].endswith("/322"):
        fail("lean canary must bind to Issue #322")

    for filename in sorted(EXPECTED_HISTORICAL):
        item = records.get(filename)
        if not item:
            fail(f"expected historical prompt missing from registry: {filename}")
        if item["status"] != "HISTORICAL" or item["class"] != "PROMPT_ONE_SHOT":
            fail(f"completed lifecycle still appears dispatchable: {filename}")

    active_tasks = {item["file"] for item in data["active_tasks"]}
    if active_tasks != {"ATLAS-FULLWORLD-COORDINATOR.md", "ATLAS-HUNT-INTELLIGENCE-PROJECT.md"}:
        fail(f"stale task packets remain active: {sorted(active_tasks)}")

    print("Atlas lean prompt contract PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
