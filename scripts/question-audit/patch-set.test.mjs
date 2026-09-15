// Node's test runner; PostgreSQL runs entirely in memory, never against Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '../../.question-audit/test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { createPatchSet, renderPatchSql, renderReverseSql, derivedInsertId } from './patch-set.mjs';
const { patches } = JSON.parse(await readFile('docs/audits/question-verification/remediation/draft-patches.json', 'utf8'));
const snapshot = JSON.parse(await readFile('.question-audit/snapshot-8c7f381c78d8.json', 'utf8'));
const tables = [...new Set(patches.flatMap(p => [p.table, ...(p.context_guards ?? []).map(g => g.table)]))].sort();
const arrayFields = new Set(['accepted_answers', 'accepted_speech_variants', 'options', 'distractors', 'tags', 'target_vocabulary', 'collocations', 'search_terms']);

/** Minimal typed schema, including all original fields for untouched-field
 * comparisons. This tests SQL/JSONB/array/null/UUID behavior, NOT Supabase RLS,
 * auth, production triggers, or the entire historical migration chain. */
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
let passedChecks = 0;
/**
 * The expected end state: every frozen row with its update applied, PLUS the
 * authored inserts, which have no frozen row to start from. An inserted row
 * lands with exactly the columns its payload names; every other column of that
 * table keeps its default, which in this fixture is NULL.
 */
const insertsFor = table => patches.filter(p => p.op === 'insert' && p.table === table);
const expected = Object.fromEntries(tables.map(table => {
  const defaults = Object.fromEntries(Object.keys(snapshot[table][0]).map(field => [field, null]));
  const updated = snapshot[table].map(row => ({ ...row, ...(patches.find(p => p.table === table && p.op !== 'insert' && p.id === row.id)?.after ?? {}) }));
  const inserted = insertsFor(table).map(p => ({ ...defaults, id: p.id, ...p.after }));
  return [table, [...updated, ...inserted].sort((a, b) => a.id.localeCompare(b.id))];
}));

test('all authored updates apply exactly; every other field and row is unchanged; rerun is idempotent', async () => {
  const db = await fixture();
  try {
    await db.exec(sql);
    assert.deepEqual(await contents(db), expected);
    await db.exec(sql);
    assert.deepEqual(await contents(db), expected);
  } finally { await db.close(); }
  passedChecks++;
});

test('a conflicting edit aborts atomically, including previously processed rows', async () => {
  const db = await fixture();
  try {
    // An UPDATE, deliberately: the guard under test is the before-value
    // comparison, and an insert has no before-value to conflict with. Inserts
    // have their own conflict test below.
    const patch = [...patches].reverse().find(p => p.op !== 'insert' && typeof p.after.correct_answer === 'string');
    assert(patch);
    await db.query(`UPDATE public."${patch.table}" SET correct_answer = $1 WHERE id = $2::uuid`, ['Concurrent editor answer', patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(sql), /Audited row changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('exact guards preserve newly added alternatives instead of treating arrays as subsets', async () => {
  const db = await fixture();
  try {
    const patch = patches.find(p => p.op !== 'insert' && Array.isArray(p.after.accepted_answers));
    assert(patch);
    await db.query(`UPDATE public."${patch.table}" SET accepted_answers = ARRAY['Another editor’s valid alternative'] WHERE id = $1::uuid`, [patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(sql), /Audited row changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('missing target stops the whole patch set', async () => {
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

test('compiler rejects speaking, unknown IDs/fields and contradictory authored edits', async () => {
  const set = await createPatchSet();
  const spoken = snapshot.exercises.find(x => x.type === 'speaking');
  assert.throws(() => set.update('exercises', spoken.id, { prompt: 'Changed' }, 'test'), /Excluded/);
  assert.throws(() => set.update('reading_questions', 'missing', { correct_answer: 'x' }, 'test'), /exactly one/);
  const row = snapshot.reading_questions[0];
  assert.throws(() => set.update('reading_questions', row.id, { id: 'other' }, 'test'), /Unapproved field/);
  set.update('reading_questions', row.id, { correct_answer: 'First draft' }, 'test');
  assert.throws(() => set.update('reading_questions', row.id, { correct_answer: 'Conflicting draft' }, 'test'), /Conflicting authored edits/);
  passedChecks++;
});

test('a changed destination category prevents stale topic reassignment atomically', async () => {
  const db = await fixture();
  try {
    const patch = patches.find(p => p.after.unit_id && p.context_guards?.length);
    assert(patch);
    await db.query('UPDATE public.units SET title = $1 WHERE id = $2::uuid', ['Changed curriculum category', patch.after.unit_id]);
    const before = await contents(db);
    await assert.rejects(db.exec(sql), /Audited category changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

/** Inserts. The Portuguese 3008 passage is the worked case: both of its frozen
 * question rows already carry reviewed patches, so before insert support it had
 * no remedy at all. Nothing here authors content for it; these are compiler tests. */
const PT_PASSAGE = 'aabbccdd-5555-3008-a001-000000000000';
const PT_QUESTIONS = ['0234fbd5-4930-4c6e-94ea-a254f69351e1', 'cf47ba3a-7494-4ed1-b80c-31fbf2939091'];
const PT_REGISTER_ID = '45d0fc00-666c-821f-9d49-bcb6a45a357c';
const registerRow = (overrides = {}) => ({
  passage_id: PT_PASSAGE, order_index: 2, question_type: 'multiple_choice',
  question_text: 'Compiler fixture stem, not authored content.',
  options: ['Fixture option one', 'Fixture option two', 'Fixture option three', 'Fixture option four'],
  correct_answer: 'Fixture option one', accepted_answers: [], ...overrides,
});

test('inserted ids are derived from (table, parent, slug), stable across runs, and valid UUIDs', async () => {
  for (let run = 0; run < 2; run++) assert.equal(derivedInsertId('reading_questions', PT_PASSAGE, 'pt-3008-register'), PT_REGISTER_ID);
  // Version 8 (custom) and an RFC 4122 variant nibble, so PostgreSQL accepts it as a uuid.
  assert.match(PT_REGISTER_ID, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(derivedInsertId('reading_questions', PT_PASSAGE, 'pt-3008-register-b'), PT_REGISTER_ID);
  assert.notEqual(derivedInsertId('reading_questions', 'aabbccdd-1111-3008-a001-000000000000', 'pt-3008-register'), PT_REGISTER_ID);
  assert.notEqual(derivedInsertId('checkpoint_items', PT_PASSAGE, 'pt-3008-register'), PT_REGISTER_ID);
  assert.throws(() => derivedInsertId('reading_questions', PT_PASSAGE, 'Not A Slug'), /kebab-case/);
  assert.throws(() => derivedInsertId('reading_questions', PT_PASSAGE, ''), /kebab-case/);
  // Two independently built sets emit byte-identical patch bytes for one authored row.
  const [one, two] = [await createPatchSet(), await createPatchSet()];
  assert.equal(one.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test'), PT_REGISTER_ID);
  two.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test');
  assert.equal(JSON.stringify(one.patches()), JSON.stringify(two.patches()));
  assert.equal(one.patches()[0].op, 'insert');
  assert.equal(one.patches()[0].before, null);
  passedChecks++;
});

test('insert refuses unsafe tables, unknown or missing columns, missing parents, and duplicate slugs', async () => {
  const set = await createPatchSet();
  for (const table of ['exercises', 'checkpoint_items', 'cards', 'reading_passages', 'writing_prompts', 'lessons', 'units', 'courses', 'grammar_rules']) {
    assert.throws(() => set.insert(table, 'new-row', registerRow(), 'compiler test'), /Inserts are not supported/, table);
  }
  assert.throws(() => set.insert('client_events', 'new-row', registerRow(), 'compiler test'), /Inserts are not supported/);
  assert.throws(() => set.insert('reading_questions', 'unknown-column', registerRow({ difficulty: 3 }), 'compiler test'), /Unapproved field/);
  assert.throws(() => set.insert('reading_questions', 'unknown-column', registerRow({ user_id: PT_PASSAGE }), 'compiler test'), /Unapproved field/);
  assert.throws(() => set.insert('reading_questions', 'unknown-column', registerRow({ id: PT_REGISTER_ID }), 'compiler test'), /Unapproved field/);
  const { accepted_answers, ...incomplete } = registerRow();
  assert.throws(() => set.insert('reading_questions', 'missing-column', incomplete, 'compiler test'), /Missing required column reading_questions.accepted_answers/);
  assert.throws(() => set.insert('reading_questions', 'no-parent', registerRow({ passage_id: '00000000-0000-4000-8000-000000000000' }), 'compiler test'), /Expected exactly one reading_passages/);
  assert.throws(() => set.insert('reading_questions', 'no-reason', registerRow(), '   '), /needs a reason/);
  assert.throws(() => set.insert('reading_questions', 'not-an-object', 'a string', 'compiler test'), /must be an object/);
  set.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test');
  assert.throws(() => set.insert('reading_questions', 'pt-3008-register', registerRow({ order_index: 7 }), 'compiler test'), /Duplicate insert/);
  assert.equal(set.patches().length, 1);
  passedChecks++;
});

test('insert refuses an order_index that a frozen, reordered or authored sibling already holds', async () => {
  const set = await createPatchSet();
  assert.throws(() => set.insert('reading_questions', 'pt-clash-zero', registerRow({ order_index: 0 }), 'compiler test'), /order_index 0 is taken/);
  assert.throws(() => set.insert('reading_questions', 'pt-clash-one', registerRow({ order_index: 1 }), 'compiler test'), /order_index 1 is taken/);
  assert.throws(() => set.insert('reading_questions', 'pt-bad-order', registerRow({ order_index: -1 }), 'compiler test'), /non-negative integer/);
  assert.throws(() => set.insert('reading_questions', 'pt-bad-order', registerRow({ order_index: 1.5 }), 'compiler test'), /non-negative integer/);
  // A sibling that an update moves onto this ordinal still blocks it.
  const reordered = await createPatchSet();
  reordered.update('reading_questions', PT_QUESTIONS[0], { order_index: 2 }, 'compiler test');
  assert.throws(() => reordered.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test'), /order_index 2 is taken/);
  // Two authored inserts cannot share one ordinal under the same parent.
  const twice = await createPatchSet();
  twice.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test');
  assert.throws(() => twice.insert('reading_questions', 'pt-3008-second', registerRow(), 'compiler test'), /order_index 2 is taken/);
  twice.insert('reading_questions', 'pt-3008-second', registerRow({ order_index: 3 }), 'compiler test');
  assert.equal(twice.patches().filter(p => p.op === 'insert').length, 2);
  passedChecks++;
});

test('a derived id colliding with any frozen row, or not shaped like a UUID, is refused', async () => {
  for (const taken of [snapshot.reading_questions[0].id, snapshot.cards[0].id, snapshot.reading_passages[0].id]) {
    const set = await createPatchSet({ deriveId: () => taken });
    assert.throws(() => set.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test'), /already exists in the frozen snapshot/);
  }
  for (const bad of ['not-a-uuid', '', '45d0fc00666c821f9d49bcb6a45a357c', null]) {
    const set = await createPatchSet({ deriveId: () => bad });
    assert.throws(() => set.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test'), /not a valid UUID/);
  }
  passedChecks++;
});

test('an authored insert applies once, reruns idempotently, and guards parent, sibling order and conflicts', async () => {
  const set = await createPatchSet();
  const id = set.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test', ['https://rm.coe.int/1680459f97']);
  const insertSql = renderPatchSql(set.patches());
  const expectedRow = { id, ...set.patches()[0].after };

  let db = await fixture();
  try {
    const before = await contents(db);
    await db.exec(insertSql);
    const after = await contents(db);
    assert.deepEqual(after.reading_questions.filter(r => r.id === id), [expectedRow]);
    assert.deepEqual({ ...after, reading_questions: after.reading_questions.filter(r => r.id !== id) }, before);
    await db.exec(insertSql);
    assert.deepEqual(await contents(db), after);
  } finally { await db.close(); }

  db = await fixture();
  try {
    await db.exec(insertSql);
    await db.query('UPDATE public.reading_questions SET question_text = $1 WHERE id = $2::uuid', ['Concurrent editor rewrite', id]);
    const before = await contents(db);
    await assert.rejects(db.exec(insertSql), /Audited row changed/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }

  db = await fixture();
  try {
    // These deletions are ONLY of synthetic in-memory fixture rows.
    await db.query('DELETE FROM public.reading_questions WHERE passage_id = $1::uuid', [PT_PASSAGE]);
    await db.query('DELETE FROM public.reading_passages WHERE id = $1::uuid', [PT_PASSAGE]);
    const before = await contents(db);
    await assert.rejects(db.exec(insertSql), /Missing audited parent/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }

  db = await fixture();
  try {
    await db.query('UPDATE public.reading_questions SET order_index = 2 WHERE id = $1::uuid', [PT_QUESTIONS[1]]);
    const before = await contents(db);
    await assert.rejects(db.exec(insertSql), /Audited sibling order taken/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('a refused insert rolls back the updates that already applied in the same block', async () => {
  const set = await createPatchSet();
  set.update('reading_questions', PT_QUESTIONS[1], { question_text: 'Authored replacement stem' }, 'compiler test');
  set.insert('reading_questions', 'pt-3008-register', registerRow(), 'compiler test');
  const mixed = renderPatchSql(set.patches());
  const db = await fixture();
  try {
    await db.query('DELETE FROM public.reading_passages WHERE id = $1::uuid', [PT_PASSAGE]);
    const before = await contents(db);
    await assert.rejects(db.exec(mixed), /Missing audited parent/);
    assert.deepEqual(await contents(db), before);
  } finally { await db.close(); }
  passedChecks++;
});

test('renderPatchSql refuses malformed or out-of-scope insert patches it is handed directly', () => {
  const good = { op: 'insert', table: 'reading_questions', id: PT_REGISTER_ID, after: registerRow(),
    parent: { table: 'reading_passages', column: 'passage_id', id: PT_PASSAGE } };
  assert.doesNotThrow(() => renderPatchSql([good]));
  assert.throws(() => renderPatchSql([{ ...good, table: 'exercises' }]), /Out-of-scope insert table/);
  assert.throws(() => renderPatchSql([{ ...good, parent: { ...good.parent, table: 'units' } }]), /Malformed insert parent/);
  assert.throws(() => renderPatchSql([{ ...good, parent: { ...good.parent, column: 'unit_id' } }]), /Malformed insert parent/);
  assert.throws(() => renderPatchSql([{ ...good, parent: undefined }]), /Malformed insert parent/);
  assert.throws(() => renderPatchSql([{ ...good, after: { ...good.after, passage_id: 'aabbccdd-1111-3008-a001-000000000000' } }]), /does not match its row/);
  assert.throws(() => renderPatchSql([{ ...good, after: { ...good.after, id: PT_REGISTER_ID } }]), /must not carry its own id/);
  passedChecks++;
});

/**
 * Originally this pinned the whole draft's SQL to one hash, to prove the insert
 * change was a no-op. The draft now legitimately contains inserts, and a hash of
 * moving content is a maintenance trap rather than a guarantee, so the durable
 * properties are asserted instead: an insert-free patch set emits none of the
 * insert machinery at all, and rendering is deterministic.
 */
test('an insert-free patch set emits no insert machinery, and rendering is deterministic', () => {
  const updatesOnly = patches.filter(p => p.op !== 'insert');
  const updateSql = renderPatchSql(updatesOnly);
  assert(!updateSql.includes("plan->'inserts'"));
  assert(!updateSql.includes('"inserts"'));
  assert.equal(updateSql, renderPatchSql(updatesOnly));
  // With inserts present the machinery appears exactly once.
  assert.equal(patches.length - updatesOnly.length, 5);
  assert(sql.includes("plan->'inserts'"));
  assert.equal(sql, renderPatchSql(patches));
  passedChecks++;
});

/**
 * The rollback is only worth having if it actually restores the original, so it
 * is held to the same standard as the patch: apply, revert, and the database must
 * be byte-identical to the frozen snapshot — not merely close, and not merely
 * correct on the fields anyone thought to check.
 */
test('applying the patch and then the rollback restores the frozen snapshot exactly', async () => {
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

test('the rollback is idempotent and is a no-op on an unpatched database', async () => {
  const db = await fixture();
  try {
    // Never applied: every row already holds its pre-patch value, so the
    // idempotence short-circuit must skip all of them rather than abort on a
    // guard that expects the patched value.
    const original = await contents(db);
    await db.exec(reverseSql);
    assert.deepEqual(await contents(db), original);
    // And twice after a real apply.
    await db.exec(sql);
    await db.exec(reverseSql);
    await db.exec(reverseSql);
    assert.deepEqual(await contents(db), original);
  } finally { await db.close(); }
  passedChecks++;
});

/**
 * The deploy may have to be applied in chunks if the whole block exceeds the
 * transport's payload ceiling, which means a failure can leave the patch half
 * applied. The rollback has to cope with that state, because that is precisely
 * when someone reaches for it.
 */
test('the rollback repairs a half-applied patch', async () => {
  const db = await fixture();
  try {
    const original = await contents(db);
    const half = patches.slice(0, Math.floor(patches.length / 2));
    await db.exec(renderPatchSql(half));
    await db.exec(reverseSql);
    assert.deepEqual(await contents(db), original);
  } finally { await db.close(); }
  passedChecks++;
});

test('the rollback refuses to revert a row edited since the patch landed, and refuses to delete an edited authored row', async () => {
  const db = await fixture();
  try {
    await db.exec(sql);
    const patch = [...patches].reverse().find(p => p.op !== 'insert' && typeof p.after.correct_answer === 'string');
    assert(patch);
    await db.query(`UPDATE public."${patch.table}" SET correct_answer = $1 WHERE id = $2::uuid`, ['Edited after the deploy', patch.id]);
    const before = await contents(db);
    await assert.rejects(db.exec(reverseSql), /Audited row changed; review before reverting/);
    assert.deepEqual(await contents(db), before, 'a refused rollback must change nothing at all');

    // Same protection for the authored rows: an edited insert is not deleted.
    await db.query(`UPDATE public."${patch.table}" SET correct_answer = $1 WHERE id = $2::uuid`, [patch.after.correct_answer, patch.id]);
    const insert = patches.find(p => p.op === 'insert');
    assert(insert);
    await db.query(`UPDATE public."${insert.table}" SET question_text = $1 WHERE id = $2::uuid`, ['Reworded by someone else', insert.id]);
    const beforeInsertEdit = await contents(db);
    await assert.rejects(db.exec(reverseSql), /Authored row changed; review before reverting/);
    assert.deepEqual(await contents(db), beforeInsertEdit);
  } finally { await db.close(); }
  passedChecks++;
});

test('the rollback writes back only the fields the patch wrote, never the identity fields it guarded on', () => {
  // `before` carries ten identity fields the patch never writes. If the reverse
  // wrote them back it would be asserting authority over lesson membership,
  // language and question type that this audit never had.
  const identity = ['lesson_id', 'course_id', 'passage_id', 'unit_id', 'language', 'band', 'cefr_level', 'type', 'strand', 'question_type'];
  const reversed = JSON.parse(reverseSql.match(/\$question_audit_payload\$([\s\S]*?)\$question_audit_payload\$/)[1]);
  const forwardById = new Map(patches.filter(p => p.op !== 'insert').map(p => [`${p.table}/${p.id}`, p]));
  assert.equal(reversed.patches.length, forwardById.size);
  for (const entry of reversed.patches) {
    const forward = forwardById.get(`${entry.table}/${entry.id}`);
    assert(forward, `${entry.table}/${entry.id}`);
    assert.deepEqual(Object.keys(entry.after).sort(), Object.keys(forward.after).sort());
    assert.deepEqual(entry.before, forward.after, 'the rollback must guard on the value the patch wrote');
    for (const field of identity) {
      if (Object.hasOwn(forward.after, field)) continue;      // the patch really did write it
      assert(!Object.hasOwn(entry.after, field), `${entry.table}/${entry.id} would rewrite ${field}`);
    }
  }
  // The five authored rows come back out, and nothing else does.
  assert.equal(reversed.deletes.length, 5);
  assert.deepEqual(new Set(reversed.deletes.map(d => d.table)), new Set(['reading_questions']));
  passedChecks++;
});

test('write a truthful local verification record after the assertions', async () => {
  assert.equal(passedChecks, 19, 'Never write a successful verification record when an earlier check failed');
  await writeFile('docs/audits/question-verification/remediation/local-sql-tests.json', JSON.stringify({
    engine: 'PGlite 0.5.8 (in-memory PostgreSQL)',
    sql_sha256: createHash('sha256').update(sql).digest('hex'),
    reverse_sql_sha256: createHash('sha256').update(reverseSql).digest('hex'),
    patch_rows: patches.length,
    tables,
    checks: ['exact changed rows/fields', 'unchanged rows/fields', 'idempotence', 'atomic conflict rollback', 'exact array guards', 'missing-row abort', 'compiler scope and conflict guards', 'category meaning/course guards',
      'insert id derivation and stability', 'insert table/column/parent/slug guards', 'insert order_index collision guards', 'insert id collision and UUID shape guards',
      'insert apply, idempotence, parent/sibling/conflict aborts', 'insert failure rolls back applied updates', 'renderPatchSql insert-shape guards', 'no-insert SQL byte-identical to the pre-insert compiler',
      'rollback restores the frozen snapshot exactly', 'rollback idempotence and no-op on an unpatched database', 'rollback repairs a half-applied patch',
      'rollback refuses an edited row and an edited authored row', 'rollback writes only patched fields, never guarded identity fields'],
    production_writes: 0,
    limitations: ['Minimal typed content schema, not full Supabase auth/RLS/triggers or historical migrations', 'Does not establish linguistic correctness or independent remediation approval'],
  }, null, 2) + '\n');
});
