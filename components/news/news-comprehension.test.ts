import {
  answersForSubmit,
  canSubmit,
  comprehensionReducer as reduce,
  correctCount,
  initialComprehensionState as init,
  isLocked,
  resultCopy,
} from './news-comprehension';
import type { NewsReadingResult } from '../../types';

const RESULT: NewsReadingResult = {
  id: 'r1',
  userId: 'u1',
  articleId: 'a1',
  targetLanguage: 'es',
  cefrLevel: 'B1',
  comprehension: 2 / 3,
  questionsTotal: 3,
  completedAt: '2026-09-13T10:00:00Z',
};

const ERR = { title: 'Could not save', message: 'Try again.' };

function answered() {
  let s = init(3);
  s = reduce(s, { type: 'select', question: 0, option: 1 });
  s = reduce(s, { type: 'select', question: 1, option: 0 });
  s = reduce(s, { type: 'select', question: 2, option: 3 });
  return s;
}

describe('comprehension state', () => {
  it('starts with no picks and cannot submit', () => {
    const s = init(3);
    expect(s.answers).toEqual([null, null, null]);
    expect(s.status).toBe('answering');
    expect(canSubmit(s)).toBe(false);
  });

  it('submits only once every question has a pick', () => {
    let s = init(3);
    s = reduce(s, { type: 'select', question: 0, option: 2 });
    s = reduce(s, { type: 'select', question: 1, option: 2 });
    expect(canSubmit(s)).toBe(false);
    expect(reduce(s, { type: 'submit' }).status).toBe('answering');
    s = reduce(s, { type: 'select', question: 2, option: 0 });
    expect(canSubmit(s)).toBe(true);
    expect(answersForSubmit(s)).toEqual([2, 2, 0]);
  });

  it('a pick can be changed until submit', () => {
    let s = reduce(init(3), { type: 'select', question: 1, option: 0 });
    s = reduce(s, { type: 'select', question: 1, option: 3 });
    expect(s.answers[1]).toBe(3);
  });

  it('ignores a pick for a question that does not exist', () => {
    const s = init(3);
    expect(reduce(s, { type: 'select', question: 3, option: 0 })).toBe(s);
    expect(reduce(s, { type: 'select', question: -1, option: 0 })).toBe(s);
  });

  it('locks the picks while submitting and after it lands', () => {
    let s = reduce(answered(), { type: 'submit' });
    expect(s.status).toBe('submitting');
    expect(isLocked(s)).toBe(true);
    expect(reduce(s, { type: 'select', question: 0, option: 0 }).answers[0]).toBe(1);
    expect(reduce(s, { type: 'submit' })).toBe(s);

    s = reduce(s, { type: 'succeeded', result: RESULT });
    expect(s.status).toBe('done');
    expect(s.result).toBe(RESULT);
    expect(isLocked(s)).toBe(true);
    expect(reduce(s, { type: 'select', question: 0, option: 0 })).toBe(s);
  });

  it('a failed submit keeps the picks, shows the error, and can retry', () => {
    let s = reduce(answered(), { type: 'submit' });
    s = reduce(s, { type: 'failed', error: ERR });
    expect(s.status).toBe('error');
    expect(s.error).toEqual(ERR);
    expect(s.answers).toEqual([1, 0, 3]);
    expect(isLocked(s)).toBe(false);

    const retried = reduce(s, { type: 'retry' });
    expect(retried.status).toBe('submitting');
    expect(retried.error).toBeNull();
  });

  it('changing a pick after a failure clears the error and returns to answering', () => {
    let s = reduce(answered(), { type: 'submit' });
    s = reduce(s, { type: 'failed', error: ERR });
    s = reduce(s, { type: 'select', question: 2, option: 1 });
    expect(s.status).toBe('answering');
    expect(s.error).toBeNull();
    expect(canSubmit(s)).toBe(true);
  });

  it('retry does nothing outside the error state', () => {
    const s = answered();
    expect(reduce(s, { type: 'retry' })).toBe(s);
  });

  it('a late failure cannot un-finish a check that already landed', () => {
    const s = reduce(reduce(answered(), { type: 'submit' }), { type: 'succeeded', result: RESULT });
    expect(reduce(s, { type: 'failed', error: ERR })).toBe(s);
  });

  it('a stored result renders as done from the start and takes no picks', () => {
    const s = init(3, RESULT);
    expect(s.status).toBe('done');
    expect(s.result).toBe(RESULT);
    expect(reduce(s, { type: 'select', question: 0, option: 0 })).toBe(s);
    expect(canSubmit(s)).toBe(false);
  });

  it('restore lands a stored result on an open check', () => {
    const s = reduce(reduce(init(3), { type: 'select', question: 0, option: 1 }), { type: 'restore', result: RESULT });
    expect(s.status).toBe('done');
    expect(s.result).toBe(RESULT);
  });
});

describe('result copy', () => {
  it('recovers whole questions from the stored share', () => {
    expect(correctCount({ comprehension: 2 / 3, questionsTotal: 3 })).toBe(2);
    expect(correctCount({ comprehension: 0.6667, questionsTotal: 3 })).toBe(2);
    expect(correctCount({ comprehension: 1, questionsTotal: 3 })).toBe(3);
    expect(correctCount({ comprehension: 0, questionsTotal: 3 })).toBe(0);
  });

  it('says "n of total" and one plain sentence — no band, no can-do', () => {
    for (const n of [0, 1, 2, 3]) {
      const copy = resultCopy({ comprehension: n / 3, questionsTotal: 3 });
      expect(copy.score).toBe(`${n} of 3`);
      expect(copy.note).not.toMatch(/\b[ABC][12]\b/);
      expect(copy.note.length).toBeGreaterThan(0);
    }
  });

  it('a perfect score and a partial score read differently', () => {
    expect(resultCopy({ comprehension: 1, questionsTotal: 3 }).note).not.toBe(
      resultCopy({ comprehension: 1 / 3, questionsTotal: 3 }).note,
    );
  });
});
