/**
 * Unit tests for lib/motion-preference.ts.
 *
 * AsyncStorage is replaced with an in-memory mock (same pattern as
 * lib/read-cache.test.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  REDUCE_MOTION_KEY,
  getReduceMotion,
  isHydrated,
  hydrateMotionPreference,
  setReduceMotion,
  subscribeMotionPreference,
  resetMotionPreferenceForTests,
} from './motion-preference';

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

const storage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  __reset: () => void;
};

beforeEach(() => {
  storage.__reset();
  jest.clearAllMocks();
  resetMotionPreferenceForTests();
});

describe('motion preference', () => {
  it('defaults to motion enabled before hydration', () => {
    expect(getReduceMotion()).toBe(false);
    expect(isHydrated()).toBe(false);
  });

  it('reads a stored preference', async () => {
    await storage.setItem(REDUCE_MOTION_KEY, 'true');
    await hydrateMotionPreference();
    expect(getReduceMotion()).toBe(true);
    expect(isHydrated()).toBe(true);
  });

  it('treats a missing entry as motion enabled', async () => {
    await hydrateMotionPreference();
    expect(getReduceMotion()).toBe(false);
  });

  it('persists and reflects a change immediately', async () => {
    await setReduceMotion(true);
    expect(getReduceMotion()).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(REDUCE_MOTION_KEY, 'true');
  });

  it('notifies subscribers on change', async () => {
    const seen: boolean[] = [];
    subscribeMotionPreference((v) => seen.push(v));
    await setReduceMotion(true);
    await setReduceMotion(false);
    expect(seen).toEqual([true, false]);
  });

  it('stops notifying after unsubscribe', async () => {
    const seen: boolean[] = [];
    const off = subscribeMotionPreference((v) => seen.push(v));
    await setReduceMotion(true);
    off();
    await setReduceMotion(false);
    expect(seen).toEqual([true]);
  });

  it('notifies subscribers when hydration lands', async () => {
    await storage.setItem(REDUCE_MOTION_KEY, 'true');
    const seen: boolean[] = [];
    subscribeMotionPreference((v) => seen.push(v));
    await hydrateMotionPreference();
    expect(seen).toEqual([true]);
  });

  it('keeps the default when storage read throws', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(hydrateMotionPreference()).resolves.toBe(false);
    expect(getReduceMotion()).toBe(false);
    expect(isHydrated()).toBe(true);
  });

  it('applies the value for this session even when the write fails', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(setReduceMotion(true)).resolves.toBeUndefined();
    expect(getReduceMotion()).toBe(true);
  });
});
