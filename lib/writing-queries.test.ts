import { fetchWritingPromptsByCourse } from './supabase-queries';

const mockResult = jest.fn();
const mockQuery = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(mockResult()).then(resolve, reject),
};
jest.mock('./supabase', () => ({ supabase: { from: () => mockQuery } }));

beforeEach(() => { jest.clearAllMocks(); });

test('the real writing query keeps course-level tasks and easier review, not stray advanced rows', async () => {
  mockResult.mockReturnValue({ data: ['A1', 'A2', 'B1', 'C2'].map(level => ({
    id: level, course_id: 'course', cefr_level: level, courses: { cefr_level: 'A2' },
    prompt_text: 'Write.', prompt_type: 'free', created_at: '2026-01-01',
  })), error: null });
  expect((await fetchWritingPromptsByCourse('course')).map(p => p.cefrLevel)).toEqual(['A1', 'A2']);
  expect(mockQuery.select).toHaveBeenCalledWith('*, courses!inner(cefr_level)');
  expect(mockQuery.eq).toHaveBeenCalledWith('course_id', 'course');
});

test('an empty writing shelf stays empty and database errors remain visible', async () => {
  mockResult.mockReturnValue({ data: [], error: null });
  expect(await fetchWritingPromptsByCourse('course')).toEqual([]);
  mockResult.mockReturnValue({ data: null, error: { message: 'Unavailable' } });
  await expect(fetchWritingPromptsByCourse('course')).rejects.toEqual({ message: 'Unavailable' });
});
