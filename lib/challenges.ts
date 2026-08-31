/**
 * Enhanced daily challenge system.
 * Pool of challenge templates, 3 randomly picked per day.
 *
 * EVERY template here must have a statKey the app actually writes. Four
 * templates were removed in Aug 2026 — practice_minutes, practice_minutes_20,
 * speaking_exercise and listening_minutes — because nothing ever wrote
 * minutesPracticed, speakingMinutes or listeningMinutes. With 4 of 10 dead and
 * 3 picked at random, only C(6,3)/C(10,3) = 17% of days were completable, and
 * the bonus had never once been claimed in production.
 *
 * The two live writers are addStats({lessonsCompleted, xpEarned}) on lesson
 * completion and addStats({cardsReviewed}) on review; cardsLearned comes from
 * try_consume_new_card_slot. If you add a template, add its writer first.
 *
 * This pool is mirrored in public.fluenci_challenge_pool() — since migration
 * 071 the server takes `target` and `statKey` from there, not from the client.
 * lib/challenges.test.ts fails if the two drift.
 */

export interface ChallengeTemplate {
  type: string;
  title: string;
  icon: string;
  color: string;
  target: number;
  unit: string;
  /** The key in DailyStats to track progress against */
  statKey: 'lessonsCompleted' | 'cardsReviewed' | 'minutesPracticed' | 'speakingMinutes' | 'listeningMinutes' | 'xpEarned' | 'cardsLearned';
}

const CHALLENGE_POOL: ChallengeTemplate[] = [
  { type: 'complete_lessons', title: 'Complete 2 lessons', icon: 'book', color: '#38BDF8', target: 2, unit: 'lessons', statKey: 'lessonsCompleted' },
  { type: 'complete_lessons_3', title: 'Complete 3 lessons', icon: 'book', color: '#38BDF8', target: 3, unit: 'lessons', statKey: 'lessonsCompleted' },
  { type: 'review_cards', title: 'Review 10 cards', icon: 'layers', color: '#A855F7', target: 10, unit: 'cards', statKey: 'cardsReviewed' },
  { type: 'review_cards_20', title: 'Review 20 cards', icon: 'layers', color: '#A855F7', target: 20, unit: 'cards', statKey: 'cardsReviewed' },
  { type: 'learn_new_cards', title: 'Learn 5 new cards', icon: 'add-circle', color: '#60A5FA', target: 5, unit: 'cards', statKey: 'cardsLearned' },
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

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
