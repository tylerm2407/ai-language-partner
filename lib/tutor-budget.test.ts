/**
 * Unit tests for the live tutor call budget.
 *
 * Two rules are being pinned. The learner is warned while there is still time
 * to react — not cut off mid-sentence — and the learner is NEVER shown a
 * currency figure for remaining AI time. The second is a product rule with a
 * margin-disclosure consequence, so it gets an explicit test rather than a
 * comment.
 */

import {
  CLOSING_CUE_INSTRUCTION,
  CLOSING_CUE_REMAINING_MS,
  WARN_REMAINING_MS,
  assessTutorBudget,
  tutorBudgetExhaustedCopy,
  type TutorBudgetInput,
} from './tutor-budget';

function input(overrides: Partial<TutorBudgetInput> = {}): TutorBudgetInput {
  return { grantedMs: 600_000, elapsedMs: 0, tier: 'premium', ...overrides };
}

const at = (remainingMs: number, tier: TutorBudgetInput['tier'] = 'premium') =>
  assessTutorBudget(input({ grantedMs: 600_000, elapsedMs: 600_000 - remainingMs, tier }));

describe('thresholds', () => {
  it('says nothing early in the call', () => {
    const v = at(300_000);
    expect(v.shouldWarn).toBe(false);
    expect(v.shouldSendClosingCue).toBe(false);
    expect(v.shouldEnd).toBe(false);
    expect(v.notice).toBeNull();
  });

  it('does not warn one millisecond before the warning point', () => {
    expect(at(WARN_REMAINING_MS + 1).shouldWarn).toBe(false);
  });

  it('warns exactly at two minutes remaining', () => {
    const v = at(WARN_REMAINING_MS);
    expect(v.shouldWarn).toBe(true);
    expect(v.shouldSendClosingCue).toBe(false);
    expect(v.shouldEnd).toBe(false);
  });

  it('sends the closing cue exactly at one minute remaining', () => {
    const v = at(CLOSING_CUE_REMAINING_MS);
    expect(v.shouldSendClosingCue).toBe(true);
    expect(v.shouldEnd).toBe(false);
  });

  it('does not cue one millisecond before the cue point', () => {
    expect(at(CLOSING_CUE_REMAINING_MS + 1).shouldSendClosingCue).toBe(false);
  });

  it('keeps the warning up through the final minute', () => {
    // The banner must not vanish just as the situation gets more urgent.
    expect(at(30_000).shouldWarn).toBe(true);
    expect(at(30_000).shouldSendClosingCue).toBe(true);
  });

  it('ends at zero and stays ended', () => {
    for (const remaining of [0, -1, -60_000]) {
      const v = at(remaining);
      expect(v.shouldEnd).toBe(true);
      expect(v.remainingMs).toBe(0);
      // Nothing below the end is worth acting on.
      expect(v.shouldWarn).toBe(false);
      expect(v.shouldSendClosingCue).toBe(false);
    }
  });
});

describe('fails closed', () => {
  it('ends the call when the grant is missing, negative or non-finite', () => {
    for (const grantedMs of [0, -1, NaN, Infinity - Infinity]) {
      expect(assessTutorBudget(input({ grantedMs })).shouldEnd).toBe(true);
    }
  });

  it('ends the call when elapsed time is unreadable', () => {
    // We cannot account for the spend, so we do not continue it.
    expect(assessTutorBudget(input({ elapsedMs: NaN })).shouldEnd).toBe(true);
  });

  it('treats a negative elapsed time as zero rather than as credit', () => {
    const v = assessTutorBudget(input({ grantedMs: 600_000, elapsedMs: -300_000 }));
    expect(v.remainingMs).toBe(600_000);
  });
});

describe('learner-facing copy', () => {
  it('never renders a currency or credit figure', () => {
    // The server meters this in cents. That number is our cost, and the
    // learner bought a flat price, not a taxi meter.
    const surfaces: string[] = [];
    for (let remaining = 0; remaining <= 600_000; remaining += 5_000) {
      const v = at(remaining);
      if (v.notice) surfaces.push(v.notice);
    }
    for (const tier of ['starter', 'basic', 'premium', 'vip'] as const) {
      const copy = tutorBudgetExhaustedCopy(tier);
      surfaces.push(copy.title, copy.message);
    }
    expect(surfaces.length).toBeGreaterThan(0);
    for (const text of surfaces) {
      expect(text).not.toMatch(/[$£€¢]/);
      expect(text).not.toMatch(/cent|credit|token|dollar/i);
    }
  });

  it('counts down in whole minutes, rounded up', () => {
    expect(at(120_000).notice).toContain('2 minutes');
    expect(at(90_000).notice).toContain('2 minutes');
    expect(at(60_000).notice).toContain('1 minute');
    // 30 seconds left is "1 minute", never "0 minutes" — zero reads as over
    // while the tutor is still talking.
    expect(at(30_000).notice).toContain('1 minute');
    expect(at(30_000).notice).not.toContain('0 minute');
  });

  it('gets the singular right', () => {
    expect(at(60_000).notice).not.toContain('1 minutes');
  });
});

describe('exhausted copy follows the tier rule', () => {
  const NOON = new Date('2026-09-02T12:00:00');

  it('offers an upgrade below the top tier', () => {
    for (const tier of ['starter', 'basic', 'premium'] as const) {
      const copy = tutorBudgetExhaustedCopy(tier, NOON);
      expect(copy.upgrade).toBeDefined();
      expect(copy.message).toMatch(/upgrade/i);
    }
  });

  it('tells a vip when it comes back instead of selling to them', () => {
    const copy = tutorBudgetExhaustedCopy('vip', NOON);
    expect(copy.upgrade).toBeUndefined();
    expect(copy.message).not.toMatch(/upgrade/i);
    expect(copy.resetsAt).toBeInstanceOf(Date);
  });

  it('names the allowance in plain language', () => {
    expect(tutorBudgetExhaustedCopy('basic', NOON).message).toContain('live tutor time');
  });
});

describe('the closing cue instruction', () => {
  it('is aimed at the model, not the learner', () => {
    // It is injected into the session, never rendered. If it ever needs to be
    // shown, that is a different string.
    expect(CLOSING_CUE_INSTRUCTION).toMatch(/close/i);
    expect(assessTutorBudget(input({ elapsedMs: 590_000 })).notice).not.toContain(
      CLOSING_CUE_INSTRUCTION,
    );
  });
});
