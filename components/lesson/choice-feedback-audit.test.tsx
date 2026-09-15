import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MultipleChoice } from './MultipleChoice';
import { ListeningExercise } from './ListeningExercise';
import { haptic } from '../../lib/haptics';
import { ui2Light } from '../../config/theme';
import type { Exercise } from '../../types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => {}),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));
jest.mock('../../lib/supabase-queries', () => ({ logExerciseCorrection: jest.fn() }));
jest.mock('../../lib/ai', () => ({ VoiceError: class VoiceError extends Error {} }));
jest.mock('../../hooks/useAudioPlayer', () => ({ useAudioPlayer: () => ({ playing: false, loading: false, error: null, play: jest.fn() }) }));
jest.mock('../../lib/lesson-audio', () => ({ getLessonAudioUri: jest.fn(), LESSON_SLOW_RATE: 0.75 }));
jest.mock('./FeedbackCard', () => ({ FeedbackCard: () => null }));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(element); });
  return tree;
}

for (const type of ['multiple_choice', 'listening_choice'] as const) {
  const Component = type === 'multiple_choice' ? MultipleChoice : ListeningExercise;
  const choiceLabel = (option: string) => `Option ${type === 'multiple_choice' ? 'A' : '1'}: ${option}`;
  const getChoice = (tree: TestRenderer.ReactTestRenderer, option: string) => tree.root.findAll(n => n.props.accessibilityLabel === choiceLabel(option) && typeof n.props.onPress === 'function')[0];
  const expectFeedback = (tree: TestRenderer.ReactTestRenderer, option: string, correct: boolean) => {
    const button = getChoice(tree, option);
    expect(button.props.disabled).toBe(true);
    // What is asserted is that the VISUAL verdict agrees with the credit —
    // the exact tokens are UI 2.0's to pick, so they are read from the live
    // palette rather than pinned to a retired one. Under UI 2.0 a choice row
    // carries its state as a fill (multiple choice) or a border (listening),
    // not as a NativeWind colour class.
    if (type === 'multiple_choice') {
      expect(button.props.style.backgroundColor).toBe(correct ? ui2Light.green : ui2Light.error);
      const labels = button.findAll(n => typeof n.type === 'string').flatMap(n => n.children.filter(c => typeof c === 'string')).join(' ');
      expect(labels).toContain(correct ? 'CORRECT' : 'YOUR PICK');
    } else {
      expect(button.props.style.borderColor).toBe(correct ? ui2Light.green : ui2Light.error);
      expect(button.findAll(n => n.props.name === (correct ? 'checkmark-circle' : 'close-circle')).length).toBeGreaterThan(0);
      expect(button.findAll(n => n.props.name === (correct ? 'close-circle' : 'checkmark-circle'))).toHaveLength(0);
    }
  };

  it.each([
    ["  J’ai  fini.  ", "J'ai fini", [], true],
    ['e\u0301te\u0301', 'été', [], true],
    ['你好！', '你好', [], true],
    ['Gray', 'Grey', ['gray'], true],
    ['Formal', 'Informal', [], false],
    ['cafe', 'café', [], false],
  ] as [string, string, string[], boolean][])(`${type}: credit and fresh/restored visuals agree for %s`, (option, key, accepted, correct) => {
    const exercise: Exercise = {
      id: `${type}-normalization`, lessonId: 'audit-lesson', type, orderIndex: 0,
      prompt: 'Choose the matching answer.', promptAudioUrl: null, correctAnswer: key,
      acceptedAnswers: accepted, options: [option, 'Other answer'], hintText: null, cardId: null,
    };
    const onAnswer = jest.fn();
    const tree = render(<Component exercise={exercise} onAnswer={onAnswer} showResult={false} language="fr" />);
    act(() => getChoice(tree, option).props.onPress());
    expect(onAnswer).toHaveBeenCalledWith(correct, option);
    if (type === 'multiple_choice') act(() => tree.update(<Component exercise={exercise} onAnswer={onAnswer} showResult selected={option} language="fr" />));
    expectFeedback(tree, option, correct);
    act(() => tree.unmount());

    onAnswer.mockClear();
    jest.mocked(haptic).mockClear();
    const restored = render(<Component exercise={exercise} onAnswer={onAnswer} showResult selected={option} language="fr" />);
    expectFeedback(restored, option, correct);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    act(() => restored.unmount());
  });
}
