// Basic analytics tracking. Replace with a real provider (Mixpanel, Amplitude, PostHog) later.

type EventName =
  | 'lesson_started'
  | 'lesson_completed'
  | 'review_started'
  | 'review_completed'
  | 'card_reviewed'
  | 'practice_started'
  | 'practice_ended'
  | 'streak_updated'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'onboarding_completed'
  | 'language_selected'
  | 'audio_played'
  | 'recording_submitted';

type EventProperties = Record<string, string | number | boolean>;

/**
 * Track an analytics event. Currently logs to console in dev.
 * Replace the implementation with your analytics provider.
 */
export function trackEvent(name: EventName, properties?: EventProperties): void {
  if (__DEV__) {
    console.log(`[Analytics] ${name}`, properties ?? '');
  }

  // TODO: Send to analytics provider
  // Example: posthog.capture(name, properties);
}

/**
 * Identify the current user for analytics.
 */
export function identifyUser(userId: string, traits?: EventProperties): void {
  if (__DEV__) {
    console.log(`[Analytics] Identify: ${userId}`, traits ?? '');
  }

  // TODO: posthog.identify(userId, traits);
}

/**
 * Reset analytics identity on logout.
 */
export function resetAnalytics(): void {
  if (__DEV__) {
    console.log('[Analytics] Reset');
  }

  // TODO: posthog.reset();
}
