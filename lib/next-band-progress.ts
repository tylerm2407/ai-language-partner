/**
 * How far a learner is toward the NEXT CEFR band, as one number Home can draw
 * as a ring (canvas "Home · standard, variations", N3 · Ring, picked
 * 2026-09-11), plus the per-strand numbers behind it.
 *
 * The ring blends all five scored strands — vocabulary, reading, writing,
 * listening, speaking — because the report grants a band only when every one
 * of them holds it (`overallFromSkills`). Each strand contributes an equal
 * fifth, measured against the same thresholds that gate the band in
 * `lib/cefr-proficiency.ts`; nothing here invents a scale. A strand already
 * assessed at or above the target counts as complete, so finished work never
 * reads as unfinished, and the ring moves for every kind of work the
 * requirement text asks for while stalling when only one kind is happening.
 *
 * Per-strand gates, each 0–1:
 *   - vocabulary: a third each for items seen, items matured, items retained
 *     (the three conditions `analyzeBands` needs before a band is mastered).
 *   - reading: pieces understood at the pass mark over the minimum count.
 *   - writing, speaking: half for volume (graded pieces / scored attempts
 *     over the minimum), half for quality (mean over the pass score).
 *   - listening: half volume, half first-try accuracy over the pass rate.
 *
 * Two honesty rules:
 *   - `percent` is floored and never reaches 100 while a next band exists.
 *     Every gate met on paper still leaves the confidence gate and the
 *     contiguity walk to the report, so "100%" would promise a promotion the
 *     report has not made.
 *   - At the top band there is no next band; the ring is full and `next` is
 *     null, and the caller says so instead of showing a percentage.
 */
import {
  CEFR_LADDER,
  LISTENING_PASS_RATE,
  MASTERY_RATE,
  MIN_ITEMS_PER_BAND,
  MIN_LISTENING_ITEMS,
  MIN_MATURE_ITEMS_PER_BAND,
  MIN_READING_ITEMS,
  MIN_SPEAKING_ITEMS,
  MIN_WRITING_ITEMS,
  SCORED_SKILLS,
  SPEAKING_PASS_SCORE,
  WRITING_PASS_SCORE,
  type BandBreakdown,
  type CefrBand,
  type ProficiencyReport,
  type SkillAssessment,
  type SkillKey,
  type StrandBreakdown,
} from './cefr-proficiency';

/** The slice of a report the ring needs. Narrow so tests can build it by hand. */
export type RingEvidence = Pick<ProficiencyReport, 'bands' | 'strands' | 'skills'>;

export interface StrandProgress {
  skill: SkillKey;
  /** 0–1 toward holding `next` in this strand. Exactly 1 when already held. */
  fraction: number;
  /** True when the strand is assessed at `next` or above. */
  met: boolean;
}

export interface NextBandProgress {
  current: CefrBand;
  /** null at the top of the ladder. */
  next: CefrBand | null;
  /** 0–1. Exactly 1 only at the top band. */
  fraction: number;
  /** 0–99 while a next band exists; 100 at the top band. Floored, never rounded up. */
  percent: number;
  /** One entry per scored strand, in `SCORED_SKILLS` order. Empty at the top band. */
  strands: StrandProgress[];
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
 * Progress toward the band after `current`. Pure.
 *
 * With no evidence for the target band the learner has not touched it: 0.
 */
export function nextBandProgress(current: CefrBand, evidence: RingEvidence): NextBandProgress {
  const next = nextBandAfter(current);
  if (!next) return { current, next: null, fraction: 1, percent: 100, strands: [] };
  return progressToward(current, next, evidence);
}

/**
 * The same five gates measured against an explicit target band. This is what
 * an unmeasured, placed learner's ring shows: progress toward proving their
 * entry band (the report's `nextLevel`), rather than toward the band after the
 * one they have not proved yet.
 */
export function progressToward(current: CefrBand, next: CefrBand, evidence: RingEvidence): NextBandProgress {
  const strands = SCORED_SKILLS.map((skill) => strandProgress(skill, next, evidence));
  const mean = strands.reduce((sum, s) => sum + s.fraction, 0) / strands.length;
  const fraction = Math.min(clamp01(mean), 0.99);
  const percent = Math.min(99, Math.floor(fraction * 100));
  return { current, next, fraction, percent, strands };
}

function strandProgress(skill: SkillKey, next: CefrBand, evidence: RingEvidence): StrandProgress {
  if (skillHolds(evidence.skills, skill, next)) return { skill, fraction: 1, met: true };
  const fraction =
    skill === 'vocabulary'
      ? vocabularyGate(next, evidence.bands)
      : strandGate(evidence.strands.find((s) => s.skill === skill), next);
  return { skill, fraction: clamp01(fraction), met: false };
}

function skillHolds(skills: SkillAssessment[], key: SkillKey, target: CefrBand): boolean {
  const skill = skills.find((s) => s.skill === key);
  return (
    !!skill &&
    skill.status === 'assessed' &&
    !!skill.level &&
    CEFR_LADDER.indexOf(skill.level) >= CEFR_LADDER.indexOf(target)
  );
}

/** The three vocabulary gates, a third each, each capped at full. */
function vocabularyGate(next: CefrBand, bands: readonly BandBreakdown[]): number {
  const target = bands.find((b) => b.band === next);
  if (!target) return 0;
  const seenGate = clamp01(target.seen / MIN_ITEMS_PER_BAND);
  const matureGate = clamp01(target.mature / MIN_MATURE_ITEMS_PER_BAND);
  // The retention gate is measured against the mature set, as the band rule
  // is. Nothing mature yet means nothing can be retained yet.
  const retainNeeded = Math.ceil(target.mature * MASTERY_RATE);
  const retainGate = retainNeeded > 0 ? clamp01(target.retained / retainNeeded) : 0;
  return (seenGate + matureGate + retainGate) / 3;
}

/**
 * Volume and quality, half each, for the four non-vocabulary strands. Reading
 * is the exception: its band rule counts passed pieces rather than a mean, so
 * its gate is the passed count alone — a piece that failed comprehension is
 * not partial progress toward "understood three texts".
 */
function strandGate(strand: StrandBreakdown | undefined, next: CefrBand): number {
  if (!strand) return 0;
  const at = strand.bands.find((b) => b.band === next);
  if (!at || at.total === 0) return 0;
  switch (strand.skill) {
    case 'reading':
      return clamp01(at.passed / MIN_READING_ITEMS);
    case 'writing':
      return 0.5 * clamp01(at.total / MIN_WRITING_ITEMS) + 0.5 * clamp01(at.mean / WRITING_PASS_SCORE);
    case 'speaking':
      return 0.5 * clamp01(at.total / MIN_SPEAKING_ITEMS) + 0.5 * clamp01(at.mean / SPEAKING_PASS_SCORE);
    case 'listening':
      return 0.5 * clamp01(at.total / MIN_LISTENING_ITEMS) + 0.5 * clamp01(at.mean / LISTENING_PASS_RATE);
  }
}
