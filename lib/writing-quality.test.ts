import { writingLevelFitsCourse, writingOverallScore } from './writing-quality';
import type { WritingFeedback } from '../types';
const feedback = (scores: Partial<WritingFeedback>) => ({
  grammarScore: 100, vocabularyScore: 100, coherenceScore: 100,
  spellingScore: 100, sentenceStructureScore: 100,
  corrections: [], strengths: [], improvements: [], overallFeedback: '', correctedVersion: '', ...scores,
});

test.each(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])('preserves matching %s writing', level => {
  expect(writingLevelFitsCourse(level, level)).toBe(true);
});
test('keeps easier review but excludes higher-level content from the selected course', () => {
  expect(writingLevelFitsCourse('A1', 'B2')).toBe(true);
  expect(writingLevelFitsCourse('B1', 'A1')).toBe(false);
  expect(writingLevelFitsCourse('C2', 'B2')).toBe(false);
  expect(writingLevelFitsCourse('unknown', 'B2')).toBe(false);
});
test('does not discard genuine zero dimensions', () => {
  expect(writingOverallScore(feedback({ grammarScore: 0 }))).toBe(0.8);
  expect(writingOverallScore(feedback({ grammarScore: 0, vocabularyScore: 0, coherenceScore: 0, spellingScore: 0, sentenceStructureScore: 0 }))).toBe(0);
});
test('task completion affects the rubric score even when language diagnostics are high', () => {
  expect(writingOverallScore(feedback({ grammar: 25, vocabulary: 25, coherence: 25, task_completion: 0, total: 100 }))).toBe(0.75);
});
test('ungraded responses remain ungraded regardless of placeholder scores', () => {
  expect(writingOverallScore(feedback({ graded: false }))).toBeNull();
});
test('invalid or partial scores do not become fabricated grades', () => {
  expect(writingOverallScore(feedback({ grammarScore: 1000 }))).toBeNull();
  expect(writingOverallScore(feedback({ grammarScore: NaN }))).toBeNull();
  expect(writingOverallScore(feedback({ grammar: 25 }))).toBeNull();
});
