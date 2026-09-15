import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

/**
 * The `-R####` / item references these packets emit are POSITIONAL: the nth row
 * of that language, ordered by id. That numbering is only stable while the input
 * is the frozen snapshot. The audit now authors INSERTS as well as updates, so a
 * materialised post-draft corpus would renumber every reference after the first
 * inserted row — measured at 54 references corpus-wide for the five reading
 * questions inserted on 2026-09-14. Refuse anything but the frozen snapshot
 * rather than emit references that look stable and are not.
 */
const SNAPSHOT_SHA = '8c7f381c78d87e57593febe851526355d300c7a704e5a57dd49a614edabd7c0f';

const [path, kind, language, mode = 'blind', start = '1', size = '1000'] = process.argv.slice(2);
const snapshotText = await readFile(path, 'utf8');
if (createHash('sha256').update(snapshotText).digest('hex') !== SNAPSHOT_SHA) throw new Error('Packet references are positional and are only stable against the frozen snapshot');
const snapshot = JSON.parse(snapshotText);
const courses = new Map(snapshot.courses.map(x => [x.id, x]));
const units = new Map(snapshot.units.map(x => [x.id, x]));
const passages = new Map(snapshot.reading_passages.map(x => [x.id, x]));
const source = { writing: 'writing_prompts', reading: 'reading_questions', checkpoint: 'checkpoint_items', cards: 'cards' }[kind];
if (!source) throw new Error('Expected writing, reading, checkpoint or cards');
const entries = snapshot[source].filter(x => {
  const course = courses.get(x.course_id ?? passages.get(x.passage_id)?.course_id);
  return (course?.target_language ?? x.language) === language && x.strand !== 'speaking';
}).sort((a, b) => a.id.localeCompare(b.id)).map((row, i) => ({
  ref: `${language}-${{ writing: 'W', reading: 'R', checkpoint: 'C', cards: 'V' }[kind]}${String(i + 1).padStart(4, '0')}`,
  row,
}));
const selected = entries.slice(Number(start) - 1, Number(start) - 1 + Number(size));
console.log(JSON.stringify({ kind, language, total: entries.length, selected: selected.length,
  packet_sha256: createHash('sha256').update(JSON.stringify(selected)).digest('hex') }));
const shownPassages = new Set();
for (const { ref, row } of selected) {
  const passage = passages.get(row.passage_id);
  const course = courses.get(row.course_id ?? passage?.course_id);
  const unit = units.get(row.unit_id ?? passage?.unit_id);
  const context = { course_level: course?.cefr_level, level: row.cefr_level ?? row.band ?? passage?.cefr_level,
    unit: unit?.title ?? null };
  if (kind === 'reading' && mode !== 'key' && !shownPassages.has(passage.id)) {
    console.log(JSON.stringify({ passage_id: passage.id, title: passage.title, content: passage.content }));
    shownPassages.add(passage.id);
  }
  const visible = kind === 'writing' ? {
    ...context, prompt: row.prompt_text, type: row.prompt_type,
    scaffold: row.scaffold_type, data: row.scaffold_data, min: row.min_words, max: row.max_words,
    vocabulary: row.target_vocabulary, grammar: row.target_grammar, rubric: row.rubric_criteria,
  } : kind === 'cards' ? { ...context, native: row.native_text } : {
    ...context, prompt: row.question_text ?? row.prompt, type: row.question_type ?? row.strand,
    options: row.options, audio_text: row.audio_text,
  };
  const key = kind === 'writing' ? { example: row.example_response }
    : kind === 'cards' ? { target: row.target_text, example: row.example_sentence, translation: row.example_sentence_translation }
      : { answer: row.correct_answer, accepted: row.accepted_answers };
  console.log(JSON.stringify({ ref, id: row.id, passage_id: row.passage_id, ...(mode !== 'key' ? visible : {}), ...(mode !== 'blind' ? key : {}) }));
}
