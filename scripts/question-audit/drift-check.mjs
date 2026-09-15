/**
 * Does production still look the way the patch expects?
 *
 * The frozen patch guards itself: every update carries the exact prior value of
 * every field it writes, and the apply block aborts the whole transaction on any
 * mismatch. So a concurrent edit can never be overwritten — it can only make the
 * deploy fail. That is the safety property, and it needs no timestamps, which is
 * just as well because none of these tables has an `updated_at`.
 *
 * What that guarantee does NOT give you is warning. This script is the warning:
 * it runs the same comparison read-only, before anything is written, so a
 * conflict is a report rather than a failed deploy.
 *
 * Two modes:
 *   (default)  every patched field still equals the patch's `before`  — run me first
 *   --after    every patched field now equals the patch's `after`     — run me last
 *
 * `before` also carries ten identity fields (lesson_id, language, type, …) that
 * the patch never writes. They are checked in `before` mode, because a row whose
 * lesson or language moved is not the row that was audited. They are skipped in
 * `--after` mode, where the question is only whether the write landed.
 *
 * Inserts are checked for absence before and exact presence after.
 *
 * Comparison is on parsed JSON values, never on serialized text. Postgres
 * `jsonb::text` and JavaScript `JSON.stringify` disagree about key order and
 * spacing for reasons that have nothing to do with drift, and an earlier pass of
 * this audit lost an hour to exactly that.
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const project = 'ngqpsuixmumdnqbqxjxv';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '../..');
const draftPath = resolve(root, 'docs/audits/question-verification/remediation/draft-patches.json');

const after = process.argv.includes('--after');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required; do not paste it into a report.');

/** One read-only statement. Never echoes headers or the environment. */
async function read(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query/read-only`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Read failed (${response.status}): ${(await response.text()).slice(0, 1500)}`);
  return response.json();
}

const { patches } = JSON.parse(await readFile(draftPath, 'utf8'));
const updates = patches.filter((p) => p.op !== 'insert');
const inserts = patches.filter((p) => p.op === 'insert');

/**
 * Pull every patched row, one statement per table. `to_jsonb(t)` gives the whole
 * row in one shot, so a patch touching a column this script has never heard of
 * still gets compared.
 */
const live = new Map();
const tables = [...new Set(patches.map((p) => p.table))].sort();
for (const table of tables) {
  const ids = patches.filter((p) => p.table === table).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 2000) {
    const chunk = ids.slice(i, i + 2000).map((id) => `'${id}'::uuid`).join(',');
    const rows = await read(`SELECT to_jsonb(t) AS row FROM public.${table} t WHERE t.id IN (${chunk})`);
    for (const { row } of rows) live.set(`${table}|${row.id}`, row);
  }
}

const problems = [];
let checked = 0;

for (const patch of updates) {
  const row = live.get(`${patch.table}|${patch.id}`);
  if (!row) {
    problems.push({ kind: 'missing', table: patch.table, id: patch.id });
    continue;
  }
  // In `before` mode the identity fields are part of the question: a row that
  // changed lesson or language is not the row that was reviewed. In `after` mode
  // they are not, because the patch never wrote them.
  const expected = after ? patch.after : patch.before;
  for (const [field, value] of Object.entries(expected)) {
    if (after && !Object.hasOwn(patch.after, field)) continue;
    checked += 1;
    if (!isDeepStrictEqual(row[field], value)) {
      problems.push({
        kind: after ? 'not-applied' : 'drift',
        table: patch.table, id: patch.id, field,
        expected: value, live: row[field],
      });
    }
  }
}

for (const patch of inserts) {
  const row = live.get(`${patch.table}|${patch.id}`);
  // An authored row's payload lives under `after`, like every other patch; the
  // `row` key with the id folded in exists only inside the rendered SQL payload.
  const authored = { id: patch.id, ...patch.after };
  if (!after) {
    // Before applying, an authored row must not already exist with other values.
    // One that already matches exactly is a re-run, not a conflict.
    if (row && Object.entries(authored).some(([f, v]) => !isDeepStrictEqual(row[f], v))) {
      problems.push({ kind: 'insert-occupied', table: patch.table, id: patch.id });
    }
    continue;
  }
  if (!row) {
    problems.push({ kind: 'insert-missing', table: patch.table, id: patch.id });
    continue;
  }
  for (const [field, value] of Object.entries(authored)) {
    checked += 1;
    if (!isDeepStrictEqual(row[field], value)) {
      problems.push({ kind: 'insert-wrong', table: patch.table, id: patch.id, field, expected: value, live: row[field] });
    }
  }
}

/** Truncated so a wall of passage text cannot bury the finding. */
const show = (v) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s === undefined ? 'undefined' : s.length > 160 ? `${s.slice(0, 160)}…` : s;
};

console.log(JSON.stringify({
  mode: after ? 'after' : 'before',
  rows: patches.length,
  fields_checked: checked,
  problems: problems.length,
}, null, 2));

if (problems.length) {
  console.log('\nFIRST 40 PROBLEMS — apply nothing until these are adjudicated:\n');
  for (const p of problems.slice(0, 40)) {
    console.log(`${p.kind} ${p.table}/${p.id}${p.field ? ` ${p.field}` : ''}`);
    if (p.field) {
      console.log(`  expected: ${show(p.expected)}`);
      console.log(`  live:     ${show(p.live)}`);
    }
  }
  process.exitCode = 1;
}
