"""Bounded mutation experiment on one original four-test file; NOT repo-wide score."""
from pathlib import Path
import tempfile,subprocess,json,shutil,os
ROOT=Path(__file__).resolve().parents[1]
cache='src/browser/verified-content-cache.mjs';scheduler='src/browser/frame-scheduler.mjs'
mutations=[('disable-get-digest',cache,' || await sha256ContentId(bytes) !== contentId',''),('disable-put-digest',cache,"    if (await sha256ContentId(bytes) !== contentId) throw new Error('refusing to cache bytes under a mismatched content identity');",''),('remove-entry-byte-cap',cache,' || bytes.byteLength > this.maxEntryBytes',''),('disable-scheduler-cancel',scheduler,"    dirty = false;\n    if (handle != null && typeof cancelFrame === 'function') cancelFrame(handle);\n    handle = null;",'    // audit-only deliberate mutant: cancellation omitted')]
rows=[]
for name,relative,before,after in mutations:
 with tempfile.TemporaryDirectory(prefix='atlas-audit-mutant-') as td:
  root=Path(td)/'sources';shutil.copytree(ROOT/'sources',root,ignore=shutil.ignore_patterns('__pycache__'))
  target=root/relative;text=target.read_text();assert text.count(before)==1,(name,text.count(before));target.write_text(text.replace(before,after))
  original=subprocess.run(['node','--test','tests/fullworld-runtime/performance.test.mjs'],cwd=root,capture_output=True,text=True,timeout=10)
  augmented=subprocess.run(['node','--test',str(ROOT/'probes/cache-scheduler-contracts.test.mjs')],env={**os.environ,'AUDIT_SOURCE_ROOT':str(root)},cwd=root,capture_output=True,text=True,timeout=10)
  logs=ROOT/'results/mutations';logs.mkdir(exist_ok=True)
  (logs/(name+'-original.tap')).write_text(original.stdout+original.stderr);(logs/(name+'-additional.tap')).write_text(augmented.stdout+augmented.stderr)
  rows.append({'id':name,'source':relative,'removedOrChanged':before,'replacement':after,'originalFourTestsExit':original.returncode,'additionalThreeTestsExit':augmented.returncode,'detectedByOriginal':original.returncode!=0,'detectedByUnion':original.returncode!=0 or augmented.returncode!=0})
report={'scope':'Only tests/fullworld-runtime/performance.test.mjs (four original tests), plus three audit contracts. Other repository test coverage is NOT assessed by this mutation score. Mutations remain only in temporary sandbox copies.','results':rows}
(ROOT/'results/mutation-probes.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
