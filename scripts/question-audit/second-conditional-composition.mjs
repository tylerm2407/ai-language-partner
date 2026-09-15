import { isDeepStrictEqual } from 'node:util';
import { lessonRefs } from './lesson-refs.mjs';

// Held for independent review: the new hypothetical scene replaces IT1655's
// isolated farebbe meaning choice, not any other occurrence of that vocabulary.
export function selectItalianNarrowBeforeHypotheticalCondition(set) {
  const id = lessonRefs(set.snapshot, 'it')(1655).exercise.id;
  const superseded = {
    correct_answer: 'Would do / would make',
    options: ['Could', 'Instead', 'I wish', 'Would do / would make'],
  };
  return {
    ...set,
    update(table, rowId, after, reason, sources) {
      if (table === 'exercises' && rowId === id) {
        if (!isDeepStrictEqual(after, superseded)) throw new Error('Changed Italian second-conditional dependency');
        return;
      }
      return set.update(table, rowId, after, reason, sources);
    },
    replaceText(table, rowId, field, edits, reason, sources) {
      if (table === 'exercises' && rowId === id) throw new Error('Unexpected Italian second-conditional text dependency');
      return set.replaceText(table, rowId, field, edits, reason, sources);
    },
  };
}
