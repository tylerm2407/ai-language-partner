/**
 * Unit tests for lib/pending-onboarding.ts.
 *
 * AsyncStorage is replaced with the same in-memory mock shape used by
 * lesson-session-storage.test.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_ONBOARDING_KEY,
  PENDING_ONBOARDING_SCHEMA_VERSION,
  PENDING_ONBOARDING_TTL_MS,
  emptyPendingOnboarding,
  savePendingOnboarding,
  loadPendingOnboarding,
  clearPendingOnboarding,
  isFlushable,
  type PendingOnboarding,
  type PendingOnboardingDraft,
} from './pending-onboarding';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      getItem: jest.fn(async (key: string) => (key in store ? store[key] : null)),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

function makeDraft(overrides: Partial<PendingOnboardingDraft> = {}): PendingOnboardingDraft {
  return {
    ...emptyPendingOnboarding(),
    targetLanguage: 'es',
    level: 'elementary',
    dailyGoalMinutes: 10,
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('emptyPendingOnboarding', () => {
  it('starts with no answers and no completion timestamp', () => {
    const draft = emptyPendingOnboarding();
    expect(draft.targetLanguage).toBeNull();
    expect(draft.level).toBeNull();
    expect(draft.placement).toBeNull();
    expect(draft.completedAt).toBeNull();
  });
});

describe('save / load round-trip', () => {
  it('round-trips a draft with the current schema version', async () => {
    const draft = makeDraft();
    const startedAt = Date.now() - 1_000;
    await savePendingOnboarding(draft, startedAt);
    expect(await loadPendingOnboarding()).toEqual({
      version: PENDING_ONBOARDING_SCHEMA_VERSION,
      startedAt,
      ...draft,
    });
  });

  it('returns null when nothing was saved', async () => {
    expect(await loadPendingOnboarding()).toBeNull();
  });

  it('preserves the original startedAt across saves so the TTL does not slide', async () => {
    const startedAt = Date.now() - 60_000;
    await savePendingOnboarding(makeDraft(), startedAt);
    const first = await loadPendingOnboarding();
    await savePendingOnboarding(makeDraft({ level: 'advanced' }), first?.startedAt);
    const second = await loadPendingOnboarding();
    expect(second?.startedAt).toBe(startedAt);
    expect(second?.level).toBe('advanced');
  });

  it('round-trips an explicit false adultMode without collapsing it to null', async () => {
    // Guards the truthiness trap in onboarding's applyPending: a learner who
    // deliberately picks Gamified must not have that read back as "unanswered"
    // and silently re-defaulted.
    await savePendingOnboarding(makeDraft({ adultMode: false }));
    expect((await loadPendingOnboarding())?.adultMode).toBe(false);
  });

  it('round-trips an explicit true adultMode', async () => {
    await savePendingOnboarding(makeDraft({ adultMode: true }));
    expect((await loadPendingOnboarding())?.adultMode).toBe(true);
  });

  it('round-trips the placement band breakdown', async () => {
    const draft = makeDraft({
      placement: {
        suggestedLevel: 'intermediate',
        correctCount: 6,
        totalCount: 10,
        bands: [
          { level: 'beginner', correct: 2, total: 2 },
          { level: 'advanced', correct: 0, total: 2 },
        ],
      },
    });
    await savePendingOnboarding(draft);
    const loaded = await loadPendingOnboarding();
    expect(loaded?.placement?.bands).toHaveLength(2);
    expect(loaded?.placement?.suggestedLevel).toBe('intermediate');
  });
});

describe('forward compatibility', () => {
  it('loads a draft written before the adultMode field existed', async () => {
    // The schema version was deliberately NOT bumped when adultMode was added,
    // so drafts from shipped builds must still parse rather than being wiped
    // mid-signup. Written as a literal because makeDraft() now always includes
    // the field.
    await AsyncStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({
        version: PENDING_ONBOARDING_SCHEMA_VERSION,
        startedAt: Date.now() - 1_000,
        targetLanguage: 'es',
        // `motivation` was dropped from the draft when the onboarding step was
        // removed. Kept here deliberately: a draft written by a shipped build
        // still carries it, and an unknown key must not invalidate the draft.
        motivation: 'travel',
        idealL2Self: null,
        level: 'elementary',
        placement: null,
        displayName: null,
        avatarConfig: null,
        dailyGoalMinutes: 10,
        completedAt: null,
      }),
    );

    const loaded = await loadPendingOnboarding();
    expect(loaded).not.toBeNull();
    expect(loaded?.targetLanguage).toBe('es');
    expect(loaded?.adultMode).toBeUndefined();
  });
});

describe('TTL', () => {
  it('discards and removes drafts past the TTL', async () => {
    await savePendingOnboarding(makeDraft(), Date.now() - PENDING_ONBOARDING_TTL_MS - 60_000);
    expect(await loadPendingOnboarding()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_ONBOARDING_KEY)).toBeNull();
  });

  it('keeps drafts inside the TTL', async () => {
    await savePendingOnboarding(makeDraft(), Date.now() - PENDING_ONBOARDING_TTL_MS + 60_000);
    expect(await loadPendingOnboarding()).not.toBeNull();
  });
});

describe('invalid payloads', () => {
  it('discards and removes corrupt JSON', async () => {
    await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, 'not-json{');
    expect(await loadPendingOnboarding()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_ONBOARDING_KEY)).toBeNull();
  });

  it('discards drafts from a different schema version', async () => {
    await AsyncStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({
        ...makeDraft(),
        version: PENDING_ONBOARDING_SCHEMA_VERSION + 1,
        startedAt: Date.now(),
      }),
    );
    expect(await loadPendingOnboarding()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_ONBOARDING_KEY)).toBeNull();
  });

  it('discards structurally invalid drafts', async () => {
    await AsyncStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify({ nope: true }));
    expect(await loadPendingOnboarding()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_ONBOARDING_KEY)).toBeNull();
  });
});

describe('clearPendingOnboarding', () => {
  it('removes the draft', async () => {
    await savePendingOnboarding(makeDraft());
    await clearPendingOnboarding();
    expect(await loadPendingOnboarding()).toBeNull();
  });

  it('is a no-op when nothing exists', async () => {
    await expect(clearPendingOnboarding()).resolves.toBeUndefined();
  });
});

describe('isFlushable', () => {
  const base = (overrides: Partial<PendingOnboarding> = {}): PendingOnboarding => ({
    version: PENDING_ONBOARDING_SCHEMA_VERSION,
    startedAt: Date.now(),
    ...makeDraft(),
    completedAt: '2026-07-27T00:00:00.000Z',
    ...overrides,
  });

  it('is true for a finished draft that has language and level', () => {
    expect(isFlushable(base())).toBe(true);
  });

  it('is false when the flow never reached auth', () => {
    expect(isFlushable(base({ completedAt: null }))).toBe(false);
  });

  it('is false when a required profile field is missing', () => {
    expect(isFlushable(base({ targetLanguage: null }))).toBe(false);
    expect(isFlushable(base({ level: null }))).toBe(false);
  });

  it('is false for no draft at all', () => {
    expect(isFlushable(null)).toBe(false);
  });
});
