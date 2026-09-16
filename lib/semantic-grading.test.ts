/**
 * Tests for lib/semantic-grading.ts.
 *
 * The edge function is mocked at the invoke boundary. What matters here is the
 * routing — fixed first, grader second, fixed-and-labelled third — and that a
 * remote failure lands in the result rather than being thrown or hidden.
 */
import { gradeToRating } from './grading';
import {
  gradeOpenResponse,
  restoreOpenGrade,
  PARTIAL_ACCURACY,
  type OpenResponseArgs,
} from './semantic-grading';

const mockInvoke = jest.fn();

jest.mock('./ai', () => ({
  invokeWithRetry: (...args: unknown[]) => mockInvoke(...args),
}));

// Deliberately far from the key: the client's fixed grader tolerates up to two
// edits, so a one-letter change (hermana/hermano) would never reach the grader.
const ARGS: OpenResponseArgs = {
  answer: 'Ayer jugué al fútbol con mis amigos.',
  key: 'Fui al cine con mi hermano.',
  alternatives: ['Ayer fui al cine.'],
  language: 'es',
  level: 'A2',
  kind: 'free_production',
  promptText: 'Write one sentence about yesterday.',
  exerciseHints: { exerciseType: 'free_production', language: 'es' },
};

beforeEach(() => {
  mockInvoke.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('a fixed-key match never calls the edge function', async () => {
  const r = await gradeOpenResponse({ ...ARGS, answer: 'ayer fui al cine' });
  expect(r.isCorrect).toBe(true);
  expect(r.source).toBe('fixed');
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('a semantic "correct" overrides the fixed miss and carries the reason', async () => {
  mockInvoke.mockResolvedValue({
    data: { verdict: 'correct', reason: 'Right tense, on topic.', source: 'semantic' },
    error: null,
  });
  const r = await gradeOpenResponse(ARGS);
  expect(mockInvoke).toHaveBeenCalledWith('grade-response', {
    body: {
      answer: ARGS.answer,
      key: ARGS.key,
      alternatives: ARGS.alternatives,
      language: 'es',
      level: 'A2',
      kind: 'free_production',
      prompt: ARGS.promptText,
    },
  });
  expect(r.isCorrect).toBe(true);
  expect(r.source).toBe('semantic');
  expect(r.reason).toBe('Right tense, on topic.');
  expect(gradeToRating(r, 1000)).toBe(5);
});

test('a "partial" verdict is wrong but close, on the untouched rating scale', async () => {
  mockInvoke.mockResolvedValue({
    data: { verdict: 'partial', reason: 'The verb should be past tense.', source: 'semantic' },
    error: null,
  });
  const r = await gradeOpenResponse(ARGS);
  expect(r.isCorrect).toBe(false);
  expect(r.accuracy).toBe(PARTIAL_ACCURACY);
  expect(r.feedback).toContain('The verb should be past tense.');
  expect(r.feedback).toContain(ARGS.key);
  expect(r.errorType).toBeNull();
  expect(gradeToRating(r, 1000)).toBe(2);
});

test('an "incorrect" verdict shows the reason and the expected answer', async () => {
  mockInvoke.mockResolvedValue({
    data: { verdict: 'incorrect', reason: 'This is about tomorrow, not yesterday.', source: 'semantic' },
    error: null,
  });
  const r = await gradeOpenResponse(ARGS);
  expect(r.isCorrect).toBe(false);
  expect(r.accuracy).toBe(0);
  expect(gradeToRating(r, 1000)).toBe(1);
  expect(r.feedback).toContain(ARGS.key);
});

test('an invoke error falls back to the fixed key and says so', async () => {
  const context = { json: () => Promise.resolve({ error: 'Too many requests.', code: 'RATE_LIMITED' }) };
  mockInvoke.mockResolvedValue({ data: null, error: { message: 'non-2xx', context } });
  const r = await gradeOpenResponse(ARGS);
  expect(r.source).toBe('fixed_fallback');
  expect(r.fallbackReason).toBe('Too many requests. [RATE_LIMITED]');
  expect(r.isCorrect).toBe(false);
  expect(console.warn).toHaveBeenCalled();
});

test('a server fallback (quota spent) keeps the local fixed result, labelled', async () => {
  mockInvoke.mockResolvedValue({
    data: { verdict: 'fallback', fixed: { verdict: 'incorrect', reason: 'Expected: x' }, reason: 'quota' },
    error: null,
  });
  const r = await gradeOpenResponse(ARGS);
  expect(r.source).toBe('fixed_fallback');
  expect(r.fallbackReason).toBe('quota');
});

test('the local fixed fallback keeps its typo tolerance', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'fallback', reason: 'provider' }, error: null });
  const r = await gradeOpenResponse({ ...ARGS, answer: 'Fui al cine con mi hermanno.' });
  expect(r.isCorrect).toBe(true);
  expect(r.source).toBe('fixed');
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('a malformed body is a labelled fallback, not a crash', async () => {
  mockInvoke.mockResolvedValue({ data: { verdict: 'meh' }, error: null });
  const r = await gradeOpenResponse(ARGS);
  expect(r.source).toBe('fixed_fallback');
  expect(r.fallbackReason).toBe('malformed response');
});

test('restoring a grader-accepted answer honours the recorded status', () => {
  const fixed = {
    isCorrect: false, accuracy: 0, feedback: 'Incorrect.', normalizedUserAnswer: 'a', normalizedCorrectAnswer: 'b', errorType: null,
  };
  expect(restoreOpenGrade(fixed, true)?.isCorrect).toBe(true);
  expect(restoreOpenGrade(fixed, false)).toBe(fixed);
  expect(restoreOpenGrade(fixed, null)).toBe(fixed);
  expect(restoreOpenGrade(null, true)).toBeNull();
});
