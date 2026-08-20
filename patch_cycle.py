from pathlib import Path
p=Path('tools/fullworld-runtime/qualify_browser.mjs')
t=p.read_text(encoding='utf-8')
t=t.replace("const timeoutMs = Number(option('--timeout-ms', '120000'));", "const timeoutMs = Number(option('--timeout-ms', '120000'));\nconst viewportWidth = Number(option('--viewport-width', '1920'));\nconst viewportHeight = Number(option('--viewport-height', '1080'));\nconst mobile = process.argv.includes('--mobile');\nconst lodCycle = process.argv.includes('--lod-cycle');")
t=t.replace("  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });", "  await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile });")
t=t.replace("    '--window-size=1920,1080',", "    `--window-size=${viewportWidth},${viewportHeight}`, ")
marker="""function metricMap(result) {
  return Object.fromEntries(result.metrics.map((entry) => [entry.name, entry.value]));
}
"""
insert="""function metricMap(result) {
  return Object.fromEntries(result.metrics.map((entry) => [entry.name, entry.value]));
}

async function clickBySelector(selector, count = 1) {
  const evaluation = await cdp.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})`, returnByValue: false });
  const objectId = evaluation.result?.objectId;
  if (!objectId) throw new Error(`missing control ${selector}`);
  const result = await cdp.send('Runtime.callFunctionOn', { objectId, functionDeclaration: 'function (count) { for (let i=0;i<count;i+=1) this.click(); return true; }', arguments: [{ value: count }], returnByValue: true });
  if (result.exceptionDetails || result.result?.value !== true) throw new Error(`control click failed ${selector}`);
}

async function waitForView(deadline, predicate) {
  while (performance.now() < deadline) {
    const evaluation = await cdp.send('Runtime.evaluate', { expression: 'globalThis.__OTERYN_ATLAS_FULLWORLD__ ?? null', returnByValue: true });
    const value = evaluation.result?.value;
    if (value?.status === 'FAIL') throw new Error(value.error ?? 'Atlas runtime failed');
    if (value?.status === 'PASS' && predicate(value)) return value;
    await sleep(50);
  }
  throw new Error('Atlas view transition did not reach expected state');
}
"""
assert marker in t
t=t.replace(marker,insert)
old="""  const pageResults = [initialResult];
  if (stepsPath && initialResult.status === 'PASS') {
"""
new="""  const pageResults = [initialResult];
  let lodCycleResult = null;
  if (lodCycle && initialResult.status === 'PASS') {
    const anchor = { x: initialResult.view.x, y: initialResult.view.y, floor: initialResult.view.floor };
    await clickBySelector('#zoom-in', 4);
    const detailResult = await waitForView(deadline, (value) => value.view?.zoom >= 0.5 && value.view?.x === anchor.x && value.view?.y === anchor.y && value.view?.floor === anchor.floor);
    assertQualifiedResult(detailResult, 'LOD cycle detail');
    await clickBySelector('#zoom-out', 4);
    const minimapResult = await waitForView(deadline, (value) => value.view?.zoom <= 0.38 && value.view?.x === anchor.x && value.view?.y === anchor.y && value.view?.floor === anchor.floor);
    const paintedMinimap = await waitForMinimap(deadline);
    lodCycleResult = { anchor, detail: detailResult.view, minimap: minimapResult.view, paintedMinimap };
  }
  if (stepsPath && initialResult.status === 'PASS') {
"""
assert old in t
t=t.replace(old,new)
t=t.replace("    minimap: initialMinimap,\n    transitions: pageResults,", "    minimap: initialMinimap,\n    lodCycle: lodCycleResult,\n    viewport: { width: viewportWidth, height: viewportHeight, mobile },\n    transitions: pageResults,")
p.write_text(t,encoding='utf-8')