import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { WritingExercise } from './WritingExercise';
import type { WritingPrompt } from '../../types';
import type { WritingLengthCount } from '../../lib/writing-length';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));
jest.mock('../ui/GradientBackground', () => ({
  GradientBackground: ({ children }: { children: React.ReactNode }) => children,
}));

const prompt: WritingPrompt = {
  id: 'p', courseId: 'c', unitId: null, cefrLevel: 'A1', promptText: 'Describe your morning.',
  promptType: 'free', exampleResponse: null, targetVocabulary: [], targetGrammar: [],
  minWords: 3, maxWords: 40, rubricCriteria: [], scaffoldType: 'free', scaffoldData: {},
  maxAttempts: 3, createdAt: '',
};

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(element); });
  return tree;
}
function allText(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll(n => typeof n.type === 'string').flatMap(n => n.children.filter(c => typeof c === 'string')).join('');
}
function type(tree: TestRenderer.ReactTestRenderer, value: string) {
  const input = tree.root.findAll(n => n.props.accessibilityLabel === 'Your writing' && typeof n.props.onChangeText === 'function')[0];
  act(() => input.props.onChangeText(value));
}
function submitButton(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll(n => n.props.accessibilityLabel === 'Submit writing' && typeof n.props.onPress === 'function')[0];
}

test('Chinese is gated in word segments when Intl.Segmenter exists', () => {
  expect(typeof Intl.Segmenter).toBe('function');
  const onSubmit = jest.fn();
  const tree = render(<WritingExercise prompt={prompt} language="zh" isGrading={false} onSubmit={onSubmit} onExit={jest.fn()} />);
  type(tree, '我');
  expect(submitButton(tree).props.disabled).toBe(true);
  expect(allText(tree)).toContain('1 word segment (min 3) (max 40)');
  type(tree, '我每天早上去学校。');
  expect(submitButton(tree).props.disabled).toBe(false);
  expect(allText(tree)).toMatch(/[3-6] word segments \(min 3\) \(max 40\)/);
  act(() => submitButton(tree).props.onPress());
  const [text, length] = onSubmit.mock.calls[0] as [string, WritingLengthCount, number];
  expect(text).toBe('我每天早上去学校。');
  expect(length.unit).toBe('segment');
  expect(length.method).toBe('intl_segmenter');
  act(() => tree.unmount());
});

test('a spaced language keeps whitespace words and the old label', () => {
  const tree = render(<WritingExercise prompt={prompt} language="es" isGrading={false} onSubmit={jest.fn()} onExit={jest.fn()} />);
  type(tree, 'hola');
  expect(allText(tree)).toContain('1 word (min 3) (max 40)');
  expect(submitButton(tree).props.disabled).toBe(true);
  type(tree, 'hola me llamo Ana');
  expect(submitButton(tree).props.disabled).toBe(false);
  act(() => tree.unmount());
});

describe('without Intl.Segmenter (Hermes)', () => {
  const original = Intl.Segmenter;
  beforeEach(() => {
    Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true, writable: true });
  });
  afterEach(() => {
    Object.defineProperty(Intl, 'Segmenter', { value: original, configurable: true, writable: true });
  });

  test('Japanese shows a neutral character count and never blocks on the word bounds', () => {
    const onSubmit = jest.fn();
    const strict: WritingPrompt = { ...prompt, minWords: 50, maxWords: 60 };
    const tree = render(<WritingExercise prompt={strict} language="ja" isGrading={false} onSubmit={onSubmit} onExit={jest.fn()} />);
    type(tree, '私は学生です。');
    const rendered = allText(tree);
    expect(rendered).toContain('6 characters · length checked on submit');
    expect(rendered).not.toContain('word');
    expect(rendered).not.toContain('min 50');
    expect(submitButton(tree).props.disabled).toBe(false);
    act(() => submitButton(tree).props.onPress());
    const length = onSubmit.mock.calls[0][1] as WritingLengthCount;
    expect(length).toEqual({ count: 6, unit: 'character', method: 'unavailable' });
    act(() => tree.unmount());
  });

  test('an empty Japanese answer still cannot be submitted', () => {
    const tree = render(<WritingExercise prompt={prompt} language="ja" isGrading={false} onSubmit={jest.fn()} onExit={jest.fn()} />);
    expect(submitButton(tree).props.disabled).toBe(true);
    expect(allText(tree)).toContain('0 characters');
    act(() => tree.unmount());
  });

  test('spaced languages are unaffected by the missing API', () => {
    const tree = render(<WritingExercise prompt={prompt} language="fr" isGrading={false} onSubmit={jest.fn()} onExit={jest.fn()} />);
    type(tree, 'Je suis là');
    expect(allText(tree)).toContain('3 words (min 3) (max 40)');
    expect(submitButton(tree).props.disabled).toBe(false);
    act(() => tree.unmount());
  });
});
