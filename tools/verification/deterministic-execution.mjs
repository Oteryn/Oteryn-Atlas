import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// The caller must supply protected ownership/catalog policy. This module resolves
// commands, never executes them or treats candidate metadata as admission authority.
export function resolveDeterministicCommands({ root, catalog, groupIds, ownership, requiredSpecs = [] }) {
  if (!Array.isArray(groupIds) || groupIds.length === 0) throw new Error('empty selection');
  if (ownership?.schemaVersion !== 1 || !Array.isArray(ownership.entries)) throw new Error('unsupported ownership schema');
  const realRoot = fs.realpathSync(root);
  function checkedFile(spec) {
    if (typeof spec !== 'string' || !/^tests\/[A-Za-z0-9_./-]+\.(mjs|py)$/.test(spec) || spec.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`exact safe test path required: ${spec}`);
    const target = path.join(realRoot, spec);
    if (!fs.existsSync(target)) throw new Error(`missing file: ${spec}`);
    const real = fs.realpathSync(target);
    if (real !== target || !real.startsWith(`${realRoot}${path.sep}`)) throw new Error(`symlink or path escape: ${spec}`);
    if (!fs.statSync(real).isFile()) throw new Error(`missing file: ${spec}`);
    return fs.readFileSync(real);
  }
  const entries = new Map();
  for (const row of [...ownership.entries, ...(ownership.importAggregators ?? [])]) {
    if (entries.has(row.spec)) throw new Error(`duplicate ownership: ${row.spec}`);
    entries.set(row.spec, row);
  }
  const selected = new Set();
  for (const id of [...new Set(groupIds)].sort()) {
    const group = catalog?.groups?.[id];
    if (!group) throw new Error(`unknown group: ${id}`);
    if (group.capabilities?.browser !== false) throw new Error(`nonbrowser group required: ${id}`);
    if (!Array.isArray(group.specs) || group.specs.length === 0) throw new Error(`empty group: ${id}`);
    for (const spec of group.specs) { checkedFile(spec); selected.add(spec); }
  }
  for (const spec of requiredSpecs) if (!selected.has(spec)) throw new Error(`required test is not selected: ${spec}`);
  const closures = new Map();
  function closure(spec, visiting = new Set()) {
    if (visiting.has(spec)) throw new Error(`test import cycle: ${spec}`);
    if (closures.has(spec)) return closures.get(spec);
    const bytes = checkedFile(spec);
    const row = entries.get(spec);
    if (!row) throw new Error(`missing explicit interpreter/import ownership: ${spec}`);
    if (row.qualification?.startsWith('blocked-')) throw new Error(`known qualification blocker: ${spec}: ${row.qualification}`);
    const expected = spec.endsWith('.py') ? { interpreter: 'python3', argv: [spec] } : { interpreter: 'node', argv: ['--test', spec] };
    if (row.interpreter !== expected.interpreter || JSON.stringify(row.argv) !== JSON.stringify(expected.argv)) throw new Error(`unsupported interpreter or argv: ${spec}`);
    if (typeof row.sourceSha256 !== 'string' || crypto.createHash('sha256').update(bytes).digest('hex') !== row.sourceSha256) throw new Error(`source proof changed: ${spec}`);
    if (!Array.isArray(row.imports) || !Array.isArray(row.subprocessTests)) throw new Error(`missing import proof: ${spec}`);
    visiting.add(spec);
    const covered = new Set([spec]);
    for (const child of row.imports) {
      if (row.interpreter !== 'node' || !child.endsWith('.mjs')) throw new Error(`unsupported import interpreter: ${spec}`);
      for (const leaf of closure(child, visiting)) covered.add(leaf);
    }
    visiting.delete(spec);
    closures.set(spec, covered);
    return covered;
  }
  for (const spec of selected) closure(spec);
  const roots = [...selected].filter(spec => ![...selected].some(other => other !== spec && closures.get(other).has(spec))).sort();
  const coveredOnce = new Set();
  for (const spec of roots) {
    for (const covered of closures.get(spec)) {
      if (coveredOnce.has(covered)) throw new Error(`unresolved overlapping import roots: ${covered}`);
      coveredOnce.add(covered);
    }
  }
  for (const covered of coveredOnce) {
    if (entries.get(covered).subprocessTests.length) {
      throw new Error(`unproven subprocess execution: ${covered}; explicit child execution ownership is required`);
    }
  }
  for (const spec of selected) if (!coveredOnce.has(spec)) throw new Error(`selected test lost coverage: ${spec}`);
  return roots.map(spec => {
    const row = entries.get(spec);
    return { interpreter: row.interpreter, argv: [...row.argv], cwd: realRoot, spec, coveredSpecs: [...closures.get(spec)].sort() };
  });
}
