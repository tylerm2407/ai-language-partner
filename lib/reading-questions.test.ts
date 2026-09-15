import { gradeReadingAnswer, gradeReadingAnswerAsync, readingQuestionOptions } from './reading-questions';
import type { ReadingQuestion } from '../types';

function question(overrides: Partial<ReadingQuestion> = {}): ReadingQuestion {
  return {
    id: 'q',
    passageId: 'p',
    orderIndex: 0,
    questionText: '¿Adónde fue Ana?',
    questionType: 'short_answer',
    correctAnswer: 'Fue al mercado',
    acceptedAnswers: ['al mercado'],
    options: null,
    ...overrides,
  };
}

test('a legacy true/false row is answerable without stored options', () => {
  expect(readingQuestionOptions(question({ questionType: 'true_false', options: null }))).toEqual(['True', 'False']);
  expect(readingQuestionOptions(question({ questionType: 'multiple_choice', options: ['A', 'B'] }))).toEqual(['A', 'B']);
});

test('a tapped choice is graded strictly, with no typo tolerance', () => {
  const row = question({ questionType: 'multiple_choice', correctAnswer: 'Formal', acceptedAnswers: [], options: ['Formal', 'Informal'] });
  expect(gradeReadingAnswer('Formal', row).isCorrect).toBe(true);
  // One edit away. A tap is a deliberate choice, so it must not be forgiven.
  expect(gradeReadingAnswer('Formel', row).isCorrect).toBe(false);
});

test('without an injected grader a short answer stays on the stored key', async () => {
  const result = await gradeReadingAnswerAsync('Fue al mercado', question(), {});
  expect(result.isCorrect).toBe(true);
  expect(result.source).toBe('fixed');
  const miss = await gradeReadingAnswerAsync('Ana fue a comprar al mercado', question(), {});
  expect(miss.isCorrect).toBe(false);
  expect(miss.source).toBe('fixed');
});

test('a choice never reaches the grader even when one is injected', async () => {
  const grader = jest.fn();
  const row = question({ questionType: 'multiple_choice', correctAnswer: 'Formal', acceptedAnswers: [], options: ['Formal', 'Informal'] });
  await gradeReadingAnswerAsync('Informal', row, { grader });
  expect(grader).not.toHaveBeenCalled();
});

/**
 * The grading language comes from the passage's own course, resolved on the
 * server. A learner who switches target language must not have a correct answer
 * to an older passage graded against the new language, so the request names the
 * passage and carries no language.
 */
test('a short answer reaches the grader naming its passage, with no language', async () => {
  const grader = jest.fn().mockResolvedValue({ isCorrect: true, accuracy: 1, feedback: 'ok', normalizedUserAnswer: '', source: 'semantic', verdict: 'correct' });
  await gradeReadingAnswerAsync('Ana fue a comprar al mercado', question(), { grader, cefrLevel: 'A2' });
  expect(grader).toHaveBeenCalledTimes(1);
  const args = grader.mock.calls[0][0] as Record<string, unknown>;
  expect(args.passageId).toBe('p');
  expect(args.kind).toBe('short_answer');
  expect(args.level).toBe('A2');
  expect(args).not.toHaveProperty('language');
});

/**
 * Every short answer is handed to the injected grader, including one that
 * matches the stored key. The paid call is avoided one level down, inside
 * `gradeOpenResponse`, which answers from the key without a request and is
 * covered by lib/semantic-grading.test.ts. Asserting it here instead would
 * pin the fast path to the wrong module.
 */
test('a keyed short answer is still routed through the grader, which answers it locally', async () => {
  const grader = jest.fn().mockResolvedValue({ isCorrect: true, accuracy: 1, feedback: 'ok', normalizedUserAnswer: '', source: 'fixed', verdict: 'correct' });
  const result = await gradeReadingAnswerAsync('al mercado', question(), { grader });
  expect(grader).toHaveBeenCalledTimes(1);
  expect(result.source).toBe('fixed');
});
