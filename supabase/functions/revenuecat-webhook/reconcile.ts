import { isPlausibleUuid } from './auth.ts';
import { resolveTier, type Tier } from './tier.ts';

export interface ReconciledEntitlement {
  userId: string;
  tier: Tier;
  isActive: boolean;
  subscriptionStatus: 'active' | 'inactive';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface RevenueCatEntitlement {
  expires_date?: unknown;
  product_identifier?: unknown;
}

/** Valid application identities affected by a transfer, de-duplicated. */
export function transferUserIds(event: Record<string, unknown>): string[] {
  const values = [event.transferred_from, event.transferred_to]
    .flatMap((value) => Array.isArray(value) ? value : []);
  return [...new Set(values.filter(isPlausibleUuid) as string[])];
}

/**
 * Convert RevenueCat's v1 subscriber payload into the one subscription row
 * our quota functions consume. Expired entitlements are ignored; when more
 * than one is active, normal tier precedence chooses the richest one.
 */
export function subscriptionFromSubscriber(
  userId: string,
  payload: unknown,
  nowMs = Date.now(),
): ReconciledEntitlement {
  const root = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const subscriber = root.subscriber && typeof root.subscriber === 'object' &&
      !Array.isArray(root.subscriber)
    ? root.subscriber as Record<string, unknown>
    : {};
  const entitlements = subscriber.entitlements && typeof subscriber.entitlements === 'object' &&
      !Array.isArray(subscriber.entitlements)
    ? subscriber.entitlements as Record<string, RevenueCatEntitlement>
    : {};

  const active = Object.entries(entitlements).flatMap(([identifier, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const rawExpiry = value.expires_date;
    const expiryMs = typeof rawExpiry === 'string' ? Date.parse(rawExpiry) : null;
    const lifetime = rawExpiry === null;
    if (!lifetime && (expiryMs === null || !Number.isFinite(expiryMs) || expiryMs <= nowMs)) {
      return [];
    }
    return [{
      identifier,
      productId: typeof value.product_identifier === 'string' ? value.product_identifier : null,
      expiryMs,
    }];
  });

  const tier = resolveTier(
    active.map((item) => item.identifier),
    active.map((item) => item.productId ?? '').join(' '),
  );
  if (active.length > 0 && tier === 'starter') {
    throw new Error('active RevenueCat entitlement does not map to a Fluenci tier');
  }
  if (active.length === 0) {
    return {
      userId,
      tier: 'starter',
      isActive: false,
      subscriptionStatus: 'inactive',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  const finiteExpiries = active
    .map((item) => item.expiryMs)
    .filter((value): value is number => value !== null);
  return {
    userId,
    tier,
    isActive: true,
    subscriptionStatus: 'active',
    currentPeriodEnd: finiteExpiries.length > 0
      ? new Date(Math.max(...finiteExpiries)).toISOString()
      : null,
    cancelAtPeriodEnd: false,
  };
}

export async function fetchRevenueCatSubscription(
  userId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<ReconciledEntitlement> {
  const response = await fetcher(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
  }
  return subscriptionFromSubscriber(userId, await response.json());
}
