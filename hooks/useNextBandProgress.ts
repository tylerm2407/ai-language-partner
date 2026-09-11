/**
 * The level ring's number, kept honest and reasonably fresh.
 *
 * Home's level card shows the learner's band and how far they are toward the
 * next one (N3 · Ring). Both come from the proficiency report: the band is
 * the MEASURED `overallLevel` when the report has one, falling back to the
 * profile's self-declared band only while there is not enough evidence to
 * assess; the ring is `nextBandProgress` over the report's band breakdown.
 *
 * "Live" here means: rebuilt from the database every time Home regains
 * focus, at most once a minute. The evidence query is four capped reads
 * (see `fetchProficiencyEvidence`), so a per-focus rebuild is affordable, and
 * a minute is shorter than any lesson — a learner who finishes a review and
 * comes back sees the ring move. Errors leave the last good value in place
 * and are reported so the card can say the number may be stale rather than
 * quietly showing 0.
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useProficiencyReport } from './useProficiencyReport';
import { nextBandProgress, type NextBandProgress } from '../lib/next-band-progress';
import type { CefrBand } from '../lib/cefr-proficiency';

/** Minimum gap between two focus-triggered rebuilds. */
export const REFRESH_MIN_MS = 60_000;

export interface NextBandState {
  /** The band to show: measured when assessed, else the profile's. */
  band: CefrBand;
  /** True when `band` is the report's assessment rather than the profile's claim. */
  measured: boolean;
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

  const band = report?.overallLevel ?? fallbackBand;
  const progress = report ? nextBandProgress(band, report.bands) : null;

  return {
    band,
    measured: report?.overallLevel != null,
    progress,
    loading: isLoading,
    error,
    refresh,
  };
}
