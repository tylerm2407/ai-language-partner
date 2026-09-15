import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { TranslationExercise } from './TranslationExercise';
import type { Exercise } from '../../types';

const mockInvoke = jest.fn();
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
jest.mock('../../lib/ai', () => ({ invokeWithRetry: (...a: unknown[]) => mockInvoke(...a) }));
jest.mock('./FeedbackCard', () => ({ FeedbackCard: () => null }));
jest.mock('../shared/HighlightedText', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { HighlightedText: ({ text }: { text: string }) => React.createElement(Text, null, text) };
});

const open: Exercise = {
  id: 'open-1', lessonId: 'lesson', type: 'free_production', orderIndex: 0,
  prompt: 'Write one sentence about what you did yesterday.', promptAudioUrl: null,
  correctAnswer: 'Ayer fui al cine.', acceptedAnswers: [], options: null, hintText: null, cardId: null, skillType: 'mixed',
};
const translation: Exercise = { ...open, id: 'tr-1', type: 'translate_to_target', prompt: 'Translate: cinema', correctAnswer: 'cine' };

function mount(exercise: Exercise, extra: Partial<React.ComponentProps<typeof TranslationExercise>> = {}) {
  const onAnswer = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={false} language="es" cefrLevel="A2" {...extra} />); });
  const type = (text: string) => act(() => tree.root.findByType(TextInput).props.onChangeText(text));
  const check = () => act(async () => {
    tree.root.findAll(n => n.props.label === 'Check' && typeof n.props.onPress === 'function')[0].props.onPress();
    await Promise.resolve();
  });
  return { tree, onAnswer, type, check };
}

beforeEach(() => { mockInvoke.mockReset(); });

test('a translation never calls the semantic grader', async () => {
  const ui = mount(translation);
  ui.type('cinema');
  await ui.check();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(ui.onAnswer).toHaveBeenCalledWith(false, 'cinema');
  act(() => ui.tree.unmount());
});

test('open production matching the key is credited without a call', async () => {
  const ui = mount(open);
  ui.type('ayer fui al cine');
  await ui.check();
  expect(mockInvoke).not.toHaveBeenCalled();
  expect(ui.onAnswer).toHaveBeenCalledWith(true, 'ayer fui al cine');
  act(() => ui.tree.unmount());
});

test('open production off the key is graded semantically', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'correct', reason: 'On topic, past tense.', source: 'semantic' }, error: null });
  const ui = mount(open);
  ui.type('Ayer jugué al fútbol con mis amigos.');
  await ui.check();
  expect(mockInvoke).toHaveBeenCalledWith('grade-response', expect.objectContaining({
    body: expect.objectContaining({ kind: 'free_production', language: 'es', level: 'A2', key: open.correctAnswer, prompt: open.prompt }),
  }));
  expect(ui.onAnswer).toHaveBeenCalledWith(true, 'Ayer jugué al fútbol con mis amigos.');
  expect(JSON.stringify(ui.tree.toJSON())).toContain('Correct');
  act(() => ui.tree.unmount());
});

test('when the grader is unavailable the key decides and the note is shown', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { message: 'network' } });
  const ui = mount(open);
  ui.type('Ayer jugué al fútbol con mis amigos.');
  await ui.check();
  expect(ui.onAnswer).toHaveBeenCalledWith(false, 'Ayer jugué al fútbol con mis amigos.');
  expect(JSON.stringify(ui.tree.toJSON())).toContain('Checked offline');
  act(() => ui.tree.unmount());
});

test('a restored grader-accepted answer stays correct on Previous', () => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <TranslationExercise exercise={open} onAnswer={jest.fn()} showResult language="es" selected="Ayer jugué al fútbol." restoredCorrect />,
    );
  });
  expect(tree.root.findByType(TextInput).props.value).toBe('Ayer jugué al fútbol.');
  expect(JSON.stringify(tree.toJSON())).toContain('Correct');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Incorrect');
  expect(mockInvoke).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

/**
 * The re-entrancy guard is a ref, not the `isGrading` state: two taps dispatched
 * in the same React batch both read the pre-update state, so a state guard lets
 * both through and each spends a unit of the day's semantic allowance.
 */
test('two Check taps in one batch spend one AI check, not two', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'correct', reason: 'Reads naturally.' }, error: null });
  const ui = mount(open);
  ui.type('Ayer fui al parque con mi hermana.');
  await act(async () => {
    const button = ui.tree.root.findAll(n => n.props.label === 'Check' && typeof n.props.onPress === 'function')[0];
    button.props.onPress();
    button.props.onPress();
    await Promise.resolve();
  });
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  act(() => ui.tree.unmount());
});

/** A spent daily allowance is not an outage, and must not read like one. */
test('a spent allowance is labelled as spent, not as an outage', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'fallback', reason: 'quota' }, error: null });
  const ui = mount(open);
  ui.type('Ayer fui al parque con mi hermana.');
  await ui.check();
  const rendered = JSON.stringify(ui.tree.toJSON());
  expect(rendered).toContain("You've used today's AI checks");
  expect(rendered).not.toContain('the AI check was not available');
  act(() => ui.tree.unmount());
});
