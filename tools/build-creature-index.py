#!/usr/bin/env python3
"""Build bounded Atlas creature shards from a validated Game static-creatures-v1 export."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

CHUNK_SIZE = 64
MAX_RECORDS = 200_000
EXPECTED_CONTRACT = "oteryn-game-atlas-export-v1"
EXPECTED_CAPABILITIES = {"static-creatures-v1", "animated-creatures-v1"}
RESOLUTION_STATES = {"RESOLVED", "AMBIGUOUS", "UNRESOLVED"}
ROLE_RESOLUTION_STATES = {"RESOLVED", "AMBIGUOUS"}
NPC_ROLE_ORDER = ("bank", "travel", "shop", "quest", "blessing", "trainer")
NPC_ROLES = set(NPC_ROLE_ORDER)


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def validate(source: dict[str, object]) -> list[dict[str, object]]:
    if source.get("contract_id") != EXPECTED_CONTRACT:
        raise ValueError("unsupported Game export contract")
    if source.get("capability") not in EXPECTED_CAPABILITIES:
        raise ValueError("unsupported creature capability")
    if source.get("coordinate_profile") != "oteryn-native-floor-v1":
        raise ValueError("unsupported coordinate profile")
    if source.get("npc_role_schema_version") != 1:
        raise ValueError("unsupported NPC role schema")
    semantic_digest = source.get("semantic_digest")
    if not isinstance(semantic_digest, str) or not semantic_digest.startswith("sha256:") or len(semantic_digest) != 71:
        raise ValueError("invalid Game semantic digest")

    records: list[dict[str, object]] = []
    for source_key, expected_kind in (("npcs", "npc"), ("monster_spawns", "monster")):
        values = source.get(source_key, [])
        if not isinstance(values, list):
            raise ValueError(f"{source_key} must be a list")
        for record in values:
            if not isinstance(record, dict) or record.get("kind") != expected_kind:
                raise ValueError(f"invalid {expected_kind} record kind")
            if record.get("resolution_state") not in RESOLUTION_STATES:
                raise ValueError("invalid creature resolution state")
            position = record.get("position")
            if not isinstance(position, dict) or not all(isinstance(position.get(key), int) for key in ("x", "y", "floor")):
                raise ValueError("invalid creature position")
            record_id = record.get("record_id")
            if not isinstance(record_id, str) or len(record_id) > 96 or not record_id.startswith(f"{expected_kind}:"):
                raise ValueError("invalid creature record id")
            entity_id = record.get("entity_id")
            if entity_id is not None and (not isinstance(entity_id, str) or len(entity_id) > 96 or not entity_id.startswith(f"{expected_kind}-entity:")):
                raise ValueError("invalid creature entity id")
            name = record.get("name")
            if not isinstance(name, str) or not name.strip() or len(name) > 256:
                raise ValueError("invalid creature name")
            role_state = record.get("role_resolution_state")
            roles = record.get("roles")
            if expected_kind == "monster":
                if role_state is not None or roles is not None:
                    raise ValueError("monster records must not expose NPC role metadata")
            elif role_state is None:
                if roles is not None:
                    raise ValueError("NPC roles require a role resolution state")
            else:
                if role_state not in ROLE_RESOLUTION_STATES:
                    raise ValueError("invalid NPC role resolution state")
                if role_state == "AMBIGUOUS" and roles is not None:
                    raise ValueError("ambiguous NPC role metadata must not publish roles")
                if roles is not None:
                    if role_state != "RESOLVED" or not isinstance(roles, list) or not roles:
                        raise ValueError("invalid NPC roles")
                    indexes = []
                    for role in roles:
                        if not isinstance(role, str) or role not in NPC_ROLES:
                            raise ValueError("unsupported NPC role")
                        indexes.append(NPC_ROLE_ORDER.index(role))
                    if len(set(roles)) != len(roles) or indexes != sorted(indexes):
                        raise ValueError("NPC roles must be unique and use canonical order")
            records.append(record)
    if len(records) > MAX_RECORDS:
        raise ValueError("creature export exceeds bounded record cap")
    return records


def build(source: dict[str, object], output: Path) -> dict[str, object]:
    records = validate(source)
    shards: dict[tuple[int, int, int], list[dict[str, object]]] = {}
    search: dict[tuple[str, str], dict[str, object]] = {}

    for record in records:
        kind = str(record["kind"])
        position = record["position"]
        assert isinstance(position, dict)
        key = (int(position["floor"]), int(position["x"]) // CHUNK_SIZE, int(position["y"]) // CHUNK_SIZE)
        public = {
            field: record[field]
            for field in ("record_id", "entity_id", "kind", "name", "position", "spawn_area", "origin", "resolution_state", "appearance", "presentation_resolution_state", "presentation_reason", "presentation_fallback", "outfit_presentation", "role_resolution_state", "roles")
            if field in record
        }
        shards.setdefault(key, []).append(public)
        label = str(record["name"])
        search_record = {
            "kind": kind,
            "label": label,
            "position": position,
            "record_id": record["record_id"],
            "resolution_state": record["resolution_state"],
        }
        if "entity_id" in record:
            search_record["entity_id"] = record["entity_id"]
        if "role_resolution_state" in record:
            search_record["role_resolution_state"] = record["role_resolution_state"]
        if "roles" in record:
            search_record["roles"] = record["roles"]
        search_key = (kind, label.casefold())
        current = search.get(search_key)
        if current is None or ("entity_id" not in current and "entity_id" in search_record):
            search[search_key] = search_record

    entries: list[dict[str, object]] = []
    for (floor, chunk_x, chunk_y), values in sorted(shards.items()):
        values.sort(key=lambda record: (
            int(record["position"]["y"]),
            int(record["position"]["x"]),
            str(record["name"]).casefold(),
            str(record["record_id"]),
        ))
        relative = f"chunks/f{floor}/{chunk_x}_{chunk_y}.json"
        payload = {"schema_version": 1, "floor": floor, "chunk_x": chunk_x, "chunk_y": chunk_y, "records": values}
        data = canonical(payload) + b"\n"
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        entries.append({
            "floor": floor,
            "chunk_x": chunk_x,
            "chunk_y": chunk_y,
            "path": relative,
            "records": len(values),
            "bytes": len(data),
            "digest": sha256(data),
        })

    source_metadata = {
        "contract_id": source["contract_id"],
        "capability": source["capability"],
        "semantic_revision": source.get("semantic_revision"),
        "semantic_digest": source["semantic_digest"],
        "npc_role_schema_version": source["npc_role_schema_version"],
        "coordinate_profile": source["coordinate_profile"],
        "legacy_evidence": source.get("legacy_evidence"),
    }
    for field in ("appearance_product_root", "outfit_spatial_product_root"):
        if source.get(field) is not None:
            source_metadata[field] = source[field]
    search_records = sorted(search.values(), key=lambda record: (str(record["label"]).casefold(), str(record["kind"])))
    search_data = canonical({"schema_version": 1, "source": source_metadata, "records": search_records}) + b"\n"
    (output / "search.json").write_bytes(search_data)

    index = {
        "schema_version": 1,
        "source": source_metadata,
        "chunk_size": CHUNK_SIZE,
        "counts": {"records": len(records), "chunks": len(entries), "search_records": len(search_records)},
        "chunks": entries,
        "search_path": "search.json",
        "search_bytes": len(search_data),
        "search_digest": sha256(search_data),
    }
    (output / "index.json").write_bytes(canonical(index) + b"\n")
    return index


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = json.loads(args.source.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True, exist_ok=True)
    result = build(source, args.output)
    print(json.dumps(result["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
