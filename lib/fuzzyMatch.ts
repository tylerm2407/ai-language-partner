/**
 * Accent-tolerant, punctuation-insensitive string comparison used by the
 * correction banner's "Try Again" mini-drill. Accepts small typos.
 */

export function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    // Strip combining diacritics (é → e, ñ → n, etc.)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Strip non-letter / non-digit / non-whitespace
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein edit distance — O(m*n) time, O(n) space.
 * Returns Infinity if either input is longer than 256 chars (guardrail).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a.length > 256 || b.length > 256) return Number.POSITIVE_INFINITY;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Returns true if `attempt` matches `expected` after normalization, with a
 * Levenshtein tolerance that scales with expected length:
 *   ≤ 8 chars:  distance ≤ 1
 *   9–20 chars: distance ≤ 2
 *   > 20 chars: distance ≤ 3
 */
export function isClose(attempt: string, expected: string): boolean {
  const a = normalizeForCompare(attempt);
  const b = normalizeForCompare(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const tolerance = b.length <= 8 ? 1 : b.length <= 20 ? 2 : 3;
  return levenshtein(a, b) <= tolerance;
}
