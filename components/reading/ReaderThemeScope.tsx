/**
 * The reader's theme boundary.
 *
 * Wraps a reading surface (book pages, a passage, its comprehension
 * questions) in the warm palette when the learner's Night reading preference
 * is on, and swaps the status-bar glyphs to light while it is — under OS light
 * mode the root layout paints them dark, which on a black page is invisible.
 * `expo-status-bar` instances stack: the last mounted wins and unmounting
 * hands control back to the root, so mounting one only while warm is enough.
 *
 * The StatusBar is tied to the PREFERENCE, not to whether the display sheet
 * is open, so opening the sheet does not flap the glyphs.
 *
 * Nothing outside this boundary ever renders from `ui2Warm`. That is the
 * scope Tyler chose on 2026-09-09: the reader only, not the tab or the app.
 */
import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ui2VariantProvider } from '../../hooks/useUi2Theme';
import { useReadingPreferences } from '../../hooks/useReadingPreferences';

export function ReaderThemeScope({ children }: { children: ReactNode }) {
  const { prefs } = useReadingPreferences();
  const warm = prefs.nightReading;
  return (
    <Ui2VariantProvider variant={warm ? 'warm' : 'system'}>
      {warm ? <StatusBar style="light" /> : null}
      {children}
    </Ui2VariantProvider>
  );
}
