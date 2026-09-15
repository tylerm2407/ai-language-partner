/**
 * The taught-keys read is paged, and the paging is the only part of it that
 * can fail silently.
 *
 * PostgREST caps a response at `db.max_rows`, 1,000 by default, and a language
 * is about 2,664 exercises. A single unpaged request returns the first thousand
 * rows with no error — the grader would hold a third of its sibling set,
 * refuse less than it should, and every grading test would still pass. So the
 * request count is asserted here: remove the loop and this fails.
 */
import { fetchTaughtKeysForUnits, TAUGHT_KEYS_PAGE_SIZE } from './supabase-queries';

const mockResult = jest.fn();
const mockQuery = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(mockResult()).then(resolve, reject),
};
jest.mock('./supabase', () => ({ supabase: { from: () => mockQuery } }));

const page = (n: number, from = 0) => ({
  data: Array.from({ length: n }, (_, i) => ({
    type: 'translate_to_target', prompt: '', correct_answer: `key-${from + i}`,
  })),
  error: null,
});

beforeEach(() => { jest.clearAllMocks(); });

test('a language longer than one page is read to the end', () => {
  mockResult
    .mockReturnValueOnce(page(TAUGHT_KEYS_PAGE_SIZE))
    .mockReturnValueOnce(page(TAUGHT_KEYS_PAGE_SIZE, TAUGHT_KEYS_PAGE_SIZE))
    .mockReturnValueOnce(page(664, 2 * TAUGHT_KEYS_PAGE_SIZE));
  return fetchTaughtKeysForUnits(['unit']).then((rows) => {
    expect(rows).toHaveLength(2 * TAUGHT_KEYS_PAGE_SIZE + 664);
    // The assertion that matters: three requests, not one.
    expect(mockQuery.range).toHaveBeenCalledTimes(3);
    expect(mockQuery.range).toHaveBeenCalledWith(0, TAUGHT_KEYS_PAGE_SIZE - 1);
    expect(mockQuery.range).toHaveBeenCalledWith(TAUGHT_KEYS_PAGE_SIZE, 2 * TAUGHT_KEYS_PAGE_SIZE - 1);
    // The last key of the last page survived, which a truncated read loses.
    expect(rows[rows.length - 1].correctAnswer).toBe(`key-${2 * TAUGHT_KEYS_PAGE_SIZE + 663}`);
  });
});

test('a short first page ends the read', () => {
  mockResult.mockReturnValue(page(12));
  return fetchTaughtKeysForUnits(['unit']).then((rows) => {
    expect(rows).toHaveLength(12);
    expect(mockQuery.range).toHaveBeenCalledTimes(1);
  });
});

test('the read stops rather than looping forever on full pages', () => {
  mockResult.mockReturnValue(page(TAUGHT_KEYS_PAGE_SIZE));
  return fetchTaughtKeysForUnits(['unit']).then((rows) => {
    expect(mockQuery.range).toHaveBeenCalledTimes(12);
    expect(rows).toHaveLength(12 * TAUGHT_KEYS_PAGE_SIZE);
  });
});

test('a database error is surfaced, not swallowed into a short sibling set', () => {
  mockResult.mockReturnValue({ data: null, error: { message: 'Unavailable' } });
  return expect(fetchTaughtKeysForUnits(['unit'])).rejects.toEqual({ message: 'Unavailable' });
});
