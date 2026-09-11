/**
 * How far a learner is toward the NEXT CEFR band, as one number Home can draw
 * as a ring (canvas "Home · standard, variations", N3 · Ring, picked
 * 2026-09-11).
 *
 * The number is derived from the same evidence and the same thresholds that
 * gate the band in `lib/cefr-proficiency.ts` — nothing here invents a scale.
 * A band counts as reached on vocabulary when three things are true of it:
 * enough of its items have been seen (`MIN_ITEMS_PER_BAND`), enough have
 * matured into long intervals (`MIN_MATURE_ITEMS_PER_BAND`), and enough of
 * the mature ones are retained (`MASTERY_RATE`). Each gate contributes a third,
 * capped at full, so the ring moves for every kind of work the requirement
 * text asks for and stalls when only one kind is happening.
 *
 * Two honesty rules:
 *   - `percent` is floored and never reaches 100 while the learner is still
 *     in the current band. Vocabulary is the leading gate, not the whole
 *     assessment (reading and writing evidence confirm a band), so "100%"
 *     would promise a promotion the report has not made.
 *   - At the top band there is no next band; the ring is full and `next` is
 *     null, and the caller says so instead of showing a percentage.
 */
import {
  CEFR_LADDER,
  MASTERY_RATE,
  MIN_ITEMS_PER_BAND,
  MIN_MATURE_ITEMS_PER_BAND,
  type BandBreakdown,
  type CefrBand,
} from './cefr-proficiency';

export interface NextBandProgress {
  current: CefrBand;
  /** null at the top of the ladder. */
  next: CefrBand | null;
  /** 0–1. Exactly 1 only at the top band. */
  fraction: number;
  /** 0–99 while a next band exists; 100 at the top band. Floored, never rounded up. */
  percent: number;
}

export function nextBandAfter(band: CefrBand): CefrBand | null {
  const i = CEFR_LADDER.indexOf(band);
  if (i < 0 || i === CEFR_LADDER.length - 1) return null;
  return CEFR_LADDER[i + 1];
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * The fraction of the next band's three vocabulary gates that are met. Pure.
 *
 * With no breakdown for the target band the learner has not touched it: 0.
 */
export function nextBandProgress(current: CefrBand, bands: readonly BandBreakdown[]): NextBandProgress {
  const next = nextBandAfter(current);
  if (!next) return { current, next: null, fraction: 1, percent: 100 };

  const target = bands.find((b) => b.band === next);
  if (!target) return { current, next, fraction: 0, percent: 0 };

  const seenGate = clamp01(target.seen / MIN_ITEMS_PER_BAND);
  const matureGate = clamp01(target.mature / MIN_MATURE_ITEMS_PER_BAND);
  // The retention gate is measured against the mature set, as the band rule
  // is. Nothing mature yet means nothing can be retained yet.
  const retainNeeded = Math.ceil(target.mature * MASTERY_RATE);
  const retainGate = retainNeeded > 0 ? clamp01(target.retained / retainNeeded) : 0;

  const fraction = clamp01((seenGate + matureGate + retainGate) / 3);
  const percent = Math.min(99, Math.floor(fraction * 100));
  return { current, next, fraction: Math.min(fraction, 0.99), percent };
}
