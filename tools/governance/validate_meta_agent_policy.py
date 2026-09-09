#!/usr/bin/env python3
"""Validate Atlas adoption of its immutable META organization-policy binding."""
from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
import re
import sys
import types
from typing import Any, Callable
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BINDING_PATH = Path("docs/agents/META_AGENT_POLICY_BINDING.json")
AGENTS_PATH = Path("AGENTS.md")
PROMPTS_PATH = Path("docs/agents/prompts")
AUTHORITY_REPOSITORY = "Oteryn/Oteryn"
POLICY_ID = "OTERYN_ORGANIZATION_AGENT_POLICY"
POLICY_VERSION = "3.1.0"
CENTRAL_POLICY_PATH = "ecosystem/organization-agent-policy.json"
CENTRAL_VALIDATOR_PATH = "tools/governance/central_agent_policy.py"
EXPECTED_SURFACES = {
    "organization_policy": "docs/agents/policy/ORGANIZATION_AGENT_POLICY.md",
    "prompting_standard": "docs/agents/policy/PROMPTING_STANDARD.md",
    "prompt_eval_standard": "docs/agents/policy/PROMPT_EVAL_STANDARD.md",
}
EXPECTED_BINDING_KEYS = {
    "schema_version",
    "policy_id",
    "policy_version",
    "authority_repository",
    "authority_commit",
    "organization_policy_path",
    "prompting_standard_path",
    "prompt_eval_standard_path",
}
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
JsonReader = Callable[[str], object]
TextReader = Callable[[str, str], str]


class ValidationFailure(RuntimeError):
    """Raised when immutable central authority cannot be authenticated."""


def _github_json(url: str, *, timeout: float = 20.0) -> object:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def _github_text(repository: str, commit: str, relative: str, *, timeout: float = 20.0) -> str:
    quoted = urllib.parse.quote(relative, safe="/")
    payload = _github_json(
        f"https://api.github.com/repos/{repository}/contents/{quoted}?ref={commit}",
        timeout=timeout,
    )
    if not isinstance(payload, dict) or payload.get("encoding") != "base64":
        raise ValidationFailure(f"invalid GitHub contents response for {relative}")
    encoded = payload.get("content")
    if not isinstance(encoded, str) or not encoded:
        raise ValidationFailure(f"empty GitHub contents response for {relative}")
    try:
        return base64.b64decode("".join(encoded.split()), validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValidationFailure(f"invalid UTF-8 authority content for {relative}") from exc


def load_binding(root: Path = ROOT) -> dict[str, object]:
    try:
        value = json.loads((root / BINDING_PATH).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValidationFailure(f"binding is unavailable or invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise ValidationFailure("binding root must be an object")
    return value


def validate_binding_bootstrap(binding: dict[str, object]) -> list[str]:
    """Reject unsafe coordinates before any remote content is loaded or executed."""
    errors: list[str] = []
    if set(binding) != EXPECTED_BINDING_KEYS:
        errors.append("binding keys must match the closed META schema")
    if type(binding.get("schema_version")) is not int or binding.get("schema_version") != 1:
        errors.append("binding schema_version must be integer 1")
    if binding.get("policy_id") != POLICY_ID:
        errors.append(f"binding policy_id must be {POLICY_ID}")
    if binding.get("policy_version") != POLICY_VERSION:
        errors.append(f"binding policy_version must be {POLICY_VERSION}")
    if binding.get("authority_repository") != AUTHORITY_REPOSITORY:
        errors.append(f"binding authority_repository must be {AUTHORITY_REPOSITORY}")
    commit = binding.get("authority_commit")
    if not isinstance(commit, str) or SHA_RE.fullmatch(commit) is None:
        errors.append("binding authority_commit must be a lowercase full SHA")
    actual_surfaces = {
        "organization_policy": binding.get("organization_policy_path"),
        "prompting_standard": binding.get("prompting_standard_path"),
        "prompt_eval_standard": binding.get("prompt_eval_standard_path"),
    }
    if actual_surfaces != EXPECTED_SURFACES:
        errors.append("binding policy paths must match the central META schema")
    return errors


def resolve_authority(
    binding: dict[str, object],
    *,
    json_reader: JsonReader = _github_json,
    text_reader: TextReader = _github_text,
) -> dict[str, object]:
    """Authenticate the pin against live protected META main before loading code."""
    bootstrap_errors = validate_binding_bootstrap(binding)
    if bootstrap_errors:
        raise ValidationFailure("; ".join(bootstrap_errors))
    commit = str(binding["authority_commit"])
    api = f"https://api.github.com/repos/{AUTHORITY_REPOSITORY}"

    commit_payload = json_reader(f"{api}/commits/{commit}")
    if not isinstance(commit_payload, dict) or commit_payload.get("sha") != commit:
        raise ValidationFailure("authority commit does not resolve to the exact META SHA")
    branch = json_reader(f"{api}/branches/main")
    branch_commit = branch.get("commit") if isinstance(branch, dict) else None
    main_sha = branch_commit.get("sha") if isinstance(branch_commit, dict) else None
    if (
        not isinstance(branch, dict)
        or branch.get("name") != "main"
        or branch.get("protected") is not True
        or not isinstance(main_sha, str)
        or SHA_RE.fullmatch(main_sha) is None
    ):
        raise ValidationFailure("live META main identity/protection is not authenticated")
    comparison = json_reader(f"{api}/compare/{commit}...{main_sha}")
    if not isinstance(comparison, dict) or comparison.get("status") not in ("ahead", "identical"):
        raise ValidationFailure("authority commit is not an ancestor of live META main")
    for key in ("base_commit", "merge_base_commit"):
        value = comparison.get(key)
        if not isinstance(value, dict) or value.get("sha") != commit:
            raise ValidationFailure("META comparison does not bind the requested authority commit")

    policy_text = text_reader(AUTHORITY_REPOSITORY, commit, CENTRAL_POLICY_PATH)
    try:
        policy = json.loads(policy_text)
    except json.JSONDecodeError as exc:
        raise ValidationFailure("central META policy is invalid JSON") from exc
    if not isinstance(policy, dict):
        raise ValidationFailure("central META policy root is not an object")
    if (
        policy.get("policy_id") != POLICY_ID
        or policy.get("policy_version") != POLICY_VERSION
        or policy.get("authority_repository") != AUTHORITY_REPOSITORY
        or policy.get("canonical_human_surfaces") != EXPECTED_SURFACES
    ):
        raise ValidationFailure("central META policy identity or canonical surfaces do not match the binding")

    surfaces: dict[str, str] = {}
    for relative in EXPECTED_SURFACES.values():
        text = text_reader(AUTHORITY_REPOSITORY, commit, relative)
        if not text.strip():
            raise ValidationFailure(f"central META policy surface is empty: {relative}")
        surfaces[relative] = text
    validator_source = text_reader(AUTHORITY_REPOSITORY, commit, CENTRAL_VALIDATOR_PATH)
    if not validator_source.strip():
        raise ValidationFailure("central META validator source is empty")
    return {
        "repository": AUTHORITY_REPOSITORY,
        "commit": commit,
        "protected_main_sha": main_sha,
        "merged_to_protected_main": True,
        "branch_protected": True,
        "policy": policy,
        "human_surfaces": surfaces,
        "validator_source": validator_source,
    }


def load_central_validator(source: str) -> types.ModuleType:
    """Load only validator code from the already-authenticated immutable commit."""
    module = types.ModuleType("oteryn_bound_central_agent_policy")
    module.__file__ = f"{AUTHORITY_REPOSITORY}@bound:{CENTRAL_VALIDATOR_PATH}"
    try:
        exec(compile(source, module.__file__, "exec"), module.__dict__)
    except Exception as exc:
        raise ValidationFailure(f"authenticated central validator could not load: {exc}") from exc
    for name in ("validate_provider_binding", "validate_provider_overlay", "validate_task_prompt_text"):
        if not callable(getattr(module, name, None)):
            raise ValidationFailure(f"authenticated central validator lacks {name}")
    return module


def validate_repository(
    root: Path,
    binding: dict[str, object],
    resolved: dict[str, object],
) -> list[str]:
    central = load_central_validator(str(resolved["validator_source"]))
    policy = resolved["policy"]
    errors: list[str] = []
    binding_errors = central.validate_provider_binding(
        binding,
        policy=policy,
        authority_resolver=lambda repository, commit: resolved
        if repository == AUTHORITY_REPOSITORY and commit == binding.get("authority_commit")
        else None,
    )
    errors.extend(f"binding: {error}" for error in binding_errors)

    try:
        agents_text = (root / AGENTS_PATH).read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        errors.append(f"AGENTS.md: unavailable or invalid UTF-8: {exc}")
    else:
        overlay_errors = central.validate_provider_overlay(
            "Oteryn/Oteryn-Atlas",
            agents_text,
            policy=policy,
        )
        errors.extend(f"AGENTS.md: {error}" for error in overlay_errors)

    try:
        prompts = sorted((root / PROMPTS_PATH).glob("*.md"))
    except OSError as exc:
        errors.append(f"prompts: unable to enumerate: {exc}")
        prompts = []
    if not prompts:
        errors.append("prompts: no reusable Atlas prompt contracts found")
    for prompt in prompts:
        try:
            text = prompt.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            errors.append(f"{prompt.relative_to(root)}: unavailable or invalid UTF-8: {exc}")
            continue
        prompt_errors = central.validate_task_prompt_text(text, policy=policy)
        errors.extend(f"{prompt.relative_to(root)}: {error}" for error in prompt_errors)
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args(argv)
    try:
        binding = load_binding(args.root)
        resolved = resolve_authority(binding)
        errors = validate_repository(args.root, binding, resolved)
    except (ValidationFailure, urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        print(f"FAIL Atlas META policy adoption: {exc}")
        return 1
    if errors:
        for error in errors:
            print(f"FAIL Atlas META policy adoption: {error}")
        return 1
    print(
        "PASS Atlas META policy adoption "
        f"{binding['policy_id']}@{binding['policy_version']} "
        f"{binding['authority_commit']} (META main {resolved['protected_main_sha']})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
