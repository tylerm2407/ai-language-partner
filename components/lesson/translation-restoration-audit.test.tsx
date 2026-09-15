import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { TranslationExercise } from './TranslationExercise';
import type { Exercise } from '../../types';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));
// TranslationExercise now reaches lib/ai (the semantic grader); keep the
// supabase client out of this render.
jest.mock('../../lib/ai', () => ({ invokeWithRetry: jest.fn() }));

jest.mock('./FeedbackCard', () => ({ FeedbackCard: () => null }));
jest.mock('../shared/HighlightedText', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { HighlightedText: ({ text }: { text: string }) => React.createElement(Text, null, text) };
});

const exercise: Exercise = {
  id: 'restoration-audit', lessonId: 'lesson', type: 'translate_to_target', orderIndex: 0,
  prompt: 'Translate to French: fish', promptAudioUrl: null, correctAnswer: 'poisson',
  acceptedAnswers: [], options: null, hintText: null, cardId: null, skillType: 'vocabulary',
};

test('a wrong confusable translation stays wrong when the learner returns to it', () => {
  const onAnswer = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult={false} language="fr" />); });
  act(() => tree.root.findByType(TextInput).props.onChangeText('poison'));
  const check = tree.root.findAll(n => n.props.label === 'Check' && typeof n.props.onPress === 'function')[0];
  act(() => check.props.onPress());
  expect(onAnswer).toHaveBeenCalledWith(false, 'poison');
  act(() => tree.unmount());
  onAnswer.mockClear();
  act(() => { tree = TestRenderer.create(<TranslationExercise exercise={exercise} onAnswer={onAnswer} showResult language="fr" selected="poison" />); });
  expect(tree.root.findByType(TextInput).props.value).toBe('poison');
  expect(tree.root.findByType(TextInput).props.editable).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('Incorrect');
  expect(onAnswer).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
