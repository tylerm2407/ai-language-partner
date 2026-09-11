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
  PENDING_ONBOARDING_COMPLETED_TTL_MS,
  emptyPendingOnboarding,
  savePendingOnboarding,
  loadPendingOnboarding,
  clearPendingOnboarding,
  isFlushable,
  claimPendingOnboarding,
  type PendingOnboarding,
  type PendingOnboardingDraft,
} from './pending-onboarding';
import {
  DEFAULT_NOTIFICATION_PREFS,
  validateNotificationPrefs,
  type NotificationPrefs,
} from './notification-prefs';

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
    expect(draft.trial).toBeNull();
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

  it('round-trips the trial lesson result', async () => {
    // The sign-up screen names these numbers back to the learner, so losing
    // them turns a specific promise ("keep your 20 XP") into a vague one.
    const draft = makeDraft({
      trial: {
        xpEarned: 20,
        correctCount: 6,
        totalCount: 8,
        completedAt: '2026-08-24T12:00:00.000Z',
      },
    });
    await savePendingOnboarding(draft);
    const loaded = await loadPendingOnboarding();
    expect(loaded?.trial?.xpEarned).toBe(20);
    expect(loaded?.trial?.correctCount).toBe(6);
    expect(loaded?.trial?.totalCount).toBe(8);
  });
});

describe('forward compatibility', () => {
  it('loads a draft carrying fields that no longer exist', async () => {
    // The schema version is deliberately not bumped when a field comes or goes,
    // so drafts from shipped builds must still parse rather than being wiped
    // mid-signup. Written as a literal because makeDraft() only ever produces
    // the current shape.
    await AsyncStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({
        version: PENDING_ONBOARDING_SCHEMA_VERSION,
        startedAt: Date.now() - 1_000,
        targetLanguage: 'es',
        // `motivation`, `placement` and `adultMode` were all dropped from the
        // draft when their onboarding steps were removed. Kept here
        // deliberately: a draft written by a shipped build still carries them,
        // and an unknown key must not invalidate the draft.
        motivation: 'travel',
        adultMode: true,
        idealL2Self: null,
        level: 'elementary',
        placement: null,
        displayName: null,
        avatarPresetId: null,
        dailyGoalMinutes: 10,
        completedAt: null,
      }),
    );

    const loaded = await loadPendingOnboarding();
    expect(loaded).not.toBeNull();
    expect(loaded?.targetLanguage).toBe('es');
    expect(loaded?.trial).toBeUndefined();
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

/**
 * The shared-device guard. A completed draft is the fully populated one and
 * the one `isFlushable` lets the onboarding screen write into whichever
 * account is signed in when it is next read, so it gets a much shorter life
 * than an in-progress draft.
 */
describe('completed-draft claim window', () => {
  const completedAgo = (ms: number) =>
    makeDraft({ completedAt: new Date(Date.now() - ms).toISOString() });

  it('keeps a completed draft inside the claim window', async () => {
    await savePendingOnboarding(completedAgo(PENDING_ONBOARDING_COMPLETED_TTL_MS - 60_000));
    expect(await loadPendingOnboarding()).not.toBeNull();
  });

  it('discards and removes a completed draft past the claim window', async () => {
    await savePendingOnboarding(completedAgo(PENDING_ONBOARDING_COMPLETED_TTL_MS + 60_000));
    expect(await loadPendingOnboarding()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_ONBOARDING_KEY)).toBeNull();
  });

  it('expires a completed draft long before the in-progress TTL would', async () => {
    // The leak this closes: learner A abandons the sign-up screen, learner B
    // picks the device up a day later. Under the 7-day TTL alone, B saw A's
    // display name and free-text goal — or had them flushed into B's profile.
    const aDayAgo = 24 * 60 * 60 * 1000;
    expect(aDayAgo).toBeLessThan(PENDING_ONBOARDING_TTL_MS);

    await savePendingOnboarding(completedAgo(aDayAgo), Date.now() - aDayAgo);
    expect(await loadPendingOnboarding()).toBeNull();
  });

  it('leaves an in-progress draft on the long TTL', async () => {
    // Same age, but never completed: still a legitimate resume, so it stays.
    const aDayAgo = 24 * 60 * 60 * 1000;
    await savePendingOnboarding(makeDraft({ completedAt: null }), Date.now() - aDayAgo);
    expect(await loadPendingOnboarding()).not.toBeNull();
  });

  it('treats an unreadable completedAt stamp as expired', async () => {
    // A stamp we cannot parse is a stamp we cannot bound.
    await AsyncStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({
        ...makeDraft({ completedAt: 'sometime last tuesday' }),
        version: PENDING_ONBOARDING_SCHEMA_VERSION,
        startedAt: Date.now(),
      }),
    );
    expect(await loadPendingOnboarding()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_ONBOARDING_KEY)).toBeNull();
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
  const USER = 'user-a';
  const base = (overrides: Partial<PendingOnboarding> = {}): PendingOnboarding => ({
    version: PENDING_ONBOARDING_SCHEMA_VERSION,
    startedAt: Date.now(),
    ...makeDraft(),
    completedAt: '2026-07-27T00:00:00.000Z',
    claimedByUserId: USER,
    ...overrides,
  });

  it('is true for a finished draft that has language and level', () => {
    expect(isFlushable(base(), USER)).toBe(true);
  });

  it('is false when the flow never reached auth', () => {
    expect(isFlushable(base({ completedAt: null }), USER)).toBe(false);
  });

  it('is false when a required profile field is missing', () => {
    expect(isFlushable(base({ targetLanguage: null }), USER)).toBe(false);
    expect(isFlushable(base({ level: null }), USER)).toBe(false);
  });

  it('is false for no draft at all', () => {
    expect(isFlushable(null, USER)).toBe(false);
  });

  // The shared-device case this guard exists for: learner A abandons the
  // sign-up screen, learner B signs in on the same iPad within the hour.
  it('refuses to flush a draft claimed by a different account', () => {
    expect(isFlushable(base({ claimedByUserId: 'user-a' }), 'user-b')).toBe(false);
  });

  it('refuses to flush a draft nobody claimed', () => {
    expect(isFlushable(base({ claimedByUserId: null }), USER)).toBe(false);
    // A draft written before the field existed loads without it. Unclaimed is
    // the safe reading: the learner re-enters answers, rather than inheriting
    // someone else's.
    expect(isFlushable(base({ claimedByUserId: undefined }), USER)).toBe(false);
  });
});

describe('claimPendingOnboarding', () => {
  it('stamps an unclaimed draft with the account that just signed in', async () => {
    await savePendingOnboarding({ ...makeDraft(), completedAt: new Date().toISOString() });
    await claimPendingOnboarding('user-a');

    const loaded = await loadPendingOnboarding();
    expect(loaded?.claimedByUserId).toBe('user-a');
    expect(isFlushable(loaded, 'user-a')).toBe(true);
  });

  it('deletes a draft belonging to someone else rather than re-stamping it', async () => {
    await savePendingOnboarding({ ...makeDraft(), completedAt: new Date().toISOString() });
    await claimPendingOnboarding('user-a');

    // B now signs in on the same device.
    await claimPendingOnboarding('user-b');

    // A's answers are gone entirely — not handed to B.
    expect(await loadPendingOnboarding()).toBeNull();
  });

  it('is a no-op when there is no draft', async () => {
    await claimPendingOnboarding('user-a');
    expect(await loadPendingOnboarding()).toBeNull();
  });

  it('lets the same account re-claim its own draft', async () => {
    await savePendingOnboarding({ ...makeDraft(), completedAt: new Date().toISOString() });
    await claimPendingOnboarding('user-a');
    await claimPendingOnboarding('user-a');

    const loaded = await loadPendingOnboarding();
    expect(loaded?.claimedByUserId).toBe('user-a');
  });
});

/**
 * The two fields added with the notifications step and the topic packs
 * (2026-09-11), and the compatibility claim that let them skip a schema bump.
 *
 * That claim is the thing worth pinning. `PENDING_ONBOARDING_SCHEMA_VERSION`
 * stayed at 1 on the argument that an older draft still LOADS and still means
 * what it meant — if either new field could make the loader throw the blob
 * away, every learner mid-signup on the previous build would lose their
 * answers on upgrade, and nothing in the app would say so.
 */
describe('topic and notificationPrefs', () => {
  it('starts empty on a fresh draft', () => {
    const draft = emptyPendingOnboarding();
    expect(draft.topic).toBeNull();
    expect(draft.notificationPrefs).toBeNull();
  });

  it('round-trips both through storage', async () => {
    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      dailyGoal: { enabled: true, hour: 7, minute: 30 },
      weeklyRecap: { enabled: true, hour: 20, minute: 0, weekday: 6 },
    };
    await savePendingOnboarding(makeDraft({ topic: 'housing_admin', notificationPrefs: prefs }));

    const loaded = await loadPendingOnboarding();
    expect(loaded?.topic).toBe('housing_admin');
    expect(loaded?.notificationPrefs?.dailyGoal).toEqual({ enabled: true, hour: 7, minute: 30 });
    expect(loaded?.notificationPrefs?.weeklyRecap.weekday).toBe(6);
  });

  it('loads a draft written before either field existed, rather than discarding it', async () => {
    // Exactly what the previous build wrote: same version, same TTL reference,
    // neither new key present.
    await AsyncStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({
        version: PENDING_ONBOARDING_SCHEMA_VERSION,
        startedAt: Date.now(),
        targetLanguage: 'fr',
        idealL2Self: 'Reading a whole novel in French by next summer.',
        level: 'beginner',
        trial: null,
        displayName: 'Ada',
        avatarPresetId: null,
        dailyGoalMinutes: 15,
        completedAt: null,
        claimedByUserId: null,
      }),
    );

    const loaded = await loadPendingOnboarding();
    // The answers survive…
    expect(loaded?.displayName).toBe('Ada');
    expect(loaded?.dailyGoalMinutes).toBe(15);
    // …and the two new fields read as absent, which every consumer substitutes
    // for: the trial falls back to `travel`, the flush to the default prefs.
    expect(loaded?.topic).toBeUndefined();
    expect(loaded?.notificationPrefs).toBeUndefined();
    expect(loaded?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS).toEqual(
      DEFAULT_NOTIFICATION_PREFS,
    );
  });

  it('repairs a half-written prefs blob field by field instead of dropping it', async () => {
    // A draft whose prefs were mangled: an hour out of range, and three of the
    // four kinds missing entirely. `validateNotificationPrefs` is what the
    // onboarding screen runs on load, and the learner's one good answer
    // (08:00 reviews) has to survive it.
    await AsyncStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({
        version: PENDING_ONBOARDING_SCHEMA_VERSION,
        startedAt: Date.now(),
        ...makeDraft(),
        notificationPrefs: {
          reviewsDue: { enabled: true, hour: 8, minute: 0 },
          dailyGoal: { hour: 99 },
        },
      }),
    );

    const loaded = await loadPendingOnboarding();
    const repaired = validateNotificationPrefs(loaded?.notificationPrefs);
    expect(repaired.reviewsDue).toEqual({ enabled: true, hour: 8, minute: 0 });
    expect(repaired.dailyGoal.hour).toBe(DEFAULT_NOTIFICATION_PREFS.dailyGoal.hour);
    expect(repaired.idealMoment.weekday).toBe(DEFAULT_NOTIFICATION_PREFS.idealMoment.weekday);
  });

  it('is not what makes a draft flushable, with or without them', async () => {
    const stamp = new Date().toISOString();
    await savePendingOnboarding({
      ...makeDraft({ topic: 'work', notificationPrefs: DEFAULT_NOTIFICATION_PREFS }),
      completedAt: stamp,
    });
    await claimPendingOnboarding('user-a');
    expect(isFlushable(await loadPendingOnboarding(), 'user-a')).toBe(true);

    // A learner who skipped the ideal-self step has no topic, and that must
    // not block the profile write.
    await clearPendingOnboarding();
    await savePendingOnboarding({ ...makeDraft(), completedAt: stamp });
    await claimPendingOnboarding('user-b');
    expect(isFlushable(await loadPendingOnboarding(), 'user-b')).toBe(true);
  });
});
