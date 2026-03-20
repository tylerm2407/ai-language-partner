import { useState, useEffect, useCallback } from 'react';
import { fetchScenarios } from '../lib/supabase-queries';
import type { Scenario, ScenarioCategory, ProficiencyLevel } from '../types';

interface UseScenariosReturn {
  scenarios: Scenario[];
  isLoading: boolean;
  error: string | null;
  filterByCategory: (category: ScenarioCategory) => void;
  filterByDifficulty: (difficulty: ProficiencyLevel) => void;
}

export function useScenarios(languageId: string): UseScenariosReturn {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScenarios = useCallback(
    async (category?: string, difficulty?: string) => {
      if (!languageId) {
        setScenarios([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchScenarios(languageId, category, difficulty);
        setScenarios(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load scenarios');
      } finally {
        setIsLoading(false);
      }
    },
    [languageId]
  );

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const filterByCategory = useCallback(
    (category: ScenarioCategory) => {
      loadScenarios(category, undefined);
    },
    [loadScenarios]
  );

  const filterByDifficulty = useCallback(
    (difficulty: ProficiencyLevel) => {
      loadScenarios(undefined, difficulty);
    },
    [loadScenarios]
  );

  return { scenarios, isLoading, error, filterByCategory, filterByDifficulty };
}
