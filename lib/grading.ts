/**
 * Answer grading utilities for exercises.
 * Handles exact match, fuzzy match (typo tolerance), and accent normalization.
 */

import type { FeedbackErrorType, ExerciseType, SkillType } from '../types';

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
export interface ExerciseHints {
  targetGrammar?: string;
  targetWord?: string;
  skillType?: SkillType;
  exerciseType?: ExerciseType;
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
  const normalizedUser = normalize(userAnswer);
  const normalizedCorrect = normalize(correctAnswer);

  // Phonological errors only come from speaking exercises (whose output is
  // the transcription from STT graded via gradeSpeechTranscription).
  if (hints.exerciseType === 'speaking') {
    return 'phonological';
  }

  const isGrammarExerciseType =
    hints.exerciseType === 'word_form' ||
    hints.exerciseType === 'sentence_transformation' ||
    hints.exerciseType === 'error_correction' ||
    hints.exerciseType === 'cloze_deletion' ||
    hints.exerciseType === 'sentence_construction';

  const isLexicalExerciseType =
    hints.exerciseType === 'translate_to_native' ||
    hints.exerciseType === 'translate_to_target' ||
    hints.exerciseType === 'collocation_match';

  // Grammar signal is strongest — explicit targetGrammar or a grammar-skill
  // exercise should win over a coincidentally small edit-distance.
  const grammarSignal =
    Boolean(hints.targetGrammar) ||
    hints.skillType === 'grammar' ||
    isGrammarExerciseType;

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
  const normalized = normalize(userAnswer);
  const normalizedCorrect = normalize(correctAnswer);
  const allAccepted = [normalizedCorrect, ...acceptedAnswers.map(normalize)];
  const hints = options?.exerciseHints;

  // Exact match (after normalization)
  if (allAccepted.includes(normalized)) {
    return {
      isCorrect: true,
      accuracy: 1,
      feedback: 'Correct!',
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: null,
    };
  }

  // Strict mode: no fuzzy matching
  if (options?.strict) {
    return {
      isCorrect: false,
      accuracy: 0,
      feedback: `Incorrect. The correct answer is: ${correctAnswer}`,
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
      errorType: hints ? classifyError(userAnswer, correctAnswer, hints) : null,
    };
  }

  // Fuzzy match: check Levenshtein distance
  const bestMatch = allAccepted.reduce(
    (best, accepted) => {
      const distance = levenshtein(normalized, accepted);
      const maxLen = Math.max(normalized.length, accepted.length);
      const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;

      return similarity > best.similarity
        ? { similarity, distance, accepted }
        : best;
    },
    { similarity: 0, distance: Infinity, accepted: '' }
  );

  // Allow typos: distance <= 2 for short words, proportional for longer
  const maxAllowedDistance = normalized.length <= 4 ? 1 : 2;

  if (bestMatch.distance <= maxAllowedDistance) {
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
 * normalize accents for Latin scripts.
 */
export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Normalize common punctuation
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Remove trailing punctuation for comparison
    .replace(/[.!?]+$/, '');
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
  const allVariants = [normalizedExpected, ...acceptedVariants.map(normalize)];

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
