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
 * It also raises the immersive flag (`lib/immersive-mode.ts`) so the floating
 * tab bar leaves while a page is up. Brightness is deliberately NOT here: an
 * in-app control shipped briefly on 2026-09-09 and was removed two days later
 * — on iOS it writes the system value, and the learner already has Control
 * Center for that.
 *
 * Nothing outside this boundary ever renders from `ui2Warm`. That is the
 * scope Tyler chose on 2026-09-09: the reader only, not the tab or the app.
 */
import { useEffect, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ui2VariantProvider } from '../../hooks/useUi2Theme';
import { useReadingPreferences } from '../../hooks/useReadingPreferences';
import { enterImmersive } from '../../lib/immersive-mode';

export function ReaderThemeScope({ children }: { children: ReactNode }) {
  const { prefs } = useReadingPreferences();
  const warm = prefs.nightReading;

  // The floating tab bar hides while any reading surface is mounted.
  useEffect(() => enterImmersive(), []);

  return (
    <Ui2VariantProvider variant={warm ? 'warm' : 'system'}>
      {warm ? <StatusBar style="light" /> : null}
      {children}
    </Ui2VariantProvider>
  );
}
