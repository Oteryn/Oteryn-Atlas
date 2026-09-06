"""Independent audit probes of an exact Git blob, using invented data only."""
from __future__ import annotations
import copy
import hashlib
import importlib.util
import json
import platform
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'sources/build-creature-index.py'
EXPECTED = '325c63b22b5b75797af7ecb47f1aaae5f577657f'
b = SOURCE.read_bytes()
assert hashlib.sha1(f'blob {len(b)}\0'.encode() + b).hexdigest() == EXPECTED
spec = importlib.util.spec_from_file_location('audited_builder', SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

base = {
    'contract_id': 'oteryn-game-atlas-export-v1',
    'capability': 'static-creatures-v1',
    'coordinate_profile': 'oteryn-native-floor-v1',
    'npc_role_schema_version': 1,
    'semantic_digest': 'sha256:' + 'a' * 64,
    'npcs': [{
        'record_id': 'npc:' + '1' * 32,
        'kind': 'npc', 'name': 'Audit synthetic NPC',
        'resolution_state': 'RESOLVED',
        'position': {'x': 64, 'y': 128, 'floor': -7},
    }],
    'monster_spawns': [],
}

cases = [
    ('valid_static', True), ('valid_animated', True),
    ('wrong_contract', False), ('wrong_capability', False),
    ('wrong_coordinate_profile', False), ('monster_npc_roles', False),
    ('boolean_coordinate', False), ('nonhex_digest', False),
    ('malformed_record_id', False), ('duplicate_roles', False),
]
results = []
for name, expected in cases:
    source = copy.deepcopy(base)
    if name == 'valid_animated': source['capability'] = 'animated-creatures-v1'
    elif name == 'wrong_contract': source['contract_id'] = 'unapproved-contract'
    elif name == 'wrong_capability': source['capability'] = 'unapproved-capability'
    elif name == 'wrong_coordinate_profile': source['coordinate_profile'] = 'unapproved-coordinates'
    elif name == 'monster_npc_roles':
        source['monster_spawns'] = [{**source['npcs'][0], 'kind': 'monster', 'record_id': 'monster:' + '2' * 32, 'roles': ['shop']}]
    elif name == 'boolean_coordinate': source['npcs'][0]['position']['x'] = True
    elif name == 'nonhex_digest': source['semantic_digest'] = 'sha256:' + 'g' * 64
    elif name == 'malformed_record_id': source['npcs'][0]['record_id'] = 'npc:invalid'
    elif name == 'duplicate_roles':
        source['npcs'][0].update(role_resolution_state='RESOLVED', roles=['shop', 'shop'])
    try:
        module.validate(source)
        accepted, error = True, None
    except (ValueError, TypeError) as exc:
        accepted, error = False, str(exc)
    results.append(dict(probe=name, expected_accept=expected, actual_accept=accepted,
                        matches_contract_expectation=(accepted == expected), error=error))

with tempfile.TemporaryDirectory(prefix='atlas-builder-audit-') as temp:
    output = []
    for label in ['one', 'two']:
        dest = Path(temp) / label
        dest.mkdir()
        module.build(copy.deepcopy(base), dest)
        output.append({str(p.relative_to(dest)): hashlib.sha256(p.read_bytes()).hexdigest()
                       for p in sorted(dest.rglob('*')) if p.is_file()})
    results.append(dict(probe='same_input_two_clean_builds', expected_equal=True,
                        actual_equal=(output[0] == output[1]),
                        matches_contract_expectation=(output[0] == output[1]),
                        output_file_count=len(output[0]), hashes=output[0]))

report = dict(source_repository='Oteryn/Oteryn-Atlas',
              source_commit='51623c7dab2346cee39cd51e3caa845bf4b65426',
              source_path='tools/build-creature-index.py', verified_git_blob=EXPECTED,
              python_version=platform.python_version(),
              scope='Invented small inputs only. Not full publication, upstream Game validation, or browser acceptance.',
              probes=results)
(ROOT/'results').mkdir(exist_ok=True)
(ROOT/'results/creature-builder-probes.json').write_text(json.dumps(report, indent=2) + '\n')
for item in results:
    print(('MATCH' if item['matches_contract_expectation'] else 'MISMATCH'), item['probe'], json.dumps(item))
print(f"TOTAL {len(results)}; MATCH {sum(x['matches_contract_expectation'] for x in results)}; MISMATCH {sum(not x['matches_contract_expectation'] for x in results)}")
