/**
 * The reconciliation pass runs on every app launch, so the property worth
 * pinning hardest is that in the steady state it writes *nothing*. The rest is
 * the two branches that decide whether a learner gets confetti or silence.
 */

jest.mock('../lib/supabase-queries', () => ({
  fetchProfile: jest.fn(),
  fetchTodayStats: jest.fn(),
  fetchSubscription: jest.fn(),
  fetchReviewItemCount: jest.fn(),
  fetchUserRoles: jest.fn(),
  fetchHasCompletedLesson: jest.fn(),
  fetchHasAiConversation: jest.fn(),
  updateOnboardingChecklist: jest.fn(async () => {}),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
}));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

const mockUser: { id: string } | null = { id: 'user-1' };
jest.mock('./useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as Notifications from 'expo-notifications';
import { updateOnboardingChecklist } from '../lib/supabase-queries';
import { useAppStore } from '../stores/useAppStore';
import { useOnboardingReconciliation } from './useOnboardingReconciliation';
import type { OnboardingChecklist, UserProfile } from '../types';

const mockUpdate = updateOnboardingChecklist as jest.Mock;
const mockPerms = Notifications.getPermissionsAsync as jest.Mock;

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

function profileWith(checklist: OnboardingChecklist): UserProfile {
  return {
    userId: 'user-1',
    targetLanguage: 'es',
    onboardingChecklist: checklist,
  } as unknown as UserProfile;
}

function Probe() {
  useOnboardingReconciliation();
  return null;
}

/** Mount the hook and let the async pass settle. */
async function run() {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(React.createElement(Probe));
  });
  await act(async () => {});
  await act(async () => { tree?.unmount(); });
}

function seed(
  checklist: OnboardingChecklist,
  signals: { lesson: boolean | null; ai: boolean | null } = { lesson: null, ai: null },
) {
  useAppStore.setState({
    profile: profileWith(checklist),
    hasCompletedLessonSignal: signals.lesson,
    hasAiConversationSignal: signals.ai,
    reconciledUserId: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms.mockResolvedValue({ status: 'denied' });
  useAppStore.getState().reset();
});

it('writes nothing when the signals agree with what is stored', async () => {
  seed({ ...EMPTY, chooseLanguage: true, firstLesson: true }, { lesson: true, ai: null });
  await run();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('writes once when a signal adds a tick', async () => {
  seed({ ...EMPTY, chooseLanguage: true }, { lesson: true, ai: null });
  await run();
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate.mock.calls[0][1]).toMatchObject({ firstLesson: true });
});

it('writes nothing when every signal is unknown — the offline launch', async () => {
  mockPerms.mockRejectedValue(new Error('no permissions module'));
  seed({ ...EMPTY, chooseLanguage: true }, { lesson: null, ai: null });
  await run();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('never un-ticks the pre-account trial lesson', async () => {
  // firstLesson true with no lesson_completions row behind it.
  seed({ ...EMPTY, chooseLanguage: true, firstLesson: true }, { lesson: false, ai: null });
  await run();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(useAppStore.getState().profile?.onboardingChecklist.firstLesson).toBe(true);
});

it('runs once per user per session', async () => {
  seed({ ...EMPTY, chooseLanguage: true }, { lesson: true, ai: null });
  await run();
  expect(mockUpdate).toHaveBeenCalledTimes(1);

  // Second mount in the same session — the store still carries the claim.
  await run();
  expect(mockUpdate).toHaveBeenCalledTimes(1);
});

it('silently resolves a checklist it completes from historical data', async () => {
  mockPerms.mockResolvedValue({ status: 'granted' });
  seed({ ...EMPTY, chooseLanguage: true }, { lesson: true, ai: true });
  await run();

  const written = mockUpdate.mock.calls[0][1] as OnboardingChecklist;
  expect(written.completedAt).not.toBeNull();
  // Acknowledged without ever being celebrated: no confetti, and the FAB's
  // effect never fires, so no XP is awarded for a database read.
  expect(written.celebratedAt).toBe(written.completedAt);
  expect(written.dismissed).toBe(true);
});

it('leaves a checklist the learner just finished in-app for the FAB to celebrate', async () => {
  mockPerms.mockResolvedValue({ status: 'granted' });
  // Already resolved on entry — reconciliation is not what got it there.
  seed(
    {
      ...EMPTY,
      chooseLanguage: true,
      firstLesson: true,
      aiConversation: true,
      dailyReminder: true,
      completedAt: '2026-08-25T00:00:00.000Z',
    },
    { lesson: true, ai: true },
  );
  await run();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(useAppStore.getState().profile?.onboardingChecklist.celebratedAt).toBeNull();
});

it('restores the stored checklist when the write fails', async () => {
  mockUpdate.mockRejectedValueOnce(new Error('offline'));
  const stored = { ...EMPTY, chooseLanguage: true };
  seed(stored, { lesson: true, ai: null });
  await run();
  expect(useAppStore.getState().profile?.onboardingChecklist).toEqual(stored);
});
