import {lessonRefs} from './lesson-refs.mjs';

// Closed, individually authored topic repairs only. Root owns integration and
// explicit supersession of previous word-only answers on these exact rows.
export function applyTopicRepairs(set, proposals, expected) {
  const lookup = Object.fromEntries(['es','ja','ko'].map(language => [language, lessonRefs(set.snapshot, language)]));
  const types = ['multiple_choice','translate_to_target','translate_to_native','fill_blank'];
  const seen = new Set();
  for (const proposal of proposals) {
    const {language, n, oldKey, fields, rationale} = proposal;
    const {exercise, lesson, course, ref} = lookup[language](n);
    if (seen.has(ref)) throw Error(`${ref}: duplicate topic replacement`);
    seen.add(ref);
    if (course.cefr_level !== expected.level || lesson.title !== expected.lesson ||
        exercise.type !== types[n - expected.first] || exercise.correct_answer !== oldKey ||
        exercise.prompt_audio_url !== null || exercise.card_id !== null ||
        Object.keys(exercise.metadata).length !== 0) throw Error(`${ref}: frozen topic target changed`);
    if (!Array.isArray(fields.accepted_answers) || fields.skill_type !== 'grammar' || !fields.target_grammar) throw Error(`${ref}: missing strict grammar contract`);
    if (exercise.type === 'fill_blank' && (fields.prompt.match(/___/g) ?? []).length !== 1) throw Error(`${ref}: the visible renderer requires exactly one blank`);
    set.update('exercises', exercise.id, fields, `${ref}: ${rationale}`);
  }
  if (seen.size !== 12) throw Error(`Expected exactly twelve ${expected.lesson} replacements`);
}

export function topicFields(prompt, key, alternatives, grammar, explanation, options = null) {
  return {
    prompt, correct_answer: key, accepted_answers: alternatives, options,
    explanation, skill_type: 'grammar', target_grammar: grammar,
    target_word: null, hint_text: null, distractors: [],
  };
}
