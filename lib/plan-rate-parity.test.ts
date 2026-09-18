/**
 * The tutor rate is written down twice, and nothing used to check it.
 *
 * `TUTOR_CENTS_PER_MINUTE` divides each plan's `monthlyTutorCents` ceiling into
 * the minutes the plan delivers. It exists in two places that cannot import
 * each other:
 *
 *   1. `supabase/functions/_shared/tutor-pricing.ts` — the AUTHORITY. The
 *      server divides by this to size every grant.
 *   2. `lib/plans.ts` — display only, via `tutorMinutesPerMonth`, which feeds
 *      the paywall ladder and the monthly limit copy.
 *
 * Drift between them is silent and one-directional in its damage: the paywall
 * promises one number and the session grants another. `lib/plan-matrix-parity`
 * guards the tier JSON across three files but never parsed this constant, so
 * the pair went unguarded until the rate moved from 12 to 9 — a fourth
 * split-brain beside the documented three.
 *
 * Read as TEXT, like `plan-matrix-parity.test.ts` and `cefr-ladder.test.ts`:
 * the edge module is Deno source and importing it here would pull in
 * `https://` specifiers that jest cannot resolve.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  PLANS,
  TUTOR_CENTS_PER_MINUTE,
  TUTOR_SESSION_FIXED_CENTS,
  tutorMinutesPerMonth,
} from './plans';

const EDGE_PRICING = resolve(__dirname, '../supabase/functions/_shared/tutor-pricing.ts');

/** `export const <name> = <integer>;` out of the edge module. */
function edgeConstant(name: string): number {
  const source = readFileSync(EDGE_PRICING, 'utf8');
  const match = source.match(new RegExp(`export const ${name} = (\\d+);`));
  if (!match) throw new Error(`could not find "export const ${name}" in tutor-pricing.ts`);
  return Number(match[1]);
}

describe('the tutor rate agrees across the server and the client', () => {
  it('uses the same cents per minute', () => {
    expect(TUTOR_CENTS_PER_MINUTE).toBe(edgeConstant('TUTOR_CENTS_PER_MINUTE'));
  });

  it('uses the same per-session fixed cent', () => {
    // Charged once per session for the debrief analysis, and subtracted before
    // the division — so a drift here shifts every published minute count too.
    expect(TUTOR_SESSION_FIXED_CENTS).toBe(edgeConstant('TUTOR_SESSION_FIXED_CENTS'));
  });

  it('derives the minutes the server would actually grant', () => {
    // Mirrors `secondsAffordable` in tutor-pricing.ts: take the fixed cent off
    // first, then divide. Getting this wrong by one cent moves basic by a whole
    // minute, which is how "25" ended up in two comments when the answer was 24.
    for (const [planId, plan] of Object.entries(PLANS)) {
      const spendable = plan.monthlyTutorCents - edgeConstant('TUTOR_SESSION_FIXED_CENTS');
      const serverMinutes = spendable <= 0
        ? 0
        : Math.floor(spendable / edgeConstant('TUTOR_CENTS_PER_MINUTE'));
      expect(tutorMinutesPerMonth(planId)).toBe(serverMinutes);
    }
  });

  it('delivers the ladder the paywall is sold on', () => {
    // Belt to the braces above: if both copies drift TOGETHER, every relative
    // check still passes. These absolutes are what would fail.
    expect(tutorMinutesPerMonth('basic')).toBe(33);
    expect(tutorMinutesPerMonth('premium')).toBe(88);
    expect(tutorMinutesPerMonth('vip')).toBe(155);
    expect(tutorMinutesPerMonth('starter')).toBe(0);
  });
});
