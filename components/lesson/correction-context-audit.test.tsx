import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { ErrorCorrectionExercise } from './ErrorCorrectionExercise';
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
  id: 'context-audit', lessonId: 'lesson', type: 'error_correction', orderIndex: 0,
  prompt: 'Legacy instruction', promptAudioUrl: null, correctAnswer: 'Penso che sia vero.',
  acceptedAnswers: [], options: null, hintText: null, cardId: null,
  metadata: { error_sentence: 'Penso che è vero.' },
};
const instruction = 'Rewrite in formal Italian using the present subjunctive after penso che.';
const contextual = { ...base, metadata: { ...base.metadata, correction_instruction: instruction } };

function render(exercise: Exercise) {
  const onAnswer = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<ErrorCorrectionExercise exercise={exercise} onAnswer={onAnswer} showResult={false} language="it" />); });
  return { tree, onAnswer };
}

test('an authored context is visible before answering and does not label the source universally wrong', () => {
  const { tree, onAnswer } = render(contextual);
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain(instruction);
  expect(text).toContain('Rewrite for this context');
  expect(text).toContain('Penso che è vero.');
  expect(text).not.toContain('This sentence contains an error.');
  expect(tree.root.findByType(TextInput).props.accessibilityLabel).toBe('Rewritten sentence');
  expect(onAnswer).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

test.each([undefined, '', '   ', 42])('default error instructions are preserved without a valid opt-in instruction (%s)', value => {
  const { tree } = render({ ...base, metadata: { ...base.metadata, correction_instruction: value } });
  expect(JSON.stringify(tree.toJSON())).toContain('This sentence contains an error.');
  expect(tree.root.findByType(TextInput).props.accessibilityLabel).toBe('Corrected sentence');
  act(() => tree.unmount());
});

test.each([['Penso che sia vero.', true], ['Penso che è vero.', false]])('the contextual task still grades the requested construction (%s)', (answer, correct) => {
  const { tree, onAnswer } = render(contextual);
  act(() => tree.root.findByType(TextInput).props.onChangeText(answer));
  const check = tree.root.findAll(n => n.props.accessibilityLabel === 'Check answer' && typeof n.props.onPress === 'function')[0];
  act(() => check.props.onPress());
  expect(onAnswer).toHaveBeenCalledWith(correct, answer);
  act(() => tree.unmount());
});
