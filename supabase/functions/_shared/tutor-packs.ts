/**
 * The minute packs, and the reason their names matter more than they look.
 *
 * A pack is a CONSUMABLE in-app purchase: a one-off payment that grants
 * purchased tutor seconds. It is not a subscription, it carries no entitlement,
 * and it must never be allowed anywhere near tier resolution.
 *
 * WHY THAT IS A REAL HAZARD AND NOT A STYLE NOTE
 *
 * `revenuecat-webhook/tier.ts` resolves a tier by SUBSTRING MATCH over the
 * joined entitlement ids and product id, looking for `vip`, `premium` or
 * `basic`. That is correct for subscriptions and catastrophic here. A pack
 * named `vip_minutes_30` would match `vip` and hand a full VIP subscription to
 * anyone who bought a $6.99 pack. A pack named `fluenci_minutes_30` would match
 * nothing, resolve to `starter`, and fall into the unmapped-tier branch, which
 * answers 500 — so RevenueCat would redeliver it forever and the learner would
 * never get their minutes.
 *
 * Both failures are invisible from the dashboard. `packProductIdsAreSafe()`
 * below is asserted by tutor-packs.test.ts so a future pack cannot be named
 * into either one.
 *
 * SECONDS, NOT MINUTES, ARE THE STORED UNIT — the ledger counts seconds
 * everywhere else (`daily_usage.tutor_seconds`, `tutor_credit_lots`), and one
 * conversion at the edge beats two units in the same table.
 *
 * MIRRORED ON THE CLIENT. `lib/tutor-packs.ts` carries the same list for
 * display and purchase. This copy is the only one that grants anything: the
 * client names a product, the store charges for it, and the seconds come from
 * HERE via the webhook. A client that invents a pack size grants itself
 * nothing.
 */

export interface TutorPack {
  /** Store product id. See the naming hazard above. */
  readonly productId: string;
  readonly minutes: number;
  readonly seconds: number;
}

/**
 * Priced 2026-09-17 against a booked cost of 12 cents/minute and a take rate of
 * 84.15% (Apple Small Business 15%, then RevenueCat 1%). Breakeven is 14.3
 * cents/minute; the ceiling is ~25.9, which is $29.99 divided by the ~116
 * minutes a VIP month already includes — above that a pack looks worse than the
 * plan the learner is already paying for.
 *
 * The ladder is shallow on purpose. Our cost is linear pass-through, so a
 * volume discount is margin given away with no cost saving behind it; 20% at
 * the top rung is what fits between the floor and the ceiling, not a preference.
 */
export const TUTOR_PACKS: readonly TutorPack[] = [
  { productId: 'fluenci_tutor_pack_20', minutes: 20, seconds: 20 * 60 },
  { productId: 'fluenci_tutor_pack_50', minutes: 50, seconds: 50 * 60 },
  { productId: 'fluenci_tutor_pack_100', minutes: 100, seconds: 100 * 60 },
];

/** The words `resolveTier` substring-matches on. A pack id containing any of
 *  them would be resolved as a subscription. */
export const TIER_WORDS: readonly string[] = ['vip', 'premium', 'basic'];

export function packForProductId(productId: string | null): TutorPack | null {
  if (!productId) return null;
  return TUTOR_PACKS.find((p) => p.productId === productId) ?? null;
}

/** True when no pack id can be mistaken for a subscription. Asserted by tests;
 *  also cheap enough to call at module load if that ever seems worth it. */
export function packProductIdsAreSafe(): boolean {
  return TUTOR_PACKS.every((p) => {
    const id = p.productId.toLowerCase();
    return TIER_WORDS.every((w) => !id.includes(w));
  });
}
