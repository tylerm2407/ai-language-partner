/**
 * The 88 typed-cue rows from the grader's alternatives-axis measurement, minus
 * what round two already covers.
 *
 * PROVENANCE. `scripts/grading/alternatives-axis.json` on `audit/grader-behaviour`,
 * committed with both definitions in its header. Its counts reproduce exactly
 * here: 249 rows with `breaks: true`, of which 141 `listening_type` and 20
 * `dictation` are audio-stimulus rows and 88 have a typed cue — 65
 * `translate_to_target`, 18 `free_production`, 4 `translate_to_native`, 1
 * `fill_blank`.
 *
 * WHY THE TWO POPULATIONS DIFFER, now that both are on the table. The axis
 * measures TOLERANCE BREAKAGE: a row that currently accepts, through the typo
 * budget, a string the language teaches as something else on the same key.
 * The same-gloss sweep measures EXPLICIT DIVERGENCE: two rows asking the same
 * question with different accepted lists, whether or not any collision exists.
 * Two consequences visible in the intersection below:
 *
 *  - The axis is keyed on the KEY, not on the gloss. fr-E0994 keys "Plus petit"
 *    under the gloss "Smaller" while fr-E1000 keys it under "Shorter"; the axis
 *    pairs them, the same-gloss sweep deliberately does not.
 *  - The axis reaches prompt shapes the sweep does not classify at all —
 *    `free_production` ("Write a sentence using the word: …") and `fill_blank`
 *    ("stem_____ (gloss)") are not bare-gloss frames.
 *
 * THE INTERSECTION, of the 88 against the 129 the same-gloss sweep derived:
 *
 *    56  already levelled here
 *     6  already held here, because levelling would admit a wrong answer
 *    26  genuinely new  ->  18 added, 1 held, 7 refused
 *
 * So 62 of 88 were already covered, and the remainder is 26 rows, not 88.
 *
 * ── THE SEVEN REFUSED, and four of them are a finding in the other direction ──
 *
 * On four `translate_to_native` rows the string the axis would refuse is the
 * SOURCE-LANGUAGE word, on a row whose answer is English. "Translate to English:
 * Protagonist" currently accepts the German `Protagonistin`; the two `Imagine`
 * rows accept the French `Imaginez` and the Portuguese `Imagina`; and
 * "Translate to English: Conservation" accepts the French `Préservation` beside
 * the English `Preservation` it already lists. Those are not omissions to level.
 * They are rows accepting the prompt's own language as the answer, and the
 * alternatives axis would have been RIGHT to refuse them. Recorded as defects
 * rather than fixed here: closing them means removing tolerance, not adding an
 * alternative, and this patch removes an accepted answer only where the removal
 * is argued row by row.
 *
 * The other three: `fr-E1460` would add the unaccented English spelling
 * "Preservation" to a translate-TO-French row, which is the same leak mirrored;
 * `zh-E0336` would add the traditional 師 for the simplified 师, which is the
 * open traditional-script product decision the register already tracks and not
 * this patch's to settle; and `de-E1719` would add `wuerde`, an ASCII
 * transliteration, on a row keyed `Würde` (dignity) whose twin is keyed `würde`
 * lowercase — the subjunctive of `werden`, a different word. That row's own
 * gloss "(Would)" against a capitalised `Würde` looks wrong independently, and
 * is flagged rather than patched around.
 *
 * ── THE ONE HELD ──
 *
 * `es-E1229` "Gerente" (Manager) would take the feminine `Gerenta`, and the
 * measurement says that admits `Renta` (rent) — a different word, one edit away.
 * Held with the rest; a pair keyed on `Gerenta` is the remedy.
 */

/** [exercise id, ref, language, type, key, the string the twin already accepts] */
export const AXIS_REMAINDER = [
  ["aabbccdd-3333-3002-0001-e00000000009","de-E1229","de","free_production","Manager","Managerin"],
  ["aabbccdd-3333-4004-0002-e00000000007","de-E2081","de","free_production","Protagonist","Protagonistin"],
  ["aabbccdd-1111-3008-0001-e00000000009","es-E1733","es","free_production","No te preocupes","No se preocupe"],
  ["aabbccdd-1111-3008-0001-e00000000009","es-E1733","es","free_production","No te preocupes","No se preocupen"],
  ["aabbccdd-1111-4003-0003-e00000000007","es-E2011","es","free_production","Acta","Actas"],
  ["aabbccdd-1111-4005-0005-e00000000007","es-E2207","es","free_production","La pelota está en tu tejado","La pelota está en su tejado"],
  ["aabbccdd-2222-2007-0001-e00000000002","fr-E0994","fr","translate_to_target","Plus petit","Plus petite"],
  ["aabbccdd-2222-2007-0006-e00000000008","fr-E1060","fr","translate_to_target","Plus grand","Plus grande"],
  ["aabbccdd-2222-3008-0001-e00000000009","fr-E1733","fr","free_production","Pas de souci","Pas de soucis"],
  ["aabbccdd-4444-4001-0002-e00000000007","it-E1829","it","free_production","Uguaglianza","Eguaglianza"],
  ["aabbccdd-4444-4003-0003-e00000000007","it-E2011","it","free_production","Verbale","Verbali"],
  ["aabbccdd-7777-3001-0001-e00000000009","ko-E1145","ko","free_production","논쟁하다","언쟁하다"],
  ["aabbccdd-7777-3007-0001-e00000000009","ko-E1649","ko","free_production","대신에","대신"],
  ["aabbccdd-7777-4002-0002-e00000000007","ko-E1913","ko","free_production","반박하다","논박하다"],
  ["aabbccdd-5555-3008-0001-e00000000009","pt-E1733","pt","free_production","Sem problemas","Sem problema"],
  ["aabbccdd-9999-3003-0001-e00000000009","ru-E1313","ru","free_production","Отменить","Отменять"],
  ["aabbccdd-9999-3008-0001-e00000000009","ru-E1733","ru","free_production","Не переживай","Не переживайте"],
  ["aabbccdd-9999-4002-0002-e00000000007","ru-E1913","ru","free_production","Опровергать","Опровергнуть"],];

/** Refused on content grounds, with the reason. Four are defects pointing the
 * other way: a row accepting the prompt's own language as the answer. */
export const AXIS_REFUSED = [
  { ref: 'de-E2133', lang: 'de', type: 'translate_to_native', key: 'Protagonist', string: 'Protagonistin',
    why: 'The row asks for English and Protagonistin is German. Accepting it is a defect in the opposite direction: the alternatives axis would have been right to refuse it.' },
  { ref: 'fr-E1699', lang: 'fr', type: 'translate_to_native', key: 'Imagine', string: 'Imaginez',
    why: 'The row asks for English and Imaginez is French. Same leak.' },
  { ref: 'pt-E1699', lang: 'pt', type: 'translate_to_native', key: 'Imagine', string: 'Imagina',
    why: 'The row asks for English and Imagina is Portuguese. Same leak.' },
  { ref: 'fr-E1447', lang: 'fr', type: 'translate_to_native', key: 'Conservation', string: 'Préservation',
    why: 'The row asks for English and already accepts the English "Preservation"; Préservation is the French form. Same leak.' },
  { ref: 'fr-E1460', lang: 'fr', type: 'translate_to_target', key: 'Conservation', string: 'Preservation',
    why: 'The mirror of the same leak: the unaccented English spelling on a translate-to-French row. Accent tolerance forgives it today, which is a grader question, not a reason to author it as a French answer.' },
  { ref: 'zh-E0336', lang: 'zh', type: 'fill_blank', key: '师', string: '師',
    why: 'Traditional for simplified. Traditional-script input is an open product decision the register already tracks — there is no policy today — and it is not this patch\'s to settle one row at a time.' },
  { ref: 'de-E1719', lang: 'de', type: 'free_production', key: 'Würde', string: 'wuerde',
    why: 'An ASCII transliteration, and of a different word: the twin that accepts it is keyed `würde` lowercase, the subjunctive of werden, while this row is keyed `Würde` (dignity). The row\'s own gloss "(Would)" against a capitalised Würde looks wrong independently and is flagged rather than patched around.' },
];

/** Held because levelling would admit a wrong answer. */
export const AXIS_HELD = [
  { ref: 'es-E1229', lang: 'es', type: 'free_production', key: 'Gerente', string: 'Gerenta', admits: ['Renta'],
    why: 'The feminine of the profession is correct, but it brings Renta (rent) inside the budget — a different word one edit away. A pair keyed on Gerenta is the remedy.' },
];

const REASON = (ref, lang, type, key, string) =>
  `${ref} (${lang}, ${type}): alternatives-axis remainder. A row sharing the stored key "${key}" already accepts "${string}" for the same gloss, and this row accepts it today only through the typo budget — so a learner who typed it was told "Correct! (Minor typo)" on one row and would be marked wrong the moment tolerance tightened. Authored explicitly. Measured against every taught ${lang} string: it admits nothing else.`;

export function alternativesAxisRemainder(set, ledger) {
  const { row } = set;
  const byRow = new Map();
  for (const [id, ref, lang, type, key, string] of AXIS_REMAINDER) {
    const original = row('exercises', id);
    if (original.correct_answer !== key) throw new Error(`${ref}: the stored key moved`);
    if (original.type !== type) throw new Error(`${ref}: the exercise type moved`);
    if (string === key) throw new Error(`${ref}: the addition repeats the key`);
    const entry = byRow.get(id) ?? { ref, lang, type, key, additions: [] };
    if (entry.additions.includes(string)) throw new Error(`${ref}: duplicate addition ${string}`);
    entry.additions.push(string);
    byRow.set(id, entry);
  }
  for (const [id, entry] of byRow) {
    ledger.contribute(id, {
      block: 'alternatives-axis-remainder',
      additions: entry.additions,
      reason: REASON(entry.ref, entry.lang, entry.type, entry.key, entry.additions.join('", "')),
      sources: ['audit/grader-behaviour scripts/grading/alternatives-axis.json'],
    });
  }
  return { added: AXIS_REMAINDER.length, rows: byRow.size, refused: AXIS_REFUSED.length, held: AXIS_HELD.length };
}
