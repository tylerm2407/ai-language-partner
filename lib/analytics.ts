// Product analytics — provider-agnostic.
//
// Call sites use trackEvent/identifyUser/resetAnalytics. To activate a real
// provider (PostHog recommended), install its SDK and register it ONCE at
// startup via setAnalyticsProvider() — see the PostHog snippet in the README /
// the setup notes. Until a provider is registered this is a safe no-op in
// production (dev logs to console).

type EventName =
  | 'lesson_started'
  | 'lesson_completed'
  | 'review_started'
  | 'review_completed'
  | 'card_reviewed'
  | 'practice_started'
  | 'practice_ended'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'onboarding_completed'
  | 'language_selected'
  | 'audio_played'
  | 'recording_submitted'
  | 'paywall_viewed'
  // Declining the paywall for the free plan. Paired with `paywall_viewed` this
  // is the free-vs-paid split for the setup funnel — without it a decline is
  // indistinguishable from an abandon.
  | 'paywall_declined'
  | 'free_avatar_generated'
  | 'purchase_completed'
  | 'purchase_restored'
  | 'plan_term_toggled'
  | 'plan_tier_selected'
  | 'avatar_preset_selected';

type EventProperties = Record<string, string | number | boolean>;

/**
 * Minimal surface any analytics SDK can satisfy. PostHog, Amplitude, Segment,
 * and Mixpanel all expose compatible capture/identify/reset methods.
 */
export interface AnalyticsProvider {
  capture: (event: string, properties?: EventProperties) => void;
  identify: (userId: string, traits?: EventProperties) => void;
  reset: () => void;
}

let provider: AnalyticsProvider | null = null;

/** Register (or clear) the analytics provider. Call once at app startup. */
export function setAnalyticsProvider(p: AnalyticsProvider | null): void {
  provider = p;
}

/** Track an analytics event. */
export function trackEvent(name: EventName, properties?: EventProperties): void {
  if (provider) {
    provider.capture(name, properties);
  } else if (__DEV__) {
    console.log(`[Analytics] ${name}`, properties ?? '');
  }
}

/** Identify the current user (call on login). */
export function identifyUser(userId: string, traits?: EventProperties): void {
  if (provider) {
    provider.identify(userId, traits);
  } else if (__DEV__) {
    console.log(`[Analytics] Identify: ${userId}`, traits ?? '');
  }
}

/** Reset analytics identity (call on logout). */
export function resetAnalytics(): void {
  if (provider) {
    provider.reset();
  } else if (__DEV__) {
    console.log('[Analytics] Reset');
  }
}
