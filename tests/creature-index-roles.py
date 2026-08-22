#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("creature_index", ROOT / "tools" / "build-creature-index.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)

NPC_ID = "npc:" + "a" * 32
NPC_ENTITY = "npc-entity:" + "b" * 32
MONSTER_ID = "monster:" + "c" * 32


def source():
    return {
        "contract_id": "oteryn-game-atlas-export-v1",
        "capability": "static-creatures-v1",
        "semantic_revision": 1,
        "semantic_digest": "sha256:" + "1" * 64,
        "npc_role_schema_version": 1,
        "coordinate_profile": "oteryn-native-floor-v1",
        "npcs": [{"kind":"npc","name":"Alice","record_id":NPC_ID,"entity_id":NPC_ENTITY,"position":{"x":100,"y":200,"floor":-7},"resolution_state":"RESOLVED","role_resolution_state":"RESOLVED","roles":["bank","quest"]}],
        "monster_spawns": [{"kind":"monster","name":"Rat","record_id":MONSTER_ID,"position":{"x":101,"y":200,"floor":-7},"resolution_state":"UNRESOLVED"}],
    }
def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        out=Path(tmp)
        index=module.build(source(),out)
        assert index["source"]["npc_role_schema_version"]==1
        search=json.loads((out/"search.json").read_text(encoding="utf-8"))
        npc=next(record for record in search["records"] if record["kind"]=="npc")
        assert npc["roles"]==["bank","quest"]
        assert npc["role_resolution_state"]=="RESOLVED"
        chunk_path=out/index["chunks"][0]["path"]
        chunk=json.loads(chunk_path.read_text(encoding="utf-8"))
        npc_chunk=next(record for record in chunk["records"] if record["kind"]=="npc")
        assert npc_chunk["roles"]==["bank","quest"]
        assert npc_chunk["role_resolution_state"]=="RESOLVED"
    bad=source(); bad["npcs"][0]["roles"]=["weapons"]
    try: module.validate(bad)
    except ValueError as error: assert "role" in str(error).lower()
    else: raise AssertionError("unsupported NPC role must fail closed")
    bad=source(); bad["npcs"][0]["role_resolution_state"]="AMBIGUOUS"
    try: module.validate(bad)
    except ValueError as error: assert "ambiguous" in str(error).lower()
    else: raise AssertionError("ambiguous role metadata must not carry roles")
    print("creature index NPC roles: PASS")
    return 0

if __name__ == "__main__": raise SystemExit(main())
