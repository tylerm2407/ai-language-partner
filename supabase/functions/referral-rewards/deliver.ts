// The referral-rewards run, behind injected dependencies so it can be tested
// without a database, Apple or RevenueCat. index.ts is only serve() + auth +
// wiring (the tutor-session-reaper split).
//
// The database decides WHAT each referrer gets (claim_referral_deliveries,
// migration 148). This file only carries it out and reports back. Every
// delivery ends in finish_referral_delivery, success or not, so a reward is
// never left in 'delivering' by anything short of a crash, and a crash is
// re-offered by the next run under the same delivery id.

export interface Delivery {
  id: string;
  referrer_id: string;
  method: 'apple_extension' | 'revenuecat_promo';
  days: number;
  original_transaction_id: string | null;
  environment: string | null;
  promo_end_at: string | null;
}

export interface RewardDeps {
  appleEnabled: boolean;
  claim(appleEnabled: boolean): Promise<Delivery[]>;
  extendApple(d: Delivery): Promise<{ ok: boolean; detail: string }>;
  premiumExpiryMs(userId: string): Promise<number | null>;
  /** Persists `endAt` unless an earlier attempt already fixed one; returns the stored value. */
  fixPromoTarget(deliveryId: string, endAt: string): Promise<string | null>;
  grantPromo(userId: string, endMs: number): Promise<{ ok: boolean; detail: string }>;
  finish(deliveryId: string, success: boolean, externalRef: string | null, error: string | null): Promise<void>;
  now(): number;
}

export interface RunSummary {
  claimed: number;
  delivered: number;
  failed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Promo time stacks on whatever Premium access the learner already has. */
export function promoEndMs(currentExpiryMs: number | null, nowMs: number, days: number): number {
  const base = currentExpiryMs !== null && currentExpiryMs > nowMs ? currentExpiryMs : nowMs;
  return base + days * DAY_MS;
}

async function deliverOne(d: Delivery, deps: RewardDeps): Promise<{ ok: boolean; detail: string }> {
  if (d.method === 'apple_extension') {
    if (!d.original_transaction_id) return { ok: false, detail: 'missing original transaction id' };
    return deps.extendApple(d);
  }
  let target = d.promo_end_at;
  if (!target) {
    const current = await deps.premiumExpiryMs(d.referrer_id);
    const proposed = new Date(promoEndMs(current, deps.now(), d.days)).toISOString();
    target = await deps.fixPromoTarget(d.id, proposed);
    if (!target) return { ok: false, detail: 'promo target not stored' };
  }
  return deps.grantPromo(d.referrer_id, Date.parse(target));
}

export async function runReferralDeliveries(deps: RewardDeps): Promise<RunSummary> {
  const deliveries = await deps.claim(deps.appleEnabled);
  const summary: RunSummary = { claimed: deliveries.length, delivered: 0, failed: 0 };

  for (const d of deliveries) {
    let outcome: { ok: boolean; detail: string };
    try {
      outcome = await deliverOne(d, deps);
    } catch (err) {
      outcome = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
    await deps.finish(d.id, outcome.ok, outcome.ok ? outcome.detail : null, outcome.ok ? null : outcome.detail);
    if (outcome.ok) summary.delivered++;
    else summary.failed++;
  }
  return summary;
}
