import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync(new URL('../../.github/workflows/legacy-molehill-transition-qualification.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function statusJob() {
  const marker = '  publish-reviewed-status:\n';
  const index = workflow.indexOf(marker);
  assert.notEqual(index, -1, 'missing reviewed-status job');
  return workflow.slice(index);
}

test('reviewed status publication converts the protected publisher JSON through an exact fail-closed gh transport shim', () => {
  const job = statusJob();
  const publisherIndex = job.indexOf('.\\e2e\\publish-local-e2e-status.ps1');
  assert.notEqual(publisherIndex, -1, 'missing protected status publisher invocation');
  const beforePublisher = job.slice(0, publisherIndex);

  assert.match(beforePublisher, /function\s+gh\s*\{/i, 'publisher step must shadow only the gh transport used by the protected publisher');
  assert.match(beforePublisher, /ValueFromPipeline\s*=\s*\$true/);
  assert.match(beforePublisher, /ValueFromRemainingArguments\s*=\s*\$true/);
  assert.match(beforePublisher, /ConvertFrom-Json/);
  assert.match(beforePublisher, /repos\/\$env:GITHUB_REPOSITORY\/statuses\/\$env:ATLAS_CODE_REVISION/);
  assert.match(beforePublisher, /\$body\.state\s+-ne\s+'success'/);
  assert.match(beforePublisher, /\$body\.context\s+-ne\s+'atlas-local-e2e'/);
  assert.match(beforePublisher, /gh\.exe\s+api\s+--method\s+POST/);
  assert.match(beforePublisher, /-f\s+"state=\$\(\$body\.state\)"/);
  assert.match(beforePublisher, /-f\s+"context=\$\(\$body\.context\)"/);
  assert.doesNotMatch(beforePublisher, /continue-on-error:\s*true/);
});
