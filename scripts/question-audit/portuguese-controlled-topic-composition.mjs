// Exact supersessions for the Portuguese A1 draft; no content is changed here.
import { isDeepStrictEqual } from 'node:util';
import { lessonRefs } from './lesson-refs.mjs';
import { portugueseControlledTopics } from './portuguese-controlled-topic-fixes.mjs';
const reviewedSupersessions = [
  [49, { options: ['Thank you', 'Goodbye', 'Good night', 'Hello'] }],
  [241, { accepted_answers: ['Hour'] }],
  [288, { accepted_answers: ['ia'] }],
  [319, { accepted_answers: ['Football'] }],
  [324, { accepted_answers: ['iga'] }],
  [446, { accepted_answers: ['Casa de banho', 'Quarto de banho'] }],
  [447, { accepted_answers: ['Room'] }],
];

// Both earlier Portuguese producers receive this wrapper. The new controlled
// producer receives the original set. Changed/new overlaps fail before writes.
export function selectPortugueseBeforeControlledTopicsExact(set) {
  const get = lessonRefs(set.snapshot, 'pt');
  const selected = new Map(portugueseControlledTopics.map(([n, , , after]) => [get(n).exercise.id, new Set(Object.keys(after))]));
  const reviewed = new Map(reviewedSupersessions.map(([n, after]) => [get(n).exercise.id, after]));
  const wrapped = {
    ...set,
    update(table, id, after, reason, sources) {
      const fields = table === 'exercises' && selected.get(id);
      if (!fields) return set.update(table, id, after, reason, sources);
      const overlap = Object.fromEntries(Object.entries(after).filter(([field]) => fields.has(field)));
      if (!Object.keys(overlap).length) return set.update(table, id, after, reason, sources);
      if (!reviewed.has(id) || !isDeepStrictEqual(overlap, reviewed.get(id))) throw new Error(`Unreviewed Portuguese controlled-topic supersession: ${table}/${id}`);
      const retained = Object.fromEntries(Object.entries(after).filter(([field]) => !fields.has(field)));
      if (Object.keys(retained).length) return set.update(table, id, retained, reason, sources);
    },
    replaceText(table, id, field, edits, reason, sources) {
      // The original helper closes over the original update; do not bypass the guard.
      let value = set.row(table, id)[field];
      if (typeof value !== 'string') throw new Error(`Not a text field: ${table}/${id}/${field}`);
      for (const [before, after] of edits) {
        if (value.split(before).length !== 2) throw new Error(`Replacement must match exactly once: ${id}: ${before}`);
        value = value.replace(before, () => after);
      }
      return wrapped.update(table, id, { [field]: value }, reason, sources);
    },
  };
  return wrapped;
}
