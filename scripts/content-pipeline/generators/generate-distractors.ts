/**
 * Generate distractors for multiple-choice exercises.
 *
 * Rule-based approach: picks random words from the provided pool
 * that are different from the correct answer.
 *
 * Falls back to an empty array if not enough candidates exist
 * (caller can use AI gap-filling to complete).
 */
export function generateDistractors(
  correctAnswer: string,
  _language: string,
  count: number,
  existingWords: string[]
): string[] {
  const normalizedCorrect = correctAnswer.toLowerCase().trim();

  // Filter candidates: must be different from correct answer
  const candidates = existingWords.filter(
    (w) => w.toLowerCase().trim() !== normalizedCorrect && w.trim().length > 0
  );

  if (candidates.length === 0) return [];

  // Shuffle using Fisher-Yates
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}
