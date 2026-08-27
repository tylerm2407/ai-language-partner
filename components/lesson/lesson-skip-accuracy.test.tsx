/**
 * Skipping the LAST exercise must record the score the learner actually earned.
 *
 * `handleSkipAndAdvance` skips and advances in the same tick. `setStatuses` is
 * queued, so the completion path — which reads `statuses` from its render
 * closure — summarised the PRE-skip map. On the final exercise that meant
 * `lesson_completions.score` recorded the skipped question as unanswered while
 * the celebration overlay, which recomputes after the flush, printed the
 * correct figures. The two disagreed, and the recorded one feeds the unit's
 * "% MASTERED".
 *
 * Only skippable (audio) types offer the affordance, so the last exercise here
 * is a `listening_choice`.
 */
import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LessonRunner, type LessonResult } from './LessonRunner';
import type { Exercise } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
// The runner reaches ListeningExercise -> lib/ai -> lib/supabase, which throws
// at import time without env vars. Nothing in this test speaks to a server.
jest.mock('../../lib/ai', () => ({
  getTextToSpeech: jest.fn(async () => ''),
  scorePronunciation: jest.fn(),
  VoiceError: class VoiceError extends Error {},
}));
jest.mock('../../lib/lesson-audio', () => ({
  getLessonAudioUri: jest.fn(async () => 'file:///stub.mp3'),
  warmLessonAudio: jest.fn(async () => true),
  LESSON_SLOW_RATE: 0.75,
  LESSON_NORMAL_RATE: 1,
}));
jest.mock('../../lib/offline-queue', () => ({
  enqueue: jest.fn(async () => {}),
  isNetworkError: () => false,
}));
jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn(async () => ({ sound: { unloadAsync: jest.fn() } })) },
    Recording: { createAsync: jest.fn() },
  },
}));
jest.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    recording: false,
    audioUri: null,
    error: null,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    getBase64: jest.fn(),
  }),
}));
jest.mock('../../hooks/usePhonemeDrill', () => ({
  usePhonemeDrill: () => ({ isPlaying: false, playNext: jest.fn() }),
}));
// The celebration animations drive a native-driver Animated loop that jest-expo
// cannot host. None of them affect what this test asserts.
jest.mock('../../components/animations/CorrectSparkle', () => ({
  CorrectSparkle: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../components/animations/WrongShake', () => ({
  WrongShake: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../components/ui/CelebrationOverlay', () => ({ CelebrationOverlay: () => null }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
    getAllKeys: jest.fn(async () => []),
    multiRemove: jest.fn(async () => {}),
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light', Heavy: 'heavy' },
}));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('../../lib/supabase-queries', () => ({
  logExerciseCorrection: jest.fn(() => Promise.resolve()),
  fetchGrammarRule: jest.fn(() => Promise.resolve(null)),
  fetchDueReviewItemsWithCards: jest.fn(() => Promise.resolve([])),
  fetchReviewItemsByCardIds: jest.fn(() => Promise.resolve(new Map())),
  upsertReviewItem: jest.fn(async (p: unknown) => p),
  tryConsumeNewCardSlot: jest.fn(async () => true),
}));
jest.mock('../../lib/lesson-session-storage', () => ({
  saveLessonSession: jest.fn(async () => {}),
  loadLessonSession: jest.fn(async () => ({ snapshot: null, expired: false })),
  clearLessonSession: jest.fn(async () => {}),
  LESSON_SESSION_TTL_MS: 24 * 60 * 60 * 1000,
}));
jest.mock('../../hooks/useNotifications', () => ({
  scheduleLessonExpiryReminder: jest.fn(async () => {}),
  cancelLessonExpiryReminder: jest.fn(async () => {}),
}));
jest.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({ playing: false, loading: false, error: null, play: jest.fn() }),
}));
jest.mock('../../hooks/useAdultMode', () => ({
  useAdultMode: () => ({ showXpCelebration: true }),
}));
jest.mock('../../hooks/useLessonAudioPrewarm', () => ({
  useLessonAudioPrewarm: jest.fn(),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function mc(id: string): Exercise {
  return {
    id, lessonId: 'l1', type: 'multiple_choice', orderIndex: 0,
    prompt: 'agua', promptAudioUrl: null, correctAnswer: 'water',
    acceptedAnswers: [], options: ['water', 'milk'], hintText: null, cardId: null,
  };
}

function listening(id: string): Exercise {
  return {
    id, lessonId: 'l1', type: 'listening_choice', orderIndex: 1,
    prompt: 'leche', promptAudioUrl: null, correctAnswer: 'milk',
    acceptedAnswers: [], options: ['water', 'milk'], hintText: null, cardId: null,
  };
}

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>{element}</SafeAreaProvider>,
    );
  });
  return renderer;
}

function pressLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const node = renderer.root.findAll(
    (n: ReactTestInstance) =>
      typeof n.type !== 'string' && n.props?.accessibilityLabel === label,
    { deep: true },
  )[0];
  if (!node) throw new Error(`no pressable labelled "${label}"`);
  TestRenderer.act(() => {
    node.props.onPress();
  });
}

function runner(onComplete: (r: LessonResult) => void) {
  return render(
    <LessonRunner
      exercises={[mc('ex1'), listening('ex2')]}
      lessonId="l1"
      lessonTitle="Basics"
      xpReward={20}
      userId=""
      targetLanguage="es"
      onComplete={onComplete}
      onExit={() => {}}
    />,
  );
}

describe('skipping the last exercise', () => {
  it('records it as skipped, not as a miss', () => {
    const onComplete = jest.fn();
    const r = runner(onComplete);

    pressLabel(r, 'Option A: water');
    pressLabel(r, 'Next');
    pressLabel(r, 'Skip this question without scoring it');

    expect(onComplete).toHaveBeenCalledTimes(1);
    const result: LessonResult = onComplete.mock.calls[0][0];

    // THE regression: skippedCount was 0 and accuracy 0.5, because the
    // completion path summarised the map from before the skip landed.
    expect(result.skippedCount).toBe(1);
    expect(result.scoredCount).toBe(1);
    expect(result.correctCount).toBe(1);
    expect(result.accuracy).toBe(1);
  });

  it('still pays XP scaled by how much of the lesson was attempted', () => {
    // Skipping is neutral for accuracy, so engagement is what stops a lesson
    // skipped down to one lucky answer from paying full price.
    const onComplete = jest.fn();
    const r = runner(onComplete);

    pressLabel(r, 'Option A: water');
    pressLabel(r, 'Next');
    pressLabel(r, 'Skip this question without scoring it');

    const result: LessonResult = onComplete.mock.calls[0][0];
    // accuracy 1 * engagement (1 of 2 attempted) * 20
    expect(result.xpEarned).toBe(10);
  });
});
