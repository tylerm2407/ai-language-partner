import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { fetchProficiencyEvidence } from '../lib/supabase-queries';
import {
  buildProficiencyReport,
  normalizeBand,
  type ProficiencyReport,
} from '../lib/cefr-proficiency';

interface UseProficiencyReportReturn {
  report: ProficiencyReport | null;
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
 * Errors surface to the UI with a retry rather than degrading to an empty
 * report — a blank report is indistinguishable from "you've learned nothing",
 * which is the worst possible thing to show someone on this particular screen.
 */
export function useProficiencyReport(): UseProficiencyReportReturn {
  const { user } = useAuth();
  const placementBand = useAppStore((s) => normalizeBand(s.profile?.placementBand));
  const [report, setReport] = useState<ProficiencyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load(userId: string) {
      try {
        setIsLoading(true);
        setError(null);
        const evidence = await fetchProficiencyEvidence(userId);
        if (cancelled) return;
        setReport(buildProficiencyReport(evidence, new Date(), { placementBand }));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load your proficiency report');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load(user.id);
    return () => {
      cancelled = true;
    };
  }, [user, reloadToken, placementBand]);

  return { report, isLoading, error, refresh };
}
