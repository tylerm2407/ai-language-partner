/**
 * Answer grading utilities for exercises.
 * Handles exact match, fuzzy match (typo tolerance), and accent normalization.
 */

export interface GradeResult {
  isCorrect: boolean;
  accuracy: number; // 0-1, used for partial credit
  feedback: string;
  normalizedUserAnswer: string;
  normalizedCorrectAnswer: string;
}

/**
 * Grade an answer against the correct answer and accepted alternatives.
 */
export function gradeAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptedAnswers: string[] = [],
  options?: { strict?: boolean }
): GradeResult {
  const normalized = normalize(userAnswer);
  const normalizedCorrect = normalize(correctAnswer);
  const allAccepted = [normalizedCorrect, ...acceptedAnswers.map(normalize)];

  // Exact match (after normalization)
  if (allAccepted.includes(normalized)) {
    return {
      isCorrect: true,
      accuracy: 1,
      feedback: 'Correct!',
      normalizedUserAnswer: normalized,
      normalizedCorrectAnswer: normalizedCorrect,
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
    };
  }

  return {
    isCorrect: false,
    accuracy: 0,
    feedback: `Incorrect. The correct answer is: ${correctAnswer}`,
    normalizedUserAnswer: normalized,
    normalizedCorrectAnswer: normalizedCorrect,
  };
}

/**
 * Normalize text for comparison: lowercase, trim, remove extra spaces,
 * normalize accents for Latin scripts.
 */
function normalize(text: string): string {
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
function levenshtein(a: string, b: string): number {
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
