"""Read-only audit probes: exact repository gate, synthetic Git fixtures only."""
import hashlib, json, os, shutil, subprocess, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'sources/verify-maintenance-diff.mjs'
EXPECTED='714fb73fe08b7c741d606c6e5a8ecdf33a3adf10'
b=SOURCE.read_bytes()
assert hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()==EXPECTED

def run(args, cwd=None, env=None, check=True):
    return subprocess.run(args,cwd=cwd,env=env,text=True,capture_output=True,check=check,timeout=15)
def git(root,*args):
    return run(['git','-c','user.name=Audit Fixture','-c','user.email=audit@example.invalid','-C',str(root),*args]).stdout.strip()
def put(root,name,data):
    p=root/name;p.parent.mkdir(parents=True,exist_ok=True)
    if p.is_symlink():p.unlink()
    p.write_bytes(data.encode() if isinstance(data,str) else data)
def commit(root):
    git(root,'add','-A');git(root,'commit','--allow-empty','-qm','Synthetic audit fixture')
    return git(root,'rev-parse','HEAD')
def setup(root,stage):
    root.mkdir();git(root,'init','-q','-b','main')
    for name,content in {
      'AGENTS.md':'base instructions\n','README.md':'intro\n',
      'docs/agents/guide.md':'agent guide\n','docs/evidence/old.md':'evidence\n',
      'web/app.mjs':'export const runtime = 1;\n',
      'tests/verification/bounded-real-world.test.mjs':'// product data authority regression\n',
      'tools/maintenance/verify-maintenance-diff.mjs':b,
      'tools/maintenance/minimal-merge-group-gate.yml':'name: minimal\n',
      '.github/workflows/merge-authority-audit.yml':'name: protected audit\n',
      '.github/workflows/terminal-branch-lifecycle.yml':'name: lifecycle\n',
      '.github/workflows/merge-group-gate.yml':'name: legacy\n' if stage=='A' else 'name: minimal\n',
    }.items():put(root,name,content)
    put(root,'.github/workflows/ci.yml' if stage=='A' else 'docs/maintenance/suspended-workflows/ci.yml','name: old CI\n')
    return commit(root)

def cutover(c, kind='text'):
    (c/'docs/maintenance/suspended-workflows').mkdir(parents=True,exist_ok=True)
    shutil.move(c/'.github/workflows/ci.yml',c/'docs/maintenance/suspended-workflows/ci.yml')
    put(c,'.github/workflows/merge-group-gate.yml','name: minimal\n')
    name='docs/maintenance/ATLAS-MAINTENANCE-MODE.md'
    if kind=='symlink':(c/name).symlink_to('../../AGENTS.md')
    else:
        put(c,name,b'\x00\xff' if kind=='binary' else 'maintenance active\n')
        if kind=='executable':(c/name).chmod(0o755)

def change(c, kind):
    if kind=='docs_add':put(c,'docs/agents/new.md','new guidance\n')
    elif kind=='root_modify':put(c,'AGENTS.md','changed guidance\n')
    elif kind=='governance_add':put(c,'tools/governance/check.py','print("candidate is not executed")\n')
    elif kind=='docs_delete':(c/'docs/evidence/old.md').unlink()
    elif kind=='product_test_delete':(c/'tests/verification/bounded-real-world.test.mjs').unlink()
    elif kind=='runtime':put(c,'web/app.mjs','export const runtime = 2;\n')
    elif kind=='mixed':change(c,'runtime');change(c,'docs_add')
    elif kind=='root_delete':(c/'AGENTS.md').unlink()
    elif kind=='readme':put(c,'README.md','Updated onboarding\n')
    elif kind=='test_add':put(c,'tests/verification/new.test.mjs','// new test\n')
    elif kind=='test_modify':put(c,'tests/verification/bounded-real-world.test.mjs','// edited product regression\n')
    elif kind=='gate_edit':put(c,'tools/maintenance/verify-maintenance-diff.mjs','process.exit(0);\n')
    elif kind=='workflow_restore':put(c,'.github/workflows/ci.yml','name: restored test\n')
    elif kind in ['symlink','executable','binary','invalid_utf8','oversized']:
        p=c/'docs/agents/unsafe.md'
        if kind=='symlink':p.symlink_to('../../web/app.mjs')
        else:
            data={'binary':b'foo\0bar','invalid_utf8':b'\xff','oversized':b'x'*(2*1024*1024+1)}.get(kind,b'text\n')
            put(c,'docs/agents/unsafe.md',data)
            if kind=='executable':p.chmod(0o755)
    elif kind=='rename_escape':shutil.move(c/'web/app.mjs',c/'docs/agents/runtime.md')
    elif kind=='space_path':put(c,'docs/agents/unsafe name.md','text\n')
    elif kind.startswith('cutover_'):cutover(c,kind.removeprefix('cutover_'))
    elif kind=='partial_cutover':(c/'.github/workflows/ci.yml').unlink()
    elif kind!='empty':change(c,'docs_add')

cases=[
('docs_add','B',True),('root_modify','B',True),('governance_add','B',True),('docs_delete','B',True),
('product_test_delete','B',False),('runtime','B',False),('mixed','B',False),('root_delete','B',False),
('readme','B',False),('test_add','B',False),('test_modify','B',False),('gate_edit','B',False),
('workflow_restore','B',False),('symlink','B',False),('executable','B',False),('binary','B',False),
('invalid_utf8','B',False),('oversized','B',False),('rename_escape','B',False),('space_path','B',False),
('empty','B',False),('dirty_candidate','B',False),('dirty_base','B',False),('wrong_repo','B',False),
('wrong_event','B',False),('wrong_head','B',False),('merge_group_valid','B',True),('merge_group_wrong_sha','B',False),
('cutover_text','A',True),('cutover_symlink','A',False),('cutover_binary','A',False),('cutover_executable','A',False),
('partial_cutover','A',False)
]
results=[]
for name,stage,expected_allow in cases:
    with tempfile.TemporaryDirectory(prefix='atlas-audit-',dir='/mnt/data') as tmp:
        t=Path(tmp);trusted=t/'trusted';base=setup(trusted,stage);candidate=t/'candidate'
        git(t,'clone','-q','--local',str(trusted),str(candidate))
        change(candidate,name);head=commit(candidate)
        env=os.environ.copy();env.update({
          'ATLAS_EVENT_REPOSITORY':'Oteryn/Oteryn-Atlas','GITHUB_REPOSITORY':'Oteryn/Oteryn-Atlas',
          'ATLAS_DEFAULT_BRANCH':'main','GITHUB_EVENT_NAME':'pull_request_target',
          'ATLAS_EVENT_ACTION':'synchronize','ATLAS_BASE_REF':'main','ATLAS_PR_NUMBER':'123',
          'ATLAS_PROTECTED_BASE_SHA':base,'ATLAS_CODE_REVISION':head,
        })
        if name=='dirty_candidate':put(candidate,'untracked.tmp','dirty\n')
        if name=='dirty_base':put(trusted,'untracked.tmp','dirty\n')
        if name=='wrong_repo':env['GITHUB_REPOSITORY']='Other/Repo'
        if name=='wrong_event':env['GITHUB_EVENT_NAME']='push'
        if name=='wrong_head':env['ATLAS_CODE_REVISION']='f'*40
        if name.startswith('merge_group_'):
            env.update(GITHUB_EVENT_NAME='merge_group',ATLAS_EVENT_ACTION='checks_requested',ATLAS_BASE_REF='refs/heads/main',GITHUB_SHA=head)
        if name=='merge_group_wrong_sha':env['GITHUB_SHA']='f'*40
        r=run(['node',str(trusted/'tools/maintenance/verify-maintenance-diff.mjs'),str(trusted),str(candidate)],env=env,check=False)
        allowed=r.returncode==0
        result={'probe':name,'synthetic_stage':stage,'expected_allow':expected_allow,'actual_allow':allowed,'matches_safety_expectation':allowed==expected_allow,'exit_code':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr.strip()}
        results.append(result)
        print(f'{name:26} actual={"ALLOW" if allowed else "DENY":5} expectation={"MATCH" if allowed==expected_allow else "MISMATCH"} {r.stderr.strip()}')
report={'source_repository':'Oteryn/Oteryn-Atlas','source_commit':'51623c7dab2346cee39cd51e3caa845bf4b65426','source_path':'tools/maintenance/verify-maintenance-diff.mjs','verified_git_blob':EXPECTED,'node_version':run(['node','--version']).stdout.strip(),'git_version':run(['git','--version']).stdout.strip(),'scope':'33 synthetic Git-fixture probes; not a full Atlas test suite or GitHub workflow execution','probes':results,'total':len(results),'matched':sum(r['matches_safety_expectation'] for r in results),'mismatches':[r['probe'] for r in results if not r['matches_safety_expectation']]}
(ROOT/'results/maintenance-probes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('SUMMARY',report['total'],report['matched'],report['mismatches'])
