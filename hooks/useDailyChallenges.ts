import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { useAppStore } from '../stores/useAppStore';
import { fetchDailyChallenges, upsertDailyChallenges, claimDailyChallengeBonus } from '../lib/supabase-queries';
import { localToday, localDayKey } from '../lib/dates';
import { pickDailyChallenges, getChallengeMultiplier } from '../lib/challenges';
import type { DailyChallenge, DailyChallengesRecord, DailyStats } from '../types';

export function useDailyChallenges() {
  const { user } = useAuth();
  const { dailyStats, profile, setProfile } = useAppStore();
  const [record, setRecord] = useState<DailyChallengesRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const claimInFlight = useRef(false);

  const [today, setToday] = useState(() => localToday());

  // Refresh when app comes to foreground (handles midnight rollover)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const now = localToday();
        setToday(prev => prev !== now ? now : prev);
      }
    });
    return () => sub.remove();
  }, []);

  // Load or create today's challenges
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        let existing = await fetchDailyChallenges(user.id, today);
        if (!existing) {
          // Carry the challenge streak across days — it continues only if
          // yesterday's bonus was claimed, otherwise it resets to 0. Without
          // this, every new day's row started at 0 and the streak multiplier
          // could never grow past 1x.
          let carriedStreak = 0;
          try {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            const yesterday = await fetchDailyChallenges(user.id, localDayKey(y));
            if (yesterday?.bonusXpClaimed) carriedStreak = yesterday.challengeStreak;
          } catch (err) {
            console.error('Failed to read yesterday\'s challenges:', err);
          }
          // Generate new challenges for today
          const templates = pickDailyChallenges(user.id, today);
          const challenges: DailyChallenge[] = templates.map((t) => ({
            ...t,
            current: 0,
            completed: false,
          }));
          existing = await upsertDailyChallenges(user.id, today, challenges, false, false, carriedStreak);
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
    // `record` must be a dep: on most app opens dailyStats resolves before
    // the challenges load, so keying on dailyStats alone leaves progress
    // stale until the next stat change. The JSON-equality guard above stops
    // the setRecord → re-run cycle from looping.
  }, [dailyStats, record]);

  const multiplier = getChallengeMultiplier(record?.challengeStreak ?? 0);

  const claimBonusXp = useCallback(async () => {
    if (!user || !record || record.bonusXpClaimed || !record.allCompleted) return 0;
    if (claimInFlight.current) return 0;
    claimInFlight.current = true;

    try {
      // Server-authoritative: the RPC validates completion + double-claim,
      // computes the streak multiplier, and grants the XP atomically
      // (migration 043). On failure it throws — local state stays unclaimed.
      const { bonusXp, totalXp } = await claimDailyChallengeBonus();
      setRecord({ ...record, bonusXpClaimed: true, challengeStreak: record.challengeStreak + 1 });
      // Guard against a null/zero RPC row: never replace displayed XP with 0.
      if (profile && totalXp > 0) {
        setProfile({ ...profile, totalXp });
      }
      return bonusXp;
    } finally {
      claimInFlight.current = false;
    }
  }, [user, record, profile, setProfile]);

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
