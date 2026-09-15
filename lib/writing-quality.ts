import type { WritingFeedback } from '../types';
import { CEFR_LADDER } from './cefr-proficiency';

/** A selected A1 course must not silently serve its stray C2 writing rows.
 * Easier review remains available; this does not delete advanced content. */
export function writingLevelFitsCourse(promptLevel: string, courseLevel: string): boolean {
  const prompt = CEFR_LADDER.findIndex(level => level === promptLevel);
  const course = CEFR_LADDER.findIndex(level => level === courseLevel);
  return prompt >= 0 && course >= 0 && prompt <= course;
}

function inRange(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
}

/** One calculation for saved score, visible score and retry comparison.
 * Include genuine zeros. A no-grade response is null, never a failing score.
 * Prefer the existing four-part rubric, including actual task completion;
 * old feedback without that rubric retains its available diagnostic mean. */
export function writingOverallScore(feedback: WritingFeedback): number | null {
  if (feedback.graded === false) return null;
  const rubric = [feedback.grammar, feedback.vocabulary, feedback.coherence, feedback.task_completion];
  if (rubric.some(score => score !== undefined)) {
    if (!rubric.every(score => inRange(score, 25))) return null;
    return (rubric as number[]).reduce((sum, score) => sum + score, 0) / 100;
  }
  const required = [feedback.grammarScore, feedback.vocabularyScore, feedback.coherenceScore];
  if (!required.every(score => inRange(score, 100))) return null;
  const scores = [...required, feedback.spellingScore, feedback.sentenceStructureScore].filter(score => score !== undefined);
  if (!scores.every(score => inRange(score, 100))) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length / 100;
}
