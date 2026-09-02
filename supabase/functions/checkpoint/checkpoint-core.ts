// Pure logic for the checkpoint: item selection, grading, and the composite.
// No Deno.env / serve(), so it is unit testable.

export const STRANDS = ['listening', 'reading', 'speaking', 'writing'] as const;
export type Strand = (typeof STRANDS)[number];

export const BANDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type Band = (typeof BANDS)[number];

/** Items per pool per (language, band, strand). Enough to rotate for a couple
 *  of years of monthly checkpoints without repeating. */
export const POOL_SIZE = 12;

/** Longest free-text answer accepted from a client. */
export const MAX_ANSWER_CHARS = 600;

export interface PoolItem {
  id: string;
  strand: Strand;
  prompt: string;
  audio_text: string | null;
  correct_answer: string | null;
  accepted_answers: string[];
  options: string[] | null;
}

/** What a client is allowed to see: no answer key, no audio source text. */
export interface ServedItem {
  id: string;
  strand: Strand;
  prompt: string;
  options: string[] | null;
}

export function serveItem(item: PoolItem): ServedItem {
  return {
    id: item.id,
    strand: item.strand,
    prompt: item.prompt,
    options: item.options,
  };
}

/**
 * Pick one item per strand, rotating deterministically on the attempt number.
 *
 * Deterministic rather than random so a learner cannot reroll into an easier
 * set by abandoning a checkpoint and starting again — the nth attempt always
 * gets the nth item. Independent per strand, so a missing strand does not
 * shift the others.
 */
export function selectItems(pool: PoolItem[], attemptNumber: number): PoolItem[] {
  const chosen: PoolItem[] = [];
  for (const strand of STRANDS) {
    const forStrand = pool
      .filter((i) => i.strand === strand)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (forStrand.length === 0) continue;
    chosen.push(forStrand[attemptNumber % forStrand.length]);
  }
  return chosen;
}

/**
 * Ligatures a learner cannot type without the right keyboard layout.
 *
 * NFD decomposition folds `ô` to `o`, but it does NOT decompose `œ` — and `œ`
 * is a letter, so it survives the punctuation strip too. Without this, a
 * French learner who types the standard `soeur` for `sœur` is marked wrong on
 * a LISTENING item, which is measuring whether they heard the word, not
 * whether they own a French keyboard. Caught by an end-to-end run that scored
 * a correct answer 0 and demoted the learner a band for it.
 */
const LIGATURES: [RegExp, string][] = [
  [/œ/g, 'oe'],
  [/æ/g, 'ae'],
  [/ß/g, 'ss'],
  [/ø/g, 'o'],
  [/đ/g, 'd'],
  [/ł/g, 'l'],
];

/** Fold case, accents, ligatures and surrounding punctuation before comparing. */
export function normalizeAnswer(text: string): string {
  let out = text.toLowerCase();
  for (const [pattern, replacement] of LIGATURES) out = out.replace(pattern, replacement);
  return out
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Is this answer right?
 *
 * Accent- and case-insensitive, because a checkpoint measures whether the
 * learner knows the word, not whether their keyboard has an é. Matches the
 * spirit of .claude/rules/learning.md's "exact match, case-insensitive,
 * accent-tolerant" for single-word answers — but with no fuzzy distance:
 * this is an assessment, and quietly accepting a near-miss inflates the band
 * that picks a leaderboard.
 */
export function isCorrect(given: string, item: PoolItem): boolean {
  const answer = normalizeAnswer(given);
  if (!answer) return false;
  const candidates = [item.correct_answer, ...item.accepted_answers].filter(
    (a): a is string => typeof a === 'string' && a.length > 0,
  );
  return candidates.some((c) => normalizeAnswer(c) === answer);
}

/**
 * The composite: the mean of the strands that were actually answered.
 *
 * Skipped strands are EXCLUDED rather than scored zero. A learner who could
 * not record audio on a noisy train has not demonstrated they cannot speak,
 * and scoring that as a zero would drop their band and their leaderboard
 * segment on the strength of a missing microphone permission.
 */
export function composite(scores: Partial<Record<Strand, number>>): number | null {
  const values = STRANDS.map((s) => scores[s]).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * The band a composite implies, relative to the band the checkpoint was SET at.
 *
 * The instrument is calibrated to one band, so a score is evidence about THAT
 * band rather than an absolute placement: doing well at A2 items says you are
 * at least A2, not that you are C1. Movement is capped at one band per
 * checkpoint in each direction — a single five-minute instrument is not
 * strong enough evidence to move someone two bands, and a monthly cadence
 * means a genuinely misplaced learner converges within a couple of months.
 */
export const PROMOTE_AT = 0.85;
export const DEMOTE_BELOW = 0.4;

export function bandFromComposite(setBand: Band, value: number | null): Band {
  if (value === null) return setBand;
  const i = BANDS.indexOf(setBand);
  if (value >= PROMOTE_AT && i < BANDS.length - 1) return BANDS[i + 1];
  if (value < DEMOTE_BELOW && i > 0) return BANDS[i - 1];
  return setBand;
}

/**
 * A pseudonymous cohort alias.
 *
 * Derived from the user id so it is stable across sessions without storing
 * anything identifying, and drawn from a small neutral word list — an alias
 * that accidentally reads as a judgement ("Slow Otter") is worse than a number.
 */
const ALIAS_ADJECTIVES = [
  'Quiet', 'Bright', 'Steady', 'Curious', 'Patient', 'Keen', 'Calm', 'Bold',
  'Gentle', 'Swift', 'Careful', 'Warm',
];
const ALIAS_NOUNS = [
  'Heron', 'Fox', 'Otter', 'Sparrow', 'Willow', 'Cedar', 'Falcon', 'Marten',
  'Ibis', 'Lynx', 'Hazel', 'Wren',
];

export function aliasFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const adjective = ALIAS_ADJECTIVES[hash % ALIAS_ADJECTIVES.length];
  const noun = ALIAS_NOUNS[Math.floor(hash / ALIAS_ADJECTIVES.length) % ALIAS_NOUNS.length];
  return `${adjective} ${noun}`;
}

/** Learners per cohort. Small enough that a rank means something and that
 *  being last is not humiliating. */
export const COHORT_TARGET_SIZE = 30;
