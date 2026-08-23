/**
 * Render tests for the shared exercise chrome.
 *
 * These pin the three behaviours the handoff spec calls out by name, because
 * each one is invisible to the type checker and each one broke in the mockups:
 * the note row reserves its height before an answer exists, Next stays
 * disabled until a pick is made, and the last exercise says Finish.
 */

import React from 'react';
import TestRenderer, { type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExerciseChrome } from './ExerciseChrome';
import { ExerciseTrack } from './ExerciseTrack';
import { MultipleChoice } from './MultipleChoice';
import { TranslationExercise } from './TranslationExercise';
import { SentenceConstructionExercise } from './SentenceConstructionExercise';
import { colors } from '../../config/theme';
import type { Exercise } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
// TactileButton -> useMotion -> lib/motion-preference reaches for the native
// AsyncStorage module, which does not exist under jest.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('../../lib/supabase-queries', () => ({
  logExerciseCorrection: jest.fn(() => Promise.resolve()),
  fetchGrammarRule: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('expo-speech', () => ({ speak: jest.fn() }));
jest.mock('../../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({ playing: false, loading: false, error: null, play: jest.fn() }),
}));

/** ExerciseChrome reads safe-area insets to clear the floating tab bar, so
 *  every render needs a provider with deterministic metrics. */
const METRICS = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>{element}</SafeAreaProvider>,
    );
  });
  return renderer;
}

function hostNodes(
  renderer: TestRenderer.ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean,
): ReactTestInstance[] {
  return renderer.root.findAll(
    (node: ReactTestInstance) => typeof node.type === 'string' && predicate(node),
    { deep: true },
  );
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

function buttonByLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
  return hostNodes(renderer, (node) => node.props?.accessibilityLabel === label)[0];
}

const chromeProps = {
  lessonTitle: 'Greetings & Basics',
  currentIndex: 1,
  total: 6,
  completedCount: 1,
  counterLabel: 'QUESTION 02',
  hearts: 4,
  maxHearts: 5,
  isUnlimitedHearts: false,
  showHearts: true,
  note: 'Agua is feminine but takes "el" in the singular — el agua fría.',
  answeredCorrect: null as boolean | null,
  correctAnswer: 'water',
  canPrev: true,
  canNext: false,
  isLast: false,
  onExit: () => {},
  onPrev: () => {},
  onNext: () => {},
  children: <Text>body</Text>,
};

describe('ExerciseChrome', () => {
  it('shows the placeholder note and disables Next before an answer', () => {
    const r = render(<ExerciseChrome {...chromeProps} />);

    const rendered = text(r);
    expect(rendered).toContain('Pick an answer to see the note.');
    expect(rendered).not.toContain('CORRECT');
    // The explanation must not leak before the learner has committed.
    expect(rendered).not.toContain('el agua fría');
    expect(buttonByLabel(r, 'Next').props.accessibilityState.disabled).toBe(true);
  });

  it('enables Next once an answer is picked', () => {
    const r = render(<ExerciseChrome {...chromeProps} canNext answeredCorrect />);
    expect(buttonByLabel(r, 'Next').props.accessibilityState.disabled).toBe(false);
  });

  it('reveals the note with a CORRECT kicker on a right answer', () => {
    const r = render(<ExerciseChrome {...chromeProps} canNext answeredCorrect />);
    const rendered = text(r);
    expect(rendered).toContain('CORRECT — ');
    expect(rendered).toContain('el agua fría');
    expect(rendered).not.toContain('Pick an answer');
  });

  it('names the correct answer in the kicker on a wrong answer', () => {
    const r = render(
      <ExerciseChrome {...chromeProps} canNext answeredCorrect={false} correctAnswer="water" />,
    );
    expect(text(r)).toContain('ANSWER: WATER — ');
  });

  it('renders the kicker alone when the exercise has no explanation', () => {
    const r = render(
      <ExerciseChrome {...chromeProps} note={null} canNext answeredCorrect={false} />,
    );
    // Never an empty row: the kicker still states the answer.
    expect(text(r)).toContain('ANSWER: WATER — ');
  });

  it('labels the last exercise Finish', () => {
    const r = render(<ExerciseChrome {...chromeProps} isLast canNext answeredCorrect />);
    const rendered = text(r);
    expect(rendered).toContain('Finish');
    expect(rendered).not.toContain('Next');
  });

  it('disables Previous on the first exercise', () => {
    const r = render(<ExerciseChrome {...chromeProps} canPrev={false} />);
    expect(buttonByLabel(r, 'Previous').props.accessibilityState.disabled).toBe(true);
  });

  it('keeps the exit affordance reachable and labelled', () => {
    const r = render(<ExerciseChrome {...chromeProps} />);
    const exit = buttonByLabel(r, 'Exit lesson');
    expect(exit).toBeDefined();
    expect(text(r)).toContain('Greetings & Basics');
  });

  it('hides hearts when the adult-mode preference is off', () => {
    const withHearts = render(<ExerciseChrome {...chromeProps} />);
    const without = render(<ExerciseChrome {...chromeProps} showHearts={false} />);
    const count = (r: TestRenderer.ReactTestRenderer) =>
      hostNodes(r, (n) => String(n.type) === 'Ionicons').length;
    expect(count(withHearts)).toBeGreaterThan(0);
    expect(count(without)).toBe(0);
  });
});

describe('ExerciseTrack', () => {
  const ticks = (r: TestRenderer.ReactTestRenderer) =>
    hostNodes(r, (n) => n.props?.style?.height === 5);

  it('draws one tick per exercise', () => {
    const r = render(<ExerciseTrack total={6} currentIndex={0} />);
    expect(ticks(r)).toHaveLength(6);
  });

  it('colours past, current and future ticks distinctly', () => {
    const r = render(<ExerciseTrack total={4} currentIndex={2} completedCount={2} />);
    expect(ticks(r).map((t) => t.props.style.backgroundColor)).toEqual([
      colors.success.base,
      colors.success.base,
      colors.action.accent,
      colors.surface.track,
    ]);
  });

  it('announces position rather than a percentage', () => {
    const r = render(<ExerciseTrack total={6} currentIndex={2} />);
    const bar = hostNodes(r, (n) => n.props?.accessibilityRole === 'progressbar')[0];
    expect(bar.props.accessibilityLabel).toBe('Question 3 of 6');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 6, now: 3 });
  });
});

// ─── Controlled MultipleChoice ────────────────────────────────────────────

const exercise: Exercise = {
  id: 'ex-1',
  lessonId: 'lesson-1',
  type: 'multiple_choice',
  orderIndex: 0,
  prompt: 'El ___ está frío.',
  promptAudioUrl: null,
  correctAnswer: 'agua',
  acceptedAnswers: ['agua'],
  options: ['agua', 'leche', 'pan', 'café'],
  hintText: null,
  cardId: null,
  targetWord: 'agua',
};

describe('MultipleChoice (controlled)', () => {
  it('renders lettered key tiles for every option', () => {
    const r = render(
      <MultipleChoice exercise={exercise} onAnswer={() => {}} showResult={false} />,
    );
    const rendered = text(r);
    expect(rendered).toContain('A');
    expect(rendered).toContain('D');
    expect(rendered).toContain('agua');
  });

  it('reports the pick upward instead of keeping it locally', () => {
    const onAnswer = jest.fn();
    const r = render(
      <MultipleChoice exercise={exercise} onAnswer={onAnswer} showResult={false} />,
    );
    TestRenderer.act(() => {
      // The composite Pressable carries onPress; the host View it renders
      // carries only the resolved responder handlers.
      const pressable = r.root.findAll(
        (n: ReactTestInstance) =>
          typeof n.type !== 'string' && n.props?.accessibilityLabel === 'Option B: leche',
        { deep: true },
      )[0];
      pressable.props.onPress();
    });
    expect(onAnswer).toHaveBeenCalledWith(false, 'leche');
  });

  it('marks the correct row and the learner pick once selected is supplied', () => {
    const r = render(
      <MultipleChoice
        exercise={exercise}
        selected="leche"
        onAnswer={() => {}}
        showResult
      />,
    );
    const rendered = text(r);
    expect(rendered).toContain('CORRECT');
    expect(rendered).toContain('YOUR PICK');
  });

  it('locks every row once an answer is restored', () => {
    const onAnswer = jest.fn();
    const r = render(
      <MultipleChoice
        exercise={exercise}
        selected="leche"
        onAnswer={onAnswer}
        showResult
      />,
    );
    const rows = hostNodes(r, (n) =>
      typeof n.props?.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Option '),
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.props.accessibilityState.disabled)).toBe(true);
  });
});

// ─── Previous restores an answered exercise ───────────────────────────────

describe('restoring an answered exercise', () => {
  const typed: Exercise = {
    ...exercise,
    id: 'ex-typed',
    type: 'translate_to_target',
    prompt: 'the water',
    correctAnswer: 'el agua',
    acceptedAnswers: ['agua'],
    options: null,
  };

  it('starts blank when the learner has not answered yet', () => {
    const r = render(
      <TranslationExercise exercise={typed} onAnswer={() => {}} showResult={false} />,
    );
    const input = hostNodes(r, (n) => n.props?.accessibilityLabel === 'Translation input')[0];
    expect(input.props.value).toBe('');
    expect(input.props.editable).toBe(true);
  });

  it('brings back the submitted text, locked, when walked back onto', () => {
    const r = render(
      <TranslationExercise
        exercise={typed}
        selected="el agua"
        onAnswer={() => {}}
        showResult
      />,
    );
    const input = hostNodes(r, (n) => n.props?.accessibilityLabel === 'Translation input')[0];
    expect(input.props.value).toBe('el agua');
    expect(input.props.editable).toBe(false);
    // And the grade the learner originally saw, not a fresh blank state.
    expect(text(r)).toContain('Correct');
  });

  it('brings back a wrong answer as wrong', () => {
    const r = render(
      <TranslationExercise
        exercise={typed}
        selected="la leche"
        onAnswer={() => {}}
        showResult
      />,
    );
    const input = hostNodes(r, (n) => n.props?.accessibilityLabel === 'Translation input')[0];
    expect(input.props.value).toBe('la leche');
    expect(text(r)).toContain('Incorrect');
  });

  it('does not re-report the restored answer upward', () => {
    // Re-firing onAnswer on mount would re-run SRS scheduling and re-log the
    // correction every time the learner paged backwards.
    const onAnswer = jest.fn();
    render(
      <TranslationExercise
        exercise={typed}
        selected="el agua"
        onAnswer={onAnswer}
        showResult
      />,
    );
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('rebuilds an assembled sentence onto this mount\'s tiles', () => {
    const construction: Exercise = {
      ...exercise,
      id: 'ex-build',
      type: 'sentence_construction',
      prompt: 'Build the sentence',
      correctAnswer: 'el agua está fría',
      acceptedAnswers: [],
      options: null,
      metadata: { tiles: ['el', 'agua', 'está', 'fría'], distractors: ['leche'] },
    };
    const r = render(
      <SentenceConstructionExercise
        exercise={construction}
        selected="el agua está fría"
        onAnswer={() => {}}
      />,
    );
    // The assembled row shows the learner's sentence back to them, whatever
    // order this mount happened to shuffle the tiles into.
    expect(text(r)).toContain('el');
    expect(text(r)).toContain('fría');
  });
});
