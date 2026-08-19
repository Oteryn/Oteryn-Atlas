#!/usr/bin/env python3
"""Validate the full-world semantic-layer authority registry fail-closed."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any

EXPECTED_TASK = "ATLAS-SEMANTIC-LAYERS-AND-INDEXES"
EXPECTED_ATLAS_REPOSITORY = "Oteryn/Oteryn-Atlas"
EXPECTED_GAME_REPOSITORY = "Oteryn/Oteryn-Game"
EXPECTED_GAME_CAPABILITIES = {
    "resolved-appearance-primitives-v0",
    "semantic-tiles-v0",
}
VALID_LAYER_STATUSES = {"PROVEN", "BLOCKED", "UNKNOWN"}
REQUIRED_LAYER_IDS = {
    "towns", "temples", "teleports-transitions", "houses", "house-doors",
    "action-ids", "unique-ids", "waypoints", "mechanics", "raids-encounters",
    "quest-areas", "pois", "npcs", "monsters-spawns", "minimap-overview",
}


class RegistryError(ValueError):
    pass


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RegistryError(message)


def _sha(value: Any, field: str) -> None:
    _require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value) is not None, f"{field} must be a full lowercase Git SHA")


def load_registry(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RegistryError(f"unable to read registry: {exc}") from exc
    _require(isinstance(value, dict), "registry root must be an object")
    return value


def validate_registry(registry: dict[str, Any]) -> dict[str, int]:
    _require(registry.get("schema_version") == 1, "unsupported schema_version")
    _require(registry.get("task_id") == EXPECTED_TASK, "unexpected task_id")
    _require(registry.get("status") == "AUTHORITY_AUDIT_COMPLETE_IMPLEMENTATION_BLOCKED", "audit status must remain blocked before upstream hand-off")

    atlas = registry.get("atlas")
    _require(isinstance(atlas, dict), "atlas must be an object")
    _require(atlas.get("repository") == EXPECTED_ATLAS_REPOSITORY, "unexpected Atlas repository")
    _sha(atlas.get("base_sha"), "atlas.base_sha")
    _sha(atlas.get("prompt_blob_sha"), "atlas.prompt_blob_sha")

    game = registry.get("game")
    _require(isinstance(game, dict), "game must be an object")
    _require(game.get("repository") == EXPECTED_GAME_REPOSITORY, "unexpected Game repository")
    _sha(game.get("source_sha"), "game.source_sha")
    for key in ("export_contract", "coordinate_profile", "world_model", "audited_producer", "public_policy"):
        value = game.get(key)
        _require(isinstance(value, dict), f"game.{key} must be an object")
        _sha(value.get("blob_sha"), f"game.{key}.blob_sha")

    producer = game["audited_producer"]
    capabilities = producer.get("capabilities")
    _require(isinstance(capabilities, list), "producer capabilities must be an array")
    _require(set(capabilities) == EXPECTED_GAME_CAPABILITIES, "audited producer capabilities changed; re-audit authority before proceeding")

    dependency = registry.get("publication_dependency")
    _require(isinstance(dependency, dict), "publication_dependency must be an object")
    _require(dependency.get("required_gate") == "G3", "semantic layers must depend on G3 publication")
    _require(dependency.get("status") == "BLOCKED", "registry may not claim publication readiness on this audit snapshot")

    rules = registry.get("rules")
    _require(isinstance(rules, dict), "rules must be an object")
    for key in ("default_deny_public_projection", "legacy_runtime_fallback_forbidden", "pixel_or_sprite_semantic_inference_forbidden", "overview_derivation_requires_verified_semantic_publication"):
        _require(rules.get(key) is True, f"rule {key} must remain true")
    _require(rules.get("blocked_or_unknown_layers_enabled") is False, "blocked/unknown layers must remain disabled")

    layers = registry.get("layers")
    _require(isinstance(layers, list), "layers must be an array")
    ids: list[str] = []
    counts = {"PROVEN": 0, "BLOCKED": 0, "UNKNOWN": 0}
    for index, layer in enumerate(layers):
        _require(isinstance(layer, dict), f"layers[{index}] must be an object")
        layer_id = layer.get("id")
        _require(isinstance(layer_id, str) and layer_id, f"layers[{index}].id is required")
        ids.append(layer_id)
        status = layer.get("status")
        _require(status in VALID_LAYER_STATUSES, f"{layer_id}: invalid status")
        counts[status] += 1
        _require(isinstance(layer.get("priority"), int) and layer["priority"] > 0, f"{layer_id}: invalid priority")
        _require(isinstance(layer.get("blocker_code"), str) and layer["blocker_code"], f"{layer_id}: blocker_code required")
        _require(isinstance(layer.get("required_upstream"), str) and layer["required_upstream"], f"{layer_id}: required_upstream required")
        _require(isinstance(layer.get("authority_evidence"), list), f"{layer_id}: authority_evidence must be an array")
        _require(layer.get("enabled") is False, f"{layer_id}: non-proven audit layer must remain disabled")
        _require(layer.get("current_export_presence") is False, f"{layer_id}: audited Game producer does not contain entity layer records")
        _require(status != "PROVEN", f"{layer_id}: PROVEN requires a new upstream audit and publication hand-off")

    _require(len(ids) == len(set(ids)), "duplicate layer ids")
    _require(set(ids) == REQUIRED_LAYER_IDS, "layer registry coverage changed; re-audit required")
    return counts


def canonical_digest(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    canonical = (json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("registry", type=Path)
    args = parser.parse_args()
    try:
        registry = load_registry(args.registry)
        counts = validate_registry(registry)
    except RegistryError as exc:
        print(f"ERROR: {exc}")
        return 1
    digest = canonical_digest(args.registry)
    print(
        "PASS "
        f"layers={sum(counts.values())} "
        f"proven={counts['PROVEN']} blocked={counts['BLOCKED']} unknown={counts['UNKNOWN']} "
        f"registry_sha256={digest}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
