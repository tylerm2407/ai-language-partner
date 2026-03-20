import { useState, useCallback } from 'react';
import { checkAIUsage, type AIUsageCheckResponse } from '../lib/ai';
import type { AIFeature } from '../types';

export function useAIUsage(userId: string) {
  const [usage, setUsage] = useState<AIUsageCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUsage = useCallback(async (feature?: AIFeature) => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkAIUsage(userId, feature);
      setUsage(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check usage');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /** Check if a specific feature is still allowed. */
  const isFeatureAllowed = useCallback((feature: AIFeature): boolean => {
    if (!usage) return true; // Optimistic — allow until we know otherwise
    const featureUsage = usage.usageSummary.find((u) => u.feature === feature);
    return featureUsage?.allowed ?? true;
  }, [usage]);

  /** Get usage ratio (0–1) for a specific feature. */
  const getUsageRatio = useCallback((feature: AIFeature): number => {
    if (!usage) return 0;
    const featureUsage = usage.usageSummary.find((u) => u.feature === feature);
    if (!featureUsage || featureUsage.limit === 'unlimited') return 0;
    return featureUsage.requestCount / featureUsage.limit;
  }, [usage]);

  return { usage, loading, error, refreshUsage, isFeatureAllowed, getUsageRatio };
}
