/**
 * State for the daily-news comprehension check, kept out of the component so
 * the rules can be asserted directly (see news-comprehension.test.ts):
 *
 *   - one pick per question, changeable until submitted;
 *   - Submit only once every question has a pick, and only once;
 *   - a failed submit keeps the picks and offers a retry — never silent;
 *   - a stored result (the learner reopened a finished article) renders as
 *     done and takes no picks, because the server ignores a second attempt.
 *
 * The copy is deliberately can-do-free and band-free: the article already
 * carries its band, and "2 of 3" is a fact about this article, not a verdict
 * on the learner's level. The report is where evidence becomes a level.
 */
import type { ErrorCopy } from '../../lib/error-copy';
import type { NewsReadingResult } from '../../types';

export type ComprehensionStatus = 'answering' | 'submitting' | 'done' | 'error';

export interface ComprehensionState {
  /** Chosen option index per question, null until picked. */
  answers: (number | null)[];
  status: ComprehensionStatus;
  result: NewsReadingResult | null;
  error: ErrorCopy | null;
}

export type ComprehensionAction =
  | { type: 'select'; question: number; option: number }
  | { type: 'submit' }
  | { type: 'succeeded'; result: NewsReadingResult }
  | { type: 'failed'; error: ErrorCopy }
  | { type: 'retry' }
  | { type: 'restore'; result: NewsReadingResult };

export function initialComprehensionState(
  questionCount: number,
  existing: NewsReadingResult | null = null,
): ComprehensionState {
  return {
    answers: Array.from({ length: questionCount }, () => null),
    status: existing ? 'done' : 'answering',
    result: existing,
    error: null,
  };
}

export function canSubmit(state: ComprehensionState): boolean {
  return state.status === 'answering' && state.answers.length > 0 && state.answers.every((a) => a !== null);
}

/** True once the picks are frozen: while a submit is in flight and after it lands. */
export function isLocked(state: ComprehensionState): boolean {
  return state.status === 'submitting' || state.status === 'done';
}

export function comprehensionReducer(
  state: ComprehensionState,
  action: ComprehensionAction,
): ComprehensionState {
  switch (action.type) {
    case 'select': {
      if (isLocked(state)) return state;
      if (action.question < 0 || action.question >= state.answers.length) return state;
      const answers = state.answers.slice();
      answers[action.question] = action.option;
      // Picking again after a failed submit is a fresh attempt at submitting,
      // so the stale error leaves with it.
      return { ...state, answers, status: 'answering', error: null };
    }
    case 'submit':
      return canSubmit(state) ? { ...state, status: 'submitting', error: null } : state;
    case 'succeeded':
      return { ...state, status: 'done', result: action.result, error: null };
    case 'failed':
      // Only a submit that was actually in flight can fail; a late rejection
      // after a restore must not un-finish the check.
      if (state.status !== 'submitting') return state;
      return { ...state, status: 'error', error: action.error };
    case 'retry':
      return state.status === 'error' ? { ...state, status: 'submitting', error: null } : state;
    case 'restore':
      return { ...state, status: 'done', result: action.result, error: null };
    default:
      return state;
  }
}

/** Answers as the RPC wants them. Only meaningful when `canSubmit`. */
export function answersForSubmit(state: ComprehensionState): number[] {
  return state.answers.map((a) => a ?? -1);
}

/** Whole questions right, recovered from the stored share. */
export function correctCount(result: Pick<NewsReadingResult, 'comprehension' | 'questionsTotal'>): number {
  return Math.round(result.comprehension * result.questionsTotal);
}

export interface ResultCopy {
  /** "2 of 3" */
  score: string;
  /** One plain sentence about this article — no band, no can-do. */
  note: string;
}

export function resultCopy(result: Pick<NewsReadingResult, 'comprehension' | 'questionsTotal'>): ResultCopy {
  const n = correctCount(result);
  const total = result.questionsTotal;
  const score = `${n} of ${total}`;
  if (n === total) return { score, note: 'You followed this article all the way through.' };
  if (n / total >= 0.5) return { score, note: 'You got the main points. One detail slipped past.' };
  if (n > 0) return { score, note: 'Some of it landed. A second read with the translation on will fill the gaps.' };
  return { score, note: 'This one was hard going. Try it again with the translation on.' };
}
