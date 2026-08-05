import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { fetchProficiencyEvidence } from '../lib/supabase-queries';
import { buildProficiencyReport, type ProficiencyReport } from '../lib/cefr-proficiency';

interface UseProficiencyReportReturn {
  report: ProficiencyReport | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Load the learner's evidence and derive their CEFR proficiency report.
 *
 * Errors surface to the UI with a retry rather than degrading to an empty
 * report — a blank report is indistinguishable from "you've learned nothing",
 * which is the worst possible thing to show someone on this particular screen.
 */
export function useProficiencyReport(): UseProficiencyReportReturn {
  const { user } = useAuth();
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
        setReport(buildProficiencyReport(evidence, new Date()));
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
  }, [user, reloadToken]);

  return { report, isLoading, error, refresh };
}
