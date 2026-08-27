import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/**
 * Go back, or go somewhere sensible when there is nothing to go back to.
 *
 * `router.back()` is a SILENT no-op when the navigation stack is empty, and
 * every route in this app is deep-linkable. A cold start into a nested route —
 * a `fluenci://` link, a notification tap, a lesson-expiry reminder — lands the
 * learner on a screen whose back chevron does nothing, with no tab bar
 * rendered underneath. The only way out is to force-quit the app.
 *
 * 47 `router.back()` call sites existed; two guarded this (the lesson runner
 * and the paywall, both of which hit it in practice and had it fixed locally).
 * This is that fix, extracted.
 *
 * `replace`, not `push`: the fallback is a recovery, and pushing Home onto a
 * stack that is already confused just adds another layer to escape.
 *
 * @param fallback Where to land when there is no history. Defaults to the app's
 *                 home tab; pass a nearer parent where one is more useful (a
 *                 submission screen is better returning to its assignment than
 *                 to Home).
 */
export function useSafeBack(fallback: string = '/(app)') {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- expo-router's
    // typed-routes generic rejects a runtime string; the value is ours, not user input.
    router.replace(fallback as any);
  }, [router, fallback]);
}
