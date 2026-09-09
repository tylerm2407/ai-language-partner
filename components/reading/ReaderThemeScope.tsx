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
 * tab bar leaves while a page is up, and holds the reader's in-app brightness
 * step for as long as it is mounted; `lib/reader-brightness.ts` restores the phone's own value when the
 * last surface goes. A `null` step touches nothing.
 *
 * Nothing outside this boundary ever renders from `ui2Warm`. That is the
 * scope Tyler chose on 2026-09-09: the reader only, not the tab or the app.
 */
import { useEffect, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ui2VariantProvider } from '../../hooks/useUi2Theme';
import { useReadingPreferences } from '../../hooks/useReadingPreferences';
import { acquireReaderBrightness, setReaderBrightnessStep } from '../../lib/reader-brightness';
import { enterImmersive } from '../../lib/immersive-mode';

export function ReaderThemeScope({ children }: { children: ReactNode }) {
  const { prefs } = useReadingPreferences();
  const warm = prefs.nightReading;

  // The floating tab bar hides while any reading surface is mounted.
  useEffect(() => enterImmersive(), []);

  // Acquire once per mount; follow the step separately so changing it in the
  // sheet does not release and re-acquire (which would restore-then-dim).
  useEffect(() => acquireReaderBrightness(prefs.brightness), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setReaderBrightnessStep(prefs.brightness);
  }, [prefs.brightness]);

  return (
    <Ui2VariantProvider variant={warm ? 'warm' : 'system'}>
      {warm ? <StatusBar style="light" /> : null}
      {children}
    </Ui2VariantProvider>
  );
}
