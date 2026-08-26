#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

REGISTRY_PATH = Path("docs/agents/DOCUMENTATION_AGENT_IA.json")
PROMPT_DIR = Path("docs/agents/prompts")
ACTIVE_TASK_DIR = Path("docs/agents/tasks/active")
REPOSITORY = "Oteryn/Oteryn-Atlas"
SCHEMA_VERSION = 1
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
PROMPT_CLASSES = {"PROMPT_TASK_EXECUTION", "PROMPT_ONE_SHOT"}
PROMPT_STATUSES = {"ACTIVE", "HISTORICAL"}
PROMPT_TERMINAL_DISPOSITIONS = {
    "ARCHIVE_HISTORICAL",
    "ON_ISSUE_CLOSE_ARCHIVE_HISTORICAL",
}
HEX40 = re.compile(r"^[0-9a-f]{40}$")
ATLAS_ISSUE = re.compile(r"^https://github\.com/Oteryn/Oteryn-Atlas/issues/[1-9][0-9]*$")


def git_blob_sha(path: Path) -> str:
    payload = path.read_bytes().replace(b"\r\n", b"\n")
    header = f"blob {len(payload)}\0".encode("ascii")
    return hashlib.sha1(header + payload).hexdigest()


def _duplicates(values: list[str]) -> list[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return sorted(duplicates)


def _files(directory: Path) -> list[str]:
    if not directory.is_dir():
        return []
    return sorted(path.name for path in directory.glob("*.md") if path.is_file())


def _require_mapping(data: dict[str, Any], key: str, errors: list[str]) -> dict[str, Any]:
    value = data.get(key)
    if not isinstance(value, dict):
        errors.append(f"{key} must be an object")
        return {}
    return value


def _require_list(data: dict[str, Any], key: str, errors: list[str]) -> list[Any]:
    value = data.get(key)
    if not isinstance(value, list):
        errors.append(f"{key} must be an array")
        return []
    return value


def validate_registry(root: Path, data: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    if data.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must be {SCHEMA_VERSION}")
    if data.get("repository") != REPOSITORY:
        errors.append(f"repository must be {REPOSITORY}")
    if data.get("status") != "ACTIVE":
        errors.append("registry status must be ACTIVE")
    for key in ("audit_start_head", "audited_head"):
        value = data.get(key)
        if not isinstance(value, str) or not HEX40.fullmatch(value):
            errors.append(f"{key} must be a 40-character lowercase commit SHA")

    inventory = _require_mapping(data, "material_inventory", errors)
    for key in (
        "root_tree",
        "docs_tree",
        "prompt_tree",
        "active_task_tree",
        "agents_instruction_blob",
        "codeowners_blob",
        "branch_lifecycle_adr_blob",
        "branch_lifecycle_policy_blob",
        "test_strategy_blob",
        "ci_workflow_blob",
        "fullworld_handoff_blob",
    ):
        value = inventory.get(key)
        if not isinstance(value, str) or not HEX40.fullmatch(value):
            errors.append(f"material_inventory.{key} must be a 40-character lowercase Git object id")

    dispositions = _require_mapping(data, "gap_dispositions", errors)
    actual_gaps = set(dispositions)
    if actual_gaps != REQUIRED_GAPS:
        missing = sorted(REQUIRED_GAPS - actual_gaps)
        extra = sorted(actual_gaps - REQUIRED_GAPS)
        errors.append(f"gap disposition set mismatch: missing={missing} extra={extra}")
    for gap, disposition in sorted(dispositions.items()):
        if disposition not in ALLOWED_DISPOSITIONS:
            errors.append(f"invalid gap disposition for {gap}: {disposition}")

    gap_artifacts = _require_mapping(data, "gap_artifacts", errors)
    not_needed = _require_mapping(data, "not_needed_reasons", errors)
    for gap, disposition in sorted(dispositions.items()):
        evidence_paths = gap_artifacts.get(gap, [])
        if not isinstance(evidence_paths, list) or not all(isinstance(path, str) and path for path in evidence_paths):
            errors.append(f"gap_artifacts.{gap} must be an array of repository paths")
            evidence_paths = []
        if disposition in {"CREATE_CANONICAL_ARTIFACT", "KEEP_EXISTING"} and not evidence_paths:
            errors.append(f"{gap} disposition {disposition} requires evidence artifacts")
        if disposition in {"CREATE_CANONICAL_ARTIFACT", "KEEP_EXISTING"}:
            for relative in evidence_paths:
                if not (root / relative).is_file():
                    errors.append(f"missing evidence artifact for {gap}: {relative}")
        if disposition == "NOT_NEEDED":
            reason = not_needed.get(gap)
            if not isinstance(reason, str) or not reason.strip():
                errors.append(f"{gap} NOT_NEEDED requires an evidence-backed reason")

    prompt_items = _require_list(data, "prompts", errors)
    prompt_records = [item for item in prompt_items if isinstance(item, dict)]
    if len(prompt_records) != len(prompt_items):
        errors.append("every prompt registry entry must be an object")
    prompt_names = [str(item.get("file", "")) for item in prompt_records]
    for duplicate in _duplicates(prompt_names):
        errors.append(f"duplicate prompt registry entry: {duplicate}")
    expected_prompts = _files(root / PROMPT_DIR)
    if sorted(prompt_names) != expected_prompts:
        errors.append(f"prompt registry mismatch: registered={sorted(prompt_names)} filesystem={expected_prompts}")

    required_prompt_fields = (
        "id",
        "file",
        "blob_sha",
        "class",
        "version",
        "status",
        "authority_owner",
        "scope",
        "input_contract",
        "output_contract",
        "prohibited_actions",
        "validation_contract",
        "lifecycle_issue",
        "issue_state_at_audit",
        "terminal_disposition",
        "supersedes",
        "superseded_by",
    )
    for item in prompt_records:
        filename = item.get("file")
        for field in required_prompt_fields:
            if field not in item:
                errors.append(f"prompt {filename!r} missing field {field}")
        if not isinstance(filename, str) or not filename.endswith(".md"):
            errors.append(f"invalid prompt file: {filename!r}")
            continue
        if item.get("id") != Path(filename).stem:
            errors.append(f"prompt id/file mismatch: {filename}")
        prompt_class = item.get("class")
        if prompt_class not in PROMPT_CLASSES:
            errors.append(f"invalid prompt class for {filename}: {prompt_class}")
        status = item.get("status")
        if status not in PROMPT_STATUSES:
            errors.append(f"invalid prompt status for {filename}: {status}")
        if item.get("version") != 1:
            errors.append(f"prompt version must be 1 for {filename}")
        if item.get("authority_owner") != REPOSITORY:
            errors.append(f"prompt authority_owner mismatch for {filename}")
        for field in ("scope", "input_contract", "output_contract", "prohibited_actions", "validation_contract"):
            value = item.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"prompt {filename} requires non-empty {field}")
        issue = item.get("lifecycle_issue")
        if not isinstance(issue, str) or not ATLAS_ISSUE.fullmatch(issue):
            errors.append(f"invalid prompt lifecycle issue for {filename}: {issue}")
        terminal = item.get("terminal_disposition")
        if terminal not in PROMPT_TERMINAL_DISPOSITIONS:
            errors.append(f"invalid prompt terminal disposition for {filename}: {terminal}")
        if status == "ACTIVE":
            if item.get("issue_state_at_audit") != "open":
                errors.append(f"active prompt must have open audited Issue state: {filename}")
            if terminal != "ON_ISSUE_CLOSE_ARCHIVE_HISTORICAL":
                errors.append(f"active prompt terminal lifecycle mismatch: {filename}")
        if status == "HISTORICAL":
            if item.get("issue_state_at_audit") != "closed":
                errors.append(f"historical prompt must have closed audited Issue state: {filename}")
            if terminal != "ARCHIVE_HISTORICAL":
                errors.append(f"historical prompt terminal lifecycle mismatch: {filename}")
        recorded_blob = item.get("blob_sha")
        prompt_path = root / PROMPT_DIR / filename
        if not isinstance(recorded_blob, str) or not HEX40.fullmatch(recorded_blob):
            errors.append(f"invalid prompt blob SHA for {filename}: {recorded_blob}")
        elif prompt_path.is_file():
            actual_blob = git_blob_sha(prompt_path)
            if actual_blob != recorded_blob:
                errors.append(f"prompt blob drift for {filename}: {actual_blob} != {recorded_blob}")

    task_items = _require_list(data, "active_tasks", errors)
    task_records = [item for item in task_items if isinstance(item, dict)]
    if len(task_records) != len(task_items):
        errors.append("every active task registry entry must be an object")
    task_names = [str(item.get("file", "")) for item in task_records]
    for duplicate in _duplicates(task_names):
        errors.append(f"duplicate active task registry entry: {duplicate}")
    expected_tasks = _files(root / ACTIVE_TASK_DIR)
    if sorted(task_names) != expected_tasks:
        errors.append(f"active task registry mismatch: registered={sorted(task_names)} filesystem={expected_tasks}")

    for item in task_records:
        filename = item.get("file")
        if not isinstance(filename, str) or not filename.endswith(".md"):
            errors.append(f"invalid active task file: {filename!r}")
            continue
        if item.get("id") != Path(filename).stem:
            errors.append(f"active task id/file mismatch: {filename}")
        if item.get("class") != "TASK_PACKET_ACTIVE":
            errors.append(f"invalid active task class for {filename}: {item.get('class')}")
        if item.get("authority") != "GITHUB_ISSUE":
            errors.append(f"active task authority must be GITHUB_ISSUE: {filename}")
        issue = item.get("issue")
        if not isinstance(issue, str) or not ATLAS_ISSUE.fullmatch(issue):
            errors.append(f"invalid active task Issue for {filename}: {issue}")
        if item.get("verified_issue_state") != "open":
            errors.append(f"active task must have verified open Issue state: {filename}")
        acceptance = item.get("acceptance")
        if not isinstance(acceptance, str) or not acceptance.strip():
            errors.append(f"active task requires acceptance/lifecycle statement: {filename}")
        recorded_blob = item.get("blob_sha")
        task_path = root / ACTIVE_TASK_DIR / filename
        if not isinstance(recorded_blob, str) or not HEX40.fullmatch(recorded_blob):
            errors.append(f"invalid active task blob SHA for {filename}: {recorded_blob}")
        elif task_path.is_file():
            actual_blob = git_blob_sha(task_path)
            if actual_blob != recorded_blob:
                errors.append(f"active task blob drift for {filename}: {actual_blob} != {recorded_blob}")

    handovers = _require_list(data, "historical_handovers", errors)
    if len(handovers) != 1 or not isinstance(handovers[0], dict):
        errors.append("historical_handovers must contain exactly one classified FullWorld handover")
    else:
        handover = handovers[0]
        expected_path = "docs/evidence/fullworld-generation/handoff-summary.json"
        if handover.get("path") != expected_path:
            errors.append(f"historical handover path mismatch: {handover.get('path')}")
        if handover.get("class") != "HANDOVER_CACHE":
            errors.append("historical FullWorld handover class must be HANDOVER_CACHE")
        if handover.get("authoritative") is not False:
            errors.append("historical FullWorld handover must be non-authoritative")
        if handover.get("status") != "HISTORICAL" or handover.get("disposition") != "ARCHIVE_HISTORICAL":
            errors.append("historical FullWorld handover lifecycle classification is invalid")
        path = root / expected_path
        recorded_blob = handover.get("blob_sha")
        if not isinstance(recorded_blob, str) or not HEX40.fullmatch(recorded_blob):
            errors.append(f"invalid historical handover blob SHA: {recorded_blob}")
        elif path.is_file():
            actual_blob = git_blob_sha(path)
            if actual_blob != recorded_blob:
                errors.append(f"historical handover blob drift: {actual_blob} != {recorded_blob}")
        else:
            errors.append(f"missing historical handover evidence: {expected_path}")

    recommendations = _require_mapping(data, "recommendation_dispositions", errors)
    expected_recommendations = {"REC-DOCS-001", "REC-DOCS-003", "REC-DOCS-004", "REC-DOCS-005", "REC-DOCS-007"}
    if set(recommendations) != expected_recommendations:
        errors.append(
            f"recommendation disposition set mismatch: registered={sorted(recommendations)} expected={sorted(expected_recommendations)}"
        )
    rec7 = recommendations.get("REC-DOCS-007", {})
    if not isinstance(rec7, dict) or rec7.get("disposition") != "KEEP_EXISTING":
        errors.append("REC-DOCS-007 must KEEP_EXISTING stable Atlas gates for this bounded closeout")
    if isinstance(rec7, dict) and rec7.get("ci_workflow_blob") != inventory.get("ci_workflow_blob"):
        errors.append("REC-DOCS-007 CI workflow blob must match material inventory")

    findings = _require_list(data, "out_of_scope_findings", errors)
    if not findings or not all(isinstance(item, str) and item.startswith("OUT_OF_SCOPE_FINDING:") for item in findings):
        errors.append("out_of_scope_findings must contain explicit OUT_OF_SCOPE_FINDING records")

    supersession = _require_mapping(data, "supersession", errors)
    for field in ("rule", "rollback"):
        value = supersession.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"supersession.{field} must be non-empty")

    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    registry = root / REGISTRY_PATH
    if not registry.is_file():
        print(f"DOCUMENTATION_IA_VALIDATION=FAIL missing registry: {REGISTRY_PATH}", file=sys.stderr)
        return 1
    try:
        data = json.loads(registry.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"DOCUMENTATION_IA_VALIDATION=FAIL invalid registry: {exc}", file=sys.stderr)
        return 1
    if not isinstance(data, dict):
        print("DOCUMENTATION_IA_VALIDATION=FAIL registry root must be an object", file=sys.stderr)
        return 1

    errors = validate_registry(root, data)
    if errors:
        print("DOCUMENTATION_IA_VALIDATION=FAIL", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "DOCUMENTATION_IA_VALIDATION=PASS "
        f"audited_head={data['audited_head']} "
        f"prompts={len(data['prompts'])} "
        f"active_tasks={len(data['active_tasks'])} "
        f"gaps={len(data['gap_dispositions'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
