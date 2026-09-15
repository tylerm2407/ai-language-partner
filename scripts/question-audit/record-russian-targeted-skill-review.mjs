// Independent exact-field review of the seven-row Russian targeted-skill batch.
// Applies the batch exactly as the build would: after both wrapped historical
// Russian producers and the A1 controlled-topic producer, on the original set.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { russianLessonFixes } from './russian-lesson-fixes.mjs';
import { russianWordOrderFixes } from './russian-word-order-fixes.mjs';
import { russianControlledTopicFixes } from './russian-controlled-topic-fixes.mjs';
import { selectRussianBeforeControlledTopicsExact } from './russian-controlled-topic-composition.mjs';
import { russianTargetedSkills, russianTargetedSkillFixes } from './russian-targeted-skill-fixes.mjs';
const base = 'docs/audits/question-verification/remediation/ru-targeted-root-review';
const source = 'scripts/question-audit/russian-targeted-skill-fixes.mjs';
const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== '6fcc5c702108f6f5edea050a88b379f875241d5c835b488c0adf60f8ffc10449') throw Error('Unreviewed source');
const reviewer = 'independent reviewer (Claude Fable 5.1, session 2026-09-14), independent of author';
const reviewedOn = '2026-09-14';

const set = await createPatchSet(), wrapped = selectRussianBeforeControlledTopicsExact(set);
russianLessonFixes(wrapped);
russianWordOrderFixes(wrapped);
russianControlledTopicFixes(set);
const earlier = structuredClone(set.patches());
russianTargetedSkillFixes(set);
const get = lessonRefs(set.snapshot, 'ru');
const patches = new Map(set.patches().map(p => [`${p.table}/${p.id}`, p]));
const earlierById = new Map(earlier.map(p => [`${p.table}/${p.id}`, p]));

const notes = new Map([
  [13, 'Меня зовут Анна. is the ordinary Russian self-introduction; the unit description promises introductions and no other non-speaking row in the unit (70 checked) or in the frozen Russian rows contains зовут. Distractors are correct phrases with other functions (residence, thanks, farewell). Original До свидания translation stays covered by E21/E22.'],
  [1515, 'Я ввёл правильный пароль, но не могу войти в свою учётную запись. Остальные страницы открываются нормально: natural B1 Russian (ввёл, учётная запись, войти в). Key restates the login failure; forgotten password, keyboard and all-pages-down are each contradicted by the text. Original Пароль translation stated no problem, and пароль stays taught in E1525/E1526.'],
  [1585, 'Imperfective готовил / читала give two ongoing background actions at a stated past time; perfective зазвонил marks the interrupting onset, the Russian equivalent of the lesson objective without inventing a continuous tense. Preparing dinner and reading is unique; distractors substitute completed or absent actions. Original Вдруг translation practised no ongoing past, and Вдруг stays in E1595/E1596.'],
  [2103, 'В финале оркестр играет всё тише, а основная мелодия повторяется: всё тише means progressively softer, so gradually more softly is the only correct volume reading; same volume, louder and sudden stop are wrong. Melody repetition does not alter volume. Original Скульптура was unrelated to the music lesson.'],
  [2112, 'Оркестр постепенно ускоряет темп: темп is musical tempo and ускорять means speed up, so the music gets faster is unique; slower, quieter and restarting are wrong. Original Роман was unrelated to the music lesson.'],
  [2113, 'Музыка звучит всё быстрее. is ordinary Russian for the music gets faster and faster; transcript = key and the prompt is the spoken text in the app; hint matches the E2114 key. Stale Скульптура card detached; the card remains for its excluded speaking row.'],
  [2114, 'Heard Музыка звучит всё быстрее. means The music gets faster. uniquely among parallel tempo/volume sentences. Stale Скульптура card detached.'],
]);

const fields = [], rows = [];
const lessonIds = new Set();
for (const [n, oldKey, level, lesson, proposed] of russianTargetedSkills) {
  const full = get(n), e = full.exercise, note = notes.get(n);
  if (!note) throw Error(`Missing individual review ${full.ref}`);
  if (e.correct_answer !== oldKey || full.course.cefr_level !== level || full.lesson.title !== lesson) throw Error(`Frozen dependency changed ${full.ref}`);
  if (earlierById.has(`exercises/${e.id}`)) throw Error(`Unexpected earlier patch on ${full.ref}`);
  const p = patches.get(`exercises/${e.id}`);
  if (!p) throw Error(`No composed patch ${full.ref}`);
  const expected = Object.fromEntries(Object.entries(proposed).filter(([f, v]) => !isDeepStrictEqual(e[f], v)));
  if (!isDeepStrictEqual(p.after, expected)) throw Error(`Composed patch differs from proposal ${full.ref}`);
  lessonIds.add(e.lesson_id);
  rows.push({ ...full, patch: p, review_note: note });
  for (const [field, after] of Object.entries(p.after)) {
    fields.push({ reviewer, reviewed_on: reviewedOn, ref: full.ref, table: 'exercises', id: e.id, field, before: e[field], after, decision: 'approve_as_correction', rationale: note, source_sha256: sourceSha });
  }
}
for (const p of earlier) if (!isDeepStrictEqual(patches.get(`${p.table}/${p.id}`), p)) throw Error(`Earlier patch changed: ${p.table}/${p.id}`);
if (rows.length !== 7 || fields.length !== 29) throw Error(`Unexpected counts ${rows.length}/${fields.length}`);
if (earlier.length !== 549 || set.patches().length !== 556) throw Error(`Unexpected composed totals ${earlier.length} -> ${set.patches().length}`);

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({ source_sha256: sourceSha, reviewer, reviewed_on: reviewedOn, rows, original_lesson_rows: set.snapshot.exercises.filter(e => lessonIds.has(e.lesson_id) && e.type !== 'speaking') }, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
await writeFile(`${base}/field-decisions.jsonl`, fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, fields: fields.length, composed_rows: set.patches().length, decisions: fields.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {}) }));
