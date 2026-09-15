/**
 * Answer grading utilities for exercises.
 * Handles exact match, fuzzy match (typo tolerance), and accent normalization.
 */

import type { FeedbackErrorType, ExerciseType, SkillType, ReviewRating, LanguageCode } from '../types';
import { accentOnlyPartner, isConfusablePair } from './confusable-pairs';
import { simplifyChinese } from './zh-simplify';

export interface GradeResult {
  isCorrect: boolean;
  accuracy: number; // 0-1, used for partial credit
  feedback: string;
  normalizedUserAnswer: string;
  normalizedCorrectAnswer: string;
  /**
   * Classification of the learner's error, populated only when `gradeAnswer`
   * is called with `exerciseHints`. `null` for correct answers, or when no
   * confident classification is possible.
   */
  errorType?: FeedbackErrorType | null;
}

/**
 * Hints that let the classifier pick an error type. All fields optional so
 * legacy callers can omit them (errorType will stay `null`).
 */
/**
 * Share of the EXPECTED answer that may differ and still count as a typo.
 * See the tolerance block in `gradeAnswer` for why this is proportional.
 */
export const TYPO_TOLERANCE_RATIO = 0.3;

export interface ExerciseHints {
  targetGrammar?: string;
  targetWord?: string;
  skillType?: SkillType;
  exerciseType?: ExerciseType;
  /**
   * Target language, used to reject known confusable pairs. Optional: without
   * it the confusable check is skipped rather than guessed at.
   */
  language?: LanguageCode;
  /**
   * The text welded to the blank on a `fill_blank` row, so the grader can see
   * the WORD the row teaches rather than the fragment the row stores.
   *
   * A fill-blank row stores only the missing piece: the "Awesome" row prompts
   * `す_____` and its `correct_answer` is `ごい`. Everything the grader knows
   * about words — the confusable-pair list, the sibling-key rule — is written
   * in words, so on 1,995 rows it was comparing against fragments and matching
   * nothing. Korean tolerance operated on `간색` where the taught word is
   * `빨간색`.
   *
   * `prefix` is the run of non-space characters immediately before the blank
   * and `suffix` the run immediately after, both taken from the prompt. See
   * `blankContext` in lib/exercise-restore.ts, which derives them.
   */
  blankContext?: { prefix: string; suffix: string };
  /**
   * The other keys taught alongside this row — the lesson's, and the unit's
   * when the caller has them.
   *
   * A string that is the stored answer to a DIFFERENT question the learner is
   * being taught is not a typo of this one, however close the two look. The
   * curriculum audit counted 868 of these key-to-key collisions across the
   * frozen curriculum, in all nine languages: Spanish "Más bajo" accepting
   * "Más caro", "Paciente" accepting "Valiente", Korean "더 좋은" accepting
   * "더 작은", "더 비싼" accepting "더 싼".
   *
   * This is the general rule the pair list cannot be: it is derived from the
   * curriculum the learner is sitting in, so it covers every row authored from
   * now on. `lib/confusable-pairs.ts` keeps the cases it already handles —
   * words taught in different units, and words that are never anyone's stored
   * key — which no sibling list can reach.
   *
   * Keys only. A sibling's accepted ALTERNATIVES are not included: an
   * alternative is one row's judgement about a synonym, and refusing it
   * everywhere else would turn a generosity into a trap.
   */
  siblingKeys?: readonly string[];
}

/**
 * True when the exercise tests grammar: an explicit `targetGrammar`, a
 * `skillType` of `grammar`, or an inherently grammar-shaped exercise type.
 * Grammar exercises are graded strictly (no fuzzy typo tolerance) because a
 * form one or two edits away from the answer is usually a different — wrong —
 * grammatical form, not a mechanical typo.
 */
export function isGrammarExercise(hints: ExerciseHints = {}): boolean {
  const isGrammarExerciseType =
    hints.exerciseType === 'word_form' ||
    hints.exerciseType === 'sentence_transformation' ||
    hints.exerciseType === 'error_correction' ||
    hints.exerciseType === 'cloze_deletion' ||
    hints.exerciseType === 'sentence_construction';

  return (
    Boolean(hints.targetGrammar) ||
    hints.skillType === 'grammar' ||
    isGrammarExerciseType
  );
}

/**
 * Classify the learner's error into one of four pedagogical categories used
 * by the feedback UI. Returns `null` when we can't confidently assign one.
 *
 * Heuristics (see CLAUDE.md rules + research.md §10 Lyster & Ranta):
 *  - phonological: exercise is speaking (only path through STT).
 *  - grammar: targetGrammar present OR skillType === 'grammar' OR the
 *    exercise type is a grammar-shaped one (word_form, transform, etc).
 *  - spelling: Levenshtein <= 2 (short) or a single-word substitution with
 *    similar edit distance — a mechanical typo, not a lexical swap.
 *  - lexical: targetWord present OR skillType === 'vocabulary' OR a whole-
 *    word swap on a translate/collocation exercise.
 */
export function classifyError(
  userAnswer: string,
  correctAnswer: string,
  hints: ExerciseHints = {}
): FeedbackErrorType | null {
  const normalizedUser = normalize(userAnswer, hints.language);
  const normalizedCorrect = normalize(correctAnswer, hints.language);

  // Phonological errors only come from speaking exercises (whose output is
  // the transcription from STT graded via gradeSpeechTranscription).
  if (hints.exerciseType === 'speaking') {
    return 'phonological';
  }

  const isLexicalExerciseType =
    hints.exerciseType === 'translate_to_native' ||
    hints.exerciseType === 'translate_to_target' ||
    hints.exerciseType === 'collocation_match';

  // Grammar signal is strongest — explicit targetGrammar or a grammar-skill
  // exercise should win over a coincidentally small edit-distance.
  const grammarSignal = isGrammarExercise(hints);

  // Spelling: mechanical typo on any exercise where the shape is similar.
  // We keep this cheaper check independent so callers with no hints still
  // get something useful for typo-only mistakes.
  const distance = levenshtein(normalizedUser, normalizedCorrect);
  const maxLen = Math.max(normalizedUser.length, normalizedCorrect.length);
  const userTokens = normalizedUser.split(/\s+/).filter(Boolean);
  const correctTokens = normalizedCorrect.split(/\s+/).filter(Boolean);
  const sameTokenCount = userTokens.length === correctTokens.length && userTokens.length > 0;

  // Single-token substitution: identify the one differing token and measure
  // its edit distance. This catches typos in multi-word answers like
  // "I like te pizza" vs. "I like the pizza".
  let singleTokenSubDistance: number | null = null;
  if (sameTokenCount) {
    const diffs: number[] = [];
    for (let i = 0; i < userTokens.length; i++) {
      if (userTokens[i] !== correctTokens[i]) diffs.push(i);
    }
    if (diffs.length === 1) {
      const idx = diffs[0];
      const u = userTokens[idx];
      const c = correctTokens[idx];
      singleTokenSubDistance = levenshtein(u, c);
      // If that one differing token looks like a completely different word
      // (long edit distance relative to its length), it's more likely a
      // lexical swap than a typo — don't call it spelling.
      const tokenMaxLen = Math.max(u.length, c.length);
      const ratio = tokenMaxLen === 0 ? 0 : singleTokenSubDistance / tokenMaxLen;
      if (ratio > 0.5 && singleTokenSubDistance > 2) {
        singleTokenSubDistance = null; // disqualify as a typo
      }
    }
  }

  const spellingSignal =
    // whole-string typo on short answers
    (maxLen > 0 && distance <= 2 && distance > 0 && maxLen <= 12) ||
    // multi-word answer with a single typo-shaped word diff
    (singleTokenSubDistance !== null && singleTokenSubDistance <= 2);

  // Grammar wins over spelling if both match — a wrong verb form like
  // "I goed" vs "I went" is technically close in edit distance but
  // pedagogically grammar.
  if (grammarSignal) return 'grammar';

  const lexicalSignal =
    Boolean(hints.targetWord) ||
    hints.skillType === 'vocabulary' ||
    (isLexicalExerciseType &&
      sameTokenCount &&
      // On a lexical-shaped exercise, a single whole-word swap that isn't a
      // typo is a vocabulary miss.
      singleTokenSubDistance === null &&
      userTokens.some((t, i) => t !== correctTokens[i]));

  // Collocation exercises test word choice itself, so a whole-token swap is
  // a vocabulary miss even when it's only an edit or two away ("make a
  // shower" vs "take a shower") — lexical outranks the typo heuristic here.
  if (
    hints.exerciseType === 'collocation_match' &&
    sameTokenCount &&
    userTokens.filter((t, i) => t !== correctTokens[i]).length === 1
  ) {
    return 'lexical';
  }

  if (spellingSignal) return 'spelling';
  if (lexicalSignal) return 'lexical';

  return null;
}

/**
 * Grade an answer against the correct answer and accepted alternatives.
 *
 * When `exerciseHints` is provided (optional for backward compatibility),
 * the returned `errorType` is populated via `classifyError` so UI callers
 * can branch on the pedagogical category.
 */
export function gradeAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptedAnswers: string[] = [],
  options?: { strict?: boolean; exerciseHints?: ExerciseHints }
): GradeResult {
  const hints = options?.exerciseHints;
  const normalized = normalize(userAnswer, hints?.language);
  const normalizedCorrect = normalize(correctAnswer, hints?.language);

  /**
   * Fill-blank rows are judged as the completed word.
   *
   * The row stores the blank's filler, not the word: `す_____` / `ごい`. Two
   * consequences, both measured by the curriculum audit across 1,995 rows.
   * First, a learner who types the whole word — `すごい`, which is what the
   * lesson taught — was marked wrong, because the stored key is two of its
   * three characters. Second, every rule the grader has about *words* (the
   * confusable-pair list, the sibling-key rule below) was being handed a
   * fragment and matching nothing at all.
   *
   * `completeWord` welds the prompt's own characters back on, so both of those
   * work on `すごい` and `빨간색` instead of `ごい` and `간색`.
   *
   * Deliberately NOT welded: the edit distance and the typo budget. They stay
   * on the piece the learner actually typed, so completing the word can only
   * change WHICH strings are judged equal, never how much of the learner's own
   * typing is allowed to be wrong, and never the partial credit a near miss
   * earns. A welded prefix would otherwise hand a long Japanese clause a budget
   * of 2 where the three-character filler earns 0.
   */
  const completeWord = (text: string): string => {
    const blank = hints?.blankContext;
    if (!blank || (!blank.prefix && !blank.suffix)) return normalize(text, hints?.language);
    return normalize(`${blank.prefix}${text}${blank.suffix}`, hints?.language);
  };
  const withoutSpaces = (text: string) => text.replace(/\s+/g, '');
  const completedAccepted = [correctAnswer, ...acceptedAnswers].map(completeWord);

  /**
   * The learner typed the whole word rather than the missing piece.
   *
   * Matched without spaces because a welded prompt (`Buenas_____`) renders with
   * a space the learner will type: "buenas tardes" has to reach
   * "buenastardes".
   */
  const typedWholeWord =
    hints?.blankContext !== undefined &&
    completedAccepted.some((accepted) => withoutSpaces(accepted) === withoutSpaces(normalized));

  const allAccepted = [
    normalizedCorrect,
    ...acceptedAnswers.map((accepted) => normalize(accepted, hints?.language)),
  ];

  /**
   * Another taught key is never a typo of this one.
   *
   * Anything this row itself accepts is filtered out first, so a unit that
   * teaches the same string twice, or a row that already accepts its
   * neighbour's answer, is unaffected. What is left is a string the learner is
   * being taught as the answer to a different question — and the fact that it
   * sits one edit away from this key is exactly the contrast the lesson is
   * drawing, not a slip of the finger.
   */
  const keyFolded = new Set([
    stripDiacritics(normalizedCorrect),
    stripDiacritics(completeWord(correctAnswer)),
  ]);
  const siblingKeys = new Set(
    (hints?.siblingKeys ?? [])
      .map((key) => normalize(key, hints?.language))
      .filter(
        (key) =>
          key !== '' &&
          !allAccepted.includes(key) &&
          !completedAccepted.includes(key) &&
          // A sibling that folds onto this row's KEY is the same word written
          // with or without its accents — "Menu" against "Menú", "Niece"
          // against "Nièce", both taught because one is the gloss of the
          // other. That is a question about accents, settled by the accent
          // branch and the pair list, not a lexical collision. Measured on
          // the frozen curriculum: 29 rows, all of them cognate pairs.
          //
          // Folding onto an ACCEPTED ALTERNATIVE is not excused the same way.
          // "Groß_____ (Generous)" keys on zügig and also accepts mütig, and
          // the unit teaches Mutig (brave) as its own answer — so the
          // alternative's unaccented form is another word outright. An
          // alternative is a generosity; it must not swallow a taught key.
          !keyFolded.has(stripDiacritics(key)),
      ),
  );
  const isTaughtElsewhere = (candidate: string): boolean =>
    siblingKeys.has(candidate) ||
    // On a fill-blank row the sibling keys arrive as whole words, so the
    // fragment the learner typed has to be welded before it can match.
    (hints?.blankContext !== undefined && siblingKeys.has(completeWord(candidate)));

  // Exact match (after normalization)
  if (allAccepted.includes(normalized) || typedWholeWord) {
    return {
      isCorrect: true,
      accuracy: 1,
      feedback: 'Correct!',
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: null,
    };
  }

  // Strict mode: no fuzzy or accent tolerance. Explicitly requested, or
  // implied for any grammar exercise — a near-miss on a grammar form is a
  // different (wrong) form, not a typo ("hablo" vs "habló" is a different
  // tense), so neither typo nor accent tolerance may accept it.
  // A tapped option cannot contain a learner typing error. Fuzzy matching
  // otherwise turns authored distractors such as “To hire” / “To fire” into
  // correct answers and disagrees with the option's red/green display.
  const isChoice = hints?.exerciseType === 'multiple_choice' || hints?.exerciseType === 'listening_choice';
  if (options?.strict || isChoice || isGrammarExercise(hints)) {
    return {
      isCorrect: false,
      accuracy: 0,
      feedback: `Incorrect. The correct answer is: ${correctAnswer}`,
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: hints ? classifyError(userAnswer, correctAnswer, hints) : null,
    };
  }

  /**
   * Accent-tolerant match: diacritic-stripped forms are equal but the raw
   * normalized forms differ (e.g. "cafe" vs "café"). Accepted as correct —
   * Duolingo-style — but the feedback nudges the learner toward the accents.
   *
   * The pair list is consulted HERE as well as in the fuzzy branch below,
   * because this branch returns first. `stripDiacritics` folds far more than
   * a missing French accent: ñ→n, ö/ü/ä→o/u/a, and Cyrillic ё→е and й→и. So
   * Spanish él/el, tú/tu, papá/papa and Portuguese avô/avó were all reaching
   * this branch and being accepted as "watch the accents" — while being
   * different words. An audit of the shipped list found 22 of its 63 entries
   * unreachable for exactly this reason.
   *
   * A genuine accent slip on the SAME word is still forgiven; only a pair the
   * list names as two distinct words is refused, and it falls through to the
   * fuzzy branch, which refuses it again and returns a wrong answer.
   */
  const stripped = stripDiacritics(normalized);

  /**
   * A bare stem that could be either of two taught words is neither.
   *
   * Portuguese teaches avô (grandfather) and avó (grandmother); the accent is
   * the entire difference between them. Typing `avo` passed for BOTH, so the
   * contrast was untestable by typing — the accent branch read it as a
   * forgivable slip on whichever row the learner happened to be on, and said
   * "Correct! (Watch the accents)". The same shape covers Spanish papa/papá,
   * el/él, tu/tú, si/sí and their kin.
   *
   * The pair list is the authority on which words these are, and it is asked
   * with the diacritics folded, which is the one question
   * `isConfusablePair` cannot answer: it skips a pair whose members fold
   * together so that folding cannot make a pair match itself.
   *
   * Deliberately NOT extended to sibling keys that fold together. Those are
   * overwhelmingly a target word and its own English gloss — "Niece" beside
   * "Nièce", 29 rows in the frozen curriculum — where the bare form is a
   * missing accent and nothing more. Two words worth separating are a
   * judgement, and the pair list is where that judgement is recorded.
   *
   * This is a real behaviour change for learners on keyboards without easy
   * accents, so the refusal says what the accent is doing rather than a bare
   * "incorrect".
   */
  const accentTwin =
    hints?.language !== undefined && stripDiacritics(normalizedCorrect) === stripped
      ? accentOnlyPartner(normalizedCorrect, hints.language, stripDiacritics) ??
        accentOnlyPartner(normalizedCorrect, 'en', stripDiacritics)
      : null;
  if (accentTwin !== null) {
    const distance = levenshtein(normalized, normalizedCorrect);
    const maxLen = Math.max(normalized.length, normalizedCorrect.length);
    // The list is stored lowercase; show the twin the way the row shows its
    // own answer, or the sentence reads as two different kinds of word.
    const first = correctAnswer.trim().charAt(0);
    const twin =
      first !== '' && first === first.toUpperCase() && first !== first.toLowerCase()
        ? accentTwin.charAt(0).toUpperCase() + accentTwin.slice(1)
        : accentTwin;
    return {
      isCorrect: false,
      accuracy: maxLen === 0 ? 0 : 1 - distance / maxLen,
      feedback:
        `Not quite — the accent is the whole difference between "${correctAnswer}" and ` +
        `"${twin}". The correct answer is: ${correctAnswer}`,
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: hints ? classifyError(userAnswer, correctAnswer, hints) : null,
    };
  }

  const accentMatch = allAccepted.find(
    (accepted) =>
      stripDiacritics(accepted) === stripped &&
      // A string the curriculum teaches as another answer is that answer, not
      // a missing accent on this one.
      !isTaughtElsewhere(normalized) &&
      !(
        hints?.language !== undefined &&
        (isConfusablePair(normalized, accepted, hints.language) ||
          isConfusablePair(normalized, accepted, 'en'))
      )
  );
  if (accentMatch !== undefined) {
    const distance = levenshtein(normalized, accentMatch);
    const maxLen = Math.max(normalized.length, accentMatch.length);
    return {
      isCorrect: true,
      accuracy: maxLen === 0 ? 1 : 1 - distance / maxLen,
      feedback: `Correct! (Watch the accents: "${correctAnswer}")`,
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: null,
    };
  }

  // Numeric facts are not spelling errors: 2046 is not a typo-correct answer
  // to 2045, nor is 48.9°C interchangeable with 48.8°C. Explicit accepted
  // answers have already been checked above. Preserve decimal comma/dot
  // equivalence, but do not guess ambiguous thousands-separator conventions.
  const numberSignature = (text: string): { values: string; notation: string } => {
    const values: string[] = [];
    // Between two numbers, a hyphen/en dash separates range endpoints; it
    // does not make the second endpoint negative. A second sign still does:
    // -5--2 and -5–-2 both retain the negative sign on each endpoint.
    const ranges = text.replace(/([0-9０-９])\s*[-–－]\s*(?=[+\-＋－−]?[0-9０-９])/g, '$1\u0001');
    const notation = ranges.replace(/[+\-＋－−]?[0-9０-９]+(?:[.,][0-9０-９]+)*/g, value => {
      // Normalize only numeric tokens, not the surrounding language text.
      // NFKC on the whole answer would also merge unrelated letter forms.
      const canonical = value
        .replace(/[０-９＋－]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
        .replace(/−/g, '-')
        .replace(/^\+/, '')
        .replace(/,/g, '.');
      values.push(canonical);
      return canonical;
    });
    return { values: values.join('\u0000'), notation };
  };
  const userNumbers = numberSignature(normalized);

  // Equivalent number notation is not a typo, even in a short answer whose
  // typo budget is zero (e.g. −5 / -5). Strict grammar and tapped choices have
  // already returned above and do not gain additional normalization here.
  if (userNumbers.values && allAccepted.some(accepted => {
    const numbers = numberSignature(accepted);
    return numbers.values === userNumbers.values && numbers.notation === userNumbers.notation;
  })) {
    return {
      isCorrect: true,
      accuracy: 1,
      feedback: 'Correct!',
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: null,
    };
  }

  // Fuzzy match: check Levenshtein distance only against numerically matching
  // candidates. A different accepted variant may still be the right match.
  const bestMatch = allAccepted.reduce(
    (best, accepted) => {
      if (numberSignature(accepted).values !== userNumbers.values) return best;
      const distance = levenshtein(stripped, stripDiacritics(accepted));
      const maxLen = Math.max(normalized.length, accepted.length);
      const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;

      return similarity > best.similarity
        ? { similarity, distance, accepted }
        : best;
    },
    { similarity: 0, distance: Infinity, accepted: '' }
  );

  /**
   * Typo tolerance, measured against the EXPECTED answer.
   *
   * It used to be `normalized.length <= 4 ? 1 : 2` — keyed off the length of
   * the LEARNER'S answer, and as a flat edit count rather than a proportion.
   * Expected "no", typed "yo": the learner's answer is two characters, so the
   * budget was 1, and a single substitution turning one real word into a
   * DIFFERENT real word was graded "Correct! (Minor typo)", rated 4, and pushed
   * out to a longer SM-2 interval. The system taught the wrong meaning and then
   * reinforced it on a schedule.
   *
   * Proportional fixes that without punishing genuine typos in longer words,
   * because one edit is most of a two-letter word and very little of a
   * seven-letter one:
   *
   *   "no"      -> floor(2 * 0.3) = 0   exact only; "yo" is rejected
   *   "café"    -> floor(4 * 0.3) = 1   "cafee" still accepted
   *   "receive" -> floor(7 * 0.3) = 2   "recieve" still accepted
   *
   * Capped at 2 so a long sentence does not accumulate a large budget.
   * `gradeSpeechTranscription` always measured proportionally; only the typed
   * path did not.
   */
  const expectedForTolerance = bestMatch.accepted || normalizedCorrect;
  /**
   * Measure the budget on the SAME string the distance was measured on.
   *
   * `bestMatch.distance` is computed over `stripDiacritics(...)`, which is NFD
   * with the combining marks removed. Hangul decomposes into conjoining jamo,
   * which are not combining marks and therefore survive — so a Korean key is
   * about 2.35x longer there than in its composed form, while the budget was
   * taken from the composed length. Korean tolerance was roughly nine times
   * stricter than the stated ratio: 242 of the 354 Korean keys in the
   * curriculum had a budget of zero, and ordinary adjacent-key slips such as
   * 경재 for 경제 or 간후사 for 간호사 were rejected outright. Measuring both on
   * the decomposed form leaves 29 of those at zero, which is the intended
   * behaviour for genuinely short keys.
   *
   * Japanese has the same mismatch on dakuten (about 19% of keys, one unit
   * each). Latin-script languages are unaffected: their decomposed length
   * after mark removal equals the composed length.
   *
   * This loosening is only safe because the confusable-pair list is consulted
   * below: the budget stops rejecting real typos, the pair list stops it
   * accepting a different word.
   */
  /**
   * Scale the budget by the SHORTER of the key and the alternative matched.
   *
   * It used to scale by the matched alternative alone, which meant that adding
   * a long accepted answer widened tolerance for every wrong neighbour on that
   * row. The curriculum audit measured the consequence across the remediation
   * it had just authored: 88 rows in seven languages began accepting a string
   * that should stay wrong, because a correct alternative had been added. The
   * clearest case recurs in all seven — the key "Cheap" gains "Inexpensive",
   * eleven characters, so the budget becomes 2, and "Expensive" is exactly two
   * edits from "Inexpensive". The row then marks the antonym correct.
   *
   * Taking the shorter length keeps a genuine typo of a long alternative
   * forgiven at the granularity the key itself earns, and stops an addition
   * from making the row more permissive about wrong answers. Adding a right
   * answer must never widen what counts as right.
   */
  const toleranceBasis = Math.min(
    stripDiacritics(expectedForTolerance).length,
    stripDiacritics(normalizedCorrect).length,
  );
  /**
   * Chinese, and Japanese above the kana line, get no typo tolerance at all.
   *
   * Edit distance works in Latin script because a letter is a fraction of a
   * morpheme: one edit in "receive" rarely lands on another real word, and the
   * 0.3 ratio encodes exactly that. A Han character IS a morpheme. One edit is
   * not a fraction of a word, it is a whole unit of meaning replaced — 我同意
   * and 我不同意 are one edit apart and are opposites, and in the A2 Japanese
   * comparative block every one of the six taught adjectives is exactly one
   * edit from every other, so a budget of one guarantees that any of the six
   * scores correct for any of the others.
   *
   * And there is no keystroke path to the neighbour. These scripts are typed
   * through an IME by reading, then converted: もっと良い is typed `motto yoi`
   * and もっと悪い is `motto warui`, sharing no input sequence. A slip that
   * lands on another valid word is not a slip the input method can produce, so
   * the tolerance buys nothing it was designed to buy. Mean key length makes it
   * worse — 2.28 characters in Chinese and 3.29 in Japanese against 8.30 in
   * Spanish — so one edit is a third of the answer and all of the meaning.
   *
   * Japanese keeps tolerance for kana, which genuinely can be mistyped: the
   * gate is per-answer, not per-language, and lifts as soon as either side
   * carries a Han character.
   *
   * Korean is deliberately NOT included. A Hangul syllable is a phonological
   * block, not a morpheme, and a single jamo really is a fraction of a word —
   * which is the level the grader already measures at. Korean's problem was
   * the opposite one, and was fixed by measuring the budget in jamo too.
   */
  const han = /[㐀-䶿一-鿿豈-﫿]/;
  const scriptTakesTypoTolerance =
    hints?.language !== 'zh' &&
    (hints?.language !== 'ja' || !(han.test(normalized) || han.test(expectedForTolerance)));
  const maxAllowedDistance = scriptTakesTypoTolerance
    ? Math.min(2, Math.floor(toleranceBasis * TYPO_TOLERANCE_RATIO))
    : 0;

  /**
   * Length alone cannot separate a typo from a different word of the same
   * shape: "gato"/"rato", "casa"/"caza", "hombre"/"hambre" are all one edit
   * apart. `isConfusablePair` enumerates exactly those, per language — it
   * existed and was never called, so every pair it lists was being accepted as
   * a minor typo and then reinforced by SRS.
   *
   * Gated on a language hint: callers that do not supply one keep the previous
   * behaviour rather than silently getting a different grade.
   *
   * Two lookups, because one answer can be in either of two languages while
   * the hint only names one. `hints.language` is the COURSE TARGET language,
   * passed by the lesson runner for both directions. That is the right list
   * for `translate_to_target`, where the learner types the target language.
   * On `translate_to_native` the learner types their native language, so the
   * target list cannot match and an English neighbour of an English key —
   * "shirt" for Skirt, taught in the same lesson — was scored "minor typo"
   * and reinforced by SRS. Every course is currently en -> X, so the
   * answer side of that direction is always English; hence the second lookup.
   *
   * Checking both is safe rather than direction-dependent: the per-language
   * lists are disjoint word sets, so the English lookup is a no-op for any
   * answer that is not English, and it can only reject when the typed answer
   * and the key are both members of one English pair. When a non-English
   * native language ships, `'en'` becomes `hints.nativeLanguage ?? 'en'` with
   * that field threaded from the learner's profile.
   */
  /**
   * The stripped forms are checked too. The list stores words with their
   * diacritics, and the lookup normalizes but does not fold them, so a pair
   * like irmã/irmão does not catch a learner typing the bare `irmao` — one
   * edit from `irmã` and inside its budget. Checking both forms closes that
   * without touching the list.
   */
  /**
   * A negation is never a typo.
   *
   * Two strings that differ only in whether they are negated are opposites, not
   * near-misses, and the edit distance between them is often small: "to fire"
   * and "not fire" are two substitutions, well inside the budget a seven-
   * character key earns. The curriculum audit measured 134 such acceptances
   * across the draft — "No estudié" credited for "I studied", "Non ho mangiato"
   * for "I ate", "Nicht ausruhen" for "To rest" — of which about 40 invert
   * meaning in the target language. A minor-typo pass is rated 3, which SM-2
   * treats as a success, so the learner is told the inverse is correct and then
   * shown the card less often.
   *
   * A confusable-pair entry cannot cover this: 48 of those hold on the bare key
   * with no authored alternative involved, so closing them by data would need
   * one entry per taught verb per language, and every new verb reopens the
   * hole. That is a policy, not a list.
   *
   * The rule is deliberately narrow. It fires only when the two strings are
   * identical apart from a leading negator — either one carries it and the
   * other does not, or one's leading marker is swapped for the other's negator.
   * An exact match returns long before this, so a legitimately negated key is
   * unaffected, and a genuine typo inside a negated answer still passes.
   */
  const NEGATORS: Partial<Record<LanguageCode, readonly string[]>> = {
    en: ['not', "don't", "doesn't", "didn't", "won't", 'never', 'no'],
    es: ['no', 'nunca', 'jamás', 'jamas'],
    it: ['non', 'mai'],
    pt: ['não', 'nao', 'nunca', 'jamais'],
    fr: ['ne', 'pas', 'jamais'],
    de: ['nicht', 'kein', 'keine', 'keinen', 'nie', 'niemals'],
    ru: ['не', 'нет', 'никогда'],
  };
  const differsOnlyByNegation = (a: string, b: string, language: LanguageCode): boolean => {
    const negators = [...(NEGATORS[language] ?? []), ...(NEGATORS.en ?? [])];
    const head = (text: string) => text.split(/\s+/).filter(Boolean);
    const [first, second] = [head(a), head(b)];
    if (!first.length || !second.length) return false;
    const isNegator = (word: string) => negators.includes(word);
    const rest = (words: string[]) => words.slice(1).join(' ');
    // One string carries a leading negator the other does not.
    if (isNegator(first[0]) && !isNegator(second[0]) && rest(first) === second.join(' ')) return true;
    if (isNegator(second[0]) && !isNegator(first[0]) && rest(second) === first.join(' ')) return true;
    // Both lead with a different word, one of which is a negator, and the rest
    // is identical — "to fire" against "not fire".
    if (first.length === second.length && first[0] !== second[0] && rest(first) === rest(second)
      && (isNegator(first[0]) !== isNegator(second[0]))) return true;
    return false;
  };
  const negationMismatch = hints?.language !== undefined
    && differsOnlyByNegation(normalized, expectedForTolerance, hints.language);

  /**
   * A different ending is a different form, not a typo.
   *
   * Register is content, and the ruling is that a MORE polite form than the key
   * is correct on a cue that names no register while a less polite one is not.
   * Both halves of that make an ending semantically load-bearing, so the grader
   * must never silently forgive a difference that consists only of one. What
   * the grader does NOT do is decide which direction is acceptable: the polite
   * forms that belong on a row are authored into `accepted_answers`, where an
   * exact match takes them long before this. This rule only stops tolerance
   * from inventing register variants nobody authored.
   *
   * Korean is where it bites. It is deliberately outside the Han-script gate
   * above — a jamo really is a fraction of a word, and the grader measures
   * distance in jamo, so ordinary slips like 간후사 for 간호사 should stay
   * forgiven. But the same measurement hands a key of any length a budget of
   * two jamo, and Korean endings sit one or two jamo apart. Round-2 triage
   * caught the consequence on `ko-E1032` (`더 키_____ (Taller)`, key `가 크다`),
   * where `가 큰` now returns "Correct! (Minor typo)" — a form the row did not
   * ask for, accepted because of a length coincidence rather than anything
   * pedagogical. Left alone, a tolerance constant decides part of the
   * speech-level question.
   *
   * Japanese needs it too, but only just: the kanji gate already refuses
   * 料理する for 料理します, and a short kana pair such as みる/みた has no budget
   * to spend. What survives both is the LONG kana string, where ます against
   * ました is two edits inside a budget of two — ありがとうございます accepting
   * ありがとうございました, live in the curriculum on two rows.
   *
   * So the rule is the one already used for negation: when two strings are the
   * same up to the point where their endings begin, and BOTH remainders are
   * recognised inflectional endings, they are two forms of one stem. 크다 and
   * 큰, 갔어요 and 가겠어요 (past against future), 먹었어요 and 먹였어요 (plain
   * past against causative), ます and ました, and a form the learner did not
   * produce is not a form they mistyped.
   *
   * Narrow on purpose:
   *  - Both remainders must be in the list. 씨다 / 씻다 differ by ㅅ다, which is
   *    no ending, so that stays an ordinary typo question for the pair list.
   *  - The shared stem must be at least two jamo, so two unrelated words that
   *    happen to share one letter are untouched.
   *  - Neither remainder may be empty: dropping a whole ending is as likely to
   *    be a slip as a choice, and the budget already judges it.
   *  - A single unit on BOTH sides is not enough. ㄴ, ㄹ and ㅁ end plenty of
   *    ordinary Korean nouns, so 신념 against 신년 looks exactly like an
   *    inflection and is nothing of the kind, and the same is true of うた
   *    against うる in Japanese. At least one side must carry a full ending —
   *    크다 against 큰 qualifies, 산 against 살 does not.
   *  - 에요 is left out, so the 이에요 / 이어요 copula spellings — 12 pairs in
   *    the Korean corpus, the same word either way — keep their tolerance.
   *
   * An exact match returns long before this, so an ending a row has authored as
   * an accepted answer is unaffected.
   */
  const INFLECTIONAL_ENDINGS: Partial<Record<LanguageCode, readonly string[]>> = {
    ko: [
      // Plain and dictionary forms.
      '다', '\u11ab다', '는다',
      // Adnominal: the bare jongseong forms are how ㄴ and ㄹ attach to a stem.
      '\u11ab', '\u11af', '은', '는', '을', '던', '\u11ab\u1103\u1161',
      // Polite. 어요 / 아요 / 여요 and the honorific imperative.
      '요', '어요', '아요', '여요', '세요', '으세요', '셔요',
      // Deferential. ㅂ니다 attaches as a jongseong; 습니다 stands alone.
      '\u11b8니다', '습니다', '\u11b8니까', '습니까', '십시오',
      // Tense. ㅆ attaches to the stem: 갔다 is 가 + ㅆ + 다.
      '\u11bb다', '\u11bb어요', '\u11bb습니다', '았다', '었다', '였다',
      '았어요', '었어요', '였어요', '았습니다', '었습니다', '였습니다',
      '겠다', '겠어요', '겠습니다',
      // Connectives and nominalisers.
      '고', '서', '지', '며', '면', '니까', '는데', '\u11ab데', '은데',
      '기', '음', '\u11b7', '자', '라', '어라', '아라',
    ],
    // Japanese: the polite/plain and tense endings, and nothing shorter than a
    // kana. Anything carrying a kanji has already lost its tolerance above, so
    // this list only has to cover what the gate leaves behind.
    ja: [
      'ます', 'ました', 'ません', 'ませんでした', 'ましょう',
      'です', 'でした', 'でしょう', 'だろう', 'である', 'だ',
      'します', 'しました', 'する', 'した', 'して', 'しない',
      'ています', 'ている', 'ていました', 'てる',
      'ない', 'なかった', 'たい', 'ください', 'よう',
      'た', 'て', 'る',
    ],
  };
  const endingsFor = (language: LanguageCode | undefined): readonly string[] =>
    (language === undefined ? [] : INFLECTIONAL_ENDINGS[language] ?? [])
      .map((ending) => ending.normalize('NFD'));

  const differsOnlyByEnding = (a: string, b: string, endings: readonly string[]): boolean => {
    if (endings.length === 0) return false;
    const [first, second] = [a.normalize('NFD'), b.normalize('NFD')];
    let common = 0;
    while (common < first.length && common < second.length && first[common] === second[common]) common++;
    // Walk the split point back from the longest shared run rather than taking
    // it as given: 먹었어요 and 먹였어요 share ㅁㅓㄱ AND the ㅇ that opens the
    // next syllable, so the maximal prefix cuts both endings in half and
    // neither remainder is recognisable.
    for (let shared = common; shared >= 2; shared--) {
      const [restA, restB] = [first.slice(shared), second.slice(shared)];
      if (restA === '' || restB === '' || restA === restB) continue;
      if (restA.length === 1 && restB.length === 1) continue;
      if (endings.includes(restA) && endings.includes(restB)) return true;
    }
    return false;
  };
  const inflectionMismatch = differsOnlyByEnding(
    normalized,
    expectedForTolerance,
    endingsFor(hints?.language),
  );

  const confusableIn = (language: LanguageCode) =>
    isConfusablePair(normalized, expectedForTolerance, language) ||
    isConfusablePair(normalized, expectedForTolerance, language, stripDiacritics) ||
    // The pair list is written in words, so on a fill-blank row it has to be
    // asked about the completed word — `빨간색`, not the stored `간색`.
    (hints?.blankContext !== undefined &&
      (isConfusablePair(completeWord(normalized), completeWord(expectedForTolerance), language) ||
        isConfusablePair(
          completeWord(normalized),
          completeWord(expectedForTolerance),
          language,
          stripDiacritics,
        )));
  const confusable =
    negationMismatch
    || inflectionMismatch
    || isTaughtElsewhere(normalized)
    || (hints?.language !== undefined
      && (confusableIn(hints.language) || confusableIn('en')));

  if (!confusable && bestMatch.distance <= maxAllowedDistance) {
    return {
      isCorrect: true,
      accuracy: bestMatch.similarity,
      feedback: `Correct! (Minor typo: "${correctAnswer}")`,
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: null,
    };
  }

  // Close but not close enough
  if (bestMatch.similarity > 0.6) {
    return {
      isCorrect: false,
      accuracy: bestMatch.similarity,
      feedback: `Almost! The correct answer is: ${correctAnswer}`,
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: hints ? classifyError(userAnswer, correctAnswer, hints) : null,
    };
  }

  return {
    isCorrect: false,
    accuracy: 0,
    feedback: `Incorrect. The correct answer is: ${correctAnswer}`,
    normalizedUserAnswer: normalized,
    normalizedCorrectAnswer: normalizedCorrect,
    errorType: hints ? classifyError(userAnswer, correctAnswer, hints) : null,
  };
}

/**
 * Normalize text for comparison: lowercase, trim, remove extra spaces,
 * normalize quotes, strip trailing punctuation. Accent folding is handled
 * separately by `stripDiacritics` in the comparison path, so accented and
 * unaccented forms can be told apart for feedback.
 *
 * With `language` set to `zh`, traditional characters fold to simplified
 * first. A learner writing 學校 for the stored 学校 is not making a typing
 * error — they are writing the same word in the other script — and there was
 * no policy at all before: the same substitution hard-failed on a
 * two-character key and passed on a seven-character one as "Correct! (Minor
 * typo)", telling a learner their correct answer was a mistake. The fold
 * belongs HERE rather than in the tolerance path because 221 of the 692
 * affected rows are strict-graded and never reach tolerance. See
 * lib/zh-simplify.ts for the table and its provenance.
 */
export function normalize(text: string, language?: LanguageCode): string {
  const scripted = language === 'zh' ? simplifyChinese(text) : text;
  return scripted
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Normalize common punctuation
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    // Remove trailing punctuation for comparison
    .replace(/[.!?。！？]+$/, '');
}

/**
 * Strip combining diacritics after NFD decomposition so accented and
 * unaccented forms compare equal ("café" -> "cafe", "está" -> "esta").
 * Letters that decompose fold to their base — including ñ -> n, so "nino"
 * matches "niño" (intentional, Duolingo-style). Letters that don't decompose
 * (e.g. German ß) are left as-is.
 */
export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Levenshtein distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows instead of full matrix for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Convert a GradeResult to an SRS rating (0-5 scale).
 * Used to feed into the SM-2 algorithm.
 */
export interface SpeechGradeResult {
  isCorrect: boolean;
  score: number;
  feedback: string;
  targetPresent: boolean;
}

/**
 * Grade a speech transcription against expected text and accepted variants.
 * Used by speaking exercises to compare STT output with expected answers.
 */
export function gradeSpeechTranscription(
  transcription: string,
  expectedText: string,
  acceptedVariants: string[],
  targetWord?: string
): SpeechGradeResult {
  const normalizedTranscription = normalize(transcription);
  const normalizedExpected = normalize(expectedText);
  // Wrapped rather than passed by reference: `normalize` takes an optional
  // language second argument, and `map` would hand it the array index.
  // Speech has no language hint to give it — the transcription arrives from
  // STT already in the target script — so traditional input is not folded on
  // this path.
  const allVariants = [normalizedExpected, ...acceptedVariants.map((v) => normalize(v))];

  // Find the best similarity across expected text and all accepted variants
  let bestSimilarity = 0;
  for (const variant of allVariants) {
    const distance = levenshtein(normalizedTranscription, variant);
    const maxLen = Math.max(normalizedTranscription.length, variant.length);
    const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
    }
  }

  const score = Math.round(bestSimilarity * 100);
  const isCorrect = score >= 60;

  // Check if the target word appears in the transcription
  const targetPresent = targetWord
    ? normalizedTranscription.includes(normalize(targetWord))
    : false;

  // Generate feedback based on score ranges
  let feedback: string;
  if (score >= 90) {
    feedback = 'Excellent pronunciation!';
  } else if (score >= 75) {
    feedback = 'Good job! A few sounds need work.';
  } else if (score >= 60) {
    feedback = 'Decent attempt. Keep practicing!';
  } else if (score >= 40) {
    feedback = 'Needs improvement. Try listening to the audio again and repeat slowly.';
  } else {
    feedback = `Not quite right. The expected answer was: "${expectedText}"`;
  }

  return { isCorrect, score, feedback, targetPresent };
}

export function gradeToRating(grade: GradeResult, responseTimeMs: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!grade.isCorrect) {
    return grade.accuracy > 0.5 ? 2 : 1; // 1 = total miss, 2 = close
  }

  // Correct: factor in response time and accuracy
  const fastThreshold = 5000; // 5 seconds
  const wasFast = responseTimeMs < fastThreshold;

  if (grade.accuracy === 1 && wasFast) return 5; // perfect + fast = easy
  if (grade.accuracy === 1) return 4; // perfect but slow
  return 3; // correct with typo
}

/**
 * Map a spoken answer's similarity score to an SM-2 rating.
 *
 * Separate from `gradeToRating` because the two take incompatible shapes —
 * `GradeResult.accuracy` is 0–1 while `SpeechGradeResult.score` is 0–100 — and
 * because response time means something different out loud.
 *
 * `thinkingTimeMs` must have the endpointer's silence window SUBTRACTED. A
 * voice turn cannot end until the detector has heard ~1.2s of silence, so raw
 * response time carries a floor that has nothing to do with how well the
 * learner knew the answer. Against `gradeToRating`'s 5-second threshold that
 * floor alone would make a 5 nearly unreachable, quietly flattening the top of
 * the rating scale and slowing every interval.
 *
 * The pass boundary is 60, matching `gradeSpeechTranscription`'s own
 * `isCorrect`, which in turn lines up with SM-2 treating <3 as a lapse.
 */
export function speechScoreToRating(
  /** 0–100 similarity from `gradeSpeechTranscription`. */
  score: number,
  /** Response time with endpointer lag already removed. */
  thinkingTimeMs: number,
  opts: { fastThresholdMs?: number } = {},
): ReviewRating {
  const fastThresholdMs = opts.fastThresholdMs ?? 3500;
  const wasFast = thinkingTimeMs < fastThresholdMs;

  if (score < 40) return 1; // nothing like it
  if (score < 60) return 2; // close, but a lapse
  if (score < 80) return 3; // passed with difficulty
  if (score < 95) return 4; // good
  return wasFast ? 5 : 4; // effortless only when it was actually effortless
}
