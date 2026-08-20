#!/usr/bin/env python3
"""Build bounded Atlas creature shards from a validated Game static-creatures-v1 export."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

CHUNK_SIZE = 64
MAX_RECORDS = 200_000
EXPECTED_CONTRACT = "oteryn-game-atlas-export-v1"
EXPECTED_CAPABILITY = "static-creatures-v1"

def canonical(value): return json.dumps(value, ensure_ascii=False, separators=(",",":"), sort_keys=True).encode("utf-8")
def digest(value): return "sha256:" + hashlib.sha256(canonical(value)).hexdigest()

def validate(source):
    if source.get("contract_id") != EXPECTED_CONTRACT: raise ValueError("unsupported Game export contract")
    if source.get("capability") != EXPECTED_CAPABILITY: raise ValueError("missing static-creatures-v1 capability")
    if source.get("coordinate_profile") != "oteryn-native-floor-v1": raise ValueError("unsupported coordinate profile")
    records = list(source.get("npcs", [])) + list(source.get("monster_spawns", []))
    if len(records) > MAX_RECORDS: raise ValueError("creature export exceeds bounded record cap")
    for record in records:
        if record.get("resolution_state") not in {"RESOLVED","AMBIGUOUS","UNRESOLVED"}: raise ValueError("invalid creature resolution state")
        pos=record.get("position",{}); x,y,floor=pos.get("x"),pos.get("y"),pos.get("floor")
        if not all(isinstance(v,int) for v in (x,y,floor)): raise ValueError("invalid creature position")
        if not isinstance(record.get("record_id"),str) or len(record["record_id"])>96: raise ValueError("invalid creature record id")
    return records

def build(source, output: Path):
    records=validate(source); shards={}; search={}
    for record in records:
        kind="npc" if record.get("kind")=="npc" else "monster"
        pos=record["position"]; key=(pos["floor"],pos["x"]//CHUNK_SIZE,pos["y"]//CHUNK_SIZE)
        public={k:record[k] for k in ("record_id","entity_id","kind","name","position","spawn_area","origin","resolution_state","appearance") if k in record}
        shards.setdefault(key,[]).append(public)
        label=str(record["name"]); search.setdefault((kind,label.casefold()),{"kind":kind,"label":label,"position":pos,"resolution_state":record["resolution_state"]})
    entries=[]
    for (floor,cx,cy), values in sorted(shards.items()):
        values.sort(key=lambda r:(r["position"]["y"],r["position"]["x"],str(r["name"]).casefold(),r["record_id"]))
        rel=f"chunks/f{floor}/{cx}_{cy}.json"; payload={"schema_version":1,"floor":floor,"chunk_x":cx,"chunk_y":cy,"records":values}
        path=output/rel; path.parent.mkdir(parents=True,exist_ok=True); data=canonical(payload); path.write_bytes(data+b"\n")
        entries.append({"floor":floor,"chunk_x":cx,"chunk_y":cy,"path":rel,"records":len(values),"bytes":len(data)+1,"digest":"sha256:"+hashlib.sha256(data+b"\n").hexdigest()})
    search_records=sorted(search.values(),key=lambda r:(r["label"].casefold(),r["kind"])); search_payload={"schema_version":1,"records":search_records}; (output/"search.json").write_bytes(canonical(search_payload)+b"\n")
    index={"schema_version":1,"source":{"contract_id":source["contract_id"],"capability":source["capability"],"semantic_digest":source.get("semantic_digest")},"chunk_size":CHUNK_SIZE,"counts":{"records":len(records),"chunks":len(entries),"search_records":len(search_records)},"chunks":entries,"search_path":"search.json"}
    (output/"index.json").write_bytes(canonical(index)+b"\n"); return index

def main():
    p=argparse.ArgumentParser(); p.add_argument("source",type=Path); p.add_argument("output",type=Path); a=p.parse_args(); source=json.loads(a.source.read_text(encoding="utf-8")); a.output.mkdir(parents=True,exist_ok=True); result=build(source,a.output); print(json.dumps(result["counts"],sort_keys=True)); return 0
if __name__=="__main__": raise SystemExit(main())
