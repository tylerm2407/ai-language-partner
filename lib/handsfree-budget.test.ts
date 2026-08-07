/**
 * Unit tests for voice-minute budgeting.
 *
 * The failure being prevented is a session that starts, drives off, and dies
 * three minutes later with a quota error the learner cannot read or act on.
 * So the bias throughout is toward under-promising.
 */

import {
  RESERVE_MINUTES,
  affordableDurationMs,
  assessVoiceBudget,
  budgetNotice,
  type BudgetInput,
} from './handsfree-budget';
import type { HandsFreeQueueItem } from './handsfree-session';

function item(n: number): HandsFreeQueueItem {
  return {
    cardId: `card-${n}`,
    reviewItemId: `ri-${n}`,
    promptText: `prompt ${n}`,
    expectedText: `answer ${n}`,
    acceptedVariants: [],
    promptLang: 'es',
  };
}

const keyFor = (i: HandsFreeQueueItem) => `key:${i.cardId}`;

function input(overrides: Partial<BudgetInput> = {}): BudgetInput {
  return {
    queue: Array.from({ length: 20 }, (_, i) => item(i)),
    cachedKeys: new Set<string>(),
    keyFor,
    dailyLimit: 20, // premium
    usedToday: 0,
    uncachedConstantPhrases: 0,
    ...overrides,
  };
}

describe('assessVoiceBudget', () => {
  it('counts only uncached prompts as generations', () => {
    const queue = Array.from({ length: 10 }, (_, i) => item(i));
    const cachedKeys = new Set(queue.slice(0, 6).map(keyFor));
    const verdict = assessVoiceBudget(input({ queue, cachedKeys }));
    expect(verdict.neededGenerations).toBe(4);
  });

  it('treats a fully cached queue as free', () => {
    const queue = Array.from({ length: 30 }, (_, i) => item(i));
    const verdict = assessVoiceBudget(
      input({ queue, cachedKeys: new Set(queue.map(keyFor)), dailyLimit: 5, usedToday: 3 }),
    );
    // Nothing to generate, so a starter learner with almost nothing left can
    // still run a long session on audio already on the device.
    expect(verdict.neededGenerations).toBe(0);
    expect(verdict.fitsEntirely).toBe(true);
    expect(verdict.blocked).toBe(false);
  });

  it('holds back a reserve so voice chat is still usable afterwards', () => {
    const verdict = assessVoiceBudget(input({ dailyLimit: 10, usedToday: 0 }));
    expect(verdict.availableMinutes).toBe(10 - RESERVE_MINUTES);
  });

  it('never reports negative availability', () => {
    const verdict = assessVoiceBudget(input({ dailyLimit: 5, usedToday: 99 }));
    expect(verdict.availableMinutes).toBe(0);
    expect(verdict.blocked).toBe(true);
  });

  it('charges the fixed phrases before any card', () => {
    // They are needed however short the session is, so a budget that cannot
    // cover them cannot cover a session either.
    const verdict = assessVoiceBudget(
      input({ dailyLimit: 5, usedToday: 0, uncachedConstantPhrases: 3 }),
    );
    // 5 - 2 reserve = 3 available, all consumed by the phrases.
    expect(verdict.affordableItems).toBe(0);
    expect(verdict.blocked).toBe(true);
  });

  it('shortens rather than blocking when the budget is partial', () => {
    const queue = Array.from({ length: 20 }, (_, i) => item(i));
    const verdict = assessVoiceBudget(input({ queue, dailyLimit: 10, usedToday: 0 }));
    // 10 - 2 reserve = 8 generations affordable out of 20 needed.
    expect(verdict.affordableItems).toBe(8);
    expect(verdict.fitsEntirely).toBe(false);
    expect(verdict.blocked).toBe(false);
  });

  it('counts cached items on top of what the budget can generate', () => {
    const queue = Array.from({ length: 20 }, (_, i) => item(i));
    const cachedKeys = new Set(queue.slice(0, 10).map(keyFor));
    const verdict = assessVoiceBudget(
      input({ queue, cachedKeys, dailyLimit: 5, usedToday: 0 }),
    );
    // 10 free + 3 affordable (5 - 2 reserve) = 13.
    expect(verdict.affordableItems).toBe(13);
  });

  it('never claims more items than the queue holds', () => {
    const queue = Array.from({ length: 3 }, (_, i) => item(i));
    const verdict = assessVoiceBudget(input({ queue, dailyLimit: 30, usedToday: 0 }));
    expect(verdict.affordableItems).toBe(3);
    expect(verdict.fitsEntirely).toBe(true);
  });

  it('blocks a starter learner from a full uncached session', () => {
    // The scenario that motivated this module: 20 cards, 5-minute cap.
    const verdict = assessVoiceBudget(input({ dailyLimit: 5, usedToday: 0 }));
    expect(verdict.fitsEntirely).toBe(false);
    expect(verdict.affordableItems).toBeLessThan(20);
  });
});

describe('affordableDurationMs', () => {
  it('scales with the measured item cost', () => {
    const verdict = assessVoiceBudget(input({ dailyLimit: 10 }));
    expect(affordableDurationMs(verdict, 14_000)).toBe(verdict.affordableItems * 14_000);
  });

  it('is zero when blocked', () => {
    const verdict = assessVoiceBudget(input({ dailyLimit: 1, usedToday: 1 }));
    expect(affordableDurationMs(verdict, 14_000)).toBe(0);
  });
});

describe('budgetNotice', () => {
  it('says nothing when the whole session fits', () => {
    expect(budgetNotice(assessVoiceBudget(input({ dailyLimit: 30 })))).toBeNull();
  });

  it('states the shortened length rather than failing silently', () => {
    const notice = budgetNotice(assessVoiceBudget(input({ dailyLimit: 10 })));
    expect(notice).toContain('8 cards');
  });

  it('explains a block in terms of the allowance, not an error code', () => {
    const notice = budgetNotice(assessVoiceBudget(input({ dailyLimit: 2, usedToday: 2 })));
    expect(notice).toMatch(/voice allowance/i);
  });
});
