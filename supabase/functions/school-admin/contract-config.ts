/**
 * Validation for `organizations.contract_config`, the school contract that
 * `get_effective_limits` merges into every enrolled student's plan.
 *
 * Kept apart from index.ts (which calls `serve` on import) so it can be
 * tested without a runtime, the same split as school/submission-policy.ts.
 *
 * WHY IT MATTERS. The merge casts each contract key with `::int`. A value
 * that is not an integer does not fall back to anything — the cast raises,
 * `get_effective_limits` fails, and every quota for every student of that
 * organisation fails with it. So a key is either absent (COALESCE to 0, the
 * personal plan wins) or a valid integer; nothing in between gets stored.
 */

/**
 * Upper bound for `maxLanguages`: the unlimited sentinel (migration 147),
 * the same 9999 `dailyNewCards` uses.
 */
export const MAX_CONTRACT_LANGUAGES = 9999;

export type ContractConfigCheck =
  | { ok: true; value: Record<string, unknown> | null }
  | { ok: false; error: string };

/**
 * Check a `contractConfig` from an admin request. `null` clears the contract
 * (allowed); anything else must be a plain object.
 *
 * `maxLanguages`, when present, must be an integer 1..9999. Zero is refused
 * rather than stored: it would merge as "no grant", which is what leaving the
 * key out already says, and a contract reading `0` looks like a school
 * forbidding languages its students' own plans pay for.
 */
export function validateContractConfig(raw: unknown): ContractConfigCheck {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'contractConfig must be an object or null' };
  }
  const config = raw as Record<string, unknown>;

  if ('maxLanguages' in config) {
    const n = config.maxLanguages;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_CONTRACT_LANGUAGES) {
      return {
        ok: false,
        error: `contractConfig.maxLanguages must be an integer from 1 to ${MAX_CONTRACT_LANGUAGES}`,
      };
    }
  }

  return { ok: true, value: config };
}
