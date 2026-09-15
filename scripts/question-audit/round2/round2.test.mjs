// Node's test runner; PostgreSQL runs entirely in memory, never against Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '../../../.question-audit/test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { lessonRefs } from '../lesson-refs.mjs';
import { createRound2PatchSet, renderPatchSql, renderReverseSql, SNAPSHOT_FILE, SNAPSHOT_SHA } from './patch-set-round2.mjs';
import { NEW_TITLE } from './idiomatic-equivalents-retitle.mjs';
import { loadTriage, DEPENDENT_ROWS, PARTIALLY_HELD, TRIAGE_SHA } from './triage-accepted-answers.mjs';
import { loadCandidates, REGISTER_RULING, REGISTER_REMOVALS, REGISTER_KEPT, FR_C0024, CANDIDATES_SHA, RULED_ON } from './product-rulings.mjs';
import { loadAlternativesEvidence, SCRIPT_ACCEPT, SCRIPT_REFUSE, HELD_TYPO_BALL, EVIDENCE_SHA } from './restored-withdrawals.mjs';
import { LEVELLED } from './same-gloss-levelling.mjs';
import { AXIS_REMAINDER, AXIS_REFUSED, AXIS_HELD } from './alternatives-axis-remainder.mjs';

const draft = JSON.parse(await readFile('docs/audits/question-verification/round2/draft-patches.json', 'utf8'));
const { patches } = draft;
const raw = await readFile(SNAPSHOT_FILE);
assert.equal(createHash('sha256').update(raw).digest('hex'), SNAPSHOT_SHA, 'the round-2 snapshot must be the pinned one');
assert.equal(draft.snapshot_sha256, SNAPSHOT_SHA, 'the draft must be built against the pinned snapshot');
const snapshot = JSON.parse(raw);
const triage = await loadTriage();
const candidates = (await loadCandidates()).filter(entry => entry.verdict === 'needs_human');
const withdrawals = await loadAlternativesEvidence();
const jaRef = lessonRefs(snapshot, 'ja');
const withdrawalIds = new Set([...withdrawals.script, ...withdrawals.ball].map(e => jaRef(Number(e.ref.slice(4))).exercise.id));
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
  const [{ productiveParadigmFixes }, { filmTheaterFixes }, { idiomaticEquivalentsRetitle },
    { triageAcceptedAnswers }, { productRulings, frenchCheckpointParaphrase, registerRemovals },
    { createAcceptedAnswerLedger }, { restoredWithdrawals }, { sameGlossLevelling }, { alternativesAxisRemainder }] = await Promise.all([
    import('./productive-paradigm-fixes.mjs'), import('./film-theater-fixes.mjs'),
    import('./idiomatic-equivalents-retitle.mjs'), import('./triage-accepted-answers.mjs'),
    import('./product-rulings.mjs'), import('./accepted-answer-ledger.mjs'), import('./restored-withdrawals.mjs'),
    import('./same-gloss-levelling.mjs'), import('./alternatives-axis-remainder.mjs'),
  ]);
  const rebuild = async () => {
    const set = await createRound2PatchSet();
    const ledger = createAcceptedAnswerLedger();
    filmTheaterFixes(set); idiomaticEquivalentsRetitle(set); productiveParadigmFixes(set);
    await triageAcceptedAnswers(set, ledger);
    await productRulings(set, ledger);
    await restoredWithdrawals(set, ledger);
    sameGlossLevelling(set, ledger);
    alternativesAxisRemainder(set, ledger);
    frenchCheckpointParaphrase(set);
    registerRemovals(set);
    ledger.write(set);
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
  assert.deepEqual([...new Set(patches.map(p => p.table))].sort(), ['checkpoint_items', 'exercises', 'lessons']);
  const checkpointFields = new Set(patches.filter(p => p.table === 'checkpoint_items').flatMap(p => Object.keys(p.after)));
  assert.deepEqual([...checkpointFields], ['accepted_answers']);
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
  let shared = 0;
  for (const patch of patches) {
    if (!Object.hasOwn(patch.after, 'target_grammar')) continue;
    // Seven rows are in both blocks: a Japanese or Korean tense row that the
    // triage also gives an overt-subject alternative. Both edits belong on one
    // patch, and the order is safe — an exact accepted answer is matched before
    // the strict return, so strictness never rejects it.
    assert.deepEqual(Object.keys(patch.after).sort().filter(f => f !== 'accepted_answers'),
      ['target_grammar'], `${patch.id}: a paradigm row changed something else`);
    if (Object.hasOwn(patch.after, 'accepted_answers')) shared++;
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
  assert.equal(shared, 8, 'the ja/ko tense rows an accepted-answer block also touches');
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
  const ledgerIds = new Set([...triage.map(entry => entry.exercise_id), ...candidates.map(entry => entry.exercise_id),
    ...REGISTER_REMOVALS.map(entry => entry.id), ...withdrawalIds, ...LEVELLED.map(([id]) => id), ...AXIS_REMAINDER.map(([id]) => id)]);
  const touched = patches.filter(p => p.table === 'exercises'
    && !Object.hasOwn(p.after, 'target_grammar') && !ledgerIds.has(p.id));
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

test('the triage block writes exactly the confirmed rows, and only accepted_answers', async () => {
  const byRef = new Map(triage.map(entry => [entry.exercise_id, entry]));
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  let rows = 0;
  let additions = 0;
  for (const patch of patches) {
    if (!Object.hasOwn(patch.after, 'accepted_answers')) continue;
    const entry = byRef.get(patch.id);
    if (!entry) continue;                       // a Film & Theater row, checked elsewhere
    rows++;
    additions += entry.additions.length;
    // The field was empty, so the patch writes only authored strings. Nine rows
    // are also reached by a product ruling, so the stored value is the union and
    // the triage additions come first, in their own order.
    assert.deepEqual(byId.get(patch.id).accepted_answers, []);
    assert.deepEqual(patch.before.accepted_answers, []);
    assert.deepEqual(patch.after.accepted_answers.slice(0, entry.additions.length), entry.additions);
    const ruled = new Set([...candidates.filter(c => c.exercise_id === patch.id).map(c => c.candidate),
      ...[...withdrawals.script, ...withdrawals.ball].filter(w => jaRef(Number(w.ref.slice(4))).exercise.id === patch.id).map(w => w.candidate),
      ...LEVELLED.filter(([id]) => id === patch.id).map(([, , , , missing]) => missing),
      ...AXIS_REMAINDER.filter(([id]) => id === patch.id).map(entry => entry[5])]);
    for (const value of patch.after.accepted_answers.slice(entry.additions.length)) {
      assert(ruled.has(value), `${entry.ref}: ${value} comes from no recorded block`);
    }
    assert(['ja', 'ko'].includes(entry.language));
    // Every reason names its row and carries the triage's own words.
    assert(patch.reasons.some(reason => reason.startsWith(`${entry.ref} (`)), entry.ref);
  }
  assert.equal(rows, 298);
  assert.equal(additions, 313);
  passedChecks++;
});

test('the four dependency-bearing rows say so in the patch itself', () => {
  const byRef = new Map(triage.map(entry => [entry.ref, entry]));
  const flagged = [];
  for (const ref of Object.keys(DEPENDENT_ROWS)) {
    const entry = byRef.get(ref);
    assert(entry, ref);
    assert.equal(entry.blocking, true);
    const patch = patches.find(p => p.id === entry.exercise_id);
    assert(patch, ref);
    const reason = patch.reasons.join(' ');
    assert(reason.includes('DEPENDENCY'), `${ref}: the dependency is not written into the patch reason`);
    assert(reason.includes('edit-distance gate'), `${ref}: the reason does not name the gate that actually holds the row apart`);
    assert(!reason.includes('lib/confusable-pairs.ts: until'), `${ref}: the reason still points at the withdrawn pair list as the remedy`);
    for (const collateral of DEPENDENT_ROWS[ref]) assert(reason.includes(collateral), `${ref}: ${collateral} is not named`);
    flagged.push(ref);
  }
  assert.deepEqual(flagged.sort(), ['ja-E0361', 'ja-E0373', 'ja-E0569', 'ja-E0581']);
  // And no other row claims a dependency it does not have.
  const claiming = patches.filter(p => p.reasons.some(r => r.includes('DEPENDENCY')));
  assert.equal(claiming.length, 4);
  passedChecks++;
});

test('the triage block never took a candidate that needed a ruling, and every ruled row is now decided', () => {
  // The triage's two decisions covered 71 distinct rows. Four also carried a
  // confirmed defect, so the triage block took the confirmed half and left the
  // open half; the rulings of 2026-09-15 then decided all 71.
  const decisionRows = new Set([
    'ja-E0090', 'ja-E0112', 'ja-E0126', 'ja-E0134', 'ja-E0142', 'ja-E0154', 'ja-E0158', 'ja-E0170',
    'ja-E0180', 'ja-E0182', 'ja-E0196', 'ja-E0202', 'ja-E0206', 'ja-E0208', 'ja-E0228', 'ja-E0250',
    'ja-E0264', 'ja-E0272', 'ja-E0300', 'ja-E0322', 'ja-E0334', 'ja-E0344', 'ja-E0392', 'ja-E0438',
    'ja-E0460', 'ja-E0462', 'ja-E0482', 'ja-E0492', 'ja-E0504', 'ja-E0522', 'ja-E0544', 'ja-E0546',
    'ja-E0558', 'ja-E0564', 'ja-E0565', 'ja-E0576', 'ja-E0586', 'ja-E0598', 'ja-E0712', 'ja-E0850',
    'ja-E0889', 'ja-E0892', 'ja-E0916', 'ja-E0922', 'ja-E0952', 'ja-E0970', 'ja-E0985', 'ja-E0988',
    'ja-E1155', 'ja-E1169', 'ja-E1183', 'ja-E1194', 'ja-E1208', 'ja-E1463', 'ja-E1673', 'ja-E1726',
    'ja-E1816', 'ja-E1838', 'ja-E1880', 'ja-E1886', 'ja-E2034',
    'ja-E0014', 'ja-E0038', 'ja-E1642', 'ko-E0066', 'ko-E0856', 'ko-E0862', 'ko-E0889', 'ko-E0901',
    'ko-E1670', 'ko-E1684',
  ]);
  assert.equal(decisionRows.size, 71);
  const patched = new Set(triage.map(entry => entry.ref));
  const both = [...decisionRows].filter(ref => patched.has(ref)).sort();
  assert.deepEqual(both, [...PARTIALLY_HELD].sort(), 'only the four dual rows may appear in both');
  // Nothing is left in limbo: every one of the 71 rows is now either compiled by
  // a ruling or carries an explicitly refused candidate.
  const ruledRows = new Set(candidates.map(entry => entry.ref));
  assert.deepEqual([...decisionRows].filter(ref => !ruledRows.has(ref)), [], 'a decision row no ruling reaches');
  passedChecks++;
});

test('the two register removals withdraw exactly what was argued, and the keeps stay', () => {
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  assert.equal(REGISTER_REMOVALS.length, 2);
  for (const entry of REGISTER_REMOVALS) {
    const original = byId.get(entry.id);
    assert.deepEqual(original.accepted_answers, entry.before);
    const patch = patches.find(p => p.id === entry.id);
    assert(patch, entry.ref);
    assert.deepEqual(Object.keys(patch.after), ['accepted_answers']);
    assert.deepEqual(patch.after.accepted_answers, entry.after);
    assert(!patch.after.accepted_answers.includes(entry.remove));
    // The key never moves on a removal, and nothing is added in the same breath.
    assert.equal(patch.before.correct_answer, undefined, `${entry.ref}: a removal must not touch the key`);
    for (const value of patch.after.accepted_answers) assert(entry.before.includes(value), `${entry.ref}: ${value} was added, not kept`);
    assert(patch.reasons.some(r => r.includes('REMOVAL:')), entry.ref);
    assert(patch.reasons.some(r => r.includes(entry.why_downward.slice(0, 40))), `${entry.ref}: the argument is not in the patch`);
  }
  // Everything adjudicated and kept is still on its row after the patch.
  for (const entry of REGISTER_KEPT) {
    const patch = patches.find(p => p.id === entry.id);
    const after = patch ? patch.after.accepted_answers ?? byId.get(entry.id).accepted_answers : byId.get(entry.id).accepted_answers;
    assert(after.includes(entry.kept), `${entry.ref}: ${entry.kept} was removed after all`);
  }
  // Only these two rows lose an accepted answer while keeping their key. The
  // three Film & Theater "Sculpture -> Stage" rows also drop alternatives, but
  // they rewrite the key in the same patch, so keeping "Skulptur" on a row that
  // now asks for "Bühne" would be the defect.
  const losing = patches.filter(p => Array.isArray(p.after.accepted_answers)
    && !Object.hasOwn(p.after, 'correct_answer')
    && (p.before.accepted_answers ?? []).some(v => !p.after.accepted_answers.includes(v)));
  assert.deepEqual(losing.map(p => p.id).sort(), REGISTER_REMOVALS.map(e => e.id).sort(),
    'some other patch silently drops an accepted answer without replacing the key');
  passedChecks++;
});

test('ruling 1 adds every Japanese script candidate and invents none', () => {
  const script = candidates.filter(e => e.group === 'ja_script_policy' || (e.group === 'individual' && e.candidate === 'イス'));
  assert.equal(script.length, 66);
  assert.equal(new Set(script.map(e => e.exercise_id)).size, 61);
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  for (const entry of script) {
    const patch = patches.find(p => p.id === entry.exercise_id);
    assert(patch, entry.ref);
    assert.equal(byId.get(entry.exercise_id).language ?? null, null);   // exercises carry no language column
    assert.deepEqual(patch.before.accepted_answers, []);
    assert(patch.after.accepted_answers.includes(entry.candidate), `${entry.ref}: ${entry.candidate} missing`);
    assert(patch.reasons.some(r => r.includes(`RULING ${RULED_ON} — Japanese script`)), entry.ref);
    assert.equal(entry.type === 'translate_to_target' || entry.type === 'cloze_deletion', true);
  }
  passedChecks++;
});

test('ruling 2 accepts every upward form, refuses every downward one, and rules on all 19', () => {
  const register = candidates.filter(e => !(e.group === 'ja_script_policy' || (e.group === 'individual' && e.candidate === 'イス')));
  assert.equal(register.length, 19);
  assert.equal(Object.keys(REGISTER_RULING).length, 19);
  let accepted = 0;
  let refused = 0;
  for (const entry of register) {
    const decision = REGISTER_RULING[`${entry.ref}|${entry.candidate}`];
    assert(decision, `${entry.ref}|${entry.candidate}`);
    const [accept] = decision;
    const patch = patches.find(p => p.id === entry.exercise_id);
    if (accept) {
      accepted++;
      assert(patch, entry.ref);
      assert(patch.after.accepted_answers.includes(entry.candidate), `${entry.ref}: ${entry.candidate} missing`);
      assert(patch.reasons.some(r => r.includes(`RULING ${RULED_ON} — register`)), entry.ref);
    } else {
      refused++;
      // A refused candidate must appear nowhere: not on its own row, not anywhere.
      for (const other of patches) {
        if (!Array.isArray(other.after.accepted_answers)) continue;
        assert(!other.after.accepted_answers.includes(entry.candidate),
          `${entry.ref}: the refused "${entry.candidate}" was written to ${other.id}`);
      }
    }
  }
  assert.equal(accepted, 12);
  assert.equal(refused, 7);
  // The two corrected on 2026-09-15: the REFUSE list they arrived in was relayed
  // prose that had mis-filed a plain-form key, and the ruling's principle accepts
  // a step up from 한다체 to 해요체. If this ever flips back, the corpus did not
  // drift — someone reinstated the wrong list.
  assert.equal(REGISTER_RULING['ko-E1670|해야 해요'][0], true);
  assert.equal(REGISTER_RULING['ko-E1684|바라요'][0], true);
  // The three strings the reversal was about are in no row, before or after.
  for (const string of ['ごめん', 'うん', 'ううん']) {
    for (const row of snapshot.exercises) assert(!(row.accepted_answers ?? []).includes(string), `${string} is live on ${row.id}`);
    for (const patch of patches) assert(!(patch.after.accepted_answers ?? []).includes(string));
  }
  passedChecks++;
});

test('ruling 3 adds the one held French paraphrase to fr-C0024', () => {
  const patch = patches.find(p => p.table === 'checkpoint_items');
  assert(patch);
  assert.equal(patch.id, FR_C0024.id);
  assert.deepEqual(patch.before.accepted_answers, FR_C0024.before);
  assert.deepEqual(patch.after.accepted_answers, [...FR_C0024.before, FR_C0024.addition]);
  assert.equal(patch.before.strand, 'reading');
  assert(patch.reasons[0].includes(`RULING ${RULED_ON}`));
  passedChecks++;
});

test('the restored withdrawals recover both lists exactly, and adjudicate every candidate', () => {
  assert.equal(withdrawals.script.length, 102, 'the recovered count must be the real one, not the prose\'s');
  assert.equal(withdrawals.ball.length, 42);
  assert(withdrawals.script.every(e => e.ground === 'script_variant'));
  // Disjoint from everything already in round two, at candidate AND row level.
  const triageIds = new Set(triage.map(e => e.exercise_id));
  const rulingIds = new Set(candidates.map(e => e.exercise_id));
  for (const entry of [...withdrawals.script, ...withdrawals.ball]) {
    const id = jaRef(Number(entry.ref.slice(4))).exercise.id;
    assert(!triageIds.has(id), `${entry.ref} overlaps the triage block`);
    assert(!rulingIds.has(id), `${entry.ref} overlaps the Ruling-1 script set`);
  }
  // Every script candidate is adjudicated one way or the other — no silent drop.
  for (const entry of withdrawals.script) {
    const pair = `${entry.key}|${entry.candidate}`;
    const decided = Object.hasOwn(SCRIPT_ACCEPT, pair) || Object.hasOwn(SCRIPT_REFUSE, pair) || entry.type === 'fill_blank';
    assert(decided, `${entry.ref}: ${pair} is adjudicated nowhere`);
  }
  // Nothing appears in both tables.
  for (const pair of Object.keys(SCRIPT_ACCEPT)) assert(!Object.hasOwn(SCRIPT_REFUSE, pair), pair);
  // Every restored string reaches its row; every refused one reaches none.
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  let restored = 0;
  for (const entry of [...withdrawals.script, ...withdrawals.ball]) {
    const id = jaRef(Number(entry.ref.slice(4))).exercise.id;
    assert.equal(byId.get(id).correct_answer, entry.key, `${entry.ref}: key moved`);
    const patch = patches.find(p => p.id === id);
    const after = patch?.after.accepted_answers ?? byId.get(id).accepted_answers ?? [];
    const pair = `${entry.key}|${entry.candidate}`;
    const held = HELD_TYPO_BALL.some(h => h.ref === entry.ref && h.candidate === entry.candidate);
    const refusedByGround = Object.hasOwn(SCRIPT_REFUSE, pair) || entry.type === 'fill_blank';
    if (held || refusedByGround) assert(!after.includes(entry.candidate), `${entry.ref}: ${entry.candidate} was restored despite being refused or held`);
    else if (after.includes(entry.candidate)) restored++;
  }
  assert.equal(restored, 95, '56 script + 39 typo-ball');
  assert.equal(HELD_TYPO_BALL.length, 3);
  passedChecks++;
});

test('the alternatives-axis remainder adds only what was adjudicated, and refuses the source-language leaks', () => {
  assert.equal(AXIS_REMAINDER.length, 18);
  assert.equal(AXIS_REFUSED.length, 7);
  assert.equal(AXIS_HELD.length, 1);
  const byId = new Map(snapshot.exercises.map(e => [e.id, e]));
  const axisIdByRef = new Map();
  for (const language of Object.keys({ es: 0, fr: 0, de: 0, it: 0, pt: 0, ru: 0, ja: 0, ko: 0, zh: 0 })) {
    const get = lessonRefs(snapshot, language);
    for (let n = 1; n <= 2312; n++) axisIdByRef.set(`${language}-E${String(n).padStart(4, '0')}`, get(n).exercise.id);
  }
  const refusedStrings = new Set(AXIS_REFUSED.map(e => `${e.ref}|${e.string}`));
  for (const [id, ref, , type, key, string] of AXIS_REMAINDER) {
    const frozen = byId.get(id);
    assert.equal(frozen.correct_answer, key, `${ref}: key moved`);
    assert.equal(frozen.type, type, `${ref}: type moved`);
    assert(!refusedStrings.has(`${ref}|${string}`), `${ref}: ${string} is both added and refused`);
    const patch = patches.find(p => p.id === id);
    assert(patch, ref);
    assert(patch.after.accepted_answers.includes(string), `${ref}: ${string} missing`);
    // Never a translate_to_native row: those four are the source-language leak.
    assert.notEqual(type, 'translate_to_native', `${ref}: a translate_to_native row was levelled`);
  }
  // A refused or held string must not be written to THE ROW IT WAS REFUSED ON.
  // Its twin may legitimately carry it — that is why the axis paired them — so
  // this is scoped to the row, not to every row sharing the key.
  const refByRef = new Map(AXIS_REMAINDER.map(([id, ref]) => [ref, id]));
  const axisRows = new Map(JSON.parse(JSON.stringify([...refByRef])));
  for (const entry of [...AXIS_REFUSED, ...AXIS_HELD]) {
    assert.ok(entry.why.trim().length > 40, `${entry.ref}: no reason recorded`);
    assert(!axisRows.has(entry.ref), `${entry.ref}: refused and added in the same block`);
    const id = axisIdByRef.get(entry.ref);
    assert(id, `${entry.ref}: cannot resolve the row it was refused on`);
    const patch = patches.find(p => p.id === id);
    const after = patch?.after.accepted_answers ?? byId.get(id).accepted_answers ?? [];
    assert(!after.includes(entry.string), `${entry.ref}: the refused "${entry.string}" reached its own row`);
  }
  passedChecks++;
});

test('write a truthful local verification record after the assertions', async () => {
  assert.equal(passedChecks, 25, 'never write a successful verification record when an earlier check failed');
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
      'Film & Theater keys no longer visual-art labels', 'triage block writes exactly the 298 confirmed rows and 313 additions',
      'the four dependency-bearing rows carry the dependency in their own reason', 'no row awaiting a product decision is patched',
      'ruling 1 adds every Japanese script candidate and invents none', 'ruling 2 accepts upward, refuses downward, and rules on all 19',
      'ruling 3 adds the one held French paraphrase',
      'the two register removals withdraw exactly what was argued and nothing else loses an accepted answer',
      'both withdrawal lists recovered exactly, disjoint from round two, every candidate adjudicated',
      'the alternatives-axis remainder adds only what was adjudicated and refuses the source-language leaks'],
    production_writes: 0,
    limitations: ['Minimal typed content schema, not full Supabase auth/RLS/triggers or historical migrations',
      'Does not establish linguistic correctness or independent round-2 approval',
      'Does not test the shipped grader; see runtime-round2.mjs for that, including the whole-language widening check'],
    triage_source_sha256: TRIAGE_SHA,
    triage_candidates_sha256: CANDIDATES_SHA,
    alternatives_evidence_sha256: EVIDENCE_SHA,
  }, null, 2) + '\n');
});
