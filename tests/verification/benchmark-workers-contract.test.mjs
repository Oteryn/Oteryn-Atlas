import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const scriptPath = new URL('../../e2e/benchmark-workers.ps1', import.meta.url);

test('worker benchmark is measurement-only, repeatable and uses non-null telemetry sources', () => {
  assert.equal(fs.existsSync(scriptPath), true, 'missing worker benchmark harness');
  const script = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');

  assert.match(script, /ValidateSet\(1, 2, 4, 6, 8\)/);
  assert.match(script, /ValidateRange\(3, 5\)/);
  assert.match(script, /Get-Counter/);
  assert.match(script, /docker stats --no-stream --format/);
  assert.match(script, /docker version --format/);
  assert.match(script, /Get-ComputerInfo/);
  assert.match(script, /ATLAS_E2E_WORKERS/);
  assert.match(script, /-SelfTest/);
  assert.doesNotMatch(script, /LoadPercentage/);
  assert.doesNotMatch(script, /Set-Content.*playwright\.config/i);
  assert.doesNotMatch(script, /git (?:commit|push|reset)/i);
});
