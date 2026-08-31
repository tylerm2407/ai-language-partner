/**
 * Unit tests for lib/challenges.ts.
 *
 * The parity block is the important one. Since migration 071,
 * `claim_daily_challenge_bonus()` no longer trusts the client's `target` or
 * `statKey` — it looks both up in `public.fluenci_challenge_pool()` by the
 * challenge's `type`. That means this file and that SQL function are two copies
 * of one truth, and drift is silent: a challenge whose type is missing from the
 * SQL pool makes the whole claim fail with "daily challenges not all
 * completed", and a target changed in only one place makes the UI and the
 * reward disagree.
 *
 * So: if you edit CHALLENGE_POOL, update
 * supabase/migrations/071_challenge_claim_server_owned.sql to match, and apply
 * it. This test fails loudly until you do.
 */
import { pickDailyChallenges } from './challenges';

/**
 * The authority-carrying half of each pool entry, exactly as it appears in
 * `public.fluenci_challenge_pool()`. Title, icon, colour and unit are
 * presentation only and deliberately absent — the server does not care.
 */
const SQL_POOL: Record<string, { target: number; statKey: string }> = {
  complete_lessons: { target: 2, statKey: 'lessonsCompleted' },
  complete_lessons_3: { target: 3, statKey: 'lessonsCompleted' },
  review_cards: { target: 10, statKey: 'cardsReviewed' },
  review_cards_20: { target: 20, statKey: 'cardsReviewed' },
  learn_new_cards: { target: 5, statKey: 'cardsLearned' },
};

/**
 * statKeys the app actually writes. A template pointing anywhere else is
 * unwinnable — that is exactly how four dead templates went unnoticed until
 * the bonus had a 0% claim rate in production.
 */
const WRITTEN_STAT_KEYS = new Set([
  'lessonsCompleted', // addStats() on lesson completion
  'xpEarned', //         addStats() on lesson completion
  'cardsReviewed', //    addStats() on review submit
  'cardsLearned', //     try_consume_new_card_slot()
]);

/** Every template the picker can produce, gathered by exhausting the picker. */
function allTemplates() {
  const seen = new Map<string, { target: number; statKey: string }>();
  for (let i = 0; i < 400; i += 1) {
    for (const t of pickDailyChallenges(`user-${i}`, '2026-08-24')) {
      seen.set(t.type, { target: t.target, statKey: t.statKey });
    }
  }
  return seen;
}

describe('challenge pool parity with fluenci_challenge_pool()', () => {
  it('produces only types the SQL pool knows', () => {
    // A type the server does not recognise makes fluenci_challenges_all_complete
    // return false for the WHOLE day, not just that challenge.
    for (const type of allTemplates().keys()) {
      expect(SQL_POOL[type]).toBeDefined();
    }
  });

  it('agrees with the SQL pool on every target and statKey', () => {
    for (const [type, ts] of allTemplates()) {
      expect({ type, ...ts }).toEqual({ type, ...SQL_POOL[type] });
    }
  });

  it('reaches every entry in the SQL pool, so neither side has dead rows', () => {
    const produced = allTemplates();
    for (const type of Object.keys(SQL_POOL)) {
      expect(produced.has(type)).toBe(true);
    }
    expect(produced.size).toBe(Object.keys(SQL_POOL).length);
  });

  it('every template tracks a stat the app actually writes', () => {
    // The regression guard for the bug that made this feature never pay out:
    // a template whose statKey is never written can never complete, and since
    // three are drawn at random one dead entry poisons a large share of days.
    // If you add a template, add its writer first.
    for (const [type, { statKey }] of allTemplates()) {
      expect({ type, statKey, written: WRITTEN_STAT_KEYS.has(statKey) }).toEqual({
        type,
        statKey,
        written: true,
      });
    }
  });
});

describe('pickDailyChallenges', () => {
  it('is deterministic for a given user and date', () => {
    const a = pickDailyChallenges('user-a', '2026-08-24');
    const b = pickDailyChallenges('user-a', '2026-08-24');
    expect(a).toEqual(b);
  });

  it('picks exactly three', () => {
    expect(pickDailyChallenges('user-a', '2026-08-24')).toHaveLength(3);
  });

  it('picks three distinct challenges', () => {
    const picked = pickDailyChallenges('user-a', '2026-08-24');
    expect(new Set(picked.map((c) => c.type)).size).toBe(3);
  });

  it('varies by date and by user', () => {
    const base = JSON.stringify(pickDailyChallenges('user-a', '2026-08-24'));
    const otherDay = JSON.stringify(pickDailyChallenges('user-a', '2026-09-01'));
    const otherUser = JSON.stringify(pickDailyChallenges('user-b', '2026-08-24'));
    // Not a strict guarantee for any single pair, but across these two it would
    // take a real bug for both to collide.
    expect([otherDay, otherUser].every((v) => v === base)).toBe(false);
  });

  it('never emits a zero or negative target', () => {
    // The server ignores client-sent targets, but a zero here would mean a
    // challenge the UI shows as instantly complete.
    for (const [, v] of allTemplates()) {
      expect(v.target).toBeGreaterThan(0);
    }
  });
});
