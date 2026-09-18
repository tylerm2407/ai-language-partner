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
 * Priced 2026-09-18 against a booked cost of 9 cents/minute and a take rate of
 * 84.15% (Apple Small Business 15%, then RevenueCat 1%).
 *
 * THE BAND, AND WHY IT IS NARROW
 *
 *   Floor   10.7 c/min — breakeven, 9 / 0.8415.
 *   Ceiling 19.3 c/min — $29.99 divided by the 155 minutes a VIP month already
 *                        includes. Above it a pack costs more per minute than
 *                        the plan it supplements, which reads as a punishment
 *                        for wanting more.
 *
 * Both moved when TUTOR_CENTS_PER_MINUTE fell from 12 to 9: the floor dropped
 * with cost, but the ceiling dropped FASTER, because more included minutes mean
 * a lower implied rate on the plan. The band narrowed from ~11.6 cents wide to
 * ~8.6. Raising plan minutes squeezes pack pricing from both ends — expect this
 * to tighten again at the next rate cut, and re-derive rather than re-scaling.
 *
 * The ladder is shallow (10% at the top rung) because our cost is linear
 * pass-through: every discount point is margin given away with no cost saving
 * behind it. Games run 50% ladders because their marginal cost is near zero.
 *
 * THE RISK, STATED PLAINLY
 *
 * Credit-funded sessions skip `monthly_usage.tutor_cents` entirely (migration
 * 149), so a purchased minute's margin is set by ACTUAL vendor cost, not by the
 * booked rate. At the 14.6 c/min top of the last production measurement, a
 * 30-minute pack at $4.99 nets $4.20 against $4.38 of cost — a LOSS. These
 * prices assume the context truncation in `tutor-pricing.ts` delivers what it
 * models (~2.85 c/min), and that is unverified.
 *
 * DO NOT TREAT THESE AS FINAL until an invoice covering a post-truncation
 * window has been divided by SUM(observed_seconds)/60 over the same period.
 * App Store prices are editable at any time, so creating the products does not
 * commit us to these numbers.
 */
export const TUTOR_PACKS: readonly TutorPack[] = [
  { productId: 'fluenci_tutor_pack_30', minutes: 30, seconds: 30 * 60 },
  { productId: 'fluenci_tutor_pack_75', minutes: 75, seconds: 75 * 60 },
  { productId: 'fluenci_tutor_pack_120', minutes: 120, seconds: 120 * 60 },
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
