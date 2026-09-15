import {
  accuracyLine,
  correctionHabits,
  currentStage,
  highestUnlockedStage,
  mergeObjectivesMet,
  missionCta,
  missionCtaLabel,
  missionFor,
  missionResumeHint,
  nextMissionAfter,
  orderScenarios,
  stageDots,
  stageLabel,
} from './missions';
import type { MissionProgressRow } from './supabase-queries';

const row = (scenarioKey: string, stage: number, passed: boolean): MissionProgressRow => ({
  scenarioKey,
  stage,
  attempts: 1,
  bestAccuracy: passed ? 0.8 : 0.5,
  passedAt: passed ? '2026-09-12T00:00:00Z' : null,
});

describe('missionFor', () => {
  it('resolves a real stage and nothing else', () => {
    expect(missionFor('restaurant', 1)?.title).toBe('A table and a drink');
    expect(missionFor('restaurant', 4)?.band).toBe('B2');
    expect(missionFor('free_chat', 1)).toBeNull();
    expect(missionFor('restaurant', 0)).toBeNull();
    expect(missionFor('restaurant', 5)).toBeNull();
    expect(missionFor('restaurant', 1.5)).toBeNull();
    expect(missionFor('__proto__', 1)).toBeNull();
  });
});

describe('unlocking', () => {
  it('unlocks max passed + 1, ignoring failed attempts and other scenes', () => {
    expect(highestUnlockedStage([], 'restaurant')).toBe(1);
    expect(highestUnlockedStage([row('restaurant', 1, false)], 'restaurant')).toBe(1);
    expect(highestUnlockedStage([row('restaurant', 1, true)], 'restaurant')).toBe(2);
    expect(highestUnlockedStage([row('doctor', 3, true)], 'restaurant')).toBe(1);
    expect(
      highestUnlockedStage([row('restaurant', 1, true), row('restaurant', 2, true), row('restaurant', 3, false)], 'restaurant'),
    ).toBe(3);
  });

  it('caps at 5 when the ladder is done', () => {
    const all = [1, 2, 3, 4].map((s) => row('restaurant', s, true));
    expect(highestUnlockedStage(all, 'restaurant')).toBe(5);
    expect(currentStage(5)).toBeNull();
    expect(stageDots(5)).toEqual(['done', 'done', 'done', 'done']);
  });

  it('draws the dots from the unlocked stage', () => {
    expect(stageDots(1)).toEqual(['current', 'locked', 'locked', 'locked']);
    expect(stageDots(3)).toEqual(['done', 'done', 'current', 'locked']);
    expect(currentStage(1)).toBe(1);
    expect(currentStage(4)).toBe(4);
    expect(stageLabel(2)).toBe('Mission 2 of 4');
  });
});

describe('the one button', () => {
  it('picks the CTA by entitlement, open attempt, then ladder state', () => {
    expect(missionCta({ scenarioKey: 'free_chat', paid: false, highestUnlocked: 1, hasOpenAttempt: false })).toBe('free_chat');
    expect(missionCta({ scenarioKey: 'restaurant', paid: false, highestUnlocked: 1, hasOpenAttempt: true })).toBe('plans');
    expect(missionCta({ scenarioKey: 'restaurant', paid: true, highestUnlocked: 2, hasOpenAttempt: true })).toBe('resume');
    expect(missionCta({ scenarioKey: 'restaurant', paid: true, highestUnlocked: 2, hasOpenAttempt: false })).toBe('start');
    expect(missionCta({ scenarioKey: 'restaurant', paid: true, highestUnlocked: 5, hasOpenAttempt: false })).toBe('replay');
  });

  it('labels it', () => {
    expect(missionCtaLabel('free_chat', null)).toBe('Continue');
    expect(missionCtaLabel('plans', 1)).toBe('See plans');
    expect(missionCtaLabel('start', 2)).toBe('Start mission 2');
    expect(missionCtaLabel('resume', 3)).toBe('Continue mission 3');
    expect(missionCtaLabel('replay', null)).toBe('Play mission 4 again');
  });

  it('hints at resumed progress', () => {
    expect(missionResumeHint(0, 3)).toMatch(/Pick up where you left off/);
    expect(missionResumeHint(2, 3)).toBe('You have done 2 of 3 objectives. Pick up where you left off.');
  });
});

describe('orderScenarios', () => {
  const list = [
    { key: 'restaurant' as const },
    { key: 'job_interview' as const },
    { key: 'directions' as const },
    { key: 'free_chat' as const },
    { key: 'doctor' as const },
  ];

  it('puts goal scenes first, in goal order, free_chat last, otherwise stable', () => {
    expect(orderScenarios(list, ['doctor', 'directions']).map((s) => s.key)).toEqual([
      'doctor', 'directions', 'restaurant', 'job_interview', 'free_chat',
    ]);
  });

  it('is the identity apart from free_chat when there is no goal', () => {
    expect(orderScenarios(list, []).map((s) => s.key)).toEqual([
      'restaurant', 'job_interview', 'directions', 'doctor', 'free_chat',
    ]);
  });

  it('ignores goal scenes that are not in the list', () => {
    expect(orderScenarios(list, ['nonsense', 'doctor']).map((s) => s.key)[0]).toBe('doctor');
  });
});

describe('mergeObjectivesMet', () => {
  const valid = ['greet_table', 'order_drink', 'ask_price'];

  it('adds new valid ids in mission order and reports what is new', () => {
    expect(mergeObjectivesMet([], ['order_drink'], valid)).toEqual({ next: ['order_drink'], newlyMet: ['order_drink'] });
    expect(mergeObjectivesMet(['order_drink'], ['greet_table', 'order_drink'], valid)).toEqual({
      next: ['greet_table', 'order_drink'],
      newlyMet: ['greet_table'],
    });
  });

  it('never ticks an id the mission does not have', () => {
    expect(mergeObjectivesMet(['bogus'], ['also_bogus', 'ask_price'], valid)).toEqual({
      next: ['ask_price'],
      newlyMet: ['ask_price'],
    });
  });

  it('is idempotent', () => {
    const once = mergeObjectivesMet([], valid, valid);
    expect(mergeObjectivesMet(once.next, valid, valid)).toEqual({ next: valid, newlyMet: [] });
  });
});

describe('debrief lines', () => {
  it('accuracyLine', () => {
    expect(accuracyLine(null, 0)).toBe('Not enough said to score');
    expect(accuracyLine(0.5, 0)).toBe('Not enough said to score');
    expect(accuracyLine(0.784, 6)).toBe('78% accuracy over 6 turns');
    expect(accuracyLine(1, 1)).toBe('100% accuracy over 1 turn');
    expect(accuracyLine(1.4, 2)).toBe('100% accuracy over 2 turns');
  });

  it('correctionHabits sorts by count, labels, and keeps two examples', () => {
    const habits = correctionHabits({
      corrections: [
        { errorType: 'gender', count: 1, examples: [{ original: 'la problema', corrected: 'el problema' }] },
        {
          errorType: 'tense',
          count: 3,
          examples: [
            { original: 'yo va', corrected: 'yo fui' },
            { original: '', corrected: '' },
            { original: 'yo come', corrected: 'yo comí' },
            { original: 'yo tiene', corrected: 'yo tuve' },
          ],
        },
      ],
    });
    expect(habits.map((h) => h.errorType)).toEqual(['tense', 'gender']);
    expect(habits[0].label).toBe('Tense');
    expect(habits[0].icon).toBe('time-outline');
    expect(habits[0].examples).toEqual([
      { original: 'yo va', corrected: 'yo fui' },
      { original: 'yo come', corrected: 'yo comí' },
    ]);
  });

  it('nextMissionAfter', () => {
    expect(nextMissionAfter({ passed: false, stage: 1 })).toBe('retry');
    expect(nextMissionAfter({ passed: true, stage: 1 })).toBe('next');
    expect(nextMissionAfter({ passed: true, stage: 4 })).toBe('ladder_done');
  });
});
