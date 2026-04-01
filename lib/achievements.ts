import { supabase } from './supabase';
import type { UserProfile, DailyStats } from '../types';

// ─── Achievement Types ──────────────────────────────────────────

export type AchievementType =
  | 'first_lesson'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'xp_100'
  | 'xp_500'
  | 'xp_1000'
  | 'xp_5000'
  | 'first_chat'
  | 'perfect_lesson'
  | 'cards_50'
  | 'cards_100'
  | 'first_review'
  | 'first_story'
  | 'bookworm_5'
  | 'bookworm_25'
  | 'first_essay'
  | 'writer_10'
  | 'perfect_essay';

export interface AchievementDefinition {
  type: AchievementType;
  title: string;
  description: string;
  icon: string; // Ionicons name
  color: string;
}

export interface EarnedAchievement {
  id: string;
  userId: string;
  type: AchievementType;
  earnedAt: string;
}

// ─── Achievement Definitions ────────────────────────────────────

export const ACHIEVEMENTS: Record<AchievementType, AchievementDefinition> = {
  first_lesson: {
    type: 'first_lesson',
    title: 'First Steps',
    description: 'Complete your first lesson',
    icon: 'book',
    color: '#38BDF8',
  },
  streak_3: {
    type: 'streak_3',
    title: 'Getting Started',
    description: 'Reach a 3-day streak',
    icon: 'flame',
    color: '#FBBF24',
  },
  streak_7: {
    type: 'streak_7',
    title: 'Week Warrior',
    description: 'Reach a 7-day streak',
    icon: 'flame',
    color: '#F97316',
  },
  streak_30: {
    type: 'streak_30',
    title: 'Monthly Master',
    description: 'Reach a 30-day streak',
    icon: 'flame',
    color: '#EF4444',
  },
  streak_100: {
    type: 'streak_100',
    title: 'Unstoppable',
    description: 'Reach a 100-day streak',
    icon: 'flame',
    color: '#DC2626',
  },
  xp_100: {
    type: 'xp_100',
    title: 'XP Hunter',
    description: 'Earn 100 total XP',
    icon: 'star',
    color: '#38BDF8',
  },
  xp_500: {
    type: 'xp_500',
    title: 'XP Collector',
    description: 'Earn 500 total XP',
    icon: 'star',
    color: '#A78BFA',
  },
  xp_1000: {
    type: 'xp_1000',
    title: 'XP Master',
    description: 'Earn 1,000 total XP',
    icon: 'star',
    color: '#38BDF8',
  },
  xp_5000: {
    type: 'xp_5000',
    title: 'XP Legend',
    description: 'Earn 5,000 total XP',
    icon: 'trophy',
    color: '#FBBF24',
  },
  first_chat: {
    type: 'first_chat',
    title: 'Conversation Starter',
    description: 'Have your first AI conversation',
    icon: 'chatbubbles',
    color: '#60A5FA',
  },
  perfect_lesson: {
    type: 'perfect_lesson',
    title: 'Perfectionist',
    description: 'Complete a lesson with 100% accuracy',
    icon: 'checkmark-circle',
    color: '#34D399',
  },
  cards_50: {
    type: 'cards_50',
    title: 'Card Apprentice',
    description: 'Review 50 flashcards',
    icon: 'layers',
    color: '#38BDF8',
  },
  cards_100: {
    type: 'cards_100',
    title: 'Card Master',
    description: 'Review 100 flashcards',
    icon: 'layers',
    color: '#A78BFA',
  },
  first_review: {
    type: 'first_review',
    title: 'Memory Lane',
    description: 'Complete your first review session',
    icon: 'refresh',
    color: '#34D399',
  },
  first_story: {
    type: 'first_story',
    title: 'Page Turner',
    description: 'Read your first story or book',
    icon: 'book',
    color: '#38BDF8',
  },
  bookworm_5: {
    type: 'bookworm_5',
    title: 'Bookworm',
    description: 'Complete 5 books or stories',
    icon: 'library',
    color: '#A78BFA',
  },
  bookworm_25: {
    type: 'bookworm_25',
    title: 'Library Legend',
    description: 'Complete 25 books or stories',
    icon: 'library',
    color: '#FBBF24',
  },
  first_essay: {
    type: 'first_essay',
    title: 'Pen to Paper',
    description: 'Submit your first writing exercise',
    icon: 'create',
    color: '#60A5FA',
  },
  writer_10: {
    type: 'writer_10',
    title: 'Prolific Writer',
    description: 'Complete 10 writing exercises',
    icon: 'create',
    color: '#A78BFA',
  },
  perfect_essay: {
    type: 'perfect_essay',
    title: 'Wordsmith',
    description: 'Score 90+ on a writing submission',
    icon: 'ribbon',
    color: '#FBBF24',
  },
};

// ─── Achievement Checking ───────────────────────────────────────

interface AchievementCondition {
  type: AchievementType;
  check: (profile: UserProfile, dailyStats: DailyStats | null) => boolean;
}

const ACHIEVEMENT_CONDITIONS: AchievementCondition[] = [
  {
    type: 'first_lesson',
    check: (_profile, stats) => (stats?.lessonsCompleted ?? 0) >= 1,
  },
  {
    type: 'streak_3',
    check: (profile) => profile.streak >= 3,
  },
  {
    type: 'streak_7',
    check: (profile) => profile.streak >= 7,
  },
  {
    type: 'streak_30',
    check: (profile) => profile.streak >= 30,
  },
  {
    type: 'streak_100',
    check: (profile) => profile.streak >= 100,
  },
  {
    type: 'xp_100',
    check: (profile) => profile.totalXp >= 100,
  },
  {
    type: 'xp_500',
    check: (profile) => profile.totalXp >= 500,
  },
  {
    type: 'xp_1000',
    check: (profile) => profile.totalXp >= 1000,
  },
  {
    type: 'xp_5000',
    check: (profile) => profile.totalXp >= 5000,
  },
  {
    type: 'perfect_lesson',
    check: (_profile, stats) => (stats?.accuracy ?? 0) >= 1 && (stats?.lessonsCompleted ?? 0) >= 1,
  },
  {
    type: 'cards_50',
    check: (_profile, stats) => (stats?.cardsReviewed ?? 0) >= 50,
  },
  {
    type: 'cards_100',
    check: (_profile, stats) => (stats?.cardsReviewed ?? 0) >= 100,
  },
  {
    type: 'first_review',
    check: (_profile, stats) => (stats?.cardsReviewed ?? 0) >= 1,
  },
  // Reading/writing achievements are checked via separate queries below
];

/**
 * Checks all achievement conditions and inserts newly earned achievements.
 * Returns an array of newly earned achievement types.
 */
export async function checkAndAwardAchievements(
  userId: string,
  profile: UserProfile,
  dailyStats: DailyStats | null
): Promise<AchievementDefinition[]> {
  // Fetch already-earned achievements
  const { data: existing, error: fetchError } = await supabase
    .from('achievements')
    .select('type')
    .eq('user_id', userId);

  if (fetchError) {
    console.error('Failed to fetch existing achievements:', fetchError.message);
    return [];
  }

  const earnedTypes = new Set((existing ?? []).map((a: { type: string }) => a.type));
  const newlyEarned: AchievementDefinition[] = [];

  // Check basic conditions (profile + stats based)
  for (const condition of ACHIEVEMENT_CONDITIONS) {
    if (earnedTypes.has(condition.type)) continue;
    if (!condition.check(profile, dailyStats)) continue;

    const { error: insertError } = await supabase.from('achievements').insert({
      user_id: userId,
      type: condition.type,
      earned_at: new Date().toISOString(),
    });

    if (!insertError) {
      newlyEarned.push(ACHIEVEMENTS[condition.type]);
    }
  }

  // Check reading/writing achievements (DB query based)
  const rwChecks: { type: AchievementType; query: () => Promise<boolean> }[] = [
    {
      type: 'first_story',
      query: async () => {
        const { count } = await supabase
          .from('user_book_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('completed_at', 'is', null);
        return (count ?? 0) >= 1;
      },
    },
    {
      type: 'bookworm_5',
      query: async () => {
        const { count } = await supabase
          .from('user_book_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('completed_at', 'is', null);
        return (count ?? 0) >= 5;
      },
    },
    {
      type: 'bookworm_25',
      query: async () => {
        const { count } = await supabase
          .from('user_book_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('completed_at', 'is', null);
        return (count ?? 0) >= 25;
      },
    },
    {
      type: 'first_essay',
      query: async () => {
        const { count } = await supabase
          .from('user_writing_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        return (count ?? 0) >= 1;
      },
    },
    {
      type: 'writer_10',
      query: async () => {
        const { count } = await supabase
          .from('user_writing_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        return (count ?? 0) >= 10;
      },
    },
    {
      type: 'perfect_essay',
      query: async () => {
        const { count } = await supabase
          .from('user_writing_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('overall_score', 0.9);
        return (count ?? 0) >= 1;
      },
    },
  ];

  for (const check of rwChecks) {
    if (earnedTypes.has(check.type)) continue;

    try {
      const earned = await check.query();
      if (!earned) continue;

      const { error: insertError } = await supabase.from('achievements').insert({
        user_id: userId,
        type: check.type,
        earned_at: new Date().toISOString(),
      });

      if (!insertError) {
        newlyEarned.push(ACHIEVEMENTS[check.type]);
      }
    } catch {
      // Skip failed checks silently
    }
  }

  return newlyEarned;
}

/**
 * Fetches all earned achievements for a user, ordered by earned date.
 */
export async function fetchAchievements(userId: string): Promise<EarnedAchievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('id, user_id, type, earned_at')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch achievements:', error.message);
    return [];
  }

  return (data ?? []).map((row: { id: string; user_id: string; type: string; earned_at: string }) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type as AchievementType,
    earnedAt: row.earned_at,
  }));
}
