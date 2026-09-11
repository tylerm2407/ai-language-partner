import {
  capturePostHogEvent,
  type PostHogCaptureConfig,
  type PostHogScalar,
  type ServerAnalyticsEvent,
} from '../_shared/posthog.ts';
import type { Tier } from './tier.ts';

const EVENTS_BY_LIFECYCLE: Record<string, string[]> = {
  INITIAL_PURCHASE: ['purchase_completed', 'subscription_started'],
  NON_RENEWING_PURCHASE: ['purchase_completed'],
  RENEWAL: ['purchase_completed', 'subscription_renewed'],
  CANCELLATION: ['subscription_cancelled'],
  EXPIRATION: ['subscription_expired'],
};

function scalar(event: Record<string, unknown>, key: string): PostHogScalar | undefined {
  const value = event[key];
  return typeof value === 'string' || typeof value === 'number' ||
      typeof value === 'boolean' || value === null
    ? value
    : undefined;
}

function billingTerm(productId: unknown): string | undefined {
  if (typeof productId !== 'string') return undefined;
  const normalized = productId.toLowerCase();
  if (normalized.includes('year') || normalized.includes('annual')) return 'annual';
  if (normalized.includes('month')) return 'monthly';
  return undefined;
}

/** Build the closed, non-PII event set emitted after entitlement persistence. */
export function revenueCatAnalyticsEvents(
  event: Record<string, unknown>,
  tier: Tier,
): ServerAnalyticsEvent[] {
  if (event.environment !== 'PRODUCTION') return [];
  const providerEventType = typeof event.type === 'string' ? event.type : '';
  const eventId = typeof event.id === 'string' ? event.id : '';
  const distinctId = typeof event.app_user_id === 'string' ? event.app_user_id : '';
  if (!eventId || !distinctId) return [];

  const timestampCandidate = typeof event.event_timestamp_ms === 'number'
    ? event.event_timestamp_ms
    : typeof event.purchased_at_ms === 'number'
    ? event.purchased_at_ms
    : undefined;
  // PostHog deduplication includes the timestamp. RevenueCat documents an
  // event timestamp on lifecycle webhooks; refusing to invent one preserves a
  // stable identity if an invalid payload somehow gets this far.
  if (timestampCandidate === undefined || !Number.isFinite(timestampCandidate) || timestampCandidate < 0) {
    return [];
  }
  const timestampMs = timestampCandidate;
  const term = billingTerm(event.product_id);
  const common: Record<string, PostHogScalar> = {
    provider: 'revenuecat',
    providerEventType,
    tier,
    environment: 'production',
    ...(term ? { term } : {}),
    ...(scalar(event, 'currency') !== undefined ? { currency: scalar(event, 'currency')! } : {}),
    ...(scalar(event, 'price_in_purchased_currency') !== undefined
      ? { amount: scalar(event, 'price_in_purchased_currency')! }
      : {}),
    ...(scalar(event, 'renewal_number') !== undefined
      ? { renewalNumber: scalar(event, 'renewal_number')! }
      : {}),
  };

  return (EVENTS_BY_LIFECYCLE[providerEventType] ?? []).map((name) => ({
    event: name,
    distinctId,
    insertId: `revenuecat:${eventId}:${name}`,
    properties: common,
    timestamp: new Date(timestampMs).toISOString(),
  }));
}

export async function captureRevenueCatAnalytics(
  event: Record<string, unknown>,
  tier: Tier,
  config?: PostHogCaptureConfig,
  fetcher?: typeof fetch,
): Promise<void> {
  const events = revenueCatAnalyticsEvents(event, tier);
  await Promise.all(events.map((item) => capturePostHogEvent(item, config, fetcher)));
}
