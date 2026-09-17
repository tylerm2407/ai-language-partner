/**
 * How far a learner is toward the NEXT CEFR band, as one number Home can draw
 * as a ring (canvas "Home · standard, variations", N3 · Ring, picked
 * 2026-09-11), plus the per-strand numbers behind it.
 *
 * The ring is the report's own arithmetic, not a second opinion about it.
 * `scoreBand` in `lib/cefr-proficiency.ts` produces the weighted score that
 * decides whether a band is held; this module renders that same score as a
 * fraction of the threshold it has to reach. Nothing here invents a scale, and
 * the two cannot drift apart — which is the whole reason the per-strand gates
 * live in the proficiency module rather than here, where they used to.
 *
 * What changed when the level became a weighted blend: the ring used to be the
 * mean of five equally-weighted strands, which matched the old rule that every
 * strand had to hold the band. Strands are no longer equal — conversation is
 * 0.55 of the score and vocabulary 0.12 — so an equal-weight ring would now
 * point learners at the cheapest strand in the model. `fraction` is the
 * weighted score over `BAND_THRESHOLD`, so a percentage point of ring is a
 * percentage point of the actual requirement.
 *
 * Two honesty rules, both kept from the equal-weight version:
 *   - `percent` is floored and never reaches 100 while a next band exists.
 *     Clearing the threshold on paper still leaves the confidence gate and the
 *     contiguity walk to the report, so "100%" would promise a promotion the
 *     report has not made.
 *   - At the top band there is no next band; the ring is full and `next` is
 *     null, and the caller says so instead of showing a percentage.
 */
import {
  BAND_THRESHOLD,
  CEFR_LADDER,
  SCORED_SKILLS,
  scoreBand,
  type BandScore,
  type CefrBand,
  type ProficiencyReport,
  type SkillKey,
} from './cefr-proficiency';

/** The slice of a report the ring needs. Narrow so tests can build it by hand. */
export type RingEvidence = Pick<ProficiencyReport, 'bands' | 'strands' | 'skills'>;

export interface StrandProgress {
  skill: SkillKey;
  /** 0–1 toward holding `next` in this strand. Exactly 1 when already held. */
  fraction: number;
  /** True when the strand is assessed at `next` or above. */
  met: boolean;
  /** This strand's share of the band score — `STRAND_WEIGHTS[skill]`. */
  weight: number;
  /**
   * `fraction * weight`: what this strand adds to the score out of the
   * `BAND_THRESHOLD` needed. The number that says where the work pays.
   */
  contribution: number;
}

export interface NextBandProgress {
  current: CefrBand;
  /** null at the top of the ladder. */
  next: CefrBand | null;
  /** 0–1. Exactly 1 only at the top band. */
  fraction: number;
  /** 0–99 while a next band exists; 100 at the top band. Floored, never rounded up. */
  percent: number;
  /** The raw weighted band score, 0–1, before it is scaled by the threshold. */
  score: number;
  /** One entry per scored strand, in `SCORED_SKILLS` order. Empty at the top band. */
  strands: StrandProgress[];
}

/**
 * THE ring for a report. Both Home's level card and the proficiency screen call
 * this rather than picking a target themselves.
 *
 * The target is always a fact about PRACTICE, because the ring measures the
 * weighted strand score and nothing else. Three cases:
 *
 *  - Practice has measured a level: the band after it. The ordinary case.
 *  - No practice level, but a TEST published one: progress toward proving that
 *    tested band. Not the band after it — the learner has proved no rung of the
 *    strand model, so pointing at the next band up would read "0% to B2" under
 *    a B1 badge, which is both wrong and demoralising. The honest claim is
 *    "your test says B1, your practice is n% of the way to confirming it".
 *  - Nothing at all: the band the report says to prove first (`nextLevel`),
 *    which for a placed learner is their entry band rather than A1.
 *
 * Returns null only when there is no target at all — a C2 practice level, or a
 * report with no evidence and no placement.
 */
export function ringForReport(report: ProficiencyReport): NextBandProgress | null {
  if (report.practiceLevel) return nextBandProgress(report.practiceLevel, report);
  const target = report.levelSource === 'test' ? report.overallLevel : report.nextLevel;
  if (!target) return null;
  return progressToward(target, target, report);
}

/**
 * Whether the ring's own band has been measured from practice.
 *
 * Drives the "Proving X" wording. It is NOT the same question as "does the
 * learner have a level" — a test-published level is a level, and it still has
 * every rung of the strand model left to prove.
 */
export function ringIsMeasured(report: ProficiencyReport): boolean {
  return report.practiceLevel !== null;
}

export function nextBandAfter(band: CefrBand): CefrBand | null {
  const i = CEFR_LADDER.indexOf(band);
  if (i < 0 || i === CEFR_LADDER.length - 1) return null;
  return CEFR_LADDER[i + 1];
}

/**
 * Progress toward the band after `current`. Pure.
 *
 * With no evidence for the target band the learner has not touched it: 0.
 */
export function nextBandProgress(current: CefrBand, evidence: RingEvidence): NextBandProgress {
  const next = nextBandAfter(current);
  if (!next) return { current, next: null, fraction: 1, percent: 100, score: 1, strands: [] };
  return progressToward(current, next, evidence);
}

/**
 * The same score measured against an explicit target band. This is what an
 * unmeasured, placed learner's ring shows: progress toward proving their entry
 * band (the report's `nextLevel`), rather than toward the band after the one
 * they have not proved yet.
 */
export function progressToward(
  current: CefrBand,
  next: CefrBand,
  evidence: RingEvidence,
): NextBandProgress {
  const scored = scoreBand(next, { bands: evidence.bands, strands: evidence.strands }, evidence.skills);
  return fromBandScore(current, scored);
}

/**
 * Render an already-computed band score as ring progress. Preferred when the
 * caller has a report in hand — `report.bandScores` already holds these, so
 * there is no reason to recompute and no way for the two to disagree.
 */
export function fromBandScore(current: CefrBand, scored: BandScore): NextBandProgress {
  const byKey = new Map(scored.strands.map((s) => [s.skill, s]));
  const strands: StrandProgress[] = SCORED_SKILLS.map((skill) => {
    const s = byKey.get(skill);
    return {
      skill,
      fraction: s?.gate ?? 0,
      met: (s?.gate ?? 0) >= 1,
      weight: s?.weight ?? 0,
      contribution: s?.contribution ?? 0,
    };
  });

  // Scaled by the threshold, not by 1: the learner is "done" at
  // BAND_THRESHOLD, so a ring that filled to 1.0 would under-report progress
  // by the 30 points of headroom nobody is required to earn.
  const fraction = Math.min(Math.max(scored.score / BAND_THRESHOLD, 0), 0.99);
  return {
    current,
    next: scored.band,
    fraction,
    percent: Math.min(99, Math.floor(fraction * 100)),
    score: scored.score,
    strands,
  };
}
