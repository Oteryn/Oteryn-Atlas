#!/usr/bin/env python3
"""Replay bounded, network-free audit probes. This is NOT an Atlas qualification runner.
Exit 0: the audit executions completed, possibly reproducing defects.
Exit 1: source custody, syntax or an execution failed unexpectedly.
Only audit-owned outputs and throwaway directories are written.
"""
from __future__ import annotations
import ast,hashlib,json,os,subprocess,sys
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'results';OUT.mkdir(exist_ok=True)
env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'}
def run(args:list[str],log:str,cwd:Path=ROOT)->None:
    result=subprocess.run(args,cwd=cwd,env=env,text=True,capture_output=True,timeout=90)
    (OUT/log).write_text(result.stdout+result.stderr)
    if result.returncode:raise RuntimeError(f'{args[0]} execution failed ({result.returncode}); see results/{log}')
try:
    manifest=json.loads((ROOT/'source-manifest.json').read_text())
    for relative,item in manifest.items():
        data=(ROOT/'sources'/relative).read_bytes()
        actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        if actual!=item['blob_sha']:raise RuntimeError('Source custody mismatch: '+relative)
    syntax=[]
    for relative in manifest:
        if relative.endswith('.mjs'):
            result=subprocess.run(['node','--check',str(ROOT/'sources'/relative)],capture_output=True,text=True,timeout=10)
            if result.returncode:raise RuntimeError('Source syntax failed: '+relative+' '+result.stderr)
            syntax.append({'path':relative,'result':'PASS','kind':'node --check'})
        elif relative.endswith('.py'):
            ast.parse((ROOT/'sources'/relative).read_text(),filename=relative)
            syntax.append({'path':relative,'result':'PASS','kind':'Python AST parse'})
    (OUT/'syntax.json').write_text(json.dumps(syntax,indent=2))
    run(['node','--test','tests/fullworld-runtime/performance.test.mjs'],'original-performance-tests.tap',ROOT/'sources')
    run(['node','--test','probes/cache-scheduler-contracts.test.mjs'],'additional-contracts.tap')
    run(['node','probes/runtime-probes.mjs'],'runtime-probes.log')
    run([sys.executable,'probes/produce-canonical-fixture.py'],'produce-canonical-fixture.log')
    run(['node','probes/consume-canonical-fixture.mjs'],'cross-language.log')
    run([sys.executable,'probes/build-publication-fixture.py'],'synthetic-build.log')
    run(['node','probes/consume-built-publication.mjs'],'synthetic-build-consumption.log')
    run([sys.executable,'probes/builder-safety.py'],'builder-safety.log')
    run(['node','probes/framebuffer-fault.mjs'],'framebuffer-fault.log')
    run([sys.executable,'probes/mutation-probes.py'],'mutation-probes.log')
    runtime=json.loads((OUT/'runtime-probes.json').read_text())
    summary={'auditStatus':'EXECUTED_WITH_FINDINGS','productQualification':'NOT_PERFORMED','completedAt':datetime.now(timezone.utc).isoformat(),'commit':'51623c7dab2346cee39cd51e3caa845bf4b65426','verifiedSourceFiles':len(manifest),'runtimeProbeCount':runtime['total'],'runtimeProbeDiscrepancies':runtime['violations'],'runtimeProbeErrors':runtime['probeErrors'],'note':'An audit process exit of zero is NOT product PASS. See individual expected/observed results and scope.'}
    (OUT/'replay-summary.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary,indent=2))
except Exception as exc:
    print('AUDIT_EXECUTION_ERROR: '+str(exc),file=sys.stderr);raise SystemExit(1)
