/**
 * The two defects this component existed to have, and the one it must never
 * grow back.
 *
 * 1. The +50 XP double-awarded once per app launch, unbounded, because the
 *    award went through `earnXp` — which mints a random idempotency key, so the
 *    server's `(user_id, event_key)` de-dupe protected nothing.
 * 2. The all-complete auto-dismiss had never fired: the once-only guard was
 *    `useState`, so writing it re-ran the effect and the cleanup cleared both
 *    timers first. That is the regression the mid-celebration `setProfile` test
 *    below pins — an unrelated store write must not cancel `markCelebrated`.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('../../lib/supabase-queries', () => ({
  fetchProfile: jest.fn(),
  fetchTodayStats: jest.fn(),
  fetchSubscription: jest.fn(),
  fetchReviewItemCount: jest.fn(),
  fetchUserRoles: jest.fn(),
  fetchHasCompletedLesson: jest.fn(),
  fetchHasAiConversation: jest.fn(),
  updateOnboardingChecklist: jest.fn(async () => {}),
  incrementXpIdempotent: jest.fn(async () => {}),
}));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
// Reduce Motion on: the FAB's idle pulse is an indefinite native-driver loop,
// which react-test-renderer cannot attach to a host node. It also collapses the
// celebration delay to 0, which is what the timer assertions below want.
jest.mock('../../hooks/useMotion', () => ({
  useMotion: () => ({ shouldReduce: true, duration: {}, easing: {}, durationOr0: () => 0 }),
}));

import { incrementXpIdempotent, updateOnboardingChecklist } from '../../lib/supabase-queries';
import { useAppStore } from '../../stores/useAppStore';
import { ONBOARDING_COMPLETE_XP_KEY } from '../../lib/onboarding-checklist';
import { OnboardingChecklistFab } from './OnboardingChecklistFab';
import type { OnboardingChecklist, UserProfile } from '../../types';

const mockXp = incrementXpIdempotent as jest.Mock;
const mockUpdate = updateOnboardingChecklist as jest.Mock;

const RESOLVED: OnboardingChecklist = {
  chooseLanguage: true,
  firstLesson: true,
  aiConversation: true,
  dailyReminder: true,
  skipped: [],
  dismissed: false,
  completedAt: '2026-08-25T00:00:00.000Z',
  celebratedAt: null,
};

function profileWith(checklist: OnboardingChecklist): UserProfile {
  return {
    userId: 'user-1',
    totalXp: 100,
    targetLanguage: 'es',
    onboardingChecklist: checklist,
  } as unknown as UserProfile;
}

/** The FAB itself, ignoring the SafeAreaProvider it has to be rendered inside. */
function fabRendered(tree: TestRenderer.ReactTestRenderer): boolean {
  return (
    tree.root.findAll(
      (node) =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('Onboarding checklist'),
    ).length > 0
  );
}

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 44, left: 0, right: 0, bottom: 34 },
        }}
      >
        <OnboardingChecklistFab />
      </SafeAreaProvider>,
    );
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  useAppStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

it('awards the completion XP exactly once, under the literal stable key', () => {
  useAppStore.setState({ profile: profileWith(RESOLVED) });
  const tree = render();

  expect(mockXp).toHaveBeenCalledTimes(1);
  expect(mockXp).toHaveBeenCalledWith(50, 'onboarding-checklist:v1');
  expect(mockXp.mock.calls[0][1]).toBe(ONBOARDING_COMPLETE_XP_KEY);

  // Re-render for any reason at all — still one award.
  act(() => { tree.update(<SafeAreaProvider><OnboardingChecklistFab /></SafeAreaProvider>); });
  expect(mockXp).toHaveBeenCalledTimes(1);
});

it('renders nothing once celebratedAt is set, even with dismissed still false', () => {
  useAppStore.setState({
    profile: profileWith({ ...RESOLVED, celebratedAt: '2026-08-25T00:00:01.000Z' }),
  });
  const tree = render();
  expect(fabRendered(tree)).toBe(false);
  expect(mockXp).not.toHaveBeenCalled();
});

it('renders nothing before the profile has loaded', () => {
  const tree = render();
  expect(fabRendered(tree)).toBe(false);
});

it('renders the rocket when there is still something to do', () => {
  useAppStore.setState({
    profile: profileWith({ ...RESOLVED, dailyReminder: false, completedAt: null }),
  });
  const tree = render();
  expect(fabRendered(tree)).toBe(true);
  expect(mockXp).not.toHaveBeenCalled();
});

/**
 * The regression for the never-firing auto-dismiss. A `setProfile` landing
 * mid-celebration (an XP write, a streak refresh, the reconciler) re-renders
 * this component; if that re-render can reach the effect's cleanup, the timer
 * dies and `markCelebrated` never runs — which is exactly why the rocket used
 * to stay on screen forever.
 */
it('a setProfile mid-celebration does not cancel markCelebrated', async () => {
  useAppStore.setState({ profile: profileWith(RESOLVED) });
  render();

  act(() => {
    const { profile } = useAppStore.getState();
    useAppStore.getState().setProfile({ ...profile!, totalXp: 150 });
  });

  await act(async () => { jest.runAllTimers(); });

  expect(mockUpdate).toHaveBeenCalledTimes(1);
  const written = mockUpdate.mock.calls[0][1] as OnboardingChecklist;
  expect(written.celebratedAt).not.toBeNull();
  expect(written.dismissed).toBe(true);
});

it('does not celebrate a checklist the learner hid before finishing it', () => {
  useAppStore.setState({ profile: profileWith({ ...RESOLVED, dismissed: true }) });
  render();
  expect(mockXp).not.toHaveBeenCalled();
});
