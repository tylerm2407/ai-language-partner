/**
 * Reader display preferences: text size, line spacing, face, Night reading.
 *
 * Device-local by design, like `lib/motion-preference.ts`. These are display
 * settings, not part of the learning record — the same learner on two phones
 * has two screens and reasonably wants two settings — and the reader needs
 * them synchronously on first paint, which rules out the profile row. None of
 * them carries learner text or names anybody, so, like the tutor voice
 * preference, they are not user-scoped either: a second learner on a shared
 * device inherits a font size, not a disclosure.
 *
 * The module-level cache plus subscriber set is what makes the synchronous
 * read possible: `hydrateReadingPreferences()` runs once at app start, and
 * every later read is a plain variable access. `current` is always REPLACED,
 * never mutated, because `useSyncExternalStore` compares snapshots by
 * identity.
 *
 * Every field is validated on read. A stored value from an older build, a
 * hand-edited backup, or a corrupt write must fall back per field rather than
 * take the reader down with it. Unknown keys are dropped — the record briefly
 * carried a `brightness` step, and phones that stored one still parse.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const READING_PREFERENCES_KEY = 'reading-preferences';

/** The five body sizes the reader offers. Index 1 (16pt) is the default. */
export const READER_FONT_SIZES = [14, 16, 18, 20, 22] as const;
export type ReaderFontSizeIndex = 0 | 1 | 2 | 3 | 4;

export type ReaderLineSpacing = 'compact' | 'normal' | 'relaxed';
/** Line-height multipliers. `normal` is the 1.7 the reader has always used;
 *  `compact` stays above Manrope's 1.366em and Fraunces's 1.233em natural
 *  line boxes (config/theme.ts `leading`), so no ascender is clipped. */
export const LINE_SPACING_MULTIPLIER: Record<ReaderLineSpacing, number> = {
  compact: 1.45,
  normal: 1.7,
  relaxed: 1.95,
};

export type ReaderFont = 'sans' | 'serif';

export interface ReadingPreferences {
  nightReading: boolean;
  fontSizeIndex: ReaderFontSizeIndex;
  lineSpacing: ReaderLineSpacing;
  font: ReaderFont;
}

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = Object.freeze({
  nightReading: false,
  fontSizeIndex: 1,
  lineSpacing: 'normal',
  font: 'sans',
}) as ReadingPreferences;

type Listener = (prefs: ReadingPreferences) => void;

let current: ReadingPreferences = DEFAULT_READING_PREFERENCES;
let hydrated = false;
const listeners = new Set<Listener>();

function isFontSizeIndex(value: unknown): value is ReaderFontSizeIndex {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < READER_FONT_SIZES.length;
}

function isLineSpacing(value: unknown): value is ReaderLineSpacing {
  return value === 'compact' || value === 'normal' || value === 'relaxed';
}

/**
 * Parse a stored value. Pure and exported so the fallbacks are asserted
 * directly: malformed JSON falls back entirely, and each out-of-range field
 * falls back on its own without disturbing the others.
 */
export function parseReadingPreferences(raw: string | null): ReadingPreferences {
  if (!raw) return DEFAULT_READING_PREFERENCES;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_READING_PREFERENCES;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return DEFAULT_READING_PREFERENCES;
  }
  const o = parsed as Record<string, unknown>;
  const d = DEFAULT_READING_PREFERENCES;
  return {
    nightReading: typeof o.nightReading === 'boolean' ? o.nightReading : d.nightReading,
    fontSizeIndex: isFontSizeIndex(o.fontSizeIndex) ? o.fontSizeIndex : d.fontSizeIndex,
    lineSpacing: isLineSpacing(o.lineSpacing) ? o.lineSpacing : d.lineSpacing,
    font: o.font === 'serif' ? 'serif' : d.font,
  };
}

/** The current preferences. Defaults until hydration completes. */
export function getReadingPreferences(): ReadingPreferences {
  return current;
}

/** Whether the stored value has been read yet. Exposed for tests. */
export function isReadingPreferencesHydrated(): boolean {
  return hydrated;
}

/**
 * Read the stored preferences into the module cache.
 *
 * Call once from the root layout. A failed read leaves the defaults rather
 * than throwing — a storage error must not block app start.
 */
export async function hydrateReadingPreferences(): Promise<ReadingPreferences> {
  try {
    const raw = await AsyncStorage.getItem(READING_PREFERENCES_KEY);
    current = parseReadingPreferences(raw);
  } catch {
    // Storage unavailable — keep the defaults.
  }
  hydrated = true;
  emit();
  return current;
}

/** Merge, broadcast, then persist. The in-memory value applies for this
 *  session even if the write fails. */
export async function setReadingPreferences(patch: Partial<ReadingPreferences>): Promise<void> {
  current = { ...current, ...patch };
  emit();
  try {
    await AsyncStorage.setItem(READING_PREFERENCES_KEY, JSON.stringify(current));
  } catch {
    // The in-memory value still applies for this session.
  }
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribeReadingPreferences(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  listeners.forEach((l) => l(current));
}

/** Test-only: drop cached state so each case starts clean. */
export function resetReadingPreferencesForTests(): void {
  current = DEFAULT_READING_PREFERENCES;
  hydrated = false;
  listeners.clear();
}
