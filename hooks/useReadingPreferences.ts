/**
 * The reader's display preferences, live.
 *
 * `useSyncExternalStore` rather than the useState-plus-effect dance in
 * `useMotion`: it re-reads the snapshot on mount and subscribes in the same
 * step, so a hydration that lands after the reader mounts still propagates,
 * and there is no frame where the subscription exists but the value is stale.
 */
import { useSyncExternalStore } from 'react';
import { ui2ReaderType } from '../config/theme';
import {
  LINE_SPACING_MULTIPLIER,
  READER_FONT_SIZES,
  getReadingPreferences,
  setReadingPreferences,
  subscribeReadingPreferences,
  type ReadingPreferences,
} from '../lib/reading-preferences';

export interface ReadingPreferencesHandle {
  prefs: ReadingPreferences;
  update: (patch: Partial<ReadingPreferences>) => Promise<void>;
  /** Resolved for the body text, so callers do not repeat the lookups. */
  fontSize: number;
  lineHeightMultiplier: number;
  fontFamily: string;
}

export function useReadingPreferences(): ReadingPreferencesHandle {
  const prefs = useSyncExternalStore(subscribeReadingPreferences, getReadingPreferences, getReadingPreferences);
  return {
    prefs,
    update: setReadingPreferences,
    fontSize: READER_FONT_SIZES[prefs.fontSizeIndex],
    lineHeightMultiplier: LINE_SPACING_MULTIPLIER[prefs.lineSpacing],
    fontFamily: ui2ReaderType[prefs.font],
  };
}
