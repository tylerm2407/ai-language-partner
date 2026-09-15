import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { WritingExercise } from './WritingExercise';
import { WritingFeedbackView } from './WritingFeedbackView';
import { haptic } from '../../lib/haptics';
import { ReportContentSheet } from '../ui/ReportContentSheet';
import type { WritingPrompt, WritingFeedback } from '../../types';

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
jest.mock('../ui/ReportContentSheet', () => ({ ReportContentSheet: () => null }));
jest.mock('../ui/GradientBackground', () => ({
  GradientBackground: ({ children }: { children: React.ReactNode }) => children,
}));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(element); });
  return tree;
}
function text(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll(n => typeof n.type === 'string').flatMap(n => n.children.filter(c => typeof c === 'string')).join(' ');
}
const prompt: WritingPrompt = {
  id: 'p', courseId: 'c', unitId: null, cefrLevel: 'A1', promptText: 'Complete the sentence.',
  promptType: 'guided', exampleResponse: null, targetVocabulary: [], targetGrammar: [],
  minWords: null, maxWords: null, rubricCriteria: [], scaffoldType: 'fill_blank',
  scaffoldData: { sentence: '我叫___。', blank_index: 3 }, maxAttempts: 3, createdAt: '',
};
const feedback: WritingFeedback = {
  grammarScore: 100, vocabularyScore: 100, coherenceScore: 100, spellingScore: 100, sentenceStructureScore: 100,
  grammar: 25, vocabulary: 25, coherence: 25, task_completion: 0, total: 100,
  strengths: [], improvements: [], corrections: [], correctedVersion: '', overallFeedback: 'Saved.',
};

test('an unspaced marked scaffold submits the entire correct sentence', () => {
  const onSubmit = jest.fn();
  const tree = render(<WritingExercise prompt={prompt} isGrading={false} onSubmit={onSubmit} onExit={jest.fn()} />);
  const input = tree.root.findAll(n => n.props.accessibilityLabel === 'Fill in the blank' && typeof n.props.onChangeText === 'function')[0];
  act(() => input.props.onChangeText('小王'));
  const button = tree.root.findAll(n => n.props.accessibilityLabel === 'Submit writing' && typeof n.props.onPress === 'function')[0];
  expect(button.props.disabled).toBe(false);
  act(() => button.props.onPress());
  expect(onSubmit.mock.calls[0][0]).toBe('我叫小王。');
  act(() => tree.unmount());
});

test('marked sentence frames display the input between the prefix and suffix', () => {
  const onSubmit = jest.fn();
  const framePrompt: WritingPrompt = { ...prompt, scaffoldType: 'sentence_frame', scaffoldData: { starters: ['私は___です。', 'I like'] } };
  const tree = render(<WritingExercise prompt={framePrompt} isGrading={false} onSubmit={onSubmit} onExit={jest.fn()} />);
  const labels = tree.root.findAllByType(Text).map(n => n.props.children);
  expect(labels).toEqual(expect.arrayContaining(['私は', 'です。', 'I like']));
  expect(labels).not.toContain('私は___です。');
  for (const [label, answer] of [['Complete: 私は___です。', '田中'], ['Complete: I like', 'tea.']]) {
    const input = tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onChangeText === 'function')[0];
    act(() => input.props.onChangeText(answer));
  }
  const button = tree.root.findAll(n => n.props.accessibilityLabel === 'Submit writing' && typeof n.props.onPress === 'function')[0];
  expect(button.props.disabled).toBe(false);
  act(() => button.props.onPress());
  expect(onSubmit.mock.calls[0][0]).toBe('私は田中です。 I like tea.');
  act(() => tree.unmount());
});

test('guided marked frames ask for the missing text and preserve the sentence ending', () => {
  const onSubmit = jest.fn();
  const framePrompt: WritingPrompt = { ...prompt, scaffoldType: 'guided_paragraph', scaffoldData: { starters: ['저는 ___입니다.'] } };
  const tree = render(<WritingExercise prompt={framePrompt} isGrading={false} onSubmit={onSubmit} onExit={jest.fn()} />);
  const input = tree.root.findAll(n => n.props.accessibilityLabel === 'Complete: 저는 ___입니다.' && typeof n.props.onChangeText === 'function')[0];
  expect(input.props.placeholder).toBe('Complete the blank...');
  act(() => input.props.onChangeText('학생'));
  const button = tree.root.findAll(n => n.props.accessibilityLabel === 'Submit writing' && typeof n.props.onPress === 'function')[0];
  act(() => button.props.onPress());
  expect(onSubmit.mock.calls[0][0]).toBe('저는 학생입니다.');
  act(() => tree.unmount());
});

test('visible overall score includes task completion and matches the saved rubric', () => {
  const tree = render(<WritingFeedbackView feedback={feedback} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  expect(text(tree)).toContain('75');
  expect(text(tree)).toContain('Task completion');
  act(() => tree.unmount());
});

test('provider fallback shows no failing score, no false improvement, and no failure haptic', () => {
  jest.mocked(haptic).mockClear();
  const tree = render(<WritingFeedbackView feedback={{ ...feedback, graded: false }} previousScore={0.8} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  const rendered = text(tree);
  expect(rendered).toContain('Not graded');
  expect(rendered).not.toContain('Overall Score');
  expect(rendered).not.toContain('points from last attempt');
  expect(jest.mocked(haptic)).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

test('legacy feedback retains its diagnostic overall but does not invent absent category zeros', () => {
  const legacy = { grammarScore: 80, vocabularyScore: 80, coherenceScore: 80, corrections: [], overallFeedback: 'Clear writing.' } as unknown as WritingFeedback;
  const tree = render(<WritingFeedbackView feedback={legacy} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  const rendered = text(tree);
  expect(rendered).toContain('80');
  expect(rendered).toContain('Overall Score');
  expect(rendered).not.toContain('Spelling');
  expect(rendered).not.toContain('Sentence Structure');
  expect(rendered).not.toContain('Task completion');
  act(() => tree.unmount());
});

test('real diagnostic and rubric zeros remain visible', () => {
  const zero = { ...feedback, spellingScore: 0, sentenceStructureScore: 0, task_completion: 0 };
  const tree = render(<WritingFeedbackView feedback={zero} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  const labels = tree.root.findAllByType(Text).map(n => n.props.children);
  expect(labels).toEqual(expect.arrayContaining(['Spelling', 'Sentence Structure', 'Task completion']));
  expect(labels.filter(value => Array.isArray(value) && value[0] === 0 && value[1] === '/100')).toHaveLength(3);
  expect(text(tree)).toContain('75');
  act(() => tree.unmount());
});

test('legacy missing or malformed display data cannot crash or manufacture corrections', () => {
  const malformed = {
    ...feedback, strengths: [null, 'Clear meaning.', {}], improvements: 'not an array',
    correctedVersion: {}, overallFeedback: {}, spellingScore: 'bad', sentenceStructureScore: 200,
    corrections: [null, {}, { original: {}, corrected: 'x', explanation: 'x', type: 'grammar' }],
  } as unknown as WritingFeedback;
  const tree = render(<WritingFeedbackView feedback={malformed} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  const rendered = text(tree);
  expect(rendered).toContain('Clear meaning.');
  expect(rendered).toContain('Written feedback is unavailable for this attempt.');
  expect(rendered).not.toContain('Corrections (');
  expect(rendered).not.toContain('Corrected Version');
  expect(rendered).not.toContain('Spelling');
  expect(rendered).not.toContain('Sentence Structure');
  expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Report this feedback').length).toBeGreaterThan(0);
  expect(tree.root.findByType(ReportContentSheet).props.content).toBe('Strengths:\nClear meaning.');
  act(() => tree.unmount());

  const missing = { grammarScore: 80, vocabularyScore: 80, coherenceScore: 80 } as unknown as WritingFeedback;
  const oldTree = render(<WritingFeedbackView feedback={missing} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  expect(text(oldTree)).toContain('80');
  expect(text(oldTree)).toContain('Written feedback is unavailable');
  expect(oldTree.root.findAll(n => n.props.accessibilityLabel === 'Report this feedback')).toHaveLength(0);
  expect(oldTree.root.findByType(ReportContentSheet).props.content).toBe('');
  act(() => oldTree.unmount());
});

test.each([
  [{ correctedVersion: 'Je suis ici.' }, ['Corrected version:', 'Je suis ici.']],
  [{ corrections: [{ original: 'Je est', corrected: 'Je suis', explanation: 'Agree with je.', type: 'grammar' }] }, ['Original: Je est', 'Corrected: Je suis', 'Explanation: Agree with je.']],
  [{ strengths: ['Clear sequence.'], improvements: ['Check agreement.'] }, ['Strengths:', 'Clear sequence.', 'Areas to improve:', 'Check agreement.']],
])('legacy visible feedback remains reportable without overall prose: %j', (details, expected) => {
  const legacy = { ...feedback, overallFeedback: undefined, ...details } as unknown as WritingFeedback;
  const tree = render(<WritingFeedbackView feedback={legacy} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  const button = tree.root.findAll(n => n.props.accessibilityLabel === 'Report this feedback' && typeof n.props.onPress === 'function')[0];
  expect(button).toBeDefined();
  expect(tree.root.findByType(ReportContentSheet).props.visible).toBe(false);
  act(() => button.props.onPress());
  const sheet = tree.root.findByType(ReportContentSheet);
  expect(sheet.props.visible).toBe(true);
  for (const value of expected) expect(sheet.props.content).toContain(value);
  expect(sheet.props.content).not.toContain('Written feedback is unavailable');
  expect(sheet.props.content).not.toContain('[object Object]');
  act(() => tree.unmount());
});

test('all-empty or malformed feedback has no reportable text or report action', () => {
  const empty = {
    ...feedback, overallFeedback: '  ', correctedVersion: {}, strengths: [null, ' '], improvements: [],
    corrections: [{ original: ' ', corrected: '', explanation: '', type: '' }, { original: {}, corrected: 'x' }],
  } as unknown as WritingFeedback;
  const tree = render(<WritingFeedbackView feedback={empty} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  expect(tree.root.findAll(n => n.props.accessibilityLabel === 'Report this feedback')).toHaveLength(0);
  expect(tree.root.findByType(ReportContentSheet).props.content).toBe('');
  expect(tree.root.findByType(ReportContentSheet).props.visible).toBe(false);
  act(() => tree.unmount());
});

test('valid legacy insertion and deletion corrections remain visible beside invalid entries', () => {
  const mixed = { ...feedback, corrections: [
    { original: '', corrected: 'a', explanation: 'Supply the preposition.', type: 'grammar' },
    { original: 'the', corrected: '', explanation: 'No article is needed.', type: 'grammar' },
    null,
  ] } as unknown as WritingFeedback;
  const tree = render(<WritingFeedbackView feedback={mixed} onTryAgain={jest.fn()} onContinue={jest.fn()} />);
  expect(text(tree)).toContain('Supply the preposition.');
  expect(text(tree)).toContain('No article is needed.');
  expect(text(tree)).toContain('Corrections ( 2 )');
  act(() => tree.unmount());
});
