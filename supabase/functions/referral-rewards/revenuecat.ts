// RevenueCat promotional access for referrers who are not paying a store.
//
// POST /v1/subscribers/{app_user_id}/entitlements/{entitlement}/promotional
//   { end_time_ms }
// A promotional grant is not idempotent at RevenueCat, so the caller fixes
// the end time once (set_referral_promo_target) and sends the same value on
// every retry: re-granting the same end leaves the same entitlement.

export const REWARD_ENTITLEMENT = 'premium';
const API = 'https://api.revenuecat.com/v1/subscribers';

function entitlementExpiryMs(payload: unknown, entitlement: string): number | null {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const subscriber = root.subscriber && typeof root.subscriber === 'object'
    ? root.subscriber as Record<string, unknown>
    : {};
  const entitlements = subscriber.entitlements && typeof subscriber.entitlements === 'object'
    ? subscriber.entitlements as Record<string, Record<string, unknown>>
    : {};
  const raw = entitlements[entitlement]?.expires_date;
  if (typeof raw !== 'string') return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/** When the learner's current Premium access ends, or null if they have none. */
export async function premiumExpiryMs(
  userId: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<number | null> {
  const response = await fetcher(`${API}/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`revenuecat lookup ${response.status}`);
  return entitlementExpiryMs(await response.json(), REWARD_ENTITLEMENT);
}

/** Grant Premium through `endMs`. Resolves true once RevenueCat reports it. */
export async function grantPromotional(
  userId: string,
  endMs: number,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; detail: string }> {
  const response = await fetcher(
    `${API}/${encodeURIComponent(userId)}/entitlements/${REWARD_ENTITLEMENT}/promotional`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ end_time_ms: endMs }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return { ok: false, detail: `revenuecat ${response.status}` };
  // Trust the returned subscriber, not the status alone.
  const expiry = entitlementExpiryMs(await response.json(), REWARD_ENTITLEMENT);
  if (expiry === null || expiry < endMs - 60_000) {
    return { ok: false, detail: 'revenuecat grant not reflected' };
  }
  return { ok: true, detail: new Date(expiry).toISOString() };
}
