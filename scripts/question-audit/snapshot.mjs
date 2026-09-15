/** Read-only, project-scoped curriculum export. Never prints credentials. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = 'ngqpsuixmumdnqbqxjxv';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '../..');
const outputDirectory = resolve(root, '.question-audit');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required; do not paste it into a report.');
const query = await readFile(resolve(scriptDirectory, 'snapshot.sql'), 'utf8');
const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query/read-only`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) {
  // SQL errors can aid diagnosis; never echo request headers or environment.
  throw new Error(`Read-only snapshot failed (${response.status}): ${(await response.text()).slice(0, 1500)}`);
}
const rows = await response.json();
const snapshot = rows[0]?.curriculum;
if (!snapshot || !Array.isArray(snapshot.exercises)) throw new Error('Unexpected snapshot shape');
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
const hash = createHash('sha256').update(serialized).digest('hex');
await mkdir(outputDirectory, { recursive: true });
const path = resolve(outputDirectory, `snapshot-${hash.slice(0, 12)}.json`);
await writeFile(path, serialized, { flag: 'wx' });
console.log(JSON.stringify({ path, sha256: hash, captured_at: snapshot.captured_at,
  counts: Object.fromEntries(Object.entries(snapshot).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
}, null, 2));
