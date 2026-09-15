/** Compact read-only packets. Blind mode omits the stored key and explanation. */
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

const [snapshotPath, language, level, unitNumber, mode = 'blind'] = process.argv.slice(2);
if (!snapshotPath || !language) throw new Error('Usage: packet.mjs SNAPSHOT LANGUAGE [LEVEL UNIT_NUMBER blind|key|full]');
const snapshotText = await readFile(snapshotPath, 'utf8');
if (createHash('sha256').update(snapshotText).digest('hex') !== SNAPSHOT_SHA) throw new Error('Packet references are positional and are only stable against the frozen snapshot');
const snapshot = JSON.parse(snapshotText);
const courses = new Map(snapshot.courses.map(row => [row.id, row]));
const units = new Map(snapshot.units.map(row => [row.id, row]));
const lessons = new Map(snapshot.lessons.map(row => [row.id, row]));
const bands = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const entries = snapshot.exercises.filter(e => e.type !== 'speaking' && e.response_mode !== 'speak')
  .map(e => { const lesson = lessons.get(e.lesson_id); const unit = units.get(lesson.unit_id);
    return { exercise: e, lesson, unit, course: courses.get(unit.course_id) }; })
  .filter(e => e.course.target_language === language)
  .sort((a, b) => bands.indexOf(a.course.cefr_level) - bands.indexOf(b.course.cefr_level)
    || a.unit.order_index - b.unit.order_index || a.lesson.order_index - b.lesson.order_index
    || a.exercise.order_index - b.exercise.order_index || a.exercise.id.localeCompare(b.exercise.id))
  .map((e, i) => ({ ...e, ref: `${language}-E${String(i + 1).padStart(4, '0')}` }));

if (!level) {
  for (const band of bands) for (const unit of snapshot.units.filter(u => {
    const course = courses.get(u.course_id);
    return course.target_language === language && course.cefr_level === band;
  }).sort((a, b) => a.order_index - b.order_index)) {
    const group = entries.filter(e => e.unit.id === unit.id);
    console.log(JSON.stringify({ level: band, unit: unit.order_index + 1, title: unit.title,
      count: group.length, first: group[0]?.ref, last: group.at(-1)?.ref }));
  }
} else {
  const group = entries.filter(e => e.course.cefr_level === level && e.unit.order_index + 1 === Number(unitNumber));
  if (!group.length) throw new Error('No questions matched');
  console.log(JSON.stringify({ language, level, unit: group[0].unit,
    count: group.length, packet_sha256: createHash('sha256').update(JSON.stringify(group)).digest('hex'),
    note: 'For listening, prompt is the supplied TTS transcript. Actual generated audio is not verified by this text packet.' }));
  let lastLesson;
  for (const entry of group) {
    const { exercise: e, lesson, ref } = entry;
    if (lastLesson !== lesson.id) { console.log(JSON.stringify({ lesson: lesson.title, description: lesson.description, order: lesson.order_index + 1 })); lastLesson = lesson.id; }
    const key = { answer: e.correct_answer, accepted: e.accepted_answers, explanation: e.explanation };
    const visible = { ref, type: e.type, prompt: e.prompt,
      ...(e.options?.length ? { options: e.options } : {}),
      ...(e.hint_text ? { hint: e.hint_text } : {}),
      ...(Object.keys(e.metadata ?? {}).length ? { metadata: e.metadata } : {}),
      ...(e.target_grammar ? { grammar: e.target_grammar } : {}),
      ...(e.skill_type !== 'vocabulary' ? { skill: e.skill_type } : {}) };
    if (e.type === 'sentence_construction' && !e.metadata?.tiles) {
      // The client constructs its tile bank from this answer. Show only the
      // unordered tokens, matching what a learner has available to solve it.
      visible.tiles = [...e.correct_answer.split(/\s+/).filter(Boolean), ...(e.distractors ?? [])].sort();
    }
    console.log(JSON.stringify(mode === 'key' ? { ref, id: e.id, ...key } : mode === 'full' ? { id: e.id, ...visible, ...key } : visible));
  }
}
