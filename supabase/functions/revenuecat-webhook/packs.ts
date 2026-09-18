// Consumable minute packs, handled BEFORE anything touches `subscriptions`.
//
// A pack is a one-off purchase that grants tutor seconds. It carries no
// entitlement and must never reach tier resolution, because `tier.ts` resolves
// a tier by substring match over the product id and entitlement ids. Two
// distinct disasters live on the other side of that boundary:
//
//   • NON_RENEWING_PURCHASE was in ACTIVE_EVENTS and a pack id matching no tier
//     word resolves to `starter`, which lands in the unmapped-tier branch and
//     answers 500. RevenueCat then redelivers forever and the learner never
//     gets the minutes they paid for.
//
//   • CANCELLATION for a refunded pack carries a revocation `cancel_reason`,
//     and `classifyEvent` reads that as "this person's access has ended" —
//     so refunding a $4.99 minute pack would REVOKE a $29.99 subscription.
//
// Both are silent from the RevenueCat dashboard. Hence one branch, taken on the
// product id alone, that returns before the subscription path exists.
//
// Idempotency is doubled deliberately. `claim_revenuecat_event` dedupes at the
// event level, and `tutor_credit_lots.store_transaction_id` is UNIQUE, so a
// replay cannot grant twice even if the claim is ever bypassed or reset.

import { packForProductId, type TutorPack } from '../_shared/tutor-packs.ts';
import { resolveTier } from '../_shared/entitlement.ts';

/**
 * The only tier packs are sold to.
 *
 * Enforced at the till rather than at the ledger, and the asymmetry is
 * deliberate: SPENDING a balance is open to whoever holds one, because a
 * cancelled vip must still be able to use minutes they already bought (App
 * Store 3.1.1 — see tutor-session/start.ts). Since only a vip can reach this
 * grant, "holds a balance" already implies "was vip when they paid".
 */
const PACK_TIER = 'vip';

export type PackAction =
  | { kind: 'grant'; pack: TutorPack }
  | { kind: 'refund'; pack: TutorPack }
  | { kind: 'ignore'; pack: TutorPack };

/**
 * Decide what a pack event means, or `null` for "this is not a pack event" —
 * which is the signal for the caller to carry on down the subscription path.
 *
 * Pure, so packs.test.ts can pin it without booting the function.
 */
export function classifyPackEvent(type: string, productId: string | null): PackAction | null {
  const pack = packForProductId(productId);
  if (!pack) return null;
  if (type === 'NON_RENEWING_PURCHASE') return { kind: 'grant', pack };
  // A refunded consumable arrives as CANCELLATION carrying a cancel_reason.
  // The reason is not consulted: there is no such thing as a consumable the
  // customer "cancels" without the money coming back, so any CANCELLATION on a
  // pack is a clawback.
  if (type === 'CANCELLATION') return { kind: 'refund', pack };
  // Anything else on a pack product — a TEST event, or an event type
  // RevenueCat adds later — is acknowledged and changes nothing. Never fall
  // through to tier resolution.
  return { kind: 'ignore', pack };
}

/** The store's own transaction id, which is what the ledger is keyed on.
 *  Falls back to the event id: both are stable across RevenueCat retries, and
 *  a lot with no key at all cannot be made idempotent. */
export function packTransactionId(event: Record<string, unknown>): string | null {
  const txn = event.transaction_id;
  if (typeof txn === 'string' && txn.length > 0 && txn.length <= 255) return txn;
  const id = event.id;
  if (typeof id === 'string' && id.length > 0 && id.length <= 255) return id;
  return null;
}

export interface PackResult {
  status: number;
  body: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
type Client = any;

/**
 * Apply a pack event. Returns the HTTP response the webhook should give.
 *
 * Failure policy differs by direction, on purpose:
 *   • a failed GRANT answers 500 so RevenueCat retries — the learner has paid
 *     and is owed minutes, and a retry can still deliver them.
 *   • a failed REFUND also answers 500, because a clawback we drop is money
 *     lost silently.
 *   • an event for a pack we cannot key (no transaction id) answers 200 and
 *     logs loudly: retrying cannot conjure an id, and 500 would have
 *     RevenueCat redelivering it until it gave up.
 */
export async function applyPackEvent(
  supabase: Client,
  userId: string,
  event: Record<string, unknown>,
  action: PackAction,
): Promise<PackResult> {
  if (action.kind === 'ignore') {
    return { status: 200, body: { ok: true, pack: action.pack.productId, ignored: true } };
  }

  const transactionId = packTransactionId(event);
  if (!transactionId) {
    console.error(
      `[revenuecat-webhook] pack ${action.pack.productId} event for ${userId} has no ` +
        'transaction_id or id — cannot be made idempotent, so it is dropped',
    );
    return { status: 200, body: { ok: true, pack: action.pack.productId, unkeyed: true } };
  }

  if (action.kind === 'grant') {
    // A non-vip purchase should be unreachable: the pack offering is shown only
    // to vip. If one lands anyway, GRANT IT AND SHOUT — Apple has already taken
    // the learner's money, and refusing to deliver what they paid for is both a
    // refund request and an App Review failure ("in-app purchase does not
    // work"). A tier leak is a bug to fix; withheld goods is a broken product.
    //
    // Failure to resolve the tier is NOT allowed to block the grant either.
    // resolveTier fails closed to `starter`, which is correct for gating a
    // feature and wrong for delivering a purchase.
    const tier = await resolveTier(supabase, userId).catch(() => null);
    if (tier !== PACK_TIER) {
      console.error(
        `[revenuecat-webhook] pack ${action.pack.productId} bought by ${userId} on tier ` +
          `${tier ?? 'unknown'}, not ${PACK_TIER} — granting anyway (money already taken). ` +
          'Check which RevenueCat offering exposes the pack products.',
      );
    }

    const { data, error } = await supabase.rpc('grant_tutor_credit_lot', {
      p_user_id: userId,
      p_store_transaction_id: transactionId,
      p_product_id: action.pack.productId,
      p_seconds: action.pack.seconds,
    });
    if (error) {
      console.error('[revenuecat-webhook] tutor credit grant failed:', error.message);
      return { status: 500, body: { error: 'credit_grant_failed' } };
    }
    const status = String((data as Record<string, unknown> | null)?.status ?? '');
    console.log(
      `[revenuecat-webhook] ${status} ${action.pack.minutes} tutor minutes for ${userId} ` +
        `(${action.pack.productId}, txn ${transactionId})`,
    );
    return { status: 200, body: { ok: true, pack: action.pack.productId, grant: status } };
  }

  const { data, error } = await supabase.rpc('refund_tutor_credit_lot', {
    p_user_id: userId,
    p_store_transaction_id: transactionId,
  });
  if (error) {
    console.error('[revenuecat-webhook] tutor credit clawback failed:', error.message);
    return { status: 500, body: { error: 'credit_refund_failed' } };
  }
  const status = String((data as Record<string, unknown> | null)?.status ?? '');
  console.warn(
    `[revenuecat-webhook] pack refund (${status}) for ${userId}: ${action.pack.productId}, ` +
      `txn ${transactionId}. Subscription state untouched.`,
  );
  return { status: 200, body: { ok: true, pack: action.pack.productId, refund: status } };
}
