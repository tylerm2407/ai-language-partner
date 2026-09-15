/**
 * ko-E0002 is claimed by two producers. One field needs one writer.
 *
 * `korean-goodbye-fixes.mjs` authors 안녕히 계세요 on the Core Vocabulary
 * "Translate to Korean: Goodbye" row, which is the precondition for the
 * 가세요/계세요 confusable pairs: without it the pair turns a correct
 * translation into a rejection. `korean-accepted-alternatives.mjs` separately
 * authors 잘 가요 and 잘 있어요 on the same row and the same field.
 *
 * Both producers throw rather than skip on a contested row, by design, so the
 * build fails in either wiring order until the merge is made deliberately. The
 * merged value an independent reviewer verified is all three:
 *
 *   ["안녕히 계세요", "잘 가요", "잘 있어요"]
 *
 * and it is only safe with the 잘 가요/잘 자요 pair present, because 잘 자요
 * ("Sleep well") otherwise sits inside 잘 가요's typo neighbourhood and would
 * grade as a translation of "Goodbye". That pair is in `lib/confusable-pairs.ts`.
 *
 * This wrapper suppresses the goodbye producer's write and widens the
 * alternatives producer's to the union, asserting BOTH original payloads first
 * so that a revision to either producer stops the build instead of silently
 * changing what ships. Apply the goodbye producer through `beforeGoodbye` and
 * the alternatives producer through `beforeAlternatives`, in that order.
 */
import { lessonRefs } from './lesson-refs.mjs';
import { isDeepStrictEqual as eq } from 'node:util';

const GOODBYE = ['안녕히 계세요'];
const ALTERNATIVES = ['잘 가요', '잘 있어요'];
const MERGED = [...GOODBYE, ...ALTERNATIVES];

function targetRow(set) {
  const context = lessonRefs(set.snapshot, 'ko')(2);
  const exercise = context.exercise;
  if (exercise.correct_answer !== '안녕히 가세요' || exercise.type !== 'translate_to_target') {
    throw new Error('Changed ko-E0002 goodbye dependency');
  }
  if (!eq(exercise.accepted_answers, [])) throw new Error('ko-E0002 no longer starts from an empty list');
  return exercise;
}

/**
 * Sources carried by the suppressed goodbye write, captured so the merged patch
 * keeps them. That row is the only one in either Korean batch with a dictionary
 * citation, and it is the evidence the goodbye approval rests on — dropping it
 * would ship an authored, dictionary-backed value with no source, which is
 * exactly what the ledger exists to prevent.
 */
let suppressedGoodbyeSources = null;

/** Suppresses the goodbye producer's ko-E0002 write, asserting its exact value. */
export function beforeGoodbye(set) {
  const id = targetRow(set).id;
  return {
    ...set,
    update(table, rowId, after, reason, sources) {
      if (table === 'exercises' && rowId === id) {
        if (!eq(after, { accepted_answers: GOODBYE })) throw new Error('Changed ko-E0002 goodbye payload');
        suppressedGoodbyeSources = sources ?? [];
        return;
      }
      return set.update(table, rowId, after, reason, sources);
    },
  };
}

/** Widens the alternatives producer's ko-E0002 write to the reviewed union. */
export function beforeAlternatives(set) {
  const id = targetRow(set).id;
  return {
    ...set,
    update(table, rowId, after, reason, sources) {
      if (table === 'exercises' && rowId === id) {
        if (!eq(after, { accepted_answers: ALTERNATIVES })) throw new Error('Changed ko-E0002 alternatives payload');
        if (suppressedGoodbyeSources === null) {
          throw new Error('Apply beforeGoodbye first: the merged ko-E0002 patch must carry the goodbye producer\'s sources');
        }
        return set.update(table, rowId, { accepted_answers: MERGED },
          `${reason} Merged with korean-goodbye-fixes.mjs, which authors 안녕히 계세요 on this row as the precondition for the 가세요/계세요 confusable pairs. One field, one writer; both original payloads are asserted by korean-goodbye-composition.mjs. The merged list is only safe with the 잘 가요/잘 자요 pair present, since 잘 자요 otherwise grades as a translation of "Goodbye".`,
          [...(sources ?? []), ...suppressedGoodbyeSources]);
      }
      return set.update(table, rowId, after, reason, sources);
    },
  };
}
