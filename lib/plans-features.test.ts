/**
 * PLAN_FEATURES is marketing copy that quotes numbers from PLANS. The two
 * drifted once — basic advertised 25 messages and 10 voice minutes against
 * real caps of 20 and 6 — so every number in a feature string is read back
 * here and compared with the plan it describes.
 */
import { PLANS, PLAN_FEATURES, type PlanId } from './plans';

const PAID: Exclude<PlanId, 'starter'>[] = ['basic', 'premium', 'vip'];

function leadingNumber(line: string): number | null {
  const m = /^(\d+)\s/.exec(line);
  return m ? Number(m[1]) : null;
}

describe('PLAN_FEATURES quotes PLANS, not memory', () => {
  it.each(PAID)('%s: every numbered line matches its plan limit', (tier) => {
    const plan = PLANS[tier];
    for (const line of PLAN_FEATURES[tier]) {
      const n = leadingNumber(line);
      if (n === null) continue;
      if (/new words/.test(line)) expect(n).toBe(plan.dailyNewCards);
      else if (/tutor messages/.test(line)) expect(n).toBe(plan.dailyTextMessages);
      else if (/voice practice/.test(line)) expect(n).toBe(plan.dailyVoiceMinutes);
      else if (/writing grades/.test(line)) expect(n).toBe(plan.dailyWritingGrades);
      else throw new Error(`unrecognised numbered feature line: "${line}"`);
    }
  });

  it('starter names the real free new-card cap', () => {
    expect(PLAN_FEATURES.starter[0]).toBe(`${PLANS.starter.dailyNewCards} new words a day`);
  });

  it('offline and audiobook are claimed only where the plan grants them', () => {
    for (const tier of PAID) {
      const text = PLAN_FEATURES[tier].join(' | ').toLowerCase();
      if (text.includes('offline')) expect(PLANS[tier].offlineMode).toBe(true);
      if (text.includes('audiobook')) expect(PLANS[tier].audiobookNarration).toBe(true);
    }
  });

  it('never mentions hearts or streaks', () => {
    for (const tier of Object.keys(PLAN_FEATURES) as PlanId[]) {
      expect(PLAN_FEATURES[tier].join(' ')).not.toMatch(/heart|streak/i);
    }
  });
});
