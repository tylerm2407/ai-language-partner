/**
 * Integration test for the second-chance rule.
 *
 * The unit tests cover the transition table and the note states in isolation.
 * What only an integration test can prove is the part that actually broke
 * before: that a wrong answer leaves the exercise's input UNLOCKED and reveals
 * nothing, because the runner remounts the exercise on the attempt key. That
 * mechanism is invisible to the type checker and lives across three files.
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
jest.mock('../../hooks/useLessonAudioPrewarm', () => ({
  useLessonAudioPrewarm: jest.fn(),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const exercise = (id: string): Exercise => ({
  id,
  lessonId: 'l1',
  type: 'multiple_choice',
  orderIndex: 0,
  prompt: 'agua',
  promptAudioUrl: null,
  correctAnswer: 'water',
  acceptedAnswers: [],
  options: ['water', 'milk'],
  hintText: null,
  cardId: null,
});

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>{element}</SafeAreaProvider>,
    );
  });
  return renderer;
}

function text(renderer: TestRenderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
  };
  renderer.root
    .findAll((node: ReactTestInstance) => node.children.length > 0, { deep: true })
    .forEach((node) => walk(node.children));
  return out.join(' ');
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
      exercises={[exercise('ex1')]}
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

describe('second chance in a real lesson', () => {
  it('hides the answer and keeps the options live after the first wrong pick', () => {
    const r = runner(jest.fn());
    pressLabel(r, 'Option B: milk');

    const rendered = text(r);
    expect(rendered).toContain('NOT QUITE — ');
    // The three ways MultipleChoice would otherwise give the game away.
    expect(rendered).not.toContain('CORRECT');
    expect(rendered).not.toContain('YOUR PICK');
    expect(rendered).not.toContain('ANSWER: WATER');
  });

  it('reveals the answer only after both attempts are spent', () => {
    const r = runner(jest.fn());
    pressLabel(r, 'Option B: milk');
    expect(text(r)).not.toContain('ANSWER: WATER');
    pressLabel(r, 'Option B: milk');
    expect(text(r)).toContain('ANSWER: WATER');
  });

  it('teaches on the second try without scoring it', () => {
    const onComplete = jest.fn();
    const r = runner(onComplete);

    pressLabel(r, 'Option B: milk');
    pressLabel(r, 'Option A: water');

    const rendered = text(r);
    expect(rendered).toContain('SECOND TRY — ');
    expect(rendered).not.toContain('CORRECT — ');

    pressLabel(r, 'Finish');
    expect(onComplete).toHaveBeenCalledTimes(1);
    const result: LessonResult = onComplete.mock.calls[0][0];
    // Right in the end, but it does not count — that is what makes the second
    // attempt worth offering rather than a free point.
    expect(result.correctCount).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.answers[0]).toMatchObject({ exerciseId: 'ex1', correct: false });
  });

  it('scores a first-time correct answer normally', () => {
    const onComplete = jest.fn();
    const r = runner(onComplete);

    pressLabel(r, 'Option A: water');
    expect(text(r)).toContain('CORRECT — ');

    pressLabel(r, 'Finish');
    const result: LessonResult = onComplete.mock.calls[0][0];
    expect(result.correctCount).toBe(1);
    expect(result.accuracy).toBe(1);
    expect(result.skippedCount).toBe(0);
  });
});
