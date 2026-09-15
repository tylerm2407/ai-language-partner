import type { ReadingQuestion } from '../types';
import { gradeAnswer } from './grading';
// TYPE-ONLY, and it must stay that way. `lib/semantic-grading` reaches
// `lib/supabase` (react-native-url-polyfill, AsyncStorage, @supabase/supabase-js),
// none of which resolve under Deno — and this module is imported directly by
// scripts/question-audit/corpus-runtime-checks.mjs, a required audit
// verification step that runs under Deno. A type import erases at compile time;
// a value import here breaks that run. The grader arrives as a parameter instead.
import type { OpenGradeResult, OpenResponseArgs } from './semantic-grading';

/** Legacy true/false rows need no stored options, but must still be answerable. */
export function readingQuestionOptions(question: ReadingQuestion): string[] {
  if (question.options?.length) return question.options;
  return question.questionType === 'true_false' ? ['True', 'False'] : [];
}

/** A tapped option is a deliberate choice, not a typing error. */
export function gradeReadingAnswer(answer: string, question: ReadingQuestion) {
  return gradeAnswer(answer, question.correctAnswer, question.acceptedAnswers, {
    exerciseHints: question.questionType === 'short_answer' ? undefined : { exerciseType: 'multiple_choice' },
  });
}

/** The injected semantic grader — `gradeOpenResponse` in the app, a stub in tests. */
export type OpenGrader = (args: OpenResponseArgs) => Promise<OpenGradeResult>;

export interface ReadingGradeContext {
  cefrLevel?: string;
  /** The question text, sent as reference so "on task" can be judged. */
  promptText?: string;
  /**
   * The semantic grader, supplied by the caller (see the import note above).
   * Without it, short answers stay on the stored key — an honest degradation
   * rather than a silent one.
   */
  grader?: OpenGrader;
}

/**
 * Grade a reading answer, semantically for a typed short answer.
 *
 * Choices stay on the synchronous key check. A short answer goes through the
 * injected grader — fixed key first, the grader only on a miss, the fixed
 * result labelled as such when the grader cannot answer. Callers show that
 * label; see lib/semantic-grading.ts.
 */
export async function gradeReadingAnswerAsync(
  answer: string,
  question: ReadingQuestion,
  context: ReadingGradeContext = {},
): Promise<OpenGradeResult> {
  const { grader } = context;
  if (question.questionType !== 'short_answer' || !grader) {
    const fixed = gradeReadingAnswer(answer, question);
    return { ...fixed, source: 'fixed', verdict: fixed.isCorrect ? 'correct' : 'incorrect' };
  }
  return grader({
    answer,
    key: question.correctAnswer,
    alternatives: question.acceptedAnswers,
    level: context.cefrLevel ?? 'A1',
    kind: 'short_answer',
    // The passage, not a language: the server reads the grading language from
    // this passage's course, so a learner switching target language cannot
    // cause a correct answer to an older passage to be graded as wrong.
    passageId: question.passageId,
    promptText: context.promptText ?? question.questionText,
  });
}
