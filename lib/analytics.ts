// Product analytics — provider-agnostic.
//
// Call sites use trackEvent/identifyUser/resetAnalytics. The provider is
// registered ONCE at startup by lib/analytics-posthog.ts; until then this is a
// safe no-op in production (dev logs to console). Keeping the indirection
// means a provider swap touches one file, not ninety call sites.
//
// TWO RULES, ENFORCED BY THE TYPES BELOW RATHER THAN BY CONVENTION, because
// analytics rots quietly — a misnamed event or a leaked property is invisible
// until the day you need the number.
//
//   1. THE EVENT SET IS CLOSED. `EventName` is a union, so `lesson_completed`
//      cannot drift into `Lesson_Completed` next quarter and split one funnel
//      in two. Adding an event is a deliberate edit here.
//
//   2. PROPERTIES ARE ALLOW-LISTED AND NON-IDENTIFYING. This app holds a lot
//      of learner free text — `ideal_l2_self`, chat turns, written
//      submissions, saved words — and none of it may reach a third party.
//      `EventProperties` is a closed shape of scalars with no index signature,
//      so there is no hole to pour a learner's sentence through. Once it is
//      sent it cannot be recalled.

type EventName =
  | 'lesson_started'
  | 'lesson_completed'
  /** Left a lesson without finishing it. The retention counterpart to
   *  `lesson_completed`: a lesson nobody finishes is a content problem, and
   *  without this it is indistinguishable from one nobody starts. */
  | 'lesson_abandoned'
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
  | 'avatar_preset_selected'

  // ── Onboarding funnel: where do they fall out before starting?
  | 'onboarding_step_viewed'
  | 'onboarding_abandoned'
  | 'signup_completed'

  // ── Feature reach: which of the Phase 2 features get used at all?
  | 'reading_book_opened'
  | 'reading_word_looked_up'
  | 'reading_passage_explained'
  | 'audiobook_segment_played'
  | 'goal_track_requested'
  | 'goal_track_lesson_opened'
  | 'checkpoint_started'
  | 'checkpoint_completed'
  | 'chat_message_sent'
  /** A learner saved a word from reading into their SRS deck. */
  | 'card_saved'

  // ── The wall: every place the product says no. The churn events.
  | 'quota_exhausted'
  | 'feature_unavailable'

  /**
   * A screen was shown.
   *
   * Deliberately a normal event with a `screen` property rather than a
   * provider-specific screen call: `AnalyticsProvider` has three methods on
   * purpose, and every provider can group by a property. It also means screen
   * views obey the same closed-union and closed-property rules as everything
   * else, instead of being a second, looser channel.
   */
  | 'screen_viewed';

/**
 * The only properties an event may carry.
 *
 * Deliberately a closed shape of scalars rather than
 * `Record<string, string | number | boolean>`: that signature accepted any key
 * and any string, which is how a learner's written answer ends up in a
 * third-party system. Everything here is a code, a category or a count.
 */
export interface EventProperties {
  /** Target language being learned, e.g. 'fr'. Never the learner's own name. */
  language?: string;
  /** CEFR band, e.g. 'B1'. */
  band?: string;
  /** Plan tier: starter | basic | premium | vip. */
  tier?: string;
  /** Coarse screen/route name. Not a deep link with ids. */
  screen?: string;
  /**
   * A server limit or error code, e.g. DAILY_WORD_LOOKUP_LIMIT_REACHED. These
   * come from the fixed set the edge functions already emit, which is what
   * makes them both safe to send and useful to group by.
   */
  code?: string;
  /** Which quota was hit, e.g. 'word_lookups'. */
  quota?: string;
  /** Which of a multi-step flow, 1-based. */
  step?: number;
  /** A count — items, seconds, index. Never an identifier. */
  count?: number;
  /** Score as a 0..1 ratio. */
  score?: number;
  /** Whether the thing succeeded. */
  ok?: boolean;
  /** A shared-content id (book, lesson). Content is shared, not personal. */
  contentId?: string;
  /** Where a generated thing came from: 'cache' | 'generated'. */
  source?: string;
  /** App version, stamped automatically so churn can be tied to a release. */
  appVersion?: string;
  /** Plan tier the learner was ALREADY on when a paywall event fired — the
   *  upgrade-vs-downgrade direction is meaningless without it. */
  currentTier?: string;
  /** Which avatar preset was chosen, from the shared premade library
   *  (`avatar_presets`). A catalogue id, not a generated photo. */
  presetId?: string;
  /** Which tier the paywall was PRESENTING when the learner acted on it.
   *  Distinct from `currentTier`, which is what they already had. */
  tierShown?: string;
  /** Billing term shown: 'monthly' | 'yearly'. */
  term?: string;
  /** How hard the paywall was: 'soft' | 'hard'. A soft gate that is declined
   *  and a hard gate that blocks are different events for the same screen. */
  gate?: string;
  /** Named step of a multi-step flow, e.g. 'idealSelf'. From a closed set in
   *  the flow itself — readable in a funnel, where a bare index is not. */
  stepName?: string;
}

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

/**
 * Report a server refusal.
 *
 * Every wall the product puts up already returns a code — daily limits,
 * entitlement, outages — and until now they were reported nowhere. This is the
 * most valuable churn signal in the app: "hit the new-card cap and never came
 * back" versus "hit it and upgraded within 48 hours" is the number pricing
 * should be decided on.
 */
export function trackRefusal(code: string, properties?: EventProperties): void {
  const isQuota = code.includes('LIMIT_REACHED') || code.includes('CAP_REACHED');
  const isUpgrade = code === 'UPGRADE_REQUIRED';
  trackEvent(
    isQuota ? 'quota_exhausted' : isUpgrade ? 'paywall_viewed' : 'feature_unavailable',
    { ...properties, code },
  );
}
