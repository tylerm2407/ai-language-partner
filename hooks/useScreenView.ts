import { useEffect } from 'react';
import { trackEvent, type EventProperties } from '../lib/analytics';

/**
 * Record that a screen was shown.
 *
 * Screens are named from a closed set rather than taken from the route path.
 * Route paths carry ids — `/learn/reading/book/0022e00c-…` — and a funnel
 * keyed on those has one step per book, which is no funnel at all. The name is
 * the thing being measured; the id, where it matters, goes in `contentId`.
 *
 * Fires once per mount. expo-router keeps screens mounted behind a navigation,
 * so a learner returning to a screen re-mounts it and is counted again, which
 * is what "how often do they come back to Review" needs.
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
  // Only the primitive fields are dependencies: passing the object itself
  // would re-fire on every render, because a fresh object literal is a new
  // identity each time and one screen visit would report as hundreds.
  const { language, band, tier, contentId } = props;
  useEffect(() => {
    trackEvent('screen_viewed', { screen, language, band, tier, contentId });
  }, [screen, language, band, tier, contentId]);
}
