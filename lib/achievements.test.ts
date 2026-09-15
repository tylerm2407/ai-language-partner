/**
 * `first_chat` had no entry in ACHIEVEMENT_CONDITIONS at all, so no learner
 * could ever earn "Conversation Starter" no matter how many AI conversations
 * they had. This pins the fix: it now reads `hasAiConversationSignal` off
 * the app store — already fetched once via the `has_ai_conversation` RPC on
 * store hydration (`stores/useAppStore.ts`), so no new query was added.
 */
import { checkAndAwardAchievements } from './achievements';
import type { UserProfile } from '../types';

let mockHasAiConversationSignal: boolean | null = null;
let mockInsertedTypes: string[] = [];

jest.mock('../stores/useAppStore', () => ({
  useAppStore: { getState: () => ({ hasAiConversationSignal: mockHasAiConversationSignal }) },
}));

jest.mock('./supabase', () => {
  const countQueue: Record<string, any[]> = {};

  const resetCountQueue = () => {
    countQueue.user_book_progress = [{ count: 0 }];
    countQueue.user_writing_submissions = [{ count: 0 }, { count: 0 }];
    countQueue.review_logs = [{ count: 0 }];
  };
  resetCountQueue();

  const from = (table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      not: () => q,
      gte: () => q,
      order: () => q,
      insert: (payload: unknown) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach((r: any) => mockInsertedTypes.push(r.type));
        return Promise.resolve({ error: null });
      },
      then: (resolve: (v: any) => void) => {
        if (table === 'achievements') {
          resolve({ data: [], error: null });
          return;
        }
        resolve(countQueue[table]?.shift() ?? { count: 0 });
      },
    };
    return q;
  };

  return { supabase: { from }, __resetCountQueue: resetCountQueue };
});

const PROFILE = { id: 'p1', userId: 'u1' } as unknown as UserProfile;

beforeEach(() => {
  mockHasAiConversationSignal = null;
  mockInsertedTypes = [];
  // Re-arm the per-table count queue each test (it's consumed via `.shift()`).
  jest.requireMock('./supabase').__resetCountQueue();
});

describe('first_chat condition', () => {
  it('is not awarded when the learner has no recorded AI conversation', async () => {
    mockHasAiConversationSignal = false;
    await checkAndAwardAchievements('u1', PROFILE, null);
    expect(mockInsertedTypes).not.toContain('first_chat');
  });

  it('is not awarded while the signal has not resolved yet (null)', async () => {
    mockHasAiConversationSignal = null;
    await checkAndAwardAchievements('u1', PROFILE, null);
    expect(mockInsertedTypes).not.toContain('first_chat');
  });

  it('is awarded once the store has a confirmed AI conversation', async () => {
    mockHasAiConversationSignal = true;
    const newlyEarned = await checkAndAwardAchievements('u1', PROFILE, null);
    expect(mockInsertedTypes).toContain('first_chat');
    expect(newlyEarned.map((a) => a.type)).toContain('first_chat');
  });
});
