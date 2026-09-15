import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { ComprehensionQuestions } from './ComprehensionQuestions';
import type { ReadingQuestion } from '../../types';

const mockInvoke = jest.fn();
jest.mock('../../lib/haptics', () => ({ haptic: jest.fn() }));
jest.mock('../../lib/ai', () => ({ invokeWithRetry: (...a: unknown[]) => mockInvoke(...a) }));

beforeEach(() => { mockInvoke.mockReset(); });

function question(overrides: Partial<ReadingQuestion> = {}): ReadingQuestion {
  return { id: 'q', passageId: 'p', orderIndex: 0, questionText: 'The train leaves at noon.',
    questionType: 'true_false', correctAnswer: 'true', acceptedAnswers: [], options: null, ...overrides };
}

function exercise(row: ReadingQuestion, props: { cefrLevel?: string } = {}) {
  const onComplete = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<ComprehensionQuestions questions={[row]} onComplete={onComplete} onExit={jest.fn()} {...props} />); });
  const button = (label: string) => tree.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  const press = (label: string) => act(() => { button(label).props.onPress(); });
  // Check is async now: let the grading promise settle inside act.
  const pressAsync = (label: string) => act(async () => { button(label).props.onPress(); await Promise.resolve(); });
  const type = (text: string) => act(() => { tree.root.findByType(TextInput).props.onChangeText(text); });
  return { tree, button, press, pressAsync, type, onComplete };
}

const SHORT: Partial<ReadingQuestion> = {
  questionType: 'short_answer', questionText: '¿Adónde fue Ana?', correctAnswer: 'Fue al mercado', acceptedAnswers: ['al mercado'], options: null,
};

test('a true/false row with no options renders both choices and can finish', async () => {
  const ui = exercise(question());
  expect(ui.button('True')).toBeDefined();
  expect(ui.button('False')).toBeDefined();
  expect(ui.button('Check answer').props.disabled).toBe(true);
  ui.press('True');
  await ui.pressAsync('Check answer');
  ui.press('Finish');
  expect(ui.onComplete).toHaveBeenCalledWith(1);
  act(() => ui.tree.unmount());
});

test('tapped reading distractors do not receive typo tolerance', async () => {
  const ui = exercise(question({ questionType: 'multiple_choice', options: ['Formal', 'Informal'], correctAnswer: 'Formal' }));
  ui.press('Informal');
  await ui.pressAsync('Check answer');
  ui.press('Finish');
  expect(ui.onComplete).toHaveBeenCalledWith(0);
  act(() => ui.tree.unmount());
});

test('an explicitly accepted reading choice receives credit', async () => {
  const ui = exercise(question({ questionType: 'multiple_choice', options: ['Grey', 'Gray', 'Blue'], correctAnswer: 'Grey', acceptedAnswers: ['Gray'] }));
  ui.press('Gray');
  await ui.pressAsync('Check answer');
  ui.press('Finish');
  expect(ui.onComplete).toHaveBeenCalledWith(1);
  act(() => ui.tree.unmount());
});

test('choices never call the semantic grader', async () => {
  const ui = exercise(question({ questionType: 'multiple_choice', options: ['Formal', 'Informal'], correctAnswer: 'Formal' }), { cefrLevel: 'A2' });
  ui.press('Informal');
  await ui.pressAsync('Check answer');
  expect(mockInvoke).not.toHaveBeenCalled();
  act(() => ui.tree.unmount());
});

test('a short answer that matches the key is credited without a call', async () => {
  const ui = exercise(question(SHORT), { cefrLevel: 'A2' });
  ui.type('al mercado.');
  await ui.pressAsync('Check answer');
  expect(mockInvoke).not.toHaveBeenCalled();
  ui.press('Finish');
  expect(ui.onComplete).toHaveBeenCalledWith(1);
  act(() => ui.tree.unmount());
});

test('a paraphrased short answer is credited by the semantic grader and shows its reason', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'correct', reason: 'Same place, different words.', source: 'semantic' }, error: null });
  const ui = exercise(question(SHORT), { cefrLevel: 'A2' });
  ui.type('Ana fue a comprar al mercado');
  await ui.pressAsync('Check answer');
  expect(mockInvoke).toHaveBeenCalledWith('grade-response', expect.objectContaining({ body: expect.objectContaining({ kind: 'short_answer', passageId: 'p', level: 'A2' }) }));
  expect(JSON.stringify(ui.tree.toJSON())).toContain('Same place, different words.');
  ui.press('Finish');
  expect(ui.onComplete).toHaveBeenCalledWith(1);
  act(() => ui.tree.unmount());
});

test('when the grader is unavailable the key decides and the learner is told', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { message: 'network' } });
  const ui = exercise(question(SHORT), { cefrLevel: 'A2' });
  ui.type('Ana fue a comprar al mercado');
  await ui.pressAsync('Check answer');
  const rendered = JSON.stringify(ui.tree.toJSON());
  expect(rendered).toContain('Checked offline');
  expect(rendered).toContain('Not quite.');
  ui.press('Finish');
  expect(ui.onComplete).toHaveBeenCalledWith(0);
  act(() => ui.tree.unmount());
});

// The grading language is the PASSAGE's, resolved server-side from its course.
// A learner who switches target language must not have a correct answer to an
// older passage graded against the new one, so no language may ride along here.
test('a short answer names its passage and sends no language of its own', async () => {
  const ui = exercise(question(SHORT), { cefrLevel: 'A2' });
  ui.type('Ana fue a comprar al mercado');
  await ui.pressAsync('Check answer');
  const body = mockInvoke.mock.calls[0][1].body as Record<string, unknown>;
  expect(body.passageId).toBe('p');
  expect(body).not.toHaveProperty('language');
  act(() => ui.tree.unmount());
});

/**
 * The re-entrancy guard is a ref, not the `isGrading` state: two taps dispatched
 * in the same React batch both read the pre-update state, so a state guard lets
 * both through and each spends a unit of the day's semantic allowance.
 */
test('two taps in one batch spend one AI check, not two', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'correct', reason: 'Same place, different words.' }, error: null });
  const ui = exercise(question(SHORT), { cefrLevel: 'A2' });
  ui.type('Ana fue a comprar al mercado');
  await act(async () => {
    ui.button('Check answer').props.onPress();
    ui.button('Check answer').props.onPress();
    await Promise.resolve();
  });
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  act(() => ui.tree.unmount());
});

/** A spent daily allowance is not an outage, and must not read like one. */
test('a spent allowance is labelled as spent, not as an outage', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'fallback', reason: 'quota' }, error: null });
  const ui = exercise(question(SHORT), { cefrLevel: 'A2' });
  ui.type('Ana fue a comprar al mercado');
  await ui.pressAsync('Check answer');
  const rendered = JSON.stringify(ui.tree.toJSON());
  expect(rendered).toContain("You've used today's AI checks");
  expect(rendered).not.toContain('the AI check was not available');
  act(() => ui.tree.unmount());
});
