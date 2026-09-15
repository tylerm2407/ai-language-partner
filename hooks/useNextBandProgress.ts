/**
 * The level ring's number, kept honest and reasonably fresh.
 *
 * Home's level card shows the learner's band and how far they are toward the
 * next one (N3 · Ring). Both come from the proficiency report: the band is
 * the MEASURED `overallLevel` when the report has one, falling back to the
 * profile's band only while there is not enough evidence to assess at or
 * above the learner's entry band; the ring is `progressToward` over the
 * report's five strands.
 *
 * Which band the ring points at depends on that same distinction. Measured,
 * it is the band after the measured level. Unmeasured, it is the band the
 * report says the learner has to prove next (`report.nextLevel`) — for a
 * learner placed at B1 that is B1 itself, not "B2", which is what the ring
 * used to show while they were still proving their entry band. The card
 * renders that case as "Proving B1", never as "B1 · n% to B1".
 *
 * "Live" here means: rebuilt from the database every time Home regains
 * focus, at most once a minute. The evidence query is nine capped reads
 * (see `fetchProficiencyEvidence`), so a per-focus rebuild is affordable, and
 * a minute is shorter than any lesson — a learner who finishes a review and
 * comes back sees the ring move. Errors leave the last good value in place
 * and are reported so the card can say the number may be stale rather than
 * quietly showing 0.
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useProficiencyReport } from './useProficiencyReport';
import { nextBandProgress, progressToward, type NextBandProgress } from '../lib/next-band-progress';
import type { CefrBand, SkillKey } from '../lib/cefr-proficiency';

/** Minimum gap between two focus-triggered rebuilds. */
export const REFRESH_MIN_MS = 60_000;

export interface NextBandState {
  /** The band to show: measured when assessed, else the profile's. */
  band: CefrBand;
  /** True when `band` is the report's assessment rather than the profile's claim. */
  measured: boolean;
  /**
   * One line disclosing which rungs under `band` were assumed from the
   * learner's placement rather than measured. Null when none were, so the UI
   * can render it unconditionally.
   */
  basis: string | null;
  assumedBands: CefrBand[];
  /** Scored strands with no level yet; what "not yet measured" is waiting on. */
  missingSkills: SkillKey[];
  /** One line per piece of work still between the learner and `progress.next`. */
  steps: string[];
  /** null until the first report has loaded. */
  progress: NextBandProgress | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useNextBandProgress(fallbackBand: CefrBand): NextBandState {
  const { report, isLoading, error, refresh } = useProficiencyReport();
  const lastRefresh = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      // The hook loads once on mount; skip the focus that mounts it.
      if (lastRefresh.current === 0) {
        lastRefresh.current = now;
        return;
      }
      if (now - lastRefresh.current < REFRESH_MIN_MS) return;
      lastRefresh.current = now;
      refresh();
    }, [refresh]),
  );

  const measured = report?.overallLevel != null;
  const band = report?.overallLevel ?? fallbackBand;
  let progress: NextBandProgress | null = null;
  if (report) {
    progress =
      !measured && report.nextLevel
        ? progressToward(band, report.nextLevel, report)
        : nextBandProgress(band, report);
  }

  return {
    band,
    measured,
    basis: report?.levelBasis ?? null,
    assumedBands: report?.assumedBands ?? [],
    missingSkills: report?.missingSkills ?? [],
    steps: report?.nextLevelSteps ?? [],
    progress,
    loading: isLoading,
    error,
    refresh,
  };
}
