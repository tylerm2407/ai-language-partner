// RevenueCat event → the arguments for `record_referral_store_event`
// (migration 148).
//
// Pure, like tier.ts, so it is testable without booting index.ts. The RPC
// does the deciding (is this real money? does it qualify a referral? is it a
// refund that voids one?); this only lifts the fields off the event and
// refuses to guess at ones that are missing or malformed.

export interface ReferralStoreEventArgs {
  p_user_id: string;
  p_event_id: string;
  p_event_type: string;
  p_store: string;
  p_environment: string | null;
  p_original_transaction_id: string | null;
  p_product_id: string | null;
  p_period_type: string | null;
  p_price: number | null;
  p_expires_at: string | null;
  p_is_revocation: boolean;
}

function shortString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

/**
 * Null when the event carries no store — the RPC keys its identity row on
 * (user, store), and a guessed store would file an Apple transaction under
 * the wrong one.
 */
export function referralStoreEventArgs(
  event: Record<string, unknown>,
  userId: string,
  eventId: string,
  isRevocation: boolean,
): ReferralStoreEventArgs | null {
  const store = shortString(event.store, 32);
  if (!store) return null;

  // `price` is RevenueCat's USD-normalised amount; only its sign is used.
  const price = typeof event.price === 'number' && Number.isFinite(event.price) ? event.price : null;
  const expiresMs = typeof event.expiration_at_ms === 'number' && Number.isFinite(event.expiration_at_ms)
    ? event.expiration_at_ms
    : null;

  return {
    p_user_id: userId,
    p_event_id: eventId,
    p_event_type: String(event.type ?? ''),
    p_store: store,
    p_environment: shortString(event.environment, 32),
    p_original_transaction_id: shortString(event.original_transaction_id, 128),
    p_product_id: shortString(event.product_id, 128),
    p_period_type: shortString(event.period_type, 32),
    p_price: price,
    p_expires_at: expiresMs === null ? null : new Date(expiresMs).toISOString(),
    p_is_revocation: isRevocation,
  };
}
