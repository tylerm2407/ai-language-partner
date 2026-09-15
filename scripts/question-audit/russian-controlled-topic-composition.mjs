// Exact historical supersessions for Russian A1; no content authored here.
import { isDeepStrictEqual } from 'node:util';
import { lessonRefs } from './lesson-refs.mjs';
import { russianControlledTopics } from './russian-controlled-topic-fixes.mjs';
const reviewedSupersessions = [
  [318, { accepted_answers: ['Приготовить'] }],
  [319, { accepted_answers: ['Football'] }],
  [446, { accepted_answers: ['Ванная комната', 'Туалет'] }],
];

// Both earlier Russian producers receive this wrapper; the new one does not.
export function selectRussianBeforeControlledTopicsExact(set) {
  const get = lessonRefs(set.snapshot, 'ru');
  const selected = new Map(russianControlledTopics.map(([n, , , after]) => [get(n).exercise.id, new Set(Object.keys(after))]));
  const reviewed = new Map(reviewedSupersessions.map(([n, after]) => [get(n).exercise.id, after]));
  const wrapped = {
    ...set,
    update(table, id, after, reason, sources) {
      const fields = table === 'exercises' && selected.get(id);
      if (!fields) return set.update(table, id, after, reason, sources);
      const overlap = Object.fromEntries(Object.entries(after).filter(([field]) => fields.has(field)));
      if (!Object.keys(overlap).length) return set.update(table, id, after, reason, sources);
      if (!reviewed.has(id) || !isDeepStrictEqual(overlap, reviewed.get(id))) throw new Error(`Unreviewed Russian controlled-topic supersession: ${table}/${id}`);
      const retained = Object.fromEntries(Object.entries(after).filter(([field]) => !fields.has(field)));
      if (Object.keys(retained).length) return set.update(table, id, retained, reason, sources);
    },
    replaceText(table, id, field, edits, reason, sources) {
      // Original replaceText closes over original update; route through the guard.
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
