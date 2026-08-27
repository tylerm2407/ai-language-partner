/**
 * Unit tests for lib/haptics.ts.
 *
 * AsyncStorage is replaced with an in-memory mock (same pattern as
 * lib/motion-preference.test.ts), and expo-haptics with spies so each case can
 * assert on the exact native call an intent produces.
 *
 * The cases worth having here are the ones that protect a *decision*: that the
 * preference defaults on, that the off switch actually reaches the native
 * layer, that a rejecting device does not produce an unhandled rejection, and
 * that intents keep their weight hierarchy. Anything that only restates the
 * EFFECTS table would fail every time the feel is retuned, which is exactly
 * when the tests should stay quiet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  HAPTICS_ENABLED_KEY,
  getHapticsEnabled,
  isHydrated,
  hydrateHapticsPreference,
  setHapticsEnabled,
  subscribeHapticsPreference,
  resetHapticsPreferenceForTests,
  haptic,
} from './haptics';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      store[k] = v;
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      delete store[k];
      return Promise.resolve();
    }),
    __reset: () => {
      store = {};
    },
  };
});

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const storage = AsyncStorage as unknown as { __reset: () => void };

beforeEach(async () => {
  storage.__reset();
  resetHapticsPreferenceForTests();
  jest.clearAllMocks();
});

describe('preference', () => {
  it('defaults to enabled, unlike reduce-motion', async () => {
    // A learner who has never opened settings should get the app's normal feel.
    expect(getHapticsEnabled()).toBe(true);
    await hydrateHapticsPreference();
    expect(getHapticsEnabled()).toBe(true);
  });

  it('only an explicit stored "false" turns haptics off', async () => {
    await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, 'false');
    await hydrateHapticsPreference();
    expect(getHapticsEnabled()).toBe(false);
  });

  it('a missing key leaves the default alone', async () => {
    await hydrateHapticsPreference();
    expect(isHydrated()).toBe(true);
    expect(getHapticsEnabled()).toBe(true);
  });

  it('keeps haptics on when storage throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('no storage'));
    await hydrateHapticsPreference();
    // Storage being unavailable is not a reason to silence the app.
    expect(getHapticsEnabled()).toBe(true);
    expect(isHydrated()).toBe(true);
  });

  it('persists a change and applies it in memory immediately', async () => {
    await setHapticsEnabled(false);
    expect(getHapticsEnabled()).toBe(false);
    expect(await AsyncStorage.getItem(HAPTICS_ENABLED_KEY)).toBe('false');
  });

  it('keeps the in-memory value when the write fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await setHapticsEnabled(false);
    expect(getHapticsEnabled()).toBe(false);
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeHapticsPreference((v) => seen.push(v));
    await setHapticsEnabled(false);
    await setHapticsEnabled(true);
    unsubscribe();
    await setHapticsEnabled(false);
    expect(seen).toEqual([false, true]);
  });
});

describe('haptic()', () => {
  it('is silent while the preference is off', async () => {
    await setHapticsEnabled(false);
    haptic('correct');
    haptic('levelUp');
    haptic('select');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('swallows a rejection from a device that cannot vibrate', async () => {
    // The bug this replaces: ~20 call sites floated this promise bare, so a
    // device with no taptic engine produced an unhandled rejection per answer.
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('unsupported'));
    expect(() => haptic('correct')).not.toThrow();
    await Promise.resolve();
  });

  it('swallows a synchronous throw from a missing native module', () => {
    (Haptics.impactAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('native module not linked');
    });
    expect(() => haptic('levelUp')).not.toThrow();
  });

  it('returns nothing, so no call site can accidentally await it', () => {
    expect(haptic('correct')).toBeUndefined();
  });
});

describe('intent hierarchy', () => {
  it('keeps a heart loss distinct from the wrong answer that caused it', () => {
    // Two Error notifications back to back read as one stuttering error rather
    // than as two facts, so the cost is weight and the verdict is a
    // notification.
    haptic('incorrect');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');

    jest.clearAllMocks();
    haptic('heartLost');
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('reserves Heavy for rare events and Light for acknowledgement', () => {
    haptic('levelUp');
    haptic('milestone');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(1, 'heavy');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, 'heavy');

    jest.clearAllMocks();
    haptic('buttonPress');
    haptic('xpAward');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(1, 'light');
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(2, 'light');
  });

  it('treats every kind of finishing as the same Success', () => {
    // Lesson, review session, reading passage and writing piece all end the
    // same way on purpose — the learner should not have to learn four buzzes.
    haptic('complete');
    haptic('achievement');
    haptic('challengeComplete');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(3);
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(2, 'success');
    expect(Haptics.notificationAsync).toHaveBeenNthCalledWith(3, 'success');
  });
});
