// Fail-closed composition proposal for the frozen 24-row French A1 source.
// Use this INSTEAD OF its initial permissive selection helper. No content changes.
import { isDeepStrictEqual } from 'node:util';
import { lessonRefs } from './lesson-refs.mjs';
import { frenchControlledTopics } from './french-controlled-topic-fixes.mjs';

// Exact current overlapping producer payloads: frenchLessonFixes only.
// Neither the approved FR10 topic source nor the FR92 banks overlaps these rows.
const reviewedSupersessions = [
  [286, { accepted_answers: ['Foot'] }],
  [287, { accepted_answers: ['Warm'] }],
  [288, { accepted_answers: ['oide'] }],
];

export function selectFrenchBeforeControlledTopicsExact(set) {
  const get = lessonRefs(set.snapshot, 'fr');
  const selected = new Map(frenchControlledTopics.map(([n, , , after]) => [get(n).exercise.id, new Set(Object.keys(after))]));
  const reviewed = new Map(reviewedSupersessions.map(([n, after]) => [get(n).exercise.id, after]));
  const wrapped = {
    ...set,
    update(table, id, after, reason, sources) {
      const fields = table === 'exercises' && selected.get(id);
      if (!fields) return set.update(table, id, after, reason, sources);
      const overlap = Object.fromEntries(Object.entries(after).filter(([field]) => fields.has(field)));
      if (!Object.keys(overlap).length) return set.update(table, id, after, reason, sources);
      // Compare before forwarding anything: a new/changed overlapping field must
      // fail even if its proposed value happens to match the new topic wording.
      if (!reviewed.has(id) || !isDeepStrictEqual(overlap, reviewed.get(id))) throw new Error(`Unreviewed French controlled-topic supersession: ${table}/${id}`);
      const retained = Object.fromEntries(Object.entries(after).filter(([field]) => !fields.has(field)));
      if (Object.keys(retained).length) return set.update(table, id, retained, reason, sources);
    },
    replaceText(table, id, field, edits, reason, sources) {
      // createPatchSet.replaceText closes over the ORIGINAL update function.
      // Delegating to it would bypass this adapter. Reproduce its exact-match
      // checks here and route the final value through the guarded update above.
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
