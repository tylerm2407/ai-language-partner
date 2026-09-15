/**
 * Unit tests for lib/reading-preferences.ts.
 *
 * AsyncStorage is replaced with an in-memory mock (same pattern as
 * lib/motion-preference.test.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_READING_PREFERENCES,
  LINE_SPACING_MULTIPLIER,
  READING_PREFERENCES_KEY,
  getReadingPreferences,
  hydrateReadingPreferences,
  isReadingPreferencesHydrated,
  parseReadingPreferences,
  resetReadingPreferencesForTests,
  setReadingPreferences,
  subscribeReadingPreferences,
} from './reading-preferences';
import { leading } from '../config/theme';

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
  resetReadingPreferencesForTests();
});

describe('parseReadingPreferences', () => {
  it('falls back entirely on nothing, garbage, or the wrong shape', () => {
    expect(parseReadingPreferences(null)).toEqual(DEFAULT_READING_PREFERENCES);
    expect(parseReadingPreferences('')).toEqual(DEFAULT_READING_PREFERENCES);
    expect(parseReadingPreferences('not json')).toEqual(DEFAULT_READING_PREFERENCES);
    expect(parseReadingPreferences('[]')).toEqual(DEFAULT_READING_PREFERENCES);
    expect(parseReadingPreferences('42')).toEqual(DEFAULT_READING_PREFERENCES);
  });

  it('falls back per field, keeping the fields that are valid', () => {
    const parsed = parseReadingPreferences(
      JSON.stringify({ nightReading: true, fontSizeIndex: 9, lineSpacing: 'huge', font: 'comic', brightness: 0.4 }),
    );
    expect(parsed).toEqual({
      nightReading: true,
      fontSizeIndex: 1,
      lineSpacing: 'normal',
      font: 'sans',
    });
    // `brightness` was a field for two days; a record that still carries it
    // must not leak it back in.
    expect('brightness' in parsed).toBe(false);
  });

  it('accepts a fully valid record', () => {
    const stored = { nightReading: true, fontSizeIndex: 4, lineSpacing: 'relaxed', font: 'serif' };
    expect(parseReadingPreferences(JSON.stringify(stored))).toEqual(stored);
  });

  it('rejects a fractional or negative font index', () => {
    expect(parseReadingPreferences('{"fontSizeIndex":1.5}').fontSizeIndex).toBe(1);
    expect(parseReadingPreferences('{"fontSizeIndex":-1}').fontSizeIndex).toBe(1);
    expect(parseReadingPreferences('{"fontSizeIndex":"2"}').fontSizeIndex).toBe(1);
  });
});

describe('line spacing', () => {
  // A lineHeight under a face's natural box clips the ascender on both
  // platforms (config/theme.ts "Line height is not a free parameter").
  it('never goes under either reader face’s natural line box', () => {
    const tightest = Math.min(...Object.values(LINE_SPACING_MULTIPLIER));
    expect(tightest).toBeGreaterThanOrEqual(leading.sans);
    expect(tightest).toBeGreaterThanOrEqual(leading.display);
  });

  it('keeps the 1.7 the reader always used as normal', () => {
    expect(LINE_SPACING_MULTIPLIER.normal).toBe(1.7);
  });
});

describe('reading preferences store', () => {
  it('defaults before hydration', () => {
    expect(getReadingPreferences()).toEqual(DEFAULT_READING_PREFERENCES);
    expect(isReadingPreferencesHydrated()).toBe(false);
  });

  it('reads a stored record', async () => {
    await storage.setItem(READING_PREFERENCES_KEY, JSON.stringify({ nightReading: true, font: 'serif' }));
    await hydrateReadingPreferences();
    expect(getReadingPreferences()).toEqual({ ...DEFAULT_READING_PREFERENCES, nightReading: true, font: 'serif' });
    expect(isReadingPreferencesHydrated()).toBe(true);
  });

  it('merges a patch, reflects it immediately, and persists the whole record', async () => {
    await setReadingPreferences({ fontSizeIndex: 3 });
    await setReadingPreferences({ nightReading: true });
    expect(getReadingPreferences()).toEqual({ ...DEFAULT_READING_PREFERENCES, fontSizeIndex: 3, nightReading: true });
    expect(storage.setItem).toHaveBeenLastCalledWith(
      READING_PREFERENCES_KEY,
      JSON.stringify({ ...DEFAULT_READING_PREFERENCES, fontSizeIndex: 3, nightReading: true }),
    );
  });

  it('replaces the snapshot rather than mutating it', async () => {
    const before = getReadingPreferences();
    await setReadingPreferences({ font: 'serif' });
    expect(getReadingPreferences()).not.toBe(before);
    expect(before.font).toBe('sans');
  });

  it('notifies subscribers on change and on hydration, and stops after unsubscribe', async () => {
    const seen: boolean[] = [];
    const off = subscribeReadingPreferences((p) => seen.push(p.nightReading));
    await setReadingPreferences({ nightReading: true });
    await hydrateReadingPreferences();
    off();
    await setReadingPreferences({ nightReading: false });
    // Hydration re-reads storage, which the set above already wrote to.
    expect(seen).toEqual([true, true]);
  });

  it('keeps the defaults when the storage read throws', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(hydrateReadingPreferences()).resolves.toEqual(DEFAULT_READING_PREFERENCES);
    expect(isReadingPreferencesHydrated()).toBe(true);
  });

  it('applies the value for this session even when the write fails', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(setReadingPreferences({ nightReading: true })).resolves.toBeUndefined();
    expect(getReadingPreferences().nightReading).toBe(true);
  });
});
