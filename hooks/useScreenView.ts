import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { trackEvent, type EventProperties } from '../lib/analytics';

/**
 * Record that a screen was shown.
 *
 * Fires on FOCUS, not on mount. The tab navigator mounts sibling tab screens
 * alongside the one being navigated to, so a mount-based version reported a
 * view for every tab the learner never looked at — `learn` and `chat` landed
 * 1ms apart, three times, and chat came out as 11 of 19 views and the
 * apparently most-used screen in the app. Focus is the only trigger that means
 * "the learner is looking at this".
 *
 * Re-firing on every refocus is deliberate: returning to Review is a visit,
 * and "how often do they come back to it" is the question this answers.
 *
 * Screens are named from a closed set rather than taken from the route path.
 * Route paths carry ids — `/learn/reading/book/0022e00c-…` — and a funnel
 * keyed on those has one step per book, which is no funnel at all. Where the
 * id matters it goes in `contentId`.
 */
export type ScreenName =
  | 'home'
  | 'learn'
  | 'lesson'
  | 'review'
  | 'reading_library'
  | 'book'
  | 'passage'
  | 'chat'
  | 'practice'
  | 'profile'
  | 'paywall'
  | 'onboarding'
  | 'checkpoint'
  | 'news';

export function useScreenView(screen: ScreenName, props: EventProperties = {}): void {
  // Only the primitive fields are dependencies: depending on the object itself
  // would rebuild the callback every render, because a fresh object literal is
  // a new identity each time, and one visit would report as hundreds.
  const { language, band, tier, contentId } = props;
  useFocusEffect(
    useCallback(() => {
      trackEvent('screen_viewed', { screen, language, band, tier, contentId });
    }, [screen, language, band, tier, contentId]),
  );
}
