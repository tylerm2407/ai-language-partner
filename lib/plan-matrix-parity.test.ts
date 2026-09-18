/**
 * The plan matrix is written down three times, and they must agree.
 *
 *   1. `get_effective_limits` in SQL — the latest copy is migration 147. The
 *      AUTHORITY: every quota RPC and the language gate read it.
 *   2. `supabase/functions/_shared/plan-limits.ts` — the edge functions' copy,
 *      and their fallback whenever the RPC fails.
 *   3. `lib/plans.ts` — the app's copy, for display only.
 *
 * None can import another. Drift between them has already shipped twice: a
 * client quota the server did not grant (the migration-057 class), and an
 * edge mapper that silently dropped `dailyNewCards`. So the tier JSON is read
 * out of the migration and the edge module as TEXT and compared here — the
 * same approach as `lib/cefr-ladder.test.ts`.
 *
 * When a later migration redefines `get_effective_limits`, point
 * `MATRIX_MIGRATION` at it; the tests then hold the new copy to the other two.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PLANS, type PlanId } from './plans';
import { UNLIMITED_LANGUAGES } from './language-access';

const MATRIX_MIGRATION = resolve(__dirname, '../supabase/migrations/147_multi_language_is_paid.sql');
const EDGE_MODULE = resolve(__dirname, '../supabase/functions/_shared/plan-limits.ts');

type Limits = Record<string, number | boolean>;

/** The SQL tier name for each client plan id. The free tier is the ELSE arm. */
const SQL_TIER: Record<PlanId, string> = { starter: 'free', basic: 'basic', premium: 'premium', vip: 'vip' };
const TIERS: PlanId[] = ['starter', 'basic', 'premium', 'vip'];
const PAID: PlanId[] = ['basic', 'premium', 'vip'];

function sqlSource(): string {
  return readFileSync(MATRIX_MIGRATION, 'utf8');
}

/** Each tier's JSON literal from the `personal_limits := CASE` arms. */
function parseSqlTiers(): Record<string, Limits> {
  const out: Record<string, Limits> = {};
  for (const m of sqlSource().matchAll(/(?:WHEN '(\w+)' THEN|ELSE) '(\{[^']*\})'::jsonb/g)) {
    out[m[1] ?? 'free'] = JSON.parse(m[2]) as Limits;
  }
  return out;
}

/** Each tier's one-line object literal from `PLAN_LIMITS` in the edge module. */
function parseEdgeTiers(): Record<string, Limits> {
  const block = readFileSync(EDGE_MODULE, 'utf8').match(/export const PLAN_LIMITS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) {
    throw new Error(
      'Could not find PLAN_LIMITS in _shared/plan-limits.ts — if it was restructured, ' +
        'update this parser rather than deleting the test.',
    );
  }
  const out: Record<string, Limits> = {};
  for (const tier of block[1].matchAll(/^\s*(\w+):\s*\{([^}]*)\}/gm)) {
    const limits: Limits = {};
    for (const kv of tier[2].matchAll(/(\w+):\s*(\d+|true|false)\b/g)) {
      limits[kv[1]] = JSON.parse(kv[2]) as number | boolean;
    }
    out[tier[1]] = limits;
  }
  return out;
}

/** Client limits as a plain record, so keys can be compared by name. */
function clientTier(tier: PlanId): Limits {
  return PLANS[tier] as unknown as Limits;
}

/**
 * Known disagreements between the client and the enforcing copies, recorded
 * rather than hidden. Each is asserted to STILL differ, so fixing one fails
 * this test until its entry is removed — the list can only shrink honestly.
 *
 * vip dailyHints / dailyWordLookups: the client says unlimited (9999) while
 * the edge copy and the SQL both enforce 150 / 800. The paywall's "unlimited
 * hints" line for VIP is quoting the client number.
 */
const KNOWN_CLIENT_DRIFT: { tier: PlanId; key: string }[] = [
  { tier: 'vip', key: 'dailyHints' },
  { tier: 'vip', key: 'dailyWordLookups' },
];

const isKnownDrift = (tier: PlanId, key: string) =>
  KNOWN_CLIENT_DRIFT.some((d) => d.tier === tier && d.key === key);

describe('plan matrix parity: SQL, edge and client', () => {
  it('parses all four tiers from both text copies', () => {
    // A parser that silently matches nothing would pass every test below.
    const sql = parseSqlTiers();
    const edge = parseEdgeTiers();
    for (const tier of TIERS) {
      expect(Object.keys(sql[SQL_TIER[tier]] ?? {}).length).toBeGreaterThan(10);
      expect(Object.keys(edge[tier] ?? {}).length).toBeGreaterThan(10);
    }
  });

  it('edge and SQL agree on every key both carry', () => {
    const sql = parseSqlTiers();
    const edge = parseEdgeTiers();
    for (const tier of TIERS) {
      const s = sql[SQL_TIER[tier]];
      for (const key of Object.keys(edge[tier])) {
        if (key in s) expect({ tier, key, value: edge[tier][key] }).toEqual({ tier, key, value: s[key] });
      }
    }
  });

  it('the client agrees with the edge copy on every key both carry, bar the recorded drift', () => {
    const edge = parseEdgeTiers();
    for (const tier of TIERS) {
      const client = clientTier(tier);
      for (const key of Object.keys(edge[tier])) {
        if (!(key in client) || isKnownDrift(tier, key)) continue;
        expect({ tier, key, value: client[key] }).toEqual({ tier, key, value: edge[tier][key] });
      }
    }
  });

  it('the recorded drift is still real — remove an entry once it is fixed', () => {
    const edge = parseEdgeTiers();
    for (const { tier, key } of KNOWN_CLIENT_DRIFT) {
      expect(clientTier(tier)[key]).not.toEqual(edge[tier][key]);
    }
  });
});

describe('maxLanguages (migration 147)', () => {
  it('pins the ladder in the client: free 1, every paid tier unlimited', () => {
    expect(UNLIMITED_LANGUAGES).toBe(9999);
    expect(PLANS.starter.maxLanguages).toBe(1);
    for (const tier of PAID) expect(PLANS[tier].maxLanguages).toBe(UNLIMITED_LANGUAGES);
  });

  it('is present in all three copies with the same value per tier', () => {
    const sql = parseSqlTiers();
    const edge = parseEdgeTiers();
    for (const tier of TIERS) {
      expect(sql[SQL_TIER[tier]].maxLanguages).toBe(PLANS[tier].maxLanguages);
      expect(edge[tier].maxLanguages).toBe(PLANS[tier].maxLanguages);
    }
  });

  it('merges a school contract with GREATEST over a validated value (0 when absent or malformed)', () => {
    // 0 for a missing key is what lets a contract without it leave the personal
    // plan alone; GREATEST is why "unlimited" must be 9999 and not null. The
    // value is regex-checked rather than cast, so a hand-edited "unlimited" or
    // 2.5 reads as 0 instead of throwing inside get_effective_limits.
    const src = sqlSource().replace(/\s+/g, '');
    expect(src).toContain(
      "'maxLanguages',GREATEST((personal_limits->>'maxLanguages')::int,CASEWHENschool_config->>'maxLanguages'~'^[0-9]{1,9}$'THEN(school_config->>'maxLanguages')::intELSE0END)",
    );
  });

  it('the gate reads the merged value and fails closed to 1', () => {
    const src = sqlSource().replace(/\s+/g, ' ');
    expect(src).toContain("public.get_effective_limits(p_user_id)->>'maxLanguages'");
    expect(src).toMatch(/SELECT GREATEST\(1, COALESCE\( CASE WHEN v\.raw ~ '\^\[0-9\]\{1,9\}\$' THEN v\.raw::int END, 1\)\)/);
  });
});
