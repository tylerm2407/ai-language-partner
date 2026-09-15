import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { SentenceConstructionExercise } from './SentenceConstructionExercise';
import type { Exercise } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));
jest.mock('./FeedbackCard', () => ({ FeedbackCard: () => null }));
jest.mock('../ui/Text', () => {
  const { Text } = jest.requireActual('react-native');
  return { Body: Text, Caption: Text };
});
jest.mock('../shared/HighlightedText', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { HighlightedText: ({ text }: { text: string }) => React.createElement(Text, null, text) };
});

const base: Exercise = {
  id: 'construction-audit', lessonId: 'lesson', type: 'sentence_construction', orderIndex: 0,
  prompt: 'Build the sentence.', promptAudioUrl: null, correctAnswer: '我学习中文。',
  acceptedAnswers: [], options: null, hintText: null, cardId: null,
  metadata: { tiles: ['我', '学习', '中文', '。'], distractors: [], tile_joiner: '' },
};
function render(exercise = base, selected: string | null = null) {
  const onAnswer = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<SentenceConstructionExercise exercise={exercise} onAnswer={onAnswer} showResult={false} selected={selected} language="zh" />); });
  const button = (label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  return { tree, onAnswer, button, press: (label: string) => act(() => button(label).props.onPress()) };
}

test('a no-space tile bank submits and grades the natural Chinese sentence', () => {
  const ui = render();
  for (const word of ['我', '学习', '中文', '。']) ui.press(`Add word: ${word}`);
  ui.press('Check answer');
  expect(ui.onAnswer).toHaveBeenCalledWith(true, '我学习中文。');
  act(() => ui.tree.unmount());
});

test('changing word order is not accepted merely because the characters match', () => {
  const ui = render();
  for (const word of ['学习', '我', '中文', '。']) ui.press(`Add word: ${word}`);
  ui.press('Check answer');
  expect(ui.onAnswer).toHaveBeenCalledWith(false, '学习我中文。');
  act(() => ui.tree.unmount());
});

test('a restored no-space answer shows the saved tiles without submitting again', () => {
  const ui = render(base, '我学习中文。');
  for (const word of ['我', '学习', '中文', '。']) expect(ui.button(`Remove word: ${word}`).props.disabled).toBe(true);
  expect(ui.onAnswer).not.toHaveBeenCalled();
  act(() => ui.tree.unmount());
});

test('existing spaced banks keep their original joining behavior', () => {
  const ui = render({ ...base, correctAnswer: 'Je lis.', metadata: { tiles: ['Je', 'lis.'] } });
  ui.press('Add word: Je');
  ui.press('Add word: lis.');
  ui.press('Check answer');
  expect(ui.onAnswer).toHaveBeenCalledWith(true, 'Je lis.');
  act(() => ui.tree.unmount());
});
