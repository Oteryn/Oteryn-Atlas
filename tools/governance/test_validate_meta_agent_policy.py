#!/usr/bin/env python3
"""Deterministic regressions for Atlas's bound META policy consumer."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

VALIDATOR_PATH = Path(__file__).with_name("validate_meta_agent_policy.py")
SPEC = importlib.util.spec_from_file_location("atlas_meta_policy", VALIDATOR_PATH)
assert SPEC and SPEC.loader
atlas = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(atlas)

PIN = "1dedfc0f264fe0e23e5365dbe9280c2d96df50c5"
MAIN = PIN


def valid_binding() -> dict[str, object]:
    return {
        "schema_version": 1,
        "policy_id": atlas.POLICY_ID,
        "policy_version": atlas.POLICY_VERSION,
        "authority_repository": atlas.AUTHORITY_REPOSITORY,
        "authority_commit": PIN,
        "organization_policy_path": atlas.EXPECTED_SURFACES["organization_policy"],
        "prompting_standard_path": atlas.EXPECTED_SURFACES["prompting_standard"],
        "prompt_eval_standard_path": atlas.EXPECTED_SURFACES["prompt_eval_standard"],
    }


def policy() -> dict[str, object]:
    return {
        "policy_id": atlas.POLICY_ID,
        "policy_version": atlas.POLICY_VERSION,
        "authority_repository": atlas.AUTHORITY_REPOSITORY,
        "canonical_human_surfaces": atlas.EXPECTED_SURFACES,
    }


CENTRAL_STUB = """
def validate_provider_binding(binding, *, policy=None, authority_resolver=None):
    resolved = authority_resolver(binding['authority_repository'], binding['authority_commit'])
    return [] if resolved and resolved.get('merged_to_protected_main') is True else ['unresolved']

def validate_provider_overlay(provider, text, *, policy=None):
    errors = []
    if provider != 'Oteryn/Oteryn-Atlas':
        errors.append('wrong provider')
    if 'docs/agents/META_AGENT_POLICY_BINDING.json' not in text:
        errors.append('missing binding')
    if 'FORBIDDEN_GLOBAL_COPY' in text:
        errors.append('copied global policy')
    return errors

def validate_task_prompt_text(text, *, policy=None):
    return ['copied global policy'] if 'FORBIDDEN_GLOBAL_COPY' in text else []
"""


class AtlasMetaPolicyTests(unittest.TestCase):
    def resolved(self) -> dict[str, object]:
        return {
            "repository": atlas.AUTHORITY_REPOSITORY,
            "commit": PIN,
            "protected_main_sha": MAIN,
            "merged_to_protected_main": True,
            "branch_protected": True,
            "policy": policy(),
            "human_surfaces": {path: "policy text" for path in atlas.EXPECTED_SURFACES.values()},
            "validator_source": CENTRAL_STUB,
        }

    def test_bootstrap_rejects_malformed_coordinates_before_remote_reads(self) -> None:
        for field, value in (
            ("authority_commit", "main"),
            ("authority_repository", "Oteryn/Oteryn-Atlas"),
            ("policy_version", "3"),
            ("schema_version", True),
            ("prompting_standard_path", "local/PROMPTING_STANDARD.md"),
            ("extra", "fork"),
        ):
            binding = valid_binding()
            binding[field] = value
            calls: list[str] = []
            with self.assertRaises(atlas.ValidationFailure):
                atlas.resolve_authority(
                    binding,
                    json_reader=lambda url: calls.append(url),
                    text_reader=lambda repository, commit, path: calls.append(path),
                )
            self.assertEqual(calls, [], field)

    def test_resolution_authenticates_exact_protected_main_ancestry_and_sources(self) -> None:
        binding = valid_binding()

        def json_reader(url: str):
            if url.endswith(f"/commits/{PIN}"):
                return {"sha": PIN}
            if url.endswith("/branches/main"):
                return {"name": "main", "protected": True, "commit": {"sha": MAIN}}
            if url.endswith(f"/compare/{PIN}...{MAIN}"):
                return {
                    "status": "identical",
                    "base_commit": {"sha": PIN},
                    "merge_base_commit": {"sha": PIN},
                }
            raise AssertionError(url)

        sources = {
            atlas.CENTRAL_POLICY_PATH: json.dumps(policy()),
            atlas.CENTRAL_VALIDATOR_PATH: CENTRAL_STUB,
            **{path: "policy text" for path in atlas.EXPECTED_SURFACES.values()},
        }
        resolved = atlas.resolve_authority(
            binding,
            json_reader=json_reader,
            text_reader=lambda repository, commit, path: sources[path],
        )
        self.assertEqual(resolved["commit"], PIN)
        self.assertEqual(resolved["protected_main_sha"], MAIN)

    def test_resolution_rejects_unprotected_or_unrelated_authority(self) -> None:
        binding = valid_binding()

        def unprotected(url: str):
            if "/commits/" in url:
                return {"sha": PIN}
            return {"name": "main", "protected": False, "commit": {"sha": MAIN}}

        with self.assertRaisesRegex(atlas.ValidationFailure, "protection"):
            atlas.resolve_authority(binding, json_reader=unprotected)

        def unrelated(url: str):
            if "/commits/" in url:
                return {"sha": PIN}
            if url.endswith("/branches/main"):
                return {"name": "main", "protected": True, "commit": {"sha": MAIN}}
            return {"status": "diverged", "base_commit": {"sha": PIN}, "merge_base_commit": {"sha": "0" * 40}}

        with self.assertRaisesRegex(atlas.ValidationFailure, "ancestor"):
            atlas.resolve_authority(binding, json_reader=unrelated)

    def test_repository_validation_covers_overlay_and_every_prompt(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "docs/agents/prompts").mkdir(parents=True)
            (root / "AGENTS.md").write_text(
                "Resolve docs/agents/META_AGENT_POLICY_BINDING.json before mutation.\n",
                encoding="utf-8",
            )
            (root / "docs/agents/prompts/good.md").write_text("Task delta.\n", encoding="utf-8")
            self.assertEqual(atlas.validate_repository(root, valid_binding(), self.resolved()), [])

            (root / "docs/agents/prompts/bad.md").write_text("FORBIDDEN_GLOBAL_COPY\n", encoding="utf-8")
            errors = atlas.validate_repository(root, valid_binding(), self.resolved())
            self.assertTrue(any("bad.md: copied global policy" in error for error in errors))

    def test_authenticated_validator_interface_fails_closed(self) -> None:
        with self.assertRaisesRegex(atlas.ValidationFailure, "lacks validate_provider_overlay"):
            atlas.load_central_validator("def validate_provider_binding(*args, **kwargs): return []\n")


if __name__ == "__main__":
    unittest.main()
