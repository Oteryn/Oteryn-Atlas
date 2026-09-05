import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const audit = fs.readFileSync(new URL('.github/workflows/merge-authority-audit.yml', root), 'utf8');
const source = audit.split("          python - <<'PY'\n")[1].split('          PY')[0]
  .split('\n').map((line) => line.replace(/^ {10}/, '')).join('\n');
const pins = Object.fromEntries([...audit.matchAll(/(EXPECTED_\w+_BLOB): "([a-f0-9]{40})"/g)]
  .map(([, key, value]) => [key, value]));

// Execute the actual embedded audit, replacing only GitHub transport with inert
// responses. No candidate code is executed and unexpected API reads fail closed.
const harness = String.raw`
import base64, hashlib, io, json, os, pathlib, urllib.parse, urllib.request
fixture = json.load(__import__('sys').stdin)
root = pathlib.Path(fixture['root'])
paths = ['.github/workflows/ci.yml', '.github/workflows/merge-group-gate.yml',
         'tools/governance/verify_extraction_provenance.py',
         'tools/governance/test_verify_extraction_provenance.py',
         'docs/migration/legacy-atlas-extraction-provenance.json']
def blob(raw):
    return hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest()
entries = {p: dict(path=p, type='blob', mode='100644', sha=blob((root / p).read_bytes())) for p in paths}
for item in fixture['changes']:
    if isinstance(item, dict) and isinstance(item.get('filename'), str):
        p = item['filename']
        if item.get('status') == 'removed':
            entries.pop(p, None)
        elif p not in entries:
            entries[p] = dict(path=p, type='blob', mode='100644', sha='d'*40)
entries.update(fixture.get('treeOverrides', {}))
entries = {p: e for p, e in entries.items() if e is not None}
head = 'a'*40
def urlopen(request, timeout=None):
    url = urllib.parse.urlsplit(request.full_url)
    assert url.netloc == 'api.github.com'
    p = url.path.removeprefix('/repos/example/project')
    q = urllib.parse.parse_qs(url.query)
    if p == '/pulls/71':
        value = dict(state='open', head=dict(sha=fixture.get('liveHead', head), repo=dict(full_name='example/project')),
                     base=dict(ref='main'), changed_files=fixture.get('count', len(fixture['changes'])))
    elif p == '/git/commits/' + head:
        value = dict(tree=dict(sha='b'*40))
    elif p == '/git/trees/' + 'b'*40:
        value = dict(tree=list(entries.values()), truncated=fixture.get('truncated', False))
    elif p == '/pulls/71/files':
        page = int(q['page'][0])
        value = fixture.get('pages', [fixture['changes']])[page-1] if page <= len(fixture.get('pages', [fixture['changes']])) else []
    elif p == '/contents/.github/workflows':
        assert q == dict(ref=[head])
        value = [dict(path=str(f.relative_to(root))) for f in (root / '.github/workflows').glob('*.yml')]
    elif p.startswith('/contents/'):
        assert q == dict(ref=[head])
        raw = (root / urllib.parse.unquote(p[len('/contents/'):])).read_bytes()
        value = dict(encoding='base64', content=base64.b64encode(raw).decode())
    else:
        raise AssertionError('unexpected API read: ' + request.full_url)
    return io.BytesIO(json.dumps(value).encode())
urllib.request.urlopen = urlopen
exec(compile(fixture['source'], 'protected-merge-authority-audit', 'exec'))
`;

function run(changes, options = {}) {
  return spawnSync('python3', ['-c', harness], {
    input: JSON.stringify({ root: decodeURIComponent(root.pathname), source, changes, ...options }),
    env: { ...process.env, ...pins, REPOSITORY: 'example/project', EVENT_PR_NUMBER: '71',
      EVENT_PR_HEAD_SHA: 'a'.repeat(40), GH_TOKEN: 'inert-test-token' },
    encoding: 'utf8',
  });
}
function pass(changes, options) {
  const result = run(changes, options);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /audit PASS|not applicable/);
}
function reject(changes, pattern, options) {
  const result = run(changes, options);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, pattern);
}
const governance = 'tools/governance/arbitrary_retired_helper.py';
const removed = { filename: governance, status: 'removed' };

test('removed arbitrary unpinned governance file passes the real protected audit', () => pass([removed]));
test('rename out of governance does not leave new governance import authority', () => pass([
  { filename: 'docs/archive/helper.txt', previous_filename: governance, status: 'renamed' },
]));
for (const status of ['added', 'modified', 'changed', 'unchanged', 'copied', 'renamed']) {
  test(`${status} unpinned governance destination fails closed`, () => reject([
    { filename: governance, status, ...(['copied', 'renamed'].includes(status) ? { previous_filename: 'docs/helper.txt' } : {}) },
  ], /unpinned Python import authority/));
}
test('rename within governance still rejects the destination', () => reject([
  { filename: governance, previous_filename: 'tools/governance/old.py', status: 'renamed' },
], /unpinned Python import authority/));
test('allowed removal cannot hide a new unpinned import', () => reject([
  removed, { filename: 'tools/governance/__init__.py', status: 'added' },
], /unpinned Python import authority/));
test('copied governance source still present in candidate fails closed', () => reject([
  { filename: 'docs/copied.txt', previous_filename: governance, status: 'copied' },
], /unpinned Python import authority/, { treeOverrides: { [governance]: { path: governance, type: 'blob', mode: '100644', sha: 'd'.repeat(40) } } }));
test('removal claim for a surviving tree entry fails closed', () => reject([removed], /removed.*candidate tree/i,
  { treeOverrides: { [governance]: { path: governance, type: 'blob', mode: '100644', sha: 'd'.repeat(40) } } }));
test('missing surviving destination fails closed', () => reject([
  { filename: governance, status: 'modified' },
], /missing.*candidate tree/i, { treeOverrides: { [governance]: null } }));
for (const change of [{ filename: governance }, { filename: governance, status: 'unexpected' },
  { status: 'removed' }, { filename: '', status: 'removed' },
  { filename: 'docs/moved.txt', status: 'renamed' }]) {
  test(`malformed changed-file record fails closed: ${JSON.stringify(change)}`, () => reject([change], /invalid.*changed.file|invalid.*rename/i));
}
test('duplicate file records cannot satisfy changed_files count', () => reject([removed, removed], /duplicate|enumeration/i));
test('rename source cannot conceal an incomplete API enumeration', () => reject([
  { filename: 'docs/new.txt', previous_filename: 'docs/old.txt', status: 'renamed' },
], /enumeration/i, { count: 2 }));
test('full pages preserve removal classification across pagination', () => {
  const changes = Array.from({ length: 101 }, (_, i) => ({ filename: `tools/governance/removed_${i}.py`, status: 'removed' }));
  pass(changes, { pages: [changes.slice(0, 100), changes.slice(100)] });
});
test('pinned verifier removal remains rejected', () => reject([
  { filename: 'tools/governance/verify_extraction_provenance.py', status: 'removed' },
], /pinned control-plane path missing/));
for (const override of [{ sha: 'e'.repeat(40) }, { mode: '120000' }, { type: 'tree' }]) {
  test(`unpinned removal does not excuse pinned tree drift: ${JSON.stringify(override)}`, () => reject([removed], /pinned control-plane/,
    { treeOverrides: { 'tools/governance/verify_extraction_provenance.py': { type: 'blob', mode: '100644', ...override } } }));
}
test('audit self-rotation still requires explicit owner authorization and independent review', () => reject([
  { filename: '.github/workflows/merge-authority-audit.yml', status: 'modified' },
], /explicit owner-authorized.*audit rotation and independent deep review/s));
test('stale exact head remains rejected', () => reject([removed], /head moved/, { liveHead: 'e'.repeat(40) }));
test('truncated candidate tree remains rejected', () => reject([removed], /tree enumeration is truncated/, { truncated: true }));
