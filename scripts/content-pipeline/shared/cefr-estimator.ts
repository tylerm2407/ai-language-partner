export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/**
 * Estimate CEFR level from sentence complexity and vocabulary.
 *
 * Heuristic based on word count per sentence:
 *   < 5 words  → A1
 *   5-10       → A2
 *   10-15      → B1
 *   15-20      → B2
 *   20+        → C1
 *
 * For single sentences, uses total word count directly.
 * For longer texts, uses average sentence length with vocabulary richness.
 */
export function estimateCefrLevel(text: string, _language: string): CefrLevel {
  const sentences = text.split(/[.!?]+\s+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(sentences.length, 1);

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = Math.max(words.length, 1);

  // For single sentences, use total word count
  if (sentenceCount === 1) {
    if (wordCount < 5) return 'A1';
    if (wordCount < 10) return 'A2';
    if (wordCount < 15) return 'B1';
    if (wordCount < 20) return 'B2';
    return 'C1';
  }

  // For longer texts, combine avg sentence length with vocabulary richness
  const avgSentenceLength = wordCount / sentenceCount;

  const totalChars = words.reduce(
    (sum, w) =>
      sum +
      w.replace(
        /[^a-zA-ZÀ-ÿ\u0400-\u04ff\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
        ''
      ).length,
    0
  );
  const avgWordLength = totalChars / wordCount;

  const sampleWords = words
    .slice(0, 1000)
    .map((w) =>
      w
        .toLowerCase()
        .replace(
          /[^a-zA-ZÀ-ÿ\u0400-\u04ff\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
          ''
        )
    );
  const validSample = sampleWords.filter((w) => w.length > 0);
  const uniqueWords = new Set(validSample);
  const sampleSize = Math.max(validSample.length, 1);
  const typeTokenRatio = uniqueWords.size / sampleSize;

  let sentenceScore: number;
  if (avgSentenceLength < 5) sentenceScore = 0;
  else if (avgSentenceLength < 10) sentenceScore = 1;
  else if (avgSentenceLength < 15) sentenceScore = 2;
  else if (avgSentenceLength < 20) sentenceScore = 3;
  else sentenceScore = 4;

  let wordLengthScore: number;
  if (avgWordLength < 4) wordLengthScore = 0;
  else if (avgWordLength < 5) wordLengthScore = 1;
  else if (avgWordLength < 6) wordLengthScore = 2;
  else if (avgWordLength < 7) wordLengthScore = 3;
  else wordLengthScore = 4;

  let ttrScore: number;
  if (typeTokenRatio < 0.4) ttrScore = 0;
  else if (typeTokenRatio < 0.5) ttrScore = 1;
  else if (typeTokenRatio < 0.6) ttrScore = 2;
  else if (typeTokenRatio < 0.7) ttrScore = 3;
  else ttrScore = 4;

  const avgScore = (sentenceScore * 2 + wordLengthScore + ttrScore) / 4;

  if (avgScore < 0.5) return 'A1';
  if (avgScore < 1.5) return 'A2';
  if (avgScore < 2.0) return 'B1';
  if (avgScore < 2.75) return 'B2';
  if (avgScore < 3.5) return 'C1';
  return 'C2';
}
