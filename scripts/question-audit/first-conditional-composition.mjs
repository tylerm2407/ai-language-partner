import { isDeepStrictEqual } from 'node:util';
import { lessonRefs } from './lesson-refs.mjs';

// The full IT1642 rain/home conditional replaces its earlier isolated farebbe cue.
// Keep the immutable narrow source and fail closed on any changed dependency.
export function selectItalianNarrowBeforeRealCondition(set) {
  const id = lessonRefs(set.snapshot, 'it')(1642).exercise.id;
  const superseded = {
    prompt: 'Translate to Italian: He would do (use the conditional of fare)',
    accepted_answers: ['Lui farebbe', 'Egli farebbe'],
  };
  return {
    ...set,
    update(table, rowId, after, reason, sources) {
      if (table === 'exercises' && rowId === id) {
        if (!isDeepStrictEqual(after, superseded)) throw new Error('Changed Italian first-conditional dependency');
        return;
      }
      return set.update(table, rowId, after, reason, sources);
    },
    replaceText(table, rowId, field, edits, reason, sources) {
      // No text-replacement path belongs to the reviewed IT1642 dependency.
      // Intercept it explicitly because set.replaceText closes over its own update.
      if (table === 'exercises' && rowId === id) throw new Error('Unexpected Italian first-conditional text dependency');
      return set.replaceText(table, rowId, field, edits, reason, sources);
    },
  };
}
