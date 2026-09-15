/**
 * The precondition for the Korean 가세요/계세요 confusable pairs.
 *
 * 안녕히 가세요 ("go in peace") is said to the person LEAVING; 안녕히 계세요
 * ("stay in peace") is said to the person STAYING. They are not
 * interchangeable, and typo tolerance currently accepts either for the other:
 * one jamo apart, against a budget of two.
 *
 * Three A1 rows are involved, and they do NOT all want the same treatment:
 *
 *   ko-E0021  listening_type       audio says 안녕히 가세요, key 안녕히 가세요
 *   ko-E0002  translate_to_target  prompt "Translate to Korean: Goodbye",
 *                                  key 안녕히 가세요, accepted_answers []
 *   ko-E0068  fill_blank           prompt "안녕히_____ (Goodbye)", key 가세요
 *
 * On ko-E0021 the audio fixes which phrase is right and the learner is asked
 * to transcribe it, so accepting the other phrase is simply wrong. On ko-E0002
 * the prompt is the bare gloss "Goodbye", which selects neither, so
 * 안녕히 계세요 is a CORRECT translation and rejecting it would be wrong. Same
 * on ko-E0068, whose visible 안녕히 stem admits either verb.
 *
 * A global pair list cannot tell those apart, and does not have to: an
 * authored `accepted_answers` entry hits the exact-match return at the top of
 * `gradeAnswer` long before the pair list is consulted, so a pair and an
 * authored alternative cannot conflict. The row that legitimately takes both
 * authors the alternative; the row that does not falls through to the pair and
 * rejects.
 *
 * ko-E0068 already gains 계세요 from an earlier approved batch in this same
 * draft (`korean-lesson-fixes`, which also restores the space in the prompt).
 * ko-E0002 does not, and it is the only remaining hole. This module closes it.
 *
 * ORDERING IS LOAD-BEARING. Adding the pairs in `lib/confusable-pairs.ts`
 * without this patch turns a correct translation of "Goodbye" into a
 * rejection. Ship them together.
 *
 * Only `accepted_answers` is touched, and only by appending. The row's key,
 * type, lesson and exact current accepted list are all guarded, so a
 * concurrent edit to any of them fails the build instead of being overwritten.
 * The row carries no `options`, so no distractor can be turned correct here.
 *
 * Authored, not reviewed. No independent reviewer has approved this value.
 */
import { lessonRefs } from './lesson-refs.mjs';

/** [ref number, exact frozen key, type, exact lesson title, exact current accepted_answers, additions] */
export const koreanGoodbyeRows = [
  [2, '안녕히 가세요', 'translate_to_target', 'Core Vocabulary', [], ['안녕히 계세요']],
];

export function koreanGoodbyeFixes(set) {
  const get = lessonRefs(set.snapshot, 'ko');
  const alreadyPatched = new Set();
  for (const patch of set.patches()) {
    if (patch.table === 'exercises' && Object.hasOwn(patch.after, 'accepted_answers')) alreadyPatched.add(patch.id);
  }
  const skipped = [];
  for (const [number, key, type, lessonTitle, current, additions] of koreanGoodbyeRows) {
    const { ref, exercise, lesson } = get(number);
    if (exercise.correct_answer !== key || exercise.type !== type || lesson.title !== lessonTitle) {
      throw new Error(`Unexpected frozen context: ${ref}`);
    }
    const frozen = exercise.accepted_answers ?? [];
    if (frozen.length !== current.length || frozen.some((value, index) => value !== current[index])) {
      throw new Error(`Frozen accepted_answers changed since review: ${ref}`);
    }
    for (const addition of additions) {
      if (addition === key || frozen.includes(addition)) throw new Error(`Addition already accepted: ${ref}: ${addition}`);
      if (additions.indexOf(addition) !== additions.lastIndexOf(addition)) throw new Error(`Duplicate addition: ${ref}: ${addition}`);
      if ((exercise.options ?? []).includes(addition)) throw new Error(`Addition is an authored option: ${ref}: ${addition}`);
      if (addition !== addition.normalize('NFC')) throw new Error(`Addition is not NFC: ${ref}: ${addition}`);
    }
    // Another producer owning this field is a reconciliation question for the
    // integration owner, not something to overwrite or quietly drop.
    if (alreadyPatched.has(exercise.id)) { skipped.push(ref); continue; }
    set.update(
      'exercises',
      exercise.id,
      { accepted_answers: [...frozen, ...additions] },
      `${ref}: The prompt is the bare gloss "Goodbye", which does not say whether the speaker is the one leaving or the one staying, so both 안녕히 가세요 (to the one leaving) and 안녕히 계세요 (to the one staying) are correct translations of it. The stored key is kept unchanged and 안녕히 계세요 is added as an alternative. This is also the precondition for the 가세요/계세요 entries in lib/confusable-pairs.ts: with the alternative authored, this row exact-matches and returns "Correct!", while the listening row ko-E0021 — whose audio fixes the phrase — falls through to the pair and rejects. Adding the pair without this addition would reject a correct translation.`,
      ['국립국어원 표준국어대사전 (National Institute of Korean Language, Standard Korean Dictionary): 안녕히 가세요 / 안녕히 계세요'],
    );
  }
  if (skipped.length) throw new Error(`accepted_answers already patched by another producer; reconcile before building: ${skipped.join(', ')}`);
}
