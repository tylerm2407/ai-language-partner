// Node's test runner; PostgreSQL runs entirely in memory, never against Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '../../../.question-audit/test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { createRound2PatchSet, renderPatchSql, renderReverseSql, SNAPSHOT_FILE, SNAPSHOT_SHA } from './patch-set-round2.mjs';
import { NEW_TITLE } from './idiomatic-equivalents-retitle.mjs';

const draft = JSON.parse(await readFile('docs/audits/question-verification/round2/draft-patches.json', 'utf8'));
const { patches } = draft;
const raw = await readFile(SNAPSHOT_FILE);
assert.equal(createHash('sha256').update(raw).digest('hex'), SNAPSHOT_SHA, 'the round-2 snapshot must be the pinned one');
assert.equal(draft.snapshot_sha256, SNAPSHOT_SHA, 'the draft must be built against the pinned snapshot');
const snapshot = JSON.parse(raw);
const tables = [...new Set(patches.flatMap(p => [p.table, ...(p.context_guards ?? []).map(g => g.table)]))].sort();
const arrayFields = new Set(['accepted_answers', 'accepted_speech_variants', 'options', 'distractors', 'tags', 'target_vocabulary', 'collocations', 'search_terms']);

/** Minimal typed schema, including every original field so untouched fields can
 * be compared. This tests SQL/JSONB/array/null/UUID behaviour, NOT Supabase RLS,
 * auth, production triggers, or the historical migration chain. */
async function fixture() {
  const db = await PGlite.create();
  for (const table of tables) {
    const rows = snapshot[table];
    const fields = Object.keys(rows[0]);
    const columns = fields.map(field => {
      const values = rows.map(r => r[field]).filter(v => v !== null);
      let type = 'text';
      if (field === 'id' || ['course_id', 'unit_id', 'lesson_id', 'passage_id', 'card_id', 'user_id'].includes(field)) type = 'uuid';
      else if (arrayFields.has(field) || (field === 'target_grammar' && table === 'writing_prompts')) type = 'text[]';
      else if (values.some(v => typeof v === 'object')) type = 'jsonb';
      else if (values.some(v => typeof v === 'boolean')) type = 'boolean';
      else if (values.some(v => typeof v === 'number')) type = 'numeric';
      return `"${field}" ${type}${field === 'id' ? ' PRIMARY KEY' : ''}`;
    });
    await db.exec(`CREATE TABLE public."${table}" (${columns.join(',')});`);
    await db.query(`INSERT INTO public."${table}" SELECT * FROM jsonb_populate_recordset(NULL::public."${table}", $1::jsonb)`, [JSON.stringify(rows)]);
  }
  return db;
}
async function contents(db) {
  const result = {};
  for (const table of tables) result[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM public."${table}" t ORDER BY id`)).rows.map(x => x.row);
  return result;
}
const sql = renderPatchSql(patches);
const reverseSql = renderReverseSql(patches);
const expected = Object.fromEntries(tables.map(table => [table,
  snapshot[table].map(row => ({ ...row, ...(patches.find(p => p.table === table && p.id === row.id)?.after ?? {}) }))
    .sort((a, b) => a.id.localeCompare(b.id))]));
let passedChecks = 0;

test('round 2 authors updates only — no inserts, no insert machinery in the SQL', () => {
  assert.equal(patches.filter(p => p.op === 'insert').length, 0);
  assert(!sql.includes("plan->'inserts'"));
  assert(!reverseSql.includes("plan->'deletes'"));
  assert.equal(sql, renderPatchSql(patches), 'rendering must be deterministic');
  assert.equal(reverseSql, renderReverseSql(patches));
  passedChecks++;
});

test('every authored update applies exactly; every other field and row is unchanged; rerun is idempotent', async () => {
  const db = await fixture();
  try {
    await db.exec(sql);
    assert.deepEqual(await contents(db), expected);
    await db.exec(sql);
    assert.deepEqual(await contents(db), expected);
  } finally { await db.close(); }
  passedChecks++;
});

test('a conflicting edit aborts atomically, including rows already processed', async () => {
  const db = await fixture();
  try {
    const patch = [...patches].reverse().find(p => p.table === 'exercises');
    assert(patch);
    await db.query('UPDATE public.exercises SET correct_answer = $1 WHERE id = $2::uuid', ['Concurrent editor answer', patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(sql), /Audited row changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('an edited lesson title aborts the retitle instead of overwriting it', async () => {
  const db = await fixture();
  try {
    const patch = patches.find(p => p.table === 'lessons');
    assert(patch);
    await db.query('UPDATE public.lessons SET title = $1 WHERE id = $2::uuid', ['Renamed by the curriculum owner', patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(sql), /Audited row changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('exact array guards refuse a row whose options someone else has changed', async () => {
  const db = await fixture();
  try {
    const patch = patches.find(p => Array.isArray(p.after.options));
    assert(patch);
    await db.query('UPDATE public.exercises SET options = $1 WHERE id = $2::uuid', [['Another editor’s option set'], patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(sql), /Audited row changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('a missing target stops the whole patch set', async () => {
  const db = await fixture();
  try {
    const patch = patches.at(-1);
    // This deletion is ONLY of a synthetic in-memory fixture row.
    await db.query(`DELETE FROM public."${patch.table}" WHERE id = $1::uuid`, [patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(sql), /Missing audited row/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('the compiler refuses speaking rows, unknown ids and fields, and contradictory authored edits', async () => {
  const set = await createRound2PatchSet();
  const spoken = snapshot.exercises.find(x => x.type === 'speaking');
  assert.throws(() => set.update('exercises', spoken.id, { prompt: 'Changed' }, 'test'), /Excluded/);
  const spokenByMode = snapshot.exercises.find(x => x.response_mode === 'speak' && x.type !== 'speaking');
  if (spokenByMode) assert.throws(() => set.update('exercises', spokenByMode.id, { prompt: 'Changed' }, 'test'), /Excluded/);
  assert.throws(() => set.update('exercises', 'missing', { correct_answer: 'x' }, 'test'), /exactly one/);
  assert.throws(() => set.update('client_events', snapshot.exercises[0].id, { correct_answer: 'x' }, 'test'), /Out-of-scope table/);
  const row = snapshot.lessons[0];
  assert.throws(() => set.update('lessons', row.id, { id: 'other' }, 'test'), /Unapproved field/);
  assert.throws(() => set.update('lessons', row.id, { title: row.title }, 'test'), /No actual correction/);
  assert.throws(() => set.update('lessons', row.id, { title: 'First draft' }, '  '), /needs a reason/);
  set.update('lessons', row.id, { title: 'First draft' }, 'test');
  assert.throws(() => set.update('lessons', row.id, { title: 'Conflicting draft' }, 'test'), /Conflicting authored edits/);
  passedChecks++;
});

test('the build is reproducible: a second compile emits byte-identical patches', async () => {
  const [{ productiveParadigmFixes }, { filmTheaterFixes }, { idiomaticEquivalentsRetitle }] = await Promise.all([
    import('./productive-paradigm-fixes.mjs'), import('./film-theater-fixes.mjs'), import('./idiomatic-equivalents-retitle.mjs'),
  ]);
  const rebuild = async () => {
    const set = await createRound2PatchSet();
    filmTheaterFixes(set); idiomaticEquivalentsRetitle(set); productiveParadigmFixes(set);
    return set.patches();
  };
  const [one, two] = [await rebuild(), await rebuild()];
  assert.equal(JSON.stringify(one), JSON.stringify(two));
  assert.equal(JSON.stringify(one), JSON.stringify(patches), 'draft-patches.json is stale; re-run build-round2.mjs');
  passedChecks++;
});

test('applying the patch and then the rollback restores the snapshot exactly', async () => {
  const db = await fixture();
  try {
    const original = await contents(db);
    await db.exec(sql);
    assert.deepEqual(await contents(db), expected);
    await db.exec(reverseSql);
    assert.deepEqual(await contents(db), original);
  } finally { await db.close(); }
  passedChecks++;
});

test('the rollback is idempotent, is a no-op on an unpatched database, and repairs a half-applied patch', async () => {
  const db = await fixture();
  try {
    const original = await contents(db);
    await db.exec(reverseSql);
    assert.deepEqual(await contents(db), original);
    await db.exec(sql);
    await db.exec(reverseSql);
    await db.exec(reverseSql);
    assert.deepEqual(await contents(db), original);
    await db.exec(renderPatchSql(patches.slice(0, Math.floor(patches.length / 2))));
    await db.exec(reverseSql);
    assert.deepEqual(await contents(db), original);
  } finally { await db.close(); }
  passedChecks++;
});

test('the rollback refuses to revert a row edited since the patch landed', async () => {
  const db = await fixture();
  try {
    await db.exec(sql);
    const patch = [...patches].reverse().find(p => p.table === 'exercises');
    await db.query('UPDATE public.exercises SET correct_answer = $1 WHERE id = $2::uuid', ['Edited after the deploy', patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(reverseSql), /Audited row changed; review before reverting/);
    assert.deepEqual(await contents(db), before, 'a refused rollback must change nothing at all');
  } finally { await db.close(); }
  passedChecks++;
});

test('the rollback writes back only the fields the patch wrote, never the identity fields it guarded on', () => {
  const identity = ['lesson_id', 'course_id', 'passage_id', 'unit_id', 'language', 'band', 'cefr_level', 'type', 'strand', 'question_type'];
  const reversed = JSON.parse(reverseSql.match(/\$question_audit_payload\$([\s\S]*?)\$question_audit_payload\$/)[1]);
  const forwardById = new Map(patches.map(p => [`${p.table}/${p.id}`, p]));
  assert.equal(reversed.patches.length, forwardById.size);
  assert.equal(reversed.deletes, undefined);
  for (const entry of reversed.patches) {
    const forward = forwardById.get(`${entry.table}/${entry.id}`);
    assert(forward, `${entry.table}/${entry.id}`);
    assert.deepEqual(Object.keys(entry.after).sort(), Object.keys(forward.after).sort());
    assert.deepEqual(entry.before, forward.after, 'the rollback must guard on the value the patch wrote');
    for (const field of identity) {
      if (Object.hasOwn(forward.after, field)) continue;
      assert(!Object.hasOwn(entry.after, field), `${entry.table}/${entry.id} would rewrite ${field}`);
    }
  }
  passedChecks++;
});

/** Scope assertions: what this patch is allowed to touch, stated as tests so a
 * future producer cannot widen it without saying so. */
test('the patch stays inside its declared scope', () => {
  assert.deepEqual([...new Set(patches.map(p => p.table))].sort(), ['exercises', 'lessons']);
  const exerciseFields = new Set(patches.filter(p => p.table === 'exercises').flatMap(p => Object.keys(p.after)));
  assert.deepEqual([...exerciseFields].sort(),
    ['accepted_answers', 'card_id', 'correct_answer', 'explanation', 'hint_text', 'options', 'prompt', 'target_grammar']);
  const lessonFields = new Set(patches.filter(p => p.table === 'lessons').flatMap(p => Object.keys(p.after)));
  assert.deepEqual([...lessonFields].sort(), ['description', 'title']);
  // Nothing spoken, and no row belonging to a learner.
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  for (const patch of patches.filter(p => p.table === 'exercises')) {
    const original = byId.get(patch.id);
    assert(original, patch.id);
    assert.notEqual(original.type, 'speaking');
    assert.notEqual(original.response_mode, 'speak');
    assert.equal(original.user_id ?? null, null);
  }
  // Every reason carries the row it belongs to, and nothing is unexplained.
  for (const patch of patches) assert(patch.reasons.length && patch.reasons.every(r => r.trim().length > 20), patch.id);
  passedChecks++;
});

test('the paradigm patch only ever sets target_grammar, and only on rows that are not already strict', () => {
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  const grammarShaped = ['word_form', 'sentence_transformation', 'error_correction', 'cloze_deletion', 'sentence_construction', 'multiple_choice', 'listening_choice'];
  let count = 0;
  let translateToNative = 0;
  for (const patch of patches) {
    if (!Object.hasOwn(patch.after, 'target_grammar')) continue;
    assert.deepEqual(Object.keys(patch.after), ['target_grammar'], `${patch.id}: a paradigm row changed something else`);
    const original = byId.get(patch.id);
    assert.equal(original.target_grammar, null);
    assert.notEqual(original.skill_type, 'grammar');
    assert(!grammarShaped.includes(original.type), `${patch.id}: ${original.type} is already strict`);
    // translate_to_native is out of scope for the TENSE class — its English
    // answers were measured and accept nothing wrong. The derivational class
    // does reach two of them, the "Cheaper" rows that accept "Cheap"; those are
    // named here so the exception cannot widen silently.
    if (original.type === 'translate_to_native') {
      assert.equal(original.correct_answer, 'Cheaper', `${patch.id}: unexpected translate_to_native paradigm row`);
      translateToNative++;
    }
    count++;
  }
  assert.equal(translateToNative, 2, 'exactly the French and Portuguese "Cheaper" rows');
  assert.equal(count, 249, '192 tense rows + 57 derivational rows');
  passedChecks++;
});

test('the retitle covers all nine Phrasal Verbs lessons and nothing else', () => {
  const lessonPatches = patches.filter(p => p.table === 'lessons');
  assert.equal(lessonPatches.length, 9);
  const byId = new Map(snapshot.lessons.map(l => [l.id, l]));
  const units = new Map(snapshot.units.map(u => [u.id, u]));
  for (const patch of lessonPatches) {
    const lesson = byId.get(patch.id);
    assert.equal(lesson.title, 'Phrasal Verbs');
    assert.equal(lesson.description, 'Phrasal Verbs');
    assert.equal(units.get(lesson.unit_id).title, 'Idiomatic Expressions');
    assert.deepEqual(patch.after, { title: NEW_TITLE, description: NEW_TITLE });
  }
  passedChecks++;
});

test('Film & Theater stops teaching Painting and Sculpture in all six remaining languages', () => {
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  const lessons = new Map(snapshot.lessons.map(l => [l.id, l]));
  const units = new Map(snapshot.units.map(u => [u.id, u]));
  const courses = new Map(snapshot.courses.map(c => [c.id, c]));
  const touched = patches.filter(p => p.table === 'exercises' && !Object.hasOwn(p.after, 'target_grammar'));
  assert.equal(touched.length, 24, 'four rows in each of six languages');
  const languages = new Set();
  for (const patch of touched) {
    const original = byId.get(patch.id);
    const lesson = lessons.get(original.lesson_id);
    const unit = units.get(lesson.unit_id);
    assert.equal(lesson.title, 'Film & Theater');
    assert.equal(unit.title, 'Literature & Arts');
    languages.add(courses.get(unit.course_id).target_language);
  }
  assert.deepEqual([...languages].sort(), ['de', 'fr', 'it', 'pt', 'ru', 'zh']);
  // The lesson's remaining visual-art references are distractors, never keys.
  for (const patch of touched) {
    const after = { ...byId.get(patch.id), ...patch.after };
    assert(!['Painting', 'Sculpture'].includes(after.correct_answer), `${patch.id} still keys a visual-art label`);
  }
  passedChecks++;
});

test('write a truthful local verification record after the assertions', async () => {
  assert.equal(passedChecks, 16, 'never write a successful verification record when an earlier check failed');
  await writeFile('docs/audits/question-verification/round2/local-sql-tests.json', JSON.stringify({
    engine: 'PGlite (in-memory PostgreSQL)',
    round: 2,
    snapshot_sha256: SNAPSHOT_SHA,
    sql_sha256: createHash('sha256').update(sql).digest('hex'),
    reverse_sql_sha256: createHash('sha256').update(reverseSql).digest('hex'),
    patch_rows: patches.length,
    changed_fields: patches.reduce((total, p) => total + Object.keys(p.after).length, 0),
    tables,
    checks: ['updates only, no insert machinery', 'exact changed rows/fields', 'unchanged rows/fields', 'idempotence',
      'atomic conflict rollback on an exercise', 'atomic conflict rollback on a lesson title', 'exact array guards',
      'missing-row abort', 'compiler scope, speaking, reason and conflict guards', 'reproducible build matching the committed draft',
      'rollback restores the snapshot exactly', 'rollback idempotence, no-op and half-applied repair',
      'rollback refuses an edited row', 'rollback writes only patched fields, never guarded identity fields',
      'declared table/field scope', 'target_grammar rows are not already strict', 'retitle covers exactly nine lessons',
      'Film & Theater keys no longer visual-art labels'],
    production_writes: 0,
    limitations: ['Minimal typed content schema, not full Supabase auth/RLS/triggers or historical migrations',
      'Does not establish linguistic correctness or independent round-2 approval',
      'Does not test the shipped grader; see runtime-round2.mjs for that'],
  }, null, 2) + '\n');
});
