/**
 * The one definition of "which plan is this learner on".
 *
 * Before this file, eleven functions each read `subscriptions` themselves and
 * ten of them decided entitlement on `is_active` alone. `get_effective_limits`
 * (the RPC) and `generate-goal-track` also required `current_period_end` to be
 * in the future. Two definitions of "paid" in one codebase means a missed
 * expiry webhook — RevenueCat EXPIRATION not delivered, a Stripe
 * `customer.subscription.deleted` lost — leaves `is_active = true` forever, and
 * the ten functions keep serving paid limits while the RPC says free.
 *
 * `current_period_end` is the ground truth the billing providers actually
 * write; `is_active` is our cache of it. Both must agree. A NULL period end is
 * a grant without an end (pilot logins, manual comps) and stays entitled.
 *
 * Fail closed: any error, missing row, or unknown tier string resolves to
 * `starter`. Nothing in here can ever hand out a tier the row does not carry.
 */
import { getEffectiveLimits, getPlanLimits, type PlanLimits, type PlanTier } from './plan-limits.ts';

const KNOWN_TIERS: ReadonlySet<string> = new Set(['starter', 'basic', 'premium', 'vip']);

/** The tiers that unlock paid features outright (as opposed to metered ones). */
export const PAID_TIERS: ReadonlySet<PlanTier> = new Set<PlanTier>(['basic', 'premium', 'vip']);

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

/**
 * Resolve the learner's active tier. `starter` unless the subscription row is
 * active AND unexpired AND names a tier we know.
 */
export async function resolveTier(supabase: AnySupabaseClient, userId: string): Promise<PlanTier> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, is_active, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return 'starter';
  if (data.is_active !== true) return 'starter';
  if (typeof data.current_period_end === 'string') {
    const endsAt = Date.parse(data.current_period_end);
    if (Number.isFinite(endsAt) && endsAt <= Date.now()) return 'starter';
  }
  const tier = typeof data.tier === 'string' ? data.tier : 'starter';
  return (KNOWN_TIERS.has(tier) ? tier : 'starter') as PlanTier;
}

/** True for basic and up. */
export function isPaidTier(tier: string): boolean {
  return PAID_TIERS.has(tier as PlanTier);
}

/**
 * Tier plus the limits that apply to it, school overrides included. This is
 * what a metered function should call: one round trip for the tier, one for
 * the RPC, and the result carries every key in `PlanLimits`.
 */
export async function resolveEntitlement(
  supabase: AnySupabaseClient,
  userId: string,
): Promise<{ tier: PlanTier; limits: PlanLimits }> {
  const tier = await resolveTier(supabase, userId);
  const limits = await getEffectiveLimits(userId, supabase, tier);
  return { tier, limits };
}

/** Static plan limits for a tier, for callers that must not touch the RPC. */
export function planLimitsFor(tier: PlanTier): PlanLimits {
  return getPlanLimits(tier);
}
