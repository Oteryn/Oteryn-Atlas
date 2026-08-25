#!/usr/bin/env python3
"""Build a creature-keyed farm spatial index tied to one farm-intelligence generation."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

PRODUCT = "atlas-farm-spatial-v1"
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
CREATURE_CAPABILITIES = {"static-creatures-v1", "animated-creatures-v1"}
ORIGINS = {"base-map", "conditional-custom-map", "runtime-world-change", "annual-event-map", "quest-map", "UNKNOWN"}
MAX_PLACEMENTS = 200_000
MAX_ENTITIES = 100_000


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _digest(value: object, label: str) -> str:
    require(isinstance(value, str) and DIGEST_RE.fullmatch(value), f"invalid {label}")
    return value


def validate_inputs(creatures: dict[str, object], farm: dict[str, object]) -> tuple[list[dict[str, object]], dict[str, object]]:
    require(isinstance(farm, dict) and farm.get("schema_version") == 1 and farm.get("product") == "atlas-farm-intelligence-v1", "unsupported farm intelligence product")
    _digest(farm.get("product_root"), "farm intelligence root")
    compatibility = farm.get("compatibility")
    require(isinstance(compatibility, dict), "farm compatibility tuple missing")
    required_compatibility = {
        "world_id", "world_profile_revision", "content_revision", "ruleset_revision",
        "modifier_context", "creature_identity_scheme", "creature_identity_revision",
        "coordinate_profile", "creature_publication_digest",
    }
    require(set(compatibility) == required_compatibility, "farm compatibility tuple incomplete")
    require(compatibility["creature_identity_scheme"] == "monster-entity-v1", "unsupported creature identity scheme")
    require(compatibility["coordinate_profile"] == "oteryn-native-floor-v1", "unsupported coordinate profile")
    _digest(compatibility["creature_publication_digest"], "creature publication digest")

    require(isinstance(creatures, dict), "creature publication must be an object")
    require(creatures.get("contract_id") == "oteryn-game-atlas-export-v1", "unsupported creature contract")
    require(creatures.get("capability") in CREATURE_CAPABILITIES, "unsupported creature capability")
    _digest(creatures.get("semantic_digest"), "creature semantic digest")
    require(creatures["semantic_digest"] == compatibility["creature_publication_digest"], "creature publication digest mismatch")
    require(creatures.get("coordinate_profile") == compatibility["coordinate_profile"], "coordinate profile mismatch")
    records = creatures.get("monster_spawns")
    require(isinstance(records, list) and len(records) <= MAX_PLACEMENTS, "invalid monster placement catalogue")
    seen_ids: set[str] = set()
    validated = [validate_placement(record, seen_ids) for record in records]
    return validated, compatibility


def validate_placement(record: object, seen_ids: set[str]) -> dict[str, object]:
    require(isinstance(record, dict) and record.get("kind") == "monster", "invalid monster placement")
    record_id = record.get("record_id")
    require(isinstance(record_id, str) and record_id.startswith("monster:") and len(record_id) <= 96, "invalid monster record id")
    require(record_id not in seen_ids, "duplicate monster record id")
    seen_ids.add(record_id)
    name = record.get("name")
    require(isinstance(name, str) and 0 < len(name) <= 256, "invalid monster name")
    position = record.get("position")
    require(isinstance(position, dict) and all(isinstance(position.get(key), int) for key in ("x", "y", "floor")), "invalid monster position")
    origin = record.get("origin")
    require(origin in ORIGINS, "unsupported placement origin")
    entity_id = record.get("entity_id")
    if entity_id is not None:
        require(isinstance(entity_id, str) and entity_id.startswith("monster-entity:") and len(entity_id) <= 96, "invalid monster entity id")
        require(record.get("resolution_state") == "RESOLVED", "joinable monster entity must be resolved")
    timer = record.get("spawn_time_seconds")
    if timer is not None:
        require(isinstance(timer, int) and timer > 0, "invalid spawn_time_seconds")
    weight = record.get("weight")
    if weight is not None:
        require(isinstance(weight, int) and weight >= 0, "invalid placement weight")
    return record


def _public_placement(record: dict[str, object]) -> dict[str, object]:
    public = {
        "record_id": record["record_id"],
        "entity_id": record["entity_id"],
        "name": record["name"],
        "position": record["position"],
        "origin": record["origin"],
        "default_placement_eligible": record["origin"] == "base-map",
    }
    for field in ("spawn_area", "spawn_time_seconds", "weight"):
        if field in record:
            public[field] = record[field]
    return public


def _write_payload(output: Path, relative: str, payload: object) -> dict[str, object]:
    data = canonical(payload) + b"\n"
    path = output / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {"path": relative, "bytes": len(data), "digest": sha256(data)}


def build(creatures: dict[str, object], farm: dict[str, object], output: Path) -> dict[str, object]:
    records, compatibility = validate_inputs(creatures, farm)
    output.mkdir(parents=True, exist_ok=True)
    by_entity: dict[str, list[dict[str, object]]] = {}
    unjoinable = 0
    for record in records:
        entity_id = record.get("entity_id")
        if entity_id is None:
            unjoinable += 1
            continue
        by_entity.setdefault(entity_id, []).append(_public_placement(record))
    require(len(by_entity) <= MAX_ENTITIES, "farm spatial entity cap exceeded")

    entities = []
    indexed = 0
    for entity_id, placements in sorted(by_entity.items()):
        placements.sort(key=lambda record: (
            int(record["position"]["floor"]), int(record["position"]["y"]),
            int(record["position"]["x"]), str(record["record_id"]),
        ))
        indexed += len(placements)
        floors = sorted({int(record["position"]["floor"]) for record in placements})
        payload = {
            "schema_version": 1,
            "entity_id": entity_id,
            "floors": floors,
            "placements": placements,
            "spawn_time_semantics": "published_static_field_only",
            "static_clear_yield_state": "UNAVAILABLE",
            "static_clear_yield_reason": "Current static-creature publication does not prove concurrent/group activation semantics.",
        }
        shard_key = hashlib.sha256(entity_id.encode("utf-8")).hexdigest()
        descriptor = _write_payload(output, f"entities/{shard_key}.json", payload)
        entities.append({"entity_id": entity_id, "records": len(placements), "floors": floors, **descriptor})

    source_metadata = {
        "contract_id": creatures["contract_id"],
        "capability": creatures["capability"],
        "semantic_digest": creatures["semantic_digest"],
        "coordinate_profile": creatures["coordinate_profile"],
    }
    index = {
        "schema_version": 1,
        "product": PRODUCT,
        "source_creatures": source_metadata,
        "farm_intelligence_root": farm["product_root"],
        "compatibility": compatibility,
        "counts": {
            "entities": len(entities),
            "indexed_placements": indexed,
            "unjoinable_placements": unjoinable,
        },
        "entities": entities,
    }
    index["product_root"] = sha256(canonical(index))
    (output / "index.json").write_bytes(canonical(index) + b"\n")
    return index


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("creatures", type=Path)
    parser.add_argument("farm_index", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    creatures = json.loads(args.creatures.read_text(encoding="utf-8"))
    farm = json.loads(args.farm_index.read_text(encoding="utf-8"))
    result = build(creatures, farm, args.output)
    print(json.dumps({"product_root": result["product_root"], **result["counts"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
