#!/usr/bin/env python3
from __future__ import annotations

import copy
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "docs/agents/DOCUMENTATION_AGENT_IA.json"
VALIDATOR = ROOT / "tools/governance/validate_documentation_ia.py"
PROMPTS = ROOT / "docs/agents/prompts"
ACTIVE_TASKS = ROOT / "docs/agents/tasks/active"
AUDIT_START_HEAD = "b8235bd4f46947aa54dfc2f19c96d3bc21e64283"
REQUIRED_GAPS = {
    "GAP-DOCS-PROVIDER-CURRENT-001",
    "GAP-DOCS-ATLAS-ARCH-001",
    "GAP-DOCS-ATLAS-CONTRACT-001",
    "GAP-DOCS-ATLAS-GOV-001",
    "GAP-DOCS-ATLAS-POLICY-001",
    "GAP-DOCS-ATLAS-TEST-001",
    "GAP-DOCS-ATLAS-OPS-001",
    "GAP-DOCS-ATLAS-RECOVERY-001",
    "GAP-PROMPT-ATLAS-001",
    "GAP-TASK-ATLAS-001",
}
ALLOWED_DISPOSITIONS = {
    "KEEP_EXISTING",
    "CREATE_CANONICAL_ARTIFACT",
    "NOT_NEEDED",
    "BLOCKED",
}


def load_registry() -> dict:
    if not REGISTRY.is_file():
        raise AssertionError("documentation IA registry must exist")
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def load_validator_module():
    if not VALIDATOR.is_file():
        raise AssertionError("documentation IA validator must exist")
    spec = importlib.util.spec_from_file_location("documentation_ia_validator", VALIDATOR)
    if spec is None or spec.loader is None:
        raise AssertionError("cannot load documentation IA validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DocumentationIATests(unittest.TestCase):
    def test_registry_is_sha_bound_and_complete(self) -> None:
        data = load_registry()
        self.assertEqual(data["schema_version"], 1)
        self.assertEqual(data["repository"], "Oteryn/Oteryn-Atlas")
        self.assertEqual(data["audit_start_head"], AUDIT_START_HEAD)
        self.assertRegex(data["audited_head"], re.compile(r"^[0-9a-f]{40}$"))
        self.assertRegex(data["material_inventory"]["root_tree"], re.compile(r"^[0-9a-f]{40}$"))
        self.assertEqual(set(data["gap_dispositions"]), REQUIRED_GAPS)
        self.assertTrue(set(data["gap_dispositions"].values()) <= ALLOWED_DISPOSITIONS)

    def test_every_prompt_is_registered_once(self) -> None:
        data = load_registry()
        expected = sorted(path.name for path in PROMPTS.glob("*.md"))
        actual = sorted(item["file"] for item in data["prompts"])
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), len(set(actual)))
        for item in data["prompts"]:
            self.assertEqual(item["id"], Path(item["file"]).stem)
            self.assertEqual(item["authority_owner"], "Oteryn/Oteryn-Atlas")
            self.assertIn(item["class"], {"PROMPT_TASK_EXECUTION", "PROMPT_ONE_SHOT"})
            self.assertIn(item["status"], {"ACTIVE", "HISTORICAL"})
            self.assertEqual(item["version"], 1)
            self.assertTrue(item["scope"])
            self.assertTrue(item["input_contract"])
            self.assertTrue(item["output_contract"])
            self.assertTrue(item["validation_contract"])
            self.assertTrue(item["prohibited_actions"])
            self.assertRegex(item["blob_sha"], re.compile(r"^[0-9a-f]{40}$"))
            self.assertTrue(item["lifecycle_issue"].startswith("https://github.com/Oteryn/Oteryn-Atlas/issues/"))
            self.assertIn(item["terminal_disposition"], {"ARCHIVE_HISTORICAL", "ON_ISSUE_CLOSE_ARCHIVE_HISTORICAL"})
            if item["status"] == "HISTORICAL":
                self.assertEqual(item["class"], "PROMPT_ONE_SHOT")
                self.assertEqual(item["terminal_disposition"], "ARCHIVE_HISTORICAL")

    def test_every_active_task_is_registered_once_with_issue_authority(self) -> None:
        data = load_registry()
        expected = sorted(path.name for path in ACTIVE_TASKS.glob("*.md"))
        actual = sorted(item["file"] for item in data["active_tasks"])
        self.assertEqual(actual, expected)
        self.assertEqual(len(actual), len(set(actual)))
        for item in data["active_tasks"]:
            self.assertEqual(item["class"], "TASK_PACKET_ACTIVE")
            self.assertEqual(item["authority"], "GITHUB_ISSUE")
            self.assertEqual(item["verified_issue_state"], "open")
            self.assertTrue(item["issue"].startswith("https://github.com/Oteryn/Oteryn-Atlas/issues/"))
            self.assertRegex(item["blob_sha"], re.compile(r"^[0-9a-f]{40}$"))

    def test_created_and_existing_artifacts_resolve(self) -> None:
        data = load_registry()
        for gap, disposition in data["gap_dispositions"].items():
            paths = data["gap_artifacts"].get(gap, [])
            if disposition in {"CREATE_CANONICAL_ARTIFACT", "KEEP_EXISTING"}:
                self.assertTrue(paths, f"{gap} needs evidence paths")
                for relative in paths:
                    self.assertTrue((ROOT / relative).is_file(), f"missing evidence artifact: {relative}")
            elif disposition == "NOT_NEEDED":
                self.assertTrue(data["not_needed_reasons"].get(gap), f"{gap} needs an evidence-backed NOT_NEEDED reason")

    def test_terminal_fullworld_handover_is_historical_non_authoritative_evidence(self) -> None:
        data = load_registry()
        handover = data["historical_handovers"][0]
        self.assertEqual(handover["path"], "docs/evidence/fullworld-generation/handoff-summary.json")
        self.assertEqual(handover["blob_sha"], "12f9aa0426596b7128f3455d068daa46dced8b1d")
        self.assertEqual(handover["class"], "HANDOVER_CACHE")
        self.assertFalse(handover["authoritative"])
        self.assertEqual(handover["disposition"], "ARCHIVE_HISTORICAL")

    def test_provenance_pinned_ci_finding_is_recorded_without_ci_mutation(self) -> None:
        data = load_registry()
        findings = data["out_of_scope_findings"]
        self.assertTrue(any("913cedcae9423e9487fb2849fe4644e31ed82a55" in finding for finding in findings))
        self.assertEqual(data["recommendation_dispositions"]["REC-DOCS-007"]["disposition"], "KEEP_EXISTING")
        self.assertEqual(data["recommendation_dispositions"]["REC-DOCS-007"]["ci_workflow_blob"], "913cedcae9423e9487fb2849fe4644e31ed82a55")

    def test_validator_accepts_canonical_registry(self) -> None:
        module = load_validator_module()
        errors = module.validate_registry(ROOT, load_registry())
        self.assertEqual(errors, [])

    def test_validator_rejects_duplicate_and_missing_prompt(self) -> None:
        module = load_validator_module()
        data = load_registry()
        duplicate = copy.deepcopy(data)
        duplicate["prompts"].append(copy.deepcopy(duplicate["prompts"][0]))
        self.assertTrue(any("duplicate prompt registry entry" in error for error in module.validate_registry(ROOT, duplicate)))

        missing = copy.deepcopy(data)
        missing["prompts"] = missing["prompts"][1:]
        self.assertTrue(any("prompt registry mismatch" in error for error in module.validate_registry(ROOT, missing)))

    def test_validator_rejects_duplicate_and_missing_active_task(self) -> None:
        module = load_validator_module()
        data = load_registry()
        duplicate = copy.deepcopy(data)
        duplicate["active_tasks"].append(copy.deepcopy(duplicate["active_tasks"][0]))
        self.assertTrue(any("duplicate active task registry entry" in error for error in module.validate_registry(ROOT, duplicate)))

        missing = copy.deepcopy(data)
        missing["active_tasks"] = missing["active_tasks"][1:]
        self.assertTrue(any("active task registry mismatch" in error for error in module.validate_registry(ROOT, missing)))

    def test_validator_rejects_invalid_disposition_and_prompt_status(self) -> None:
        module = load_validator_module()
        data = load_registry()
        bad_disposition = copy.deepcopy(data)
        bad_disposition["gap_dispositions"]["GAP-DOCS-ATLAS-ARCH-001"] = "OPTIONAL"
        self.assertTrue(any("invalid gap disposition" in error for error in module.validate_registry(ROOT, bad_disposition)))

        bad_status = copy.deepcopy(data)
        bad_status["prompts"][0]["status"] = "DONE"
        self.assertTrue(any("invalid prompt status" in error for error in module.validate_registry(ROOT, bad_status)))

    def test_validator_rejects_missing_canonical_artifact(self) -> None:
        module = load_validator_module()
        data = load_registry()
        mutated = copy.deepcopy(data)
        mutated["gap_artifacts"]["GAP-DOCS-ATLAS-OPS-001"] = ["docs/operations/DOES-NOT-EXIST.md"]
        self.assertTrue(any("missing evidence artifact" in error for error in module.validate_registry(ROOT, mutated)))

    def test_validator_rejects_prompt_blob_drift(self) -> None:
        module = load_validator_module()
        data = load_registry()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "docs/agents/prompts").mkdir(parents=True)
            (root / "docs/agents/tasks/active").mkdir(parents=True)
            for item in data["prompts"]:
                source = PROMPTS / item["file"]
                target = root / "docs/agents/prompts" / item["file"]
                target.write_bytes(source.read_bytes())
            for item in data["active_tasks"]:
                source = ACTIVE_TASKS / item["file"]
                target = root / "docs/agents/tasks/active" / item["file"]
                target.write_bytes(source.read_bytes())
            for path in {
                relative
                for values in data["gap_artifacts"].values()
                for relative in values
            } | {item["path"] for item in data["historical_handovers"]}:
                source = ROOT / path
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                if source.is_file():
                    target.write_bytes(source.read_bytes())
            target_prompt = root / "docs/agents/prompts" / data["prompts"][0]["file"]
            target_prompt.write_text(target_prompt.read_text(encoding="utf-8") + "\nDRIFT\n", encoding="utf-8")
            errors = module.validate_registry(root, data)
            self.assertTrue(any("prompt blob drift" in error for error in errors))


if __name__ == "__main__":
    unittest.main(verbosity=2)
