// Independent exact-field review of the frozen Russian A1 controlled-topic batch.
// Applies the batch exactly as the build would: both historical Russian producers
// run through the composition wrapper, the new producer receives the original set.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createPatchSet } from './patch-set.mjs';
import { lessonRefs } from './lesson-refs.mjs';
import { russianLessonFixes } from './russian-lesson-fixes.mjs';
import { russianWordOrderFixes } from './russian-word-order-fixes.mjs';
import { russianControlledTopics, russianControlledTopicFixes } from './russian-controlled-topic-fixes.mjs';
import { selectRussianBeforeControlledTopicsExact } from './russian-controlled-topic-composition.mjs';
const base = 'docs/audits/question-verification/remediation/ru-controlled-root-review';
const source = 'scripts/question-audit/russian-controlled-topic-fixes.mjs';
const composition = 'scripts/question-audit/russian-controlled-topic-composition.mjs';
const sha = x => createHash('sha256').update(x).digest('hex');
const sourceSha = sha(await readFile(source));
if (sourceSha !== 'fd913625219e7323507ad6267a831436c99f47fbc24b6e137b2c2d10d62bfe84') throw Error('Unreviewed source');
const compositionSha = sha(await readFile(composition));
if (compositionSha !== '9078f9bd27df3deeeaa9e40569e747212aa26c8f76e360c30640fbb01ff24758') throw Error('Unreviewed composition adapter');
const reviewer = 'independent reviewer (Claude Fable 5.1, session 2026-09-14), independent of author';
const reviewedOn = '2026-09-14';

// Build order reproduced: wrapper for both earlier Russian producers, original set for the batch.
const set = await createPatchSet(), wrapped = selectRussianBeforeControlledTopicsExact(set);
russianLessonFixes(wrapped);
russianWordOrderFixes(wrapped);
const beforeBatch = structuredClone(set.patches());
russianControlledTopicFixes(set);
const get = lessonRefs(set.snapshot, 'ru');
const patches = new Map(set.patches().map(p => [`${p.table}/${p.id}`, p]));
// Unwrapped earlier producers, to record exactly which historical payloads the wrapper drops.
const unwrapped = await createPatchSet();
russianLessonFixes(unwrapped);
russianWordOrderFixes(unwrapped);
const unwrappedById = new Map(unwrapped.patches().map(p => [`${p.table}/${p.id}`, p]));

const notes = new Map([
  [49, 'Bedtime exchange with Спокойной ночи and До завтра uniquely selects Good night; Good morning/luck/Happy birthday are wrong yet plausible wishes. Original isolated translation had no connected text in the reading lesson.'],
  [119, 'Мне, пожалуйста, рыбу, рис и воду is an ordinary elliptical Russian order with accusative objects; fish/rice/water uniquely matches, each distractor changes at least one item. Original Milk translation was no order.'],
  [141, 'Скажите, пожалуйста, где вокзал? / Идите прямо, потом поверните налево: polite question, imperatives, ordered straight-then-left. Distractors reverse or reorder. Original isolated Налево was no exchange.'],
  [177, 'Один билет до Москвы, пожалуйста uses до + genitive correctly and is the only request among the options; other sentences are grammatical statements, not purchases. Original Bus translation was no ticket request.'],
  [211, 'Каждое утро я завтракаю в восемь часов is a habitual present statement; every morning at eight unique, distractors alter time of day, time or frequency. Original Breakfast translation stated no routine.'],
  [241, 'Юбка is a basic garment (Skirt) that fits Clothes & Colors; isolated Время was unrelated. Original Tense alternative applied only to время and must be cleared. Runtime note: the grader accepts typed shirt as a minor typo of skirt; shirt is a different garment taught in this lesson (E238). That is a grader tolerance gap, not a content error.'],
  [242, 'Зелё + ный forms зелёный; the prompt explicitly selects the masculine singular dictionary form, so ная/ное are correctly rejected. ё matches Дешёвый in the same lesson. Original tomorrow completion was unrelated to clothes.'],
  [245, 'Listening prompt is the spoken text in the app; Юбка = transcript = key, hint Skirt correct. The Время card also backs an excluded speaking row, so it stays; detaching it from this transcript is required.'],
  [246, 'Heard Юбка means Skirt uniquely among Shoes/Shirt/Dress/Skirt (all clothing). Stale Время card detached; the shared card itself is unchanged.'],
  [247, 'Магазин открывается в девять утра и закрывается в шесть вечера: утра/вечера make 9 a.m. unique against the offered 9 p.m., 6 a.m. and 6 p.m. Original Red translation had no time or schedule.'],
  [286, 'Официант is the ordinary masculine restaurant waiter noun; the prompt states a man, so официантка is not the target. Original Soccer was unrelated to jobs.'],
  [287, 'Водитель means driver (person who drives a vehicle); prompt selects the occupation noun. Original Горячий was a temperature adjective, unrelated to jobs. Runtime note: typed diver is accepted as a minor typo.'],
  [288, 'Пека + рь forms пекарь with its required soft sign; singular dictionary form is explicit. Original Холодный completion was unrelated to jobs.'],
  [291, 'Водитель transcript = key, hint Driver. Stale Горячий card detached; the card remains for its excluded speaking row.'],
  [292, 'Heard Водитель means Driver uniquely among Doctor/Cook/Teacher/Driver, all occupations. Stale Горячий card detached.'],
  [293, 'Завтра я буду играть в футбол с другом: compound future буду + imperfective and с + instrumental are correct; soccer with a friend unique. Original Doctor translation stated no plan.'],
  [305, 'В свободное время Ирина любит рисовать expresses a hobby; Drawing unique, Cooking/Reading/Swimming plausible hobbies. Original Office translation named no hobby.'],
  [313, 'Я люблю рисовать. transcript = key, hint I like drawing. Stale Офис card detached; the card remains for its excluded speaking row.'],
  [314, 'Heard Я люблю рисовать. means I like drawing. uniquely among parallel hobby sentences. Stale Офис card detached.'],
  [317, 'Идёт дождь is the ordinary Russian it is raining; snowing/hot/cold are weather distractors. Original Читать was unrelated to weather.'],
  [318, 'Ветер is the unambiguous weather noun wind; the prompt asks for the noun. Historical accepted_answers Приготовить belonged to the old cooking key and is correctly suppressed by the composition wrapper. Runtime note: typed Вечер (evening) is accepted as a minor typo.'],
  [319, 'Осень means Autumn; Fall is the ordinary American equivalent and is rejected by the grader without the alternative. Historical Football alternative belonged to the old Футбол key and is correctly suppressed.'],
  [324, 'Вес + на forms весна (spring); nominative singular is explicit. Original friend completion was unrelated to seasons.'],
  [325, 'Идёт дождь. transcript = key, hint It is raining. Stale Читать card detached; card remains for its excluded speaking row. Learner input without ё is accepted by the grader accent path.'],
  [326, 'Heard Идёт дождь. means It is raining. uniquely among four weather sentences. Stale Читать card detached.'],
  [363, 'Мой отец высокий. У него каштановые волосы uses у + genitive correctly; каштановые волосы is standardly glossed brown/chestnut hair, so Brown is the intended answer. Note: каштановый can carry a reddish tint, so the Red distractor is the closest option; рыжие would be red hair. Original Father translation gave no description.'],
  [375, 'Сколько тебе лет? / Мне пятнадцать лет: correct dative age construction and лет after пятнадцать. 15 unique; 5 (пять) is the closest plausible distractor. Original Sister translation had no age.'],
  [379, 'У меня день рождения десятого мая: genitive ordinal + month is the ordinary date form. May 10 unique; distractors vary day and month. Original Grandmother translation had no date.'],
  [399, 'По воскресеньям моя семья обедает вместе: dative plural for habitual days and singular agreement with семья. Обедать is have lunch; other options are unrelated activities. Original Daughter translation had no activity.'],
  [446, 'Ложка is the basic kitchen utensil spoon in the singular dictionary form. Historical accepted_answers Ванная комната/Туалет belonged to the old bathroom key and are correctly suppressed by the wrapper. Runtime note: typed Ножка is accepted as a minor typo.'],
  [447, 'Тарелка is plate/dish; the prompt selects the tableware sense, so Dish as an alternative is justified and is rejected without it. Lowercase headword differs from the capitalised convention elsewhere but is orthographically normal. Original Bedroom translation was unrelated to the kitchen.'],
  [452, 'Ви + лка forms вилка (fork); singular dictionary form explicit. Original bed completion was unrelated to the kitchen.'],
  [469, 'Мой дом небольшой. Кухня находится рядом с гостиной: рядом с + instrumental correct; The kitchen unique. Original Bedroom translation described nothing.'],
  [539, 'Каждый день я хожу пешком. Ночью я сплю восемь часов: habitual multidirectional хожу and correct time expressions; Walking unique among activities; fictional routine, not advice. Original Sick translation had no habit.'],
]);

const fields = [], rows = [];
const lessonIds = new Set();
for (const [n, oldKey, lesson, proposed] of russianControlledTopics) {
  const full = get(n), e = full.exercise, note = notes.get(n);
  if (!note) throw Error(`Missing individual review ${full.ref}`);
  if (e.correct_answer !== oldKey || full.lesson.title !== lesson || full.course.cefr_level !== 'A1') throw Error(`Frozen dependency changed ${full.ref}`);
  const p = patches.get(`exercises/${e.id}`);
  if (!p) throw Error(`No composed patch ${full.ref}`);
  // The composed patch must contain exactly the proposal's actual changes and nothing else.
  const expected = Object.fromEntries(Object.entries(proposed).filter(([f, v]) => !isDeepStrictEqual(e[f], v)));
  if (!isDeepStrictEqual(p.after, expected)) throw Error(`Composed patch differs from proposal ${full.ref}`);
  const dropped = unwrappedById.get(`exercises/${e.id}`)?.after ?? null;
  lessonIds.add(e.lesson_id);
  rows.push({ ...full, patch: p, superseded_historical_payload: dropped, review_note: note });
  for (const [field, after] of Object.entries(p.after)) {
    fields.push({ reviewer, reviewed_on: reviewedOn, ref: full.ref, table: 'exercises', id: e.id, field, before: e[field], after, decision: 'approve_as_correction', rationale: note, source_sha256: sourceSha, composition_sha256: compositionSha });
  }
}
// Guard evidence: only the three enumerated arrays are dropped; every other earlier patch is identical.
let suppressed = 0;
for (const p of unwrapped.patches()) for (const [field, value] of Object.entries(p.after)) {
  const composed = patches.get(`${p.table}/${p.id}`);
  if (['ru-E0318', 'ru-E0319', 'ru-E0446'].some(ref => get(Number(ref.slice(4))).exercise.id === p.id) && field === 'accepted_answers') { suppressed++; continue; }
  if (!composed || !isDeepStrictEqual(composed.after[field], value)) throw Error(`Earlier field changed by composition: ${p.table}/${p.id}.${field}`);
}
if (suppressed !== 3) throw Error(`Expected three suppressed arrays, saw ${suppressed}`);
if (rows.length !== 34 || fields.length !== 120) throw Error(`Unexpected counts ${rows.length}/${fields.length}`);
// 518 unwrapped earlier rows become 515: E318/E319/E446 carried only the suppressed arrays, so the
// wrapper drops those rows entirely until the batch writes their new prompt/key fields.
if (unwrapped.patches().length !== 518 || beforeBatch.length !== 515 || set.patches().length !== 549) throw Error(`Unexpected composed totals ${unwrapped.patches().length}/${beforeBatch.length} -> ${set.patches().length}`);

await mkdir(base, { recursive: true });
const archive = `${base}/reviewed-source-${sourceSha.slice(0, 12)}.json`;
const body = JSON.stringify({ source_sha256: sourceSha, composition_sha256: compositionSha, reviewer, reviewed_on: reviewedOn, rows, original_lesson_rows: set.snapshot.exercises.filter(e => lessonIds.has(e.lesson_id) && e.type !== 'speaking') }, null, 2) + '\n';
try { await writeFile(archive, body, { flag: 'wx' }); } catch (e) { if (e.code !== 'EEXIST' || await readFile(archive, 'utf8') !== body) throw e; }
await writeFile(`${base}/field-decisions.jsonl`, fields.map(f => JSON.stringify({ ...f, evidence: archive, evidence_sha256: sha(body) })).join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, fields: fields.length, suppressed_historical_arrays: suppressed, composed_rows: set.patches().length, decisions: fields.reduce((a, f) => ({ ...a, [f.decision]: (a[f.decision] ?? 0) + 1 }), {}) }));
