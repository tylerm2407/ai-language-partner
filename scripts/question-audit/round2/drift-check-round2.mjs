/**
 * Does production still look the way the round-2 patch expects?
 *
 * The patch guards itself — every update carries the exact prior value of every
 * field it writes, and the apply block aborts the whole transaction on any
 * mismatch — so a concurrent edit can never be overwritten. It can only make the
 * deploy fail. What that guarantee does not give you is WARNING. This is the
 * warning: the same comparison, read-only, before anything is written.
 *
 *   node scripts/question-audit/round2/drift-check-round2.mjs            # before
 *   node scripts/question-audit/round2/drift-check-round2.mjs --after    # after
 *
 * `before` also carries the identity fields (lesson_id, unit_id, type, …) that
 * the patch never writes. They are checked in `before` mode, because a row whose
 * lesson moved is not the row that was audited, and skipped in `--after` mode,
 * where the only question is whether the write landed.
 *
 * Round two authors no inserts, so there is no absence-then-presence check here.
 * The comparison is on parsed JSON values, never serialized text: Postgres
 * `jsonb::text` and `JSON.stringify` disagree about key order for reasons that
 * have nothing to do with drift.
 *
 * READ-ONLY. It uses the read-only query endpoint and never echoes the token.
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const project = 'ngqpsuixmumdnqbqxjxv';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const draftPath = resolve(root, 'docs/audits/question-verification/round2/draft-patches.json');

const after = process.argv.includes('--after');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required; do not paste it into a report.');

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
if (patches.some(p => p.op === 'insert')) throw new Error('Round two authors no inserts; this check does not cover them');

const live = new Map();
for (const table of [...new Set(patches.map(p => p.table))].sort()) {
  const ids = patches.filter(p => p.table === table).map(p => p.id);
  for (let index = 0; index < ids.length; index += 2000) {
    const chunk = ids.slice(index, index + 2000).map(id => `'${id}'::uuid`).join(',');
    for (const { row } of await read(`SELECT to_jsonb(t) AS row FROM public.${table} t WHERE t.id IN (${chunk})`)) {
      live.set(`${table}|${row.id}`, row);
    }
  }
}

const problems = [];
let checked = 0;
for (const patch of patches) {
  const row = live.get(`${patch.table}|${patch.id}`);
  if (!row) { problems.push({ kind: 'missing', table: patch.table, id: patch.id }); continue; }
  const expected = after ? patch.after : patch.before;
  for (const [field, value] of Object.entries(expected)) {
    if (after && !Object.hasOwn(patch.after, field)) continue;
    checked += 1;
    if (!isDeepStrictEqual(row[field], value)) {
      problems.push({ kind: after ? 'not-applied' : 'drift', table: patch.table, id: patch.id, field, expected: value, live: row[field] });
    }
  }
}

/** Truncated so a wall of prompt text cannot bury the finding. */
const show = value => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text === undefined ? 'undefined' : text.length > 160 ? `${text.slice(0, 160)}…` : text;
};

console.log(JSON.stringify({ mode: after ? 'after' : 'before', rows: patches.length, fields_checked: checked, problems: problems.length }, null, 2));
if (problems.length) {
  console.log('\nFIRST 40 PROBLEMS — apply nothing until these are adjudicated:\n');
  for (const problem of problems.slice(0, 40)) {
    console.log(`${problem.kind} ${problem.table}/${problem.id}${problem.field ? ` ${problem.field}` : ''}`);
    if (problem.field) { console.log(`  expected: ${show(problem.expected)}`); console.log(`  live:     ${show(problem.live)}`); }
  }
  process.exitCode = 1;
}
