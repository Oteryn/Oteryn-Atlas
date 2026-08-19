#!/usr/bin/env python3
"""Validate the full-world semantic-layer authority registry fail-closed."""
from __future__ import annotations
import argparse, hashlib, json, re
from pathlib import Path
from typing import Any

EXPECTED_TASK = "ATLAS-SEMANTIC-LAYERS-AND-INDEXES"
EXPECTED_ATLAS_REPOSITORY = "Oteryn/Oteryn-Atlas"
EXPECTED_GAME_REPOSITORY = "Oteryn/Oteryn-Game"
EXPECTED_GAME_CAPABILITIES = {"resolved-appearance-primitives-v0", "semantic-tiles-v0"}
VALID_LAYER_STATUSES = {"PROVEN", "BLOCKED", "UNKNOWN"}
REQUIRED_LAYER_IDS = {
    "towns", "temples", "teleports-transitions", "houses", "house-doors",
    "action-ids", "unique-ids", "waypoints", "mechanics", "raids-encounters",
    "quest-areas", "pois", "npcs", "monsters-spawns", "minimap-overview",
}
EXPECTED_PROVEN = {"minimap-overview"}
EXPECTED_G3 = {
    "publication_root": "sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f",
    "semantic_root": "sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9",
    "source_fingerprint": "sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9",
}

class RegistryError(ValueError): pass

def _require(condition: bool, message: str) -> None:
    if not condition: raise RegistryError(message)

def _sha(value: Any, field: str) -> None:
    _require(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value) is not None, f"{field} must be a full lowercase Git SHA")

def _cid(value: Any, field: str) -> None:
    _require(isinstance(value, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", value) is not None, f"{field} must be a sha256 content id")

def load_registry(path: Path) -> dict[str, Any]:
    try: value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc: raise RegistryError(f"unable to read registry: {exc}") from exc
    _require(isinstance(value, dict), "registry root must be an object")
    return value

def validate_registry(registry: dict[str, Any]) -> dict[str, int]:
    _require(registry.get("schema_version") == 2, "unsupported schema_version")
    _require(registry.get("task_id") == EXPECTED_TASK, "unexpected task_id")
    _require(registry.get("status") == "G4_PARTIAL_PROVEN", "unexpected registry status")

    atlas = registry.get("atlas"); _require(isinstance(atlas, dict), "atlas must be an object")
    _require(atlas.get("repository") == EXPECTED_ATLAS_REPOSITORY, "unexpected Atlas repository")
    _sha(atlas.get("base_sha"), "atlas.base_sha"); _sha(atlas.get("prompt_blob_sha"), "atlas.prompt_blob_sha")

    game = registry.get("game"); _require(isinstance(game, dict), "game must be an object")
    _require(game.get("repository") == EXPECTED_GAME_REPOSITORY, "unexpected Game repository")
    _sha(game.get("source_sha"), "game.source_sha"); _sha(game.get("current_main_sha"), "game.current_main_sha")
    for key in ("export_contract", "coordinate_profile", "world_model", "audited_producer", "public_policy"):
        value = game.get(key); _require(isinstance(value, dict), f"game.{key} must be an object"); _sha(value.get("blob_sha"), f"game.{key}.blob_sha")
    producer = game["audited_producer"]
    _require(producer.get("path") == "tools/game-atlas-fullworld-source/producer.py", "full-world Game producer must be audited")
    _require(set(producer.get("capabilities", [])) == EXPECTED_GAME_CAPABILITIES, "audited producer capabilities changed; re-audit authority")

    dep = registry.get("publication_dependency"); _require(isinstance(dep, dict), "publication_dependency must be an object")
    _require(dep.get("required_gate") == "G3" and dep.get("status") == "PASS", "G3 publication dependency must be PASS")
    for key, expected in EXPECTED_G3.items(): _require(dep.get(key) == expected, f"G3 {key} mismatch")
    counts = dep.get("counts"); _require(counts == {"floors":16,"shards":1197,"tiles":18997668,"resolved_primitives":24502035}, "G3 reconciliation counts mismatch")
    _sha(dep.get("atlas_main_sha"), "publication_dependency.atlas_main_sha"); _sha(dep.get("publication_contract_blob_sha"), "publication_dependency.publication_contract_blob_sha"); _sha(dep.get("evidence_blob_sha"), "publication_dependency.evidence_blob_sha")

    rules = registry.get("rules"); _require(isinstance(rules, dict), "rules must be an object")
    for key in ("default_deny_public_projection", "legacy_runtime_fallback_forbidden", "pixel_or_sprite_semantic_inference_forbidden", "overview_derivation_requires_verified_semantic_publication"):
        _require(rules.get(key) is True, f"rule {key} must remain true")
    _require(rules.get("blocked_or_unknown_layers_enabled") is False, "blocked/unknown layers must remain disabled")

    layers = registry.get("layers"); _require(isinstance(layers, list), "layers must be an array")
    ids=[]; proven=set(); status_counts={"PROVEN":0,"BLOCKED":0,"UNKNOWN":0}
    for index, layer in enumerate(layers):
        _require(isinstance(layer, dict), f"layers[{index}] must be an object")
        layer_id=layer.get("id"); _require(isinstance(layer_id,str) and layer_id, f"layers[{index}].id required"); ids.append(layer_id)
        status=layer.get("status"); _require(status in VALID_LAYER_STATUSES, f"{layer_id}: invalid status"); status_counts[status]+=1
        _require(isinstance(layer.get("priority"),int) and layer["priority"]>0, f"{layer_id}: invalid priority")
        _require(isinstance(layer.get("authority_evidence"),list), f"{layer_id}: authority_evidence must be an array")
        if status == "PROVEN":
            proven.add(layer_id)
            _require(layer_id == "minimap-overview", f"{layer_id}: only overview is proven on current Game capabilities")
            _require(layer.get("enabled") is True, "proven overview must be enabled")
            _require(layer.get("current_export_presence") is False and layer.get("derived_from_publication") is True, "overview must be marked Atlas-derived, not Game-emitted")
            _require(layer.get("blocker_code") is None and layer.get("required_upstream") is None, "proven overview cannot retain blocker fields")
            _require(layer.get("layer_contract") == "src/layers/overview-v0.md", "overview contract path mismatch")
            _require(layer.get("layer_evidence") == "docs/evidence/fullworld-layers/overview-summary.json", "overview evidence path mismatch")
        else:
            _require(layer.get("enabled") is False, f"{layer_id}: blocked/unknown layer must remain disabled")
            _require(layer.get("current_export_presence") is False, f"{layer_id}: current Game producer does not emit this layer")
            _require(isinstance(layer.get("blocker_code"),str) and layer["blocker_code"], f"{layer_id}: blocker_code required")
            _require(isinstance(layer.get("required_upstream"),str) and layer["required_upstream"], f"{layer_id}: required_upstream required")
    _require(len(ids)==len(set(ids)), "duplicate layer ids")
    _require(set(ids)==REQUIRED_LAYER_IDS, "layer registry coverage changed; re-audit required")
    _require(proven==EXPECTED_PROVEN, "proven layer set mismatch")
    _require(status_counts=={"PROVEN":1,"BLOCKED":11,"UNKNOWN":3}, "unexpected layer status counts")
    return status_counts

def canonical_digest(path: Path) -> str:
    data=json.loads(path.read_text(encoding="utf-8")); canonical=(json.dumps(data,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n").encode(); return hashlib.sha256(canonical).hexdigest()

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("registry",type=Path); args=parser.parse_args()
    try: counts=validate_registry(load_registry(args.registry))
    except RegistryError as exc: print(f"ERROR: {exc}"); return 1
    print(f"PASS layers={sum(counts.values())} proven={counts['PROVEN']} blocked={counts['BLOCKED']} unknown={counts['UNKNOWN']} registry_sha256={canonical_digest(args.registry)}"); return 0

if __name__ == "__main__": raise SystemExit(main())
