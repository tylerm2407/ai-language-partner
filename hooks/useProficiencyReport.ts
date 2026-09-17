import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import {
  fetchLatestCheckpoint,
  fetchLevelHistory,
  fetchProficiencyEvidence,
} from '../lib/supabase-queries';
import {
  buildProficiencyReport,
  normalizeBand,
  type ProficiencyReport,
} from '../lib/cefr-proficiency';
import type { LevelHistoryEntry } from '../types';

interface UseProficiencyReportReturn {
  report: ProficiencyReport | null;
  /**
   * Recorded band changes for this language, newest first.
   *
   * Separate from `report` because it is persisted fact rather than derived
   * estimate: the report is recomputed from evidence on every load, and this is
   * the only thing on the screen that can answer "am I moving?" — see migration
   * 143 for why a snapshot-per-visit would have answered nothing.
   */
  history: LevelHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Load the learner's evidence and derive their CEFR proficiency report.
 *
 * The report takes the profile's placement band (migration 125) so that a
 * learner whose lessons started at B1 is assessed from B1 up rather than being
 * told to review A1 words forever — see `highestContiguousBand`. Home and the
 * profile screen both read this hook, so they agree by construction.
 *
 * Evidence is fetched for the profile's CURRENT target language only. The
 * report used to pool every language the learner had ever touched; switching
 * from Spanish to French then either inherited a Spanish level or dragged it
 * down with French beginner cards. Changing language now rebuilds the report.
 *
 * After every build the measured band is mirrored into the app store
 * (`measuredBand`), null when nothing is measured, so chat and the tutor can
 * pitch at the learner's real level without a second evidence fetch. That band
 * may now come from the learner's level test rather than from practice — see
 * `ProficiencyReportOptions.checkpointBand` — which is exactly what should
 * happen: a tested B1 who has practised nothing should be spoken to at B1, not
 * at the A1 default an unmeasured learner used to get.
 *
 * Errors surface to the UI with a retry rather than degrading to an empty
 * report — a blank report is indistinguishable from "you've learned nothing",
 * which is the worst possible thing to show someone on this particular screen.
 */
export function useProficiencyReport(): UseProficiencyReportReturn {
  const { user } = useAuth();
  const placementBand = useAppStore((s) => normalizeBand(s.profile?.placementBand));
  const targetLanguage = useAppStore((s) => s.profile?.targetLanguage ?? null);
  const setMeasuredBand = useAppStore((s) => s.setMeasuredBand);
  const [report, setReport] = useState<ProficiencyReport | null>(null);
  const [history, setHistory] = useState<LevelHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    // No profile yet means no language to scope evidence to; the store loads
    // the profile right after sign-in, and this effect re-runs on it.
    if (!user || !targetLanguage) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load(userId: string, language: string) {
      try {
        setIsLoading(true);
        setError(null);
        // The checkpoint and the history are fetched alongside the evidence, not
        // after it: the tested band is an INPUT to the report (it publishes the
        // level when practice has measured none), so sequencing it second would
        // render an unassessed hero for a learner who has taken the test.
        const [evidence, checkpoint, entries] = await Promise.all([
          fetchProficiencyEvidence(userId, language),
          fetchLatestCheckpoint(userId, language),
          fetchLevelHistory(userId, language),
        ]);
        if (cancelled) return;
        const built = buildProficiencyReport(evidence, new Date(), {
          placementBand,
          checkpointBand: normalizeBand(checkpoint?.band),
        });
        setReport(built);
        setHistory(entries);
        setMeasuredBand(built.overallLevel);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load your proficiency report');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load(user.id, targetLanguage);
    return () => {
      cancelled = true;
    };
  }, [user, reloadToken, placementBand, targetLanguage, setMeasuredBand]);

  return { report, history, isLoading, error, refresh };
}
