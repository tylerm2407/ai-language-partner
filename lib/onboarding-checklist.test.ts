/**
 * The invariants that make the onboarding checklist trustworthy.
 *
 * The first block is the one that matters most: reconciliation must never
 * un-tick. The trial-lesson case is the proof — a learner who did the pre-
 * account trial has `firstLesson: true` and no `lesson_completions` row, so a
 * derive-and-overwrite pass would tell them to go finish the lesson they just
 * finished.
 */

import {
  ONBOARDING_COMPLETE_XP_KEY,
  ONBOARDING_STEP_KEYS,
  checklistEquals,
  checklistProgress,
  isChecklistResolved,
  isStepResolved,
  reconcileSteps,
  withCompletedAt,
  withSkipped,
  type OnboardingSignals,
} from './onboarding-checklist';
import type { OnboardingChecklist } from '../types';

const EMPTY: OnboardingChecklist = {
  chooseLanguage: false,
  firstLesson: false,
  aiConversation: false,
  dailyReminder: false,
  skipped: [],
  dismissed: false,
  completedAt: null,
  celebratedAt: null,
};

const NO_SIGNALS: OnboardingSignals = {
  hasTargetLanguage: null,
  hasCompletedLesson: null,
  hasAiConversation: null,
  notificationsGranted: null,
};

describe('reconcileSteps', () => {
  it('never un-ticks a step the server has no record of (the trial lesson)', () => {
    // Exactly the state app/(public)/onboarding.tsx writes after a pre-account
    // trial: firstLesson true, and nothing in lesson_completions to back it up.
    const stored = { ...EMPTY, chooseLanguage: true, firstLesson: true };

    const next = reconcileSteps(stored, {
      ...NO_SIGNALS,
      hasTargetLanguage: true,
      hasCompletedLesson: false,
    });

    expect(next.firstLesson).toBe(true);
  });

  it('treats a null signal exactly like false', () => {
    const stored = { ...EMPTY, aiConversation: true };
    const next = reconcileSteps(stored, NO_SIGNALS);
    expect(next).toEqual(stored);
  });

  it('adds a tick when a signal reports the work was done', () => {
    const next = reconcileSteps(EMPTY, {
      ...NO_SIGNALS,
      hasCompletedLesson: true,
      notificationsGranted: true,
    });
    expect(next.firstLesson).toBe(true);
    expect(next.dailyReminder).toBe(true);
    expect(next.chooseLanguage).toBe(false);
    expect(next.aiConversation).toBe(false);
  });

  it('leaves everything but the four step keys alone', () => {
    const stored = { ...EMPTY, dismissed: true, completedAt: 'x', celebratedAt: 'y' };
    const next = reconcileSteps(stored, { ...NO_SIGNALS, hasTargetLanguage: true });
    expect(next.dismissed).toBe(true);
    expect(next.completedAt).toBe('x');
    expect(next.celebratedAt).toBe('y');
  });

  it('an offline launch (every signal null) produces an equal checklist', () => {
    const stored = { ...EMPTY, chooseLanguage: true, skipped: ['dailyReminder' as const] };
    expect(checklistEquals(stored, reconcileSteps(stored, NO_SIGNALS))).toBe(true);
  });
});

describe('resolution', () => {
  const allDone: OnboardingChecklist = {
    ...EMPTY,
    chooseLanguage: true,
    firstLesson: true,
    aiConversation: true,
    dailyReminder: true,
  };

  it('needs every step done or skipped', () => {
    expect(isChecklistResolved(EMPTY)).toBe(false);
    expect(isChecklistResolved(allDone)).toBe(true);
  });

  it('counts a skipped step as resolved but not as done', () => {
    const skipped = withSkipped(
      { ...allDone, aiConversation: false },
      'aiConversation',
    );
    expect(isChecklistResolved(skipped)).toBe(true);
    expect(isStepResolved(skipped, 'aiConversation')).toBe(true);
    expect(skipped.aiConversation).toBe(false);
  });

  it('will not record a skip for a step that is already done', () => {
    expect(withSkipped(allDone, 'firstLesson').skipped).toEqual([]);
  });

  it('does not record the same skip twice', () => {
    const once = withSkipped(EMPTY, 'dailyReminder');
    expect(withSkipped(once, 'dailyReminder')).toBe(once);
  });
});

describe('withCompletedAt', () => {
  const resolved: OnboardingChecklist = {
    ...EMPTY,
    chooseLanguage: true,
    firstLesson: true,
    aiConversation: true,
    dailyReminder: true,
  };

  it('stamps once the checklist resolves', () => {
    expect(withCompletedAt(resolved, () => '2026-08-25T00:00:00.000Z').completedAt).toBe(
      '2026-08-25T00:00:00.000Z',
    );
  });

  it('does not stamp an unresolved checklist', () => {
    expect(withCompletedAt(EMPTY, () => 'now').completedAt).toBeNull();
  });

  it('never re-stamps — the first time is the record', () => {
    const already = { ...resolved, completedAt: 'first' };
    expect(withCompletedAt(already, () => 'second').completedAt).toBe('first');
  });
});

describe('checklistEquals', () => {
  it.each([...ONBOARDING_STEP_KEYS])('notices a change to %s', (key) => {
    expect(checklistEquals(EMPTY, { ...EMPTY, [key]: true })).toBe(false);
  });

  it.each([
    ['dismissed', { dismissed: true }],
    ['completedAt', { completedAt: 'x' }],
    ['celebratedAt', { celebratedAt: 'x' }],
    ['skipped', { skipped: ['firstLesson' as const] }],
  ])('notices a change to %s', (_label, patch) => {
    expect(checklistEquals(EMPTY, { ...EMPTY, ...patch })).toBe(false);
  });

  it('ignores the order of skipped keys', () => {
    const a = { ...EMPTY, skipped: ['firstLesson' as const, 'dailyReminder' as const] };
    const b = { ...EMPTY, skipped: ['dailyReminder' as const, 'firstLesson' as const] };
    expect(checklistEquals(a, b)).toBe(true);
  });

  it('is true for two identical checklists', () => {
    expect(checklistEquals({ ...EMPTY }, { ...EMPTY })).toBe(true);
  });
});

describe('checklistProgress', () => {
  it('opens above zero thanks to the granted rows', () => {
    expect(checklistProgress(EMPTY, 1)).toEqual({ resolved: 1, total: 5 });
  });

  it('counts skipped steps toward the total so the ring can fill', () => {
    const c = ONBOARDING_STEP_KEYS.reduce((acc, key) => withSkipped(acc, key), EMPTY);
    expect(checklistProgress(c, 1)).toEqual({ resolved: 5, total: 5 });
  });
});

it('the XP key fits migration 046\'s 8..128 character constraint', () => {
  expect(ONBOARDING_COMPLETE_XP_KEY.length).toBeGreaterThanOrEqual(8);
  expect(ONBOARDING_COMPLETE_XP_KEY.length).toBeLessThanOrEqual(128);
});
