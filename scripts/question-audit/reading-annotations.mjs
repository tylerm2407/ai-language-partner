/** Supplemental read-only dependency check before changing passage offsets. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const snapshot = JSON.parse(await readFile('.question-audit/snapshot-8c7f381c78d8.json', 'utf8'));
const ids = snapshot.reading_passages.map(p => p.id);
if (ids.some(id => !/^[0-9a-f-]{36}$/.test(id))) throw new Error('Unexpected passage ID');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required; never paste it into reports.');
async function readOnly(query) {
  const response = await fetch('https://api.supabase.com/v1/projects/ngqpsuixmumdnqbqxjxv/database/query/read-only', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Read-only annotation query failed: HTTP ${response.status}: ${(await response.text()).slice(0, 1500)}`);
  return response.json();
}
// Migration 094b removed this obsolete table; older installations may retain it.
const exists = (await readOnly("SELECT to_regclass('public.reading_annotations') IS NOT NULL AS exists"))[0]?.exists;
const query = `SELECT jsonb_build_object(
  'captured_at', current_timestamp,
  'annotation_table_exists', ${exists ? 'true' : 'false'},
  'passage_hashes', (SELECT jsonb_object_agg(id, md5(content)) FROM public.reading_passages WHERE id IN (${ids.map(id => `'${id}'::uuid`).join(',')})),
  'annotations', ${exists ? `(SELECT coalesce(jsonb_agg(a ORDER BY a.id), '[]'::jsonb) FROM public.reading_annotations a WHERE passage_id IN (${ids.map(id => `'${id}'::uuid`).join(',')}))` : "'[]'::jsonb"}
) AS dependencies`;
const data = (await readOnly(query))[0]?.dependencies;
if (!data || !Array.isArray(data.annotations)) throw new Error('Unexpected response');
for (const passage of snapshot.reading_passages) {
  if (data.passage_hashes[passage.id] !== createHash('md5').update(passage.content).digest('hex')) throw new Error(`Passage changed since frozen audit: ${passage.id}`);
}
const raw = JSON.stringify(data, null, 2) + '\n';
const hash = createHash('sha256').update(raw).digest('hex');
const file = `.question-audit/reading-annotations-${hash.slice(0, 12)}.json`;
await writeFile(file, raw, { flag: 'wx' });
console.log(JSON.stringify({ file, sha256: hash, annotations: data.annotations.length, checked_unchanged_passages: ids.length }));
