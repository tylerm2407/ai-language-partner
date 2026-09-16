/**
 * Generate `script_choice` exercises: "which is the kanji for this reading?"
 *
 * WHY THIS EXISTS. The orthography ruling of 2026-09-16
 * (docs/audits/question-verification/round3/README.md) accepted the kana
 * reading on every written-production row whose cue is an English gloss,
 * because the corpus keys the same class of word in kanji, kana and mixed
 * script and a learner cannot infer a rule the course does not follow. That
 * ruling deliberately left a gap it named: nothing in the Japanese track then
 * asks the learner to know a kanji at all, so the track can be finished without
 * ever meeting one. The ruling said the fix is an item that asks out loud.
 * This is that item.
 *
 * SHAPE. Reading and gloss are given; the four options are written forms.
 *
 *   Which is the kanji for さかな (Fish)?     魚 · 牛肉 · 野菜 · 水
 *
 * THE CUE ASKS FOR THE KANJI, NOT FOR "THE CORRECT SPELLING". That wording is
 * load-bearing. さかな is perfectly correct Japanese — the ruling above says so
 * — and an item that called it wrong would contradict the ruling it exists to
 * complete. So kana is never an option and is never scored: the question is
 * which character writes this word, and a learner who does not know can be
 * wrong about that without being told their Japanese is wrong.
 *
 * DISTRACTORS ARE REAL WORDS FROM THE CORPUS, never invented compounds. In
 * preference order: a word sharing a kanji character with the answer (the
 * sharpest trap), then a word from the same unit (thematically plausible, the
 * same rule migration 055 used for listening_choice), then the same band. A
 * candidate is refused if it reads the same as the answer — two right answers —
 * or if it glosses the same, which would make the item a synonym question.
 *
 * READINGS are harvested from `accepted_answers`, where round two recorded the
 * kana for the kanji-keyed rows; 24 cards have no such row and their readings
 * are authored in `readings.json`, which says so.
 *
 * ONE ITEM PER KANJI-BEARING CARD, dealt round-robin across the card's unit's
 * lessons so no lesson takes the whole unit's load. Idempotent: the SQL skips a
 * card that already has a `script_choice`, and ids are derived from the card id,
 * so re-running writes nothing new.
 *
 *   node scripts/content/kanji/build-script-choice.mjs --snapshot <path>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, '../../..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const snapshotPath = args.get('snapshot');
if (!snapshotPath) throw new Error('--snapshot <path> is required');

const snapshot = JSON.parse(await readFile(resolve(root, snapshotPath), 'utf8'));
const authored = JSON.parse(await readFile(resolve(scriptDirectory, 'readings.json'), 'utf8'));

const HAS_KANJI = /[一-鿿]/;
const ALL_KANA = /^[぀-ゟ゠-ヿー\s]+$/;
const ALL_HIRAGANA = new RegExp('^[\\u3040-\\u309f\\u30fc\\s]+$');

/**
 * Is this kana string a READING of this word, or just a synonym that happens to
 * be written in kana?
 *
 * `accepted_answers` holds both, and a type check cannot tell them apart. The
 * first pass of this generator produced "Which is the kanji for どうぞ (Please)?
 * -> お願いします" and "Which is the kanji for チキン (Chicken)? -> 鶏肉", because
 * どうぞ and チキン sit in those rows' accepted lists as alternative answers, not
 * as pronunciations. Two rules separate them:
 *
 * 1. A reading of a kanji word is written in HIRAGANA. Katakana in an accepted
 *    list is a loanword synonym — チキン, ミルク — never the reading of 鶏肉.
 * 2. Every kana the word ITSELF contains must appear in the reading, in order.
 *    お願いします reads おねがいします, which keeps お, い, し, ま, す in sequence;
 *    どうぞ keeps none of them. That is what catches a same-script synonym.
 */
function isReadingOf(word, kana) {
  if (!ALL_HIRAGANA.test(kana)) return false;
  const kanjiCount = [...word].filter((ch) => HAS_KANJI.test(ch)).length;
  if (kana.length < kanjiCount) return false;
  let at = 0;
  for (const ch of word) {
    if (HAS_KANJI.test(ch)) continue;
    const found = kana.indexOf(ch, at);
    if (found === -1) return false;
    at = found + 1;
  }
  return true;
}

/** Readings the curriculum already contains, recorded by round two. */
const harvested = new Map();
for (const exercise of snapshot.exercises) {
  const key = exercise.correct_answer;
  if (!key || !HAS_KANJI.test(key)) continue;
  for (const accepted of exercise.accepted_answers ?? []) {
    if (ALL_KANA.test(accepted ?? '') && isReadingOf(key, accepted)) {
      if (!harvested.has(key)) harvested.set(key, new Set());
      harvested.get(key).add(accepted);
    }
  }
}
const readingFor = (word) => {
  const found = harvested.get(word);
  // Shortest harvested reading: a longer one is a politer or inflected variant
  // of the same word, and the cue wants the plain reading of the headword.
  if (found?.size) return [...found].sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  return authored[word] ?? null;
};

const cards = snapshot.cards
  .filter((c) => c.language === 'ja' && HAS_KANJI.test(c.target_text ?? ''))
  .sort((a, b) => a.id.localeCompare(b.id));
const lessonsByUnit = new Map();
for (const lesson of [...snapshot.lessons].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id.localeCompare(b.id))) {
  if (!lessonsByUnit.has(lesson.unit_id)) lessonsByUnit.set(lesson.unit_id, []);
  lessonsByUnit.get(lesson.unit_id).push(lesson);
}

/** Every kanji word the Japanese course teaches, as distractor stock. */
const stock = cards.map((c) => ({
  word: c.target_text, gloss: c.native_text, unit: c.unit_id, band: c.cefr_level,
  reading: readingFor(c.target_text),
}));

const shareCharacter = (a, b) => [...a].some((ch) => HAS_KANJI.test(ch) && b.includes(ch));

function distractorsFor(card, reading) {
  const answer = card.target_text;
  const usable = (s) =>
    s.word !== answer &&
    s.gloss !== card.native_text &&
    // Same reading would make two options correct.
    !(s.reading && reading && s.reading === reading);
  const pick = [];
  const take = (pool) => {
    for (const s of pool) {
      if (pick.length >= 3) return;
      if (!usable(s) || pick.some((p) => p.word === s.word)) continue;
      pick.push(s);
    }
  };
  take(stock.filter((s) => shareCharacter(answer, s.word)));
  take(stock.filter((s) => s.unit === card.unit_id));
  take(stock.filter((s) => s.band === card.cefr_level));
  take(stock);
  return pick.map((s) => s.word);
}

/** Stable id, so a re-run recognises the row it already wrote. */
const idFor = (cardId) => {
  const d = createHash('sha256').update(`fluenci-script-choice:v1:${cardId}`).digest('hex');
  const hex = `${d.slice(0, 12)}8${d.slice(13, 16)}${'89ab'[parseInt(d[16], 16) % 4]}${d.slice(17, 32)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const rows = [];
const skipped = [];
const cursor = new Map();
for (const card of cards) {
  const reading = readingFor(card.target_text);
  if (!reading) { skipped.push({ card: card.id, word: card.target_text, why: 'no reading' }); continue; }
  const lessons = lessonsByUnit.get(card.unit_id) ?? [];
  if (!lessons.length) { skipped.push({ card: card.id, word: card.target_text, why: 'unit has no lessons' }); continue; }
  const n = cursor.get(card.unit_id) ?? 0;
  cursor.set(card.unit_id, n + 1);
  const lesson = lessons[n % lessons.length];
  const distractors = distractorsFor(card, reading);
  if (distractors.length < 3) { skipped.push({ card: card.id, word: card.target_text, why: 'too few distractors' }); continue; }
  // Options are ordered by the derived id, not shuffled at random, so the file
  // is byte-identical on a re-run and the answer is not always first.
  const options = [card.target_text, ...distractors]
    .sort((a, b) => createHash('sha256').update(`${card.id}:${a}`).digest('hex')
      .localeCompare(createHash('sha256').update(`${card.id}:${b}`).digest('hex')));
  rows.push({
    id: idFor(card.id), card_id: card.id, lesson_id: lesson.id,
    prompt: `Which is the kanji for ${reading} (${card.native_text})?`,
    correct_answer: card.target_text, options, distractors,
    order_index: 130 + n, reading, band: card.cefr_level,
  });
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (xs) => `ARRAY[${xs.map(q).join(',')}]::text[]`;
const values = rows.map((r) => `  (${q(r.id)}::uuid, ${q(r.lesson_id)}::uuid, ${q(r.card_id)}::uuid, ${q(r.prompt)}, ${q(r.correct_answer)}, ${arr(r.options)}, ${arr(r.distractors)}, ${r.order_index}, ${q(JSON.stringify({ script: 'kanji', reading: r.reading }))}::jsonb)`).join(',\n');

const sql = `-- 138_script_choice_kanji.sql
--
-- "Which is the kanji for さかな (Fish)?" — ${rows.length} items, one per
-- kanji-bearing Japanese card, generated by
-- scripts/content/kanji/build-script-choice.mjs.
--
-- WHY. The orthography ruling of 2026-09-16 accepted the kana reading on every
-- written-production row whose cue is an English gloss, and named the gap it
-- left: nothing then asks the learner to know a kanji, so the Japanese track
-- could be finished without meeting one. This is the item that asks.
--
-- The cue asks for THE KANJI, not for "the correct spelling". さかな is correct
-- Japanese — the ruling says so — so kana is never an option and never scored.
-- The question is which character writes the word.
--
-- Distractors are real words from the Japanese course: one sharing a kanji
-- character with the answer where possible, then same unit, then same band —
-- the rule migration 055 used for listening_choice. Never an invented compound,
-- never a word that reads or glosses the same as the answer.
--
-- Idempotent: a card that already has a script_choice is skipped, and ids are
-- derived from the card id, so re-running writes nothing.

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_type_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_type_check
  CHECK (type = ANY (ARRAY['multiple_choice','listening_choice','listening_type','translate_to_target','translate_to_native','speaking','fill_blank','free_production','cloze_deletion','sentence_construction','dictation','error_correction','collocation_match','word_form','sentence_transformation','mini_dialogue','script_choice']));

INSERT INTO public.exercises
  (id, lesson_id, card_id, type, skill_type, response_mode, source_type,
   prompt, correct_answer, options, distractors, order_index, metadata)
SELECT v.id, v.lesson_id, v.card_id, 'script_choice', 'vocabulary', 'tap', 'seed',
       v.prompt, v.correct_answer, v.options, v.distractors, v.order_index, v.metadata
FROM (VALUES
${values}
) AS v(id, lesson_id, card_id, prompt, correct_answer, options, distractors, order_index, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises e
  WHERE e.card_id = v.card_id AND e.type = 'script_choice'
);
`;

const outputDirectory = resolve(root, 'docs/audits/question-verification/round3/script-choice');
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'items.json'), `${JSON.stringify(rows, null, 2)}\n`);
await writeFile(resolve(root, 'supabase/migrations/138_script_choice_kanji.sql'), sql);
console.log(JSON.stringify({
  cards_considered: cards.length,
  items: rows.length,
  skipped,
  by_band: rows.reduce((a, r) => ({ ...a, [r.band]: (a[r.band] ?? 0) + 1 }), {}),
  authored_readings_used: rows.filter((r) => authored[r.correct_answer] === r.reading).length,
}, null, 2));
