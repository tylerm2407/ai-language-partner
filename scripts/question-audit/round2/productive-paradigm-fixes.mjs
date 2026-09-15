/**
 * Productive paradigms: close the holes a confusable-pair list cannot.
 *
 * `lib/grading.ts` forgives a typed answer within a proportional edit budget —
 * min(2, floor(0.3 × the shorter of the key and the matched alternative)) —
 * unless `isGrammarExercise(hints)` is true, which it is whenever the row
 * carries a `target_grammar`. Two classes of wrong answer sit inside that budget
 * and cannot be enumerated as pairs, because the wrong string is produced by the
 * LEARNER and need never appear in the curriculum at all:
 *
 *   1. Same-verb tense pairs. "Estudié" accepts "Estudiaré"; "Estudiaré"
 *      accepts "Estudié"; Korean 갔어요 accepts 가겠어요 and 먹을 거예요 accepts
 *      먹었어요. A pair list would need one entry per taught verb per tense per
 *      language, and would still miss the form the learner actually typed.
 *   2. Derivational noun/verb pairs. "Reserva" accepts "Reservar" and the
 *      reverse; Cocina/Cocinar, Cozinha/Cozinhar, Cucina/Cucinare, Fête/Fêter,
 *      Feier/Feiern all do the same, in both directions.
 *
 * The remedy the audit recommended is a content fix: set `target_grammar`, which
 * makes the whole class strict at once. This producer does that, and nothing
 * else — no key, alternative, prompt or option moves.
 *
 * `target_grammar` is not an inert grading flag. It is read by
 * `components/lesson/RuleCard.tsx` as a `grammar_rules.rule_name` lookup
 * (exact first, then a substring fallback), by `HighlightedText` as a needle to
 * highlight inside the prompt, and by `FeedbackCard` as the `shortLabel` of the
 * logged correction. Every value below was therefore checked against the
 * `grammar_rules` rows for that exact language and CEFR level: each one either
 * resolves to the RIGHT rule or resolves to nothing at all, and none resolves to
 * a wrong one. Values that are not the name of an existing rule are readable
 * labels rather than identifiers, because a learner may see them.
 *
 * WHAT IS REFUSED, and why, because the refusals matter more than the fixes:
 *
 *  - RUSSIAN, entirely. Strictness would start rejecting answers that are
 *    CORRECT and that the rows do not list: "Я училась" on the "Я учился" row,
 *    "Я играла" on "Я играл", "Я купила" on "Я купил", "Я путешествовала" on
 *    "Я путешествовал", "Я хотела бы" on "Я хотел бы" — the feminine past, which
 *    a woman learner must write — and the pronoun-dropped "Буду работать",
 *    "Буду учиться", "Буду путешествовать". Today the typo budget is quietly
 *    doing the work those missing `accepted_answers` should do. Setting
 *    `target_grammar` first would convert a grading hole into a grading
 *    injustice. Russian needs the alternatives authored FIRST; the exact list is
 *    in the round-2 report.
 *  - CHINESE, entirely. There is no verb inflection, so there is no tense pair
 *    to collide: 我吃了 and 我会吃 are nowhere near each other. What strictness
 *    WOULD reject is correct: 我将学习 / 我要学习 on 我会学习, 我去旅行了 / 我旅游了
 *    on 我旅行了. Same conclusion, same remedy, same owner.
 *  - `translate_to_native` rows, whose answer is English. Measured, not assumed:
 *    none of the 126 finite-verb-glossed rows accepts any other string in its
 *    language's corpus, and the obvious near-miss is already refused ("I study"
 *    on an "I studied" row grades Incorrect). Nothing to fix.
 *  - The B1 "Opinions & Current Events" and "Formal vs. Informal" rows ("I
 *    agree", "I disagree", "I think that", "Would you mind") and one A1 weather
 *    row ("It is windy."). Their keys are set phrases, not members of a taught
 *    paradigm; no sibling form is taught and none is accepted. Making them
 *    strict would cost typo tolerance for no measured benefit.
 *  - Every `speaking` row, refused by the compiler itself.
 *
 * Two classes are in scope, each with its own selection rule.
 */

/** Languages whose paradigm rows can be made strict without losing a correct
 * answer. Russian and Chinese are refused above; see the header. */
const TENSE_LANGUAGES = ['es', 'fr', 'de', 'it', 'pt', 'ja', 'ko'];

/** The three units that exist to contrast one lemma's forms. Past Tense Basics
 * and Future Plans teach the SAME ten verbs in two tenses, which is why the
 * cross-acceptance is measurable in both directions. */
const TENSE_UNITS = ['Past Tense Basics', 'Future Plans', 'Hypothetical Situations'];

/** An English gloss that names a finite verb form: a subject pronoun followed by
 * a verb, or a modal future. Bare infinitives ("To book") and nouns
 * ("Reservation") are not matched and are handled by the derivational class. */
const FINITE_GLOSS = /^(I|You|He|She|It|We|They)\s+\S|\b(will|would|shall)\s+\w/i;

/** Where the learner-visible English gloss lives, per prompt shape. Only the
 * shapes whose ANSWER is in the target language are listed: `translate_to_native`
 * is deliberately absent. */
const GLOSS_PATTERNS = [
  /^Translate to (?:Spanish|French|German|Italian|Portuguese|Russian|Japanese|Korean|Chinese): (.+)$/,
  /^Listen and type what you hear \(write the translation of: (.+)\)$/,
  /^Write a sentence using the word: .+ \((.+)\)$/,
  /^Fill in the missing word: _____ means (.+)$/,
  /^.*_____ \((.+)\)$/,
];

/** target_grammar per (language, unit). Verified against grammar_rules for that
 * exact language and CEFR level: EXACT names the rule the card will show, none
 * means no card is shown (and no wrong card is shown). */
const TENSE_GRAMMAR = {
  'es/Past Tense Basics': 'preterite',                      // FUZZY -> es/A2 preterite_regular
  'es/Future Plans': 'future_simple',                       // none at A2
  'es/Hypothetical Situations': 'conditional_simple',       // none at B1
  'fr/Past Tense Basics': 'passe_compose',                  // EXACT fr/A2 passe_compose
  'fr/Future Plans': 'futur_simple',                        // none at A2
  'fr/Hypothetical Situations': 'conditionnel_present',     // EXACT fr/B1 conditionnel_present
  'de/Past Tense Basics': 'perfekt',                        // FUZZY -> de/A2 perfekt_haben_sein
  'de/Future Plans': 'futur_mit_werden',                    // none at A2
  'de/Hypothetical Situations': 'konjunktiv2_irrealis',     // none at B1
  'it/Past Tense Basics': 'passato_prossimo',               // EXACT it/A2 passato_prossimo
  'it/Future Plans': 'futuro_semplice',                     // EXACT it/A2 futuro_semplice
  'it/Hypothetical Situations': 'condizionale_presente',    // EXACT it/B1 condizionale_presente
  'pt/Past Tense Basics': 'preterito_perfeito_simples',     // EXACT pt/A2 preterito_perfeito_simples
  'pt/Future Plans': 'futuro_simples',                      // none at A2
  'pt/Hypothetical Situations': 'condicional',              // EXACT pt/B1 condicional
  'ja/Past Tense Basics': 'past_polite_mashita',            // none at A2
  'ja/Future Plans': 'future_nonpast_masu',                 // none at A2
  'ja/Hypothetical Situations': 'desire_tai',               // none at B1
  'ko/Past Tense Basics': 'past_polite_eosseoyo',           // none at A2
  'ko/Future Plans': 'future_eul_geoyeyo',                  // EXACT ko/A2 future_eul_geoyeyo
  'ko/Hypothetical Situations': 'desire_barada',            // none at B1
};

/** Exactly how many rows each (language, unit) must yield. A curriculum edit
 * that changes the shape of these lessons should fail the build, not silently
 * patch a different set of rows. */
const TENSE_COUNTS = { 'Past Tense Basics': 16, 'Future Plans': 9 };
const HYPOTHETICAL_COUNTS = { es: 4, fr: 3, de: 1, it: 2, pt: 3, ja: 2, ko: 2 };

/**
 * The derivational class, enumerated rather than re-derived, because finding it
 * requires running the shipped grader over every taught string in the language.
 * Each entry is [exercise id, language, band, type, stored key, the strings the
 * grader accepts today that it must not, the authored target_grammar]. The
 * companion runtime check re-derives this list from `lib/grading.ts` and fails
 * if it is not exactly this set.
 *
 *  word_formation      the competitor is the noun/verb counterpart of the key,
 *                      or the other half of a derivational suffix contrast.
 *  comparative_form    the competitor is the positive of a comparative key
 *                      ("Cheap" accepted on a "Cheaper" row).
 *  exact_target_form   the competitor is not a form of the key at all — it is
 *                      the English gloss ("Implement" on Implementar) or a
 *                      fragment of another item ("che" on Cher). Strictness is
 *                      still the remedy; the label says what is being required.
 */
export const derivationalRows = [
  ["0535d0fc-06d6-47ac-af0e-c8b7be24fd9f", "pt", "B2", "listening_type", "Implementar",["Implement"],"exact_target_form"],
  ["1f2d4e9b-d786-4262-b133-29533823804e", "de", "A2", "listening_type", "Feiern",["Feier"],"word_formation"],
  ["1f7c81d6-a83b-4a3c-b22a-ff25b3b7377a", "pt", "A1", "listening_type", "Cozinhar",["Cozinha"],"word_formation"],
  ["31bb585b-6474-4bac-8bc4-fbe9f868bc90", "pt", "A2", "listening_type", "Cozinhar",["Cozinha"],"word_formation"],
  ["47bf0ff3-93ce-46a0-af00-6b6b4227f993", "es", "B1", "listening_type", "Reserva",["Reservar"],"word_formation"],
  ["48cd8492-6262-4ccb-9b91-da74f8115c16", "pt", "A1", "listening_type", "Cozinha",["Cozinhar"],"word_formation"],
  ["58976be0-18e5-4d4f-9f8e-148105d659d9", "pt", "B1", "listening_type", "Argumentar",["Argument"],"exact_target_form"],
  ["692e5419-b3b8-428b-ac82-eba471c5fe35", "fr", "A2", "listening_type", "Fête",["Fêter"],"word_formation"],
  ["75dada33-edd2-4525-9c05-af463f73fff0", "pt", "B1", "listening_type", "Reserva",["Reservar"],"word_formation"],
  ["778d8a27-9d21-4acd-83c5-1f2db901b67c", "it", "A1", "listening_type", "Cucinare",["Cucina"],"word_formation"],
  ["7d5ed32d-22b4-4b3b-a85e-710aab035098", "it", "A2", "listening_type", "Cucinare",["Cucina"],"word_formation"],
  ["90e5d938-a9a6-4406-abc3-e9842e81868a", "es", "A1", "listening_type", "Cocinar",["Cocina"],"word_formation"],
  ["94e94443-a26f-43ed-abba-3b11592f040c", "pt", "B1", "listening_type", "Reservar",["Reserva"],"word_formation"],
  ["97d4862b-5ece-4cfe-b22f-2899fa129c35", "fr", "A1", "listening_type", "Cher",["che"],"exact_target_form"],
  ["9a70bd89-7d67-4a29-9137-a4a1caeff6f7", "es", "B2", "listening_type", "Implementar",["Implement"],"exact_target_form"],
  ["a3c65e2f-202c-4c93-955b-a1386e45ac50", "es", "A1", "listening_type", "Cocina",["Cocinar"],"word_formation"],
  ["a439cc31-d32a-40b4-97c3-370cd570016b", "es", "B1", "listening_type", "Argumentar",["Argument"],"exact_target_form"],
  ["aabbccdd-1111-1005-0005-e00000000008", "es", "A1", "fill_blank", "esor",["eso"],"word_formation"],
  ["aabbccdd-1111-1007-0002-e00000000002", "es", "A1", "translate_to_target", "Cocina",["Cocinar"],"word_formation"],
  ["aabbccdd-1111-2003-0001-e00000000008", "es", "A2", "translate_to_target", "Cocinar",["Cocina"],"word_formation"],
  ["aabbccdd-1111-3001-0001-e00000000009", "es", "B1", "free_production", "Argumentar",["Argument"],"exact_target_form"],
  ["aabbccdd-1111-3001-0002-e00000000008", "es", "B1", "dictation", "Argumentar",["Argument"],"exact_target_form"],
  ["aabbccdd-1111-3003-0003-e00000000002", "es", "B1", "translate_to_target", "Reserva",["Reservar"],"word_formation"],
  ["aabbccdd-1111-3003-0005-e00000000009", "es", "B1", "free_production", "Reservar",["Reserva"],"word_formation"],
  ["aabbccdd-1111-3003-0006-e00000000004", "es", "B1", "fill_blank", "elar",["ela"],"word_formation"],
  ["aabbccdd-1111-3003-0006-e00000000008", "es", "B1", "dictation", "Reservar",["Reserva"],"word_formation"],
  ["aabbccdd-1111-4003-0003-e00000000002", "es", "B2", "translate_to_target", "Implementar",["Implement"],"exact_target_form"],
  ["aabbccdd-2222-1004-0001-e00000000002", "fr", "A1", "translate_to_target", "Cher",["che"],"exact_target_form"],
  ["aabbccdd-2222-2007-0002-e00000000004", "fr", "A2", "fill_blank", "cher",["che"],"exact_target_form"],
  ["aabbccdd-2222-2007-0003-e00000000003", "fr", "A2", "translate_to_native", "Cheaper",["Cheap"],"comparative_form"],
  ["aabbccdd-2222-2007-0003-e00000000004", "fr", "A2", "fill_blank", "cher",["che"],"exact_target_form"],
  ["aabbccdd-2222-2008-0006-e00000000002", "fr", "A2", "translate_to_target", "Fête",["Fêter"],"word_formation"],
  ["aabbccdd-3333-1006-0002-e00000000004", "de", "A1", "fill_blank", "hter",["htern"],"word_formation"],
  ["aabbccdd-3333-2004-0003-e00000000004", "de", "A2", "fill_blank", "htern",["hter"],"word_formation"],
  ["aabbccdd-3333-2008-0001-e00000000008", "de", "A2", "translate_to_target", "Feiern",["Feier"],"word_formation"],
  ["aabbccdd-3333-3002-0005-e00000000004", "de", "B1", "fill_blank", "lege",["legen"],"word_formation"],
  ["aabbccdd-3333-4002-0005-e00000000004", "de", "B2", "fill_blank", "legen",["lege"],"word_formation"],
  ["aabbccdd-3333-4003-0001-e00000000004", "de", "B2", "fill_blank", "tzen",["tze"],"word_formation"],
  ["aabbccdd-4444-1005-0004-e00000000002", "it", "A1", "translate_to_target", "Cucinare",["Cucina"],"word_formation"],
  ["aabbccdd-4444-2003-0001-e00000000008", "it", "A2", "translate_to_target", "Cucinare",["Cucina"],"word_formation"],
  ["aabbccdd-5555-1005-0002-e00000000004", "pt", "A1", "fill_blank", "nhar",["nha"],"word_formation"],
  ["aabbccdd-5555-1007-0002-e00000000002", "pt", "A1", "translate_to_target", "Cozinha",["Cozinhar"],"word_formation"],
  ["aabbccdd-5555-2003-0001-e00000000008", "pt", "A2", "translate_to_target", "Cozinhar",["Cozinha"],"word_formation"],
  ["aabbccdd-5555-2003-0005-e00000000004", "pt", "A2", "fill_blank", "nhar",["nha"],"word_formation"],
  ["aabbccdd-5555-2007-0003-e00000000003", "pt", "A2", "translate_to_native", "Cheaper",["Cheap"],"comparative_form"],
  ["aabbccdd-5555-3001-0001-e00000000009", "pt", "B1", "free_production", "Argumentar",["Argument"],"exact_target_form"],
  ["aabbccdd-5555-3001-0002-e00000000008", "pt", "B1", "dictation", "Argumentar",["Argument"],"exact_target_form"],
  ["aabbccdd-5555-3003-0003-e00000000002", "pt", "B1", "translate_to_target", "Reserva",["Reservar"],"word_formation"],
  ["aabbccdd-5555-3003-0005-e00000000009", "pt", "B1", "free_production", "Reservar",["Reserva"],"word_formation"],
  ["aabbccdd-5555-3003-0006-e00000000004", "pt", "B1", "fill_blank", "elar",["ela"],"word_formation"],
  ["aabbccdd-5555-3003-0006-e00000000008", "pt", "B1", "dictation", "Reservar",["Reserva"],"word_formation"],
  ["aabbccdd-5555-3005-0003-e00000000004", "pt", "B1", "fill_blank", "egar",["ega"],"word_formation"],
  ["aabbccdd-5555-4002-0005-e00000000004", "pt", "B2", "fill_blank", "utar",["uta"],"word_formation"],
  ["aabbccdd-5555-4003-0003-e00000000002", "pt", "B2", "translate_to_target", "Implementar",["Implement"],"exact_target_form"],
  ["ccabc831-2eff-4112-9cb9-3d113c343cb9", "es", "B1", "listening_type", "Reservar",["Reserva"],"word_formation"],
  ["ccfbb2e9-ec8b-4dde-9860-0830b178e691", "it", "B1", "listening_type", "Immagina",["Immaginare"],"word_formation"],
  ["fbbb94fd-5618-4a89-bae5-7f7c12e9bd7c", "es", "A2", "listening_type", "Cocinar",["Cocina"],"word_formation"],];

const TENSE_REASON = (ref, value) =>
  `${ref}: the lesson's point is the verb form, and the row was tagged vocabulary, so the typo budget accepted a different form of the same lemma as a "minor typo" — rated 3, which SM-2 treats as success. Setting target_grammar = ${value} makes the row strict, which is what every other grammar-shaped row already is. No key, alternative, prompt or option is changed.`;

const DERIVATIONAL_REASON = (key, accepts, value) =>
  `${key}: the grader accepts ${accepts.map(x => `"${x}"`).join(', ')} on this row today, inside the proportional typo budget. Setting target_grammar = ${value} makes the row strict. No key, alternative, prompt or option is changed.`;

/** The claim here is about the shipped grader's behaviour, not about a
 * dictionary, so the source is the code that produces it. */
const SOURCES = ['lib/grading.ts gradeAnswer (TYPO_TOLERANCE_RATIO, isGrammarExercise)'];

function englishGloss(prompt) {
  for (const pattern of GLOSS_PATTERNS) {
    const match = String(prompt ?? '').match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

/** The compiler already refuses speaking; these are the rows that are ALREADY
 * strict and so have nothing to gain. Kept in one place so the selection rule
 * and the runtime check cannot drift. */
export const GRAMMAR_SHAPED_TYPES = ['word_form', 'sentence_transformation', 'error_correction', 'cloze_deletion', 'sentence_construction'];
export const CHOICE_TYPES = ['multiple_choice', 'listening_choice'];
export function alreadyStrict(exercise) {
  return Boolean(exercise.target_grammar) || exercise.skill_type === 'grammar'
    || GRAMMAR_SHAPED_TYPES.includes(exercise.type) || CHOICE_TYPES.includes(exercise.type);
}

/** The tense/mood class, derived from the snapshot so the rule is the record. */
export function selectTenseRows(snapshot, curriculumOf) {
  const selected = [];
  for (const exercise of snapshot.exercises) {
    if (exercise.type === 'speaking' || exercise.response_mode === 'speak') continue;
    if (exercise.type === 'translate_to_native') continue;
    if (alreadyStrict(exercise)) continue;
    const { unit, course } = curriculumOf(exercise);
    if (!TENSE_LANGUAGES.includes(course.target_language)) continue;
    if (!TENSE_UNITS.includes(unit.title)) continue;
    const gloss = englishGloss(exercise.prompt);
    if (!gloss || !FINITE_GLOSS.test(gloss)) continue;
    selected.push({ exercise, unit, course, gloss });
  }
  return selected.sort((a, b) => a.exercise.id.localeCompare(b.exercise.id));
}

export function productiveParadigmFixes(set) {
  const { snapshot, row, update } = set;
  const courses = new Map(snapshot.courses.map(c => [c.id, c]));
  const units = new Map(snapshot.units.map(u => [u.id, u]));
  const lessons = new Map(snapshot.lessons.map(l => [l.id, l]));
  const curriculumOf = exercise => {
    const lesson = lessons.get(exercise.lesson_id);
    const unit = units.get(lesson.unit_id);
    return { lesson, unit, course: courses.get(unit.course_id) };
  };

  // --- Same-verb tense pairs -------------------------------------------
  const tense = selectTenseRows(snapshot, curriculumOf);
  const perKey = {};
  for (const { exercise, unit, course, gloss } of tense) {
    const key = `${course.target_language}/${unit.title}`;
    const value = TENSE_GRAMMAR[key];
    if (!value) throw new Error(`No authored target_grammar for ${key}`);
    perKey[key] = (perKey[key] ?? 0) + 1;
    update('exercises', exercise.id, { target_grammar: value },
      TENSE_REASON(`${course.target_language} ${course.cefr_level} ${unit.title} "${gloss}"`, value), SOURCES);
  }
  for (const language of TENSE_LANGUAGES) {
    for (const [unitTitle, expected] of Object.entries(TENSE_COUNTS)) {
      const actual = perKey[`${language}/${unitTitle}`] ?? 0;
      if (actual !== expected) throw new Error(`${language}/${unitTitle}: expected ${expected} paradigm rows, selected ${actual}`);
    }
    const actual = perKey[`${language}/Hypothetical Situations`] ?? 0;
    if (actual !== HYPOTHETICAL_COUNTS[language]) throw new Error(`${language}/Hypothetical Situations: expected ${HYPOTHETICAL_COUNTS[language]}, selected ${actual}`);
  }

  // --- Derivational noun/verb pairs -------------------------------------
  for (const [id, language, band, type, key, accepts, value] of derivationalRows) {
    const exercise = row('exercises', id);
    if (exercise.correct_answer !== key) throw new Error(`${id}: stored key moved, expected ${JSON.stringify(key)}`);
    if (exercise.type !== type) throw new Error(`${id}: exercise type moved`);
    if (alreadyStrict(exercise)) throw new Error(`${id}: already strict, the entry is stale`);
    const { unit, course } = curriculumOf(exercise);
    if (course.target_language !== language || course.cefr_level !== band) throw new Error(`${id}: language or band moved`);
    update('exercises', id, { target_grammar: value },
      DERIVATIONAL_REASON(`${language} ${band} ${unit.title} ${JSON.stringify(key)}`, accepts, value), SOURCES);
  }

  return { tense: tense.length, derivational: derivationalRows.length };
}
