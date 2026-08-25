import process from 'node:process';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
const paths = input.split(/\r?\n/).filter((path) => path.length > 0);

function isSafeDocsMarkdown(path) {
  if (typeof path !== 'string' || !path.startsWith('docs/') || !path.endsWith('.md')) return false;
  if (path.startsWith('/') || path.includes('\\')) return false;
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false;
  return segments.length >= 2;
}

const docsOnly = paths.length > 0 && paths.every(isSafeDocsMarkdown);
process.stdout.write(`docs_only=${docsOnly}\nrequires_e2e=${!docsOnly}\n`);
