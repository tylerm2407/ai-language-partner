import PostHog from 'posthog-react-native';

// ─── PostHog Client ─────────────────────────────────────────────

const POSTHOG_API_KEY = 'phc_mlVc9Kk77Y2RSw29DQrVAPBGkc8BysYl9PpqV3Pr6ln';
const POSTHOG_HOST = 'https://us.i.posthog.com';

export const posthog = new PostHog(POSTHOG_API_KEY, {
  host: POSTHOG_HOST,
  enableSessionReplay: false,
});

// ─── Event Types ────────────────────────────────────────────────

type EventName =
  // Learning
  | 'lesson_started'
  | 'lesson_completed'
  | 'review_started'
  | 'review_completed'
  | 'card_reviewed'
  // Practice
  | 'practice_started'
  | 'practice_ended'
  | 'voice_practice_started'
  | 'voice_practice_ended'
  | 'driving_mode_started'
  | 'driving_mode_ended'
  | 'scenario_selected'
  // Reading
  | 'reading_opened'
  | 'reading_ai_action'
  // Writing
  | 'writing_prompt_selected'
  | 'writing_submitted'
  // Pronunciation
  | 'recording_submitted'
  | 'pronunciation_retry'
  // Audio
  | 'audio_played'
  // User
  | 'streak_updated'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'onboarding_completed'
  | 'language_selected'
  | 'level_up'
  | 'personality_changed'
  | 'vocab_added_to_srs'
  // Screen views
  | 'screen_viewed';

type EventProperties = Record<string, string | number | boolean>;

/**
 * Track an analytics event via PostHog.
 */
export function trackEvent(name: EventName, properties?: EventProperties): void {
  if (__DEV__) {
    console.log(`[Analytics] ${name}`, properties ?? '');
  }

  posthog.capture(name, properties);
}

/**
 * Track a screen view.
 */
export function trackScreen(screenName: string, properties?: EventProperties): void {
  posthog.screen(screenName, properties);
}

/**
 * Identify the current user for analytics.
 */
export function identifyUser(userId: string, traits?: EventProperties): void {
  if (__DEV__) {
    console.log(`[Analytics] Identify: ${userId}`, traits ?? '');
  }

  posthog.identify(userId, traits);
}

/**
 * Reset analytics identity on logout.
 */
export function resetAnalytics(): void {
  if (__DEV__) {
    console.log('[Analytics] Reset');
  }

  posthog.reset();
}
