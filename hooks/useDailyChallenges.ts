import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { fetchDailyChallenges, upsertDailyChallenges } from '../lib/supabase-queries';
import { pickDailyChallenges, getChallengeMultiplier } from '../lib/challenges';
import type { DailyChallenge, DailyChallengesRecord, DailyStats } from '../types';

export function useDailyChallenges() {
  const { user } = useAuth();
  const { dailyStats } = useAppStore();
  const [record, setRecord] = useState<DailyChallengesRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  // Load or create today's challenges
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        let existing = await fetchDailyChallenges(user.id, today);
        if (!existing) {
          // Generate new challenges for today
          const templates = pickDailyChallenges(user.id, today);
          const challenges: DailyChallenge[] = templates.map((t) => ({
            ...t,
            current: 0,
            completed: false,
          }));
          existing = await upsertDailyChallenges(user.id, today, challenges, false, false, 0);
        }
        setRecord(existing);
      } catch (err) {
        console.error('Failed to load daily challenges:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, today]);

  // Update progress when daily stats change
  useEffect(() => {
    if (!record || !dailyStats) return;

    const updatedChallenges = record.challenges.map((challenge) => {
      const statValue = dailyStats[challenge.statKey as keyof DailyStats] as number ?? 0;
      return {
        ...challenge,
        current: statValue,
        completed: statValue >= challenge.target,
      };
    });

    const allCompleted = updatedChallenges.every((c) => c.completed);

    if (JSON.stringify(updatedChallenges) !== JSON.stringify(record.challenges) || allCompleted !== record.allCompleted) {
      setRecord({ ...record, challenges: updatedChallenges, allCompleted });

      // Persist to DB
      if (user) {
        upsertDailyChallenges(
          user.id,
          today,
          updatedChallenges,
          allCompleted,
          record.bonusXpClaimed,
          record.challengeStreak
        ).catch(console.error);
      }
    }
  }, [dailyStats]);

  const multiplier = getChallengeMultiplier(record?.challengeStreak ?? 0);

  const claimBonusXp = useCallback(async () => {
    if (!user || !record || record.bonusXpClaimed || !record.allCompleted) return 0;

    const bonusXp = Math.round(50 * multiplier);
    const newStreak = record.challengeStreak + 1;

    await upsertDailyChallenges(user.id, today, record.challenges, true, true, newStreak);
    setRecord({ ...record, bonusXpClaimed: true, challengeStreak: newStreak });

    return bonusXp;
  }, [user, record, multiplier, today]);

  return {
    challenges: record?.challenges ?? [],
    allCompleted: record?.allCompleted ?? false,
    bonusXpClaimed: record?.bonusXpClaimed ?? false,
    challengeStreak: record?.challengeStreak ?? 0,
    multiplier,
    loading,
    claimBonusXp,
  };
}
