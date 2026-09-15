/**
 * `Würde` -> `würde`: the correction is to the KEY, not to the gloss.
 *
 * READ THIS BEFORE THE DIFF, because the diff reads the other way round. The
 * obvious reading of "a row keyed Würde and glossed Would" is that the gloss is
 * wrong, since Würde is the noun "dignity". It is not. The gloss is right and
 * the capital W is the error.
 *
 * What settles it is the neighbourhood rather than the dictionary. All five rows
 * sit in de B1 Hypothetical Situations — Second Conditional, Regrets, Review &
 * Test — and two of them are already keyed "Would": a `listening_choice` whose
 * options are Perhaps / Should / Would / Suppose, and a `multiple_choice` asking
 * what the word means. The lesson is teaching the Konjunktiv II auxiliary, and
 * that auxiliary is written `würde`, lower case. German capitalises nouns; a
 * capitalised `Würde` is a different word.
 *
 * The B2 `fill_blank` at `9987684c` already does this correctly — keyed `würde`
 * lower case, `target_grammar: konjunktiv2_irrealis`, in Complex Grammar /
 * Konjunktiv II: Unreal Conditions. It is the model this cluster should match,
 * and it is left alone.
 *
 * GRADING IMPACT: NONE, IN EITHER DIRECTION. `normalize()` lowercases before
 * comparing, so `Würde` and `würde` are one string to the grader — typing
 * `würde` on a key of `Würde` already returns Correct at accuracy 1.0, not a
 * typo pass. No grading rule could separate them without making German
 * case-sensitive, which would fail every learner who types a noun in lower case.
 * The defect is entirely in what the learner is SHOWN, which is why this is a
 * display correction and why the runtime check measures no change from it.
 *
 * THE CARD IS THE POINT, AND THE REASON THIS WAS FLAGGED BEFORE IT WAS MADE.
 * `aabbccdd-3333-3007-c002-b10000000000` is not lesson text; it is the SRS
 * payload, the thing a learner meets again every review for as long as they keep
 * the card. Three exercise rows render from it. Correcting a card changes what
 * people see outside the lesson that introduced it, so it was put to the
 * curriculum owner rather than folded into a levelling count, and is authored
 * here only on an explicit yes.
 *
 * ONE ROW IS KNOWINGLY LEFT WRONG. The `speaking` row `6589a5e4` carries the
 * same capitalised prompt and this compiler refuses speaking content by a hard
 * rule, so after this patch the cluster is right on five surfaces and wrong on
 * one. That is worse to inherit than a cluster that is uniformly wrong, because
 * the next reader will assume the odd one out is deliberate. It is not: it is
 * out of scope, it is named in findings.json, and it needs whoever owns speaking
 * content. Its `accepted_answers` carries `Würde` too.
 */

const CARD = 'aabbccdd-3333-3007-c002-b10000000000';

const WHY = 'The correction is to the KEY, not to the gloss: read the diff the other way round and it looks wrong. These rows teach the Konjunktiv II auxiliary — they sit in de B1 Hypothetical Situations beside two rows already keyed "Would" — and that auxiliary is written würde, lower case. German capitalises nouns, so a capitalised Würde is the noun "dignity", a different word. "Would" was always the right gloss. Grading is unaffected either way, because normalize() lowercases before comparing; this is a display correction.';

/** [id, field, before, after] — every edit is the same one character. */
export const WUERDE_EDITS = [
  [CARD, 'cards', 'target_text', 'Würde', 'würde'],
  ['205ec1b3-5fa8-4efd-a824-d3081c280f11', 'exercises', 'prompt', 'Würde', 'würde'],
  ['205ec1b3-5fa8-4efd-a824-d3081c280f11', 'exercises', 'correct_answer', 'Würde', 'würde'],
  ['00a15d8d-141f-426c-a19a-16b03af7b624', 'exercises', 'prompt', 'Würde', 'würde'],
  ['aabbccdd-3333-3007-0005-e00000000010', 'exercises', 'prompt', 'What does "Würde" mean in English?', 'What does "würde" mean in English?'],
  ['aabbccdd-3333-3007-0006-e00000000009', 'exercises', 'prompt', 'Write a sentence using the word: Würde (Would)', 'Write a sentence using the word: würde (Would)'],
  ['aabbccdd-3333-3007-0006-e00000000009', 'exercises', 'correct_answer', 'Würde', 'würde'],
];

/** Out of scope for this compiler and left wrong on purpose; named so it is not
 * mistaken for a deliberate exception. */
export const WUERDE_LEFT_WRONG = {
  id: '6589a5e4-d510-45e6-a1d6-56ea8de56030', type: 'speaking',
  fields: ['prompt', 'correct_answer', 'accepted_answers'],
  why: 'Speaking content is refused by the compiler by a hard rule, so this row keeps the capitalised Würde on all three fields. After this patch the cluster is right on five surfaces and wrong on one, which is worse to inherit than uniformly wrong: the next reader will assume the odd one out is deliberate. It is not. It needs whoever owns speaking content.',
};

export function wuerdeCapitalisation(set) {
  const { row, update } = set;
  const byTarget = new Map();
  for (const [id, table, field, before, after] of WUERDE_EDITS) {
    const original = row(table, id);
    if (original[field] !== before) throw new Error(`${id}.${field} is not ${JSON.stringify(before)}; re-read before correcting`);
    if (before.toLowerCase() !== after.toLowerCase()) throw new Error(`${id}.${field}: this producer changes capitalisation only`);
    const key = `${table}|${id}`;
    byTarget.set(key, { ...(byTarget.get(key) ?? {}), [field]: after });
  }
  for (const [key, after] of byTarget) {
    const [table, id] = key.split('|');
    update(table, id, after, `${table}/${id}: Würde -> würde. ${WHY}`,
      ['https://www.duden.de/rechtschreibung/wuerde_Konjunktiv_werden', 'https://www.duden.de/rechtschreibung/Wuerde']);
  }
  // The row that stays wrong must still be there, and still wrong, or this
  // producer's account of the cluster has gone stale.
  const spoken = row('exercises', WUERDE_LEFT_WRONG.id);
  if (spoken.type !== 'speaking') throw new Error('The out-of-scope Würde row is no longer a speaking row');
  if (spoken.correct_answer !== 'Würde') throw new Error('The out-of-scope Würde row has changed; re-check the cluster');
  return { rows: byTarget.size, fields: WUERDE_EDITS.length, left_wrong: 1 };
}
