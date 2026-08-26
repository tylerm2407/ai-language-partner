// Pure scoring helpers for the score-pronunciation edge function.
// No Deno.env / serve() / network so they can be unit tested
// (see score-pronunciation.test.ts).

export interface PronunciationScore {
  score: number;
  feedback: string;
  phonemeErrors: string[];
  matchedVariant: string | null;
}

/**
 * Compare transcription against expected text and accepted variants,
 * generate a score.
 *
 * Variant selection is deterministic: highest similarity wins; on a tie
 * the earliest variant in [expectedText, ...acceptedVariants] order wins
 * (strict `>` never replaces an equal-scoring earlier variant).
 * `matchedVariant` is null when the best match is the expected text
 * itself (i.e. no alternate variant was needed).
 */
export function calculatePronunciationScore(
  transcription: string,
  expectedText: string,
  acceptedVariants: string[]
): PronunciationScore {
  const normalizedTranscription = transcription.toLowerCase().trim();
  const normalizedExpected = expectedText.toLowerCase().trim();

  // Check all variants (expected text + accepted variants) for the best match
  const allVariants = [normalizedExpected, ...acceptedVariants.map(v => v.toLowerCase().trim())];

  let best: { score: number; phonemeErrors: string[]; variant: string } | null = null;

  for (const variant of allVariants) {
    const expectedWords = variant.split(/\s+/);
    const transcribedWords = normalizedTranscription.split(/\s+/);
    const phonemeErrors: string[] = [];

    let matchCount = 0;
    for (let i = 0; i < expectedWords.length; i++) {
      const expected = expectedWords[i];
      const transcribed = transcribedWords[i] ?? '';

      if (expected === transcribed) {
        matchCount++;
      } else if (levenshteinDistance(expected, transcribed) <= 2) {
        matchCount += 0.7; // partial credit for close pronunciation
        phonemeErrors.push(`"${expected}" heard as "${transcribed}"`);
      } else {
        phonemeErrors.push(`"${expected}" not recognized`);
      }
    }

    const variantScore = Math.round((matchCount / Math.max(expectedWords.length, 1)) * 100);

    // First variant seeds `best` (so a 0-score attempt still reports the
    // expected text's phoneme errors); after that only a strictly better
    // score replaces it — ties keep the earlier variant.
    if (best === null || variantScore > best.score) {
      best = { score: variantScore, phonemeErrors, variant };
    }
  }

  // allVariants always contains at least normalizedExpected, so best is set.
  const { score, phonemeErrors, variant } = best!;
  const matchedVariant = variant !== normalizedExpected ? variant : null;

  let feedback: string;
  if (score >= 90) feedback = 'Excellent pronunciation!';
  else if (score >= 75) feedback = 'Good job! A few sounds need work.';
  // A score in [60, 75) is a PASS (see index.ts), and the learner is shown a
  // plain "Sounded right". Prose that reads like a failure under a pass label
  // is the one thing this band must not do.
  else if (score >= 60) feedback = 'That works. A couple of sounds could be crisper.';
  else feedback = 'Needs improvement. Try listening to the audio again and repeat slowly.';

  return { score, feedback, phonemeErrors, matchedVariant };
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
