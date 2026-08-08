/**
 * Enhanced daily challenge system.
 * Pool of ~10 challenge templates, 3 randomly picked per day.
 * Challenge streaks earn XP multipliers.
 */

export interface ChallengeTemplate {
  type: string;
  title: string;
  icon: string;
  color: string;
  target: number;
  unit: string;
  xpReward: number;
  /** The key in DailyStats to track progress against */
  statKey: 'lessonsCompleted' | 'cardsReviewed' | 'minutesPracticed' | 'speakingMinutes' | 'listeningMinutes' | 'xpEarned' | 'cardsLearned';
}

const CHALLENGE_POOL: ChallengeTemplate[] = [
  { type: 'complete_lessons', title: 'Complete 2 lessons', icon: 'book', color: '#38BDF8', target: 2, unit: 'lessons', xpReward: 30, statKey: 'lessonsCompleted' },
  { type: 'complete_lessons_3', title: 'Complete 3 lessons', icon: 'book', color: '#38BDF8', target: 3, unit: 'lessons', xpReward: 50, statKey: 'lessonsCompleted' },
  { type: 'review_cards', title: 'Review 10 cards', icon: 'layers', color: '#A855F7', target: 10, unit: 'cards', xpReward: 25, statKey: 'cardsReviewed' },
  { type: 'review_cards_20', title: 'Review 20 cards', icon: 'layers', color: '#A855F7', target: 20, unit: 'cards', xpReward: 40, statKey: 'cardsReviewed' },
  { type: 'practice_minutes', title: 'Practice for 10 minutes', icon: 'time', color: '#34D399', target: 10, unit: 'min', xpReward: 30, statKey: 'minutesPracticed' },
  { type: 'practice_minutes_20', title: 'Practice for 20 minutes', icon: 'time', color: '#34D399', target: 20, unit: 'min', xpReward: 50, statKey: 'minutesPracticed' },
  { type: 'speaking_exercise', title: 'Speak for 5 minutes', icon: 'mic', color: '#F472B6', target: 5, unit: 'min', xpReward: 35, statKey: 'speakingMinutes' },
  { type: 'listening_minutes', title: 'Listen for 5 minutes', icon: 'headset', color: '#FBBF24', target: 5, unit: 'min', xpReward: 30, statKey: 'listeningMinutes' },
  { type: 'xp_target', title: 'Earn 100 XP', icon: 'star', color: '#F59E0B', target: 100, unit: 'XP', xpReward: 25, statKey: 'xpEarned' },
  { type: 'learn_new_cards', title: 'Learn 5 new cards', icon: 'add-circle', color: '#60A5FA', target: 5, unit: 'cards', xpReward: 35, statKey: 'cardsLearned' },
];

/**
 * Pick 3 challenges for a given date.
 * Uses a seeded pseudo-random based on date + userId for deterministic results.
 */
export function pickDailyChallenges(userId: string, dateStr: string): ChallengeTemplate[] {
  const seed = hashCode(`${userId}-${dateStr}`);
  const shuffled = [...CHALLENGE_POOL].sort((a, b) => {
    const ha = hashCode(`${seed}-${a.type}`);
    const hb = hashCode(`${seed}-${b.type}`);
    return ha - hb;
  });
  return shuffled.slice(0, 3);
}

/**
 * Get challenge streak XP multiplier.
 * 3-day streak = 1.5x, 7-day = 2x, else 1x.
 */
export function getChallengeMultiplier(streak: number): number {
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
