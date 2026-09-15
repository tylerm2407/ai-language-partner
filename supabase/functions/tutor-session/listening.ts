// The `listening-answer` action: grade the post-session listening check.
//
// Server-side for the same reason `checkpoint` grades server-side, and it is
// the whole point of the action existing. The answer key lives in
// `tutor_listening_checks`, which has RLS on and no policies, so the only way
// a learner learns whether they were right is to ask us — and the only score
// that reaches `fetchProficiencyEvidence` is one we computed. A client-graded
// check would be a self-assigned contribution to a measured CEFR level.
//
// Answering is once per session. The row is keyed by session id and carries
// `answered_at`, so the update is guarded on it being null: a second
// submission grades nothing and returns what the first one produced. Without
// that, a learner could resubmit until they had guessed their way to 3/3, and
// the listening strand would measure persistence rather than comprehension.

import {
  gradeListeningCheck,
  toPrompts,
  type TutorListeningItem,
  type TutorListeningPrompt,
} from '../_shared/tutor-listening.ts';

// deno-lint-ignore no-explicit-any
type Client = { from: (table: string) => any };

export interface ListeningAnswerRequest {
  sessionId: string;
  /** One option index per item, in order. Validated by `gradeListeningCheck`. */
  answers: unknown;
}

export interface ListeningAnswerResult {
  status: number;
  body: Record<string, unknown>;
}

export interface ListeningCheckRow {
  items: TutorListeningItem[];
  answered_at: string | null;
  correct_count: number | null;
  total_count: number | null;
  cefr_level: string | null;
}

/**
 * Grade one submission.
 *
 * The ownership check is `eq('user_id', userId)` on the read rather than a
 * comparison afterwards: a session that is not theirs must be indistinguishable
 * from one that does not exist, or the endpoint reports which session ids are
 * real.
 */
export async function handleListeningAnswer(
  supabase: Client,
  userId: string,
  request: ListeningAnswerRequest,
): Promise<ListeningAnswerResult> {
  const { data, error } = await supabase
    .from('tutor_listening_checks')
    .select('items, answered_at, correct_count, total_count, cefr_level')
    .eq('tutor_session_id', request.sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[tutor-session] listening check read failed:', error.message);
    return { status: 500, body: { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' } };
  }
  if (!data) {
    return { status: 404, body: { error: 'No listening check for this session.', code: 'NOT_FOUND' } };
  }

  const row = data as ListeningCheckRow;
  const items = Array.isArray(row.items) ? row.items : [];
  if (items.length === 0) {
    return { status: 404, body: { error: 'No listening check for this session.', code: 'NOT_FOUND' } };
  }

  // Already answered: report the stored result rather than regrading. The
  // learner gets the same screen back if they reopen the debrief, and nothing
  // new reaches the proficiency report.
  if (row.answered_at) {
    return {
      status: 200,
      body: {
        alreadyAnswered: true,
        correctCount: row.correct_count ?? 0,
        total: row.total_count ?? items.length,
      },
    };
  }

  const grade = gradeListeningCheck(items, request.answers);

  // Guarded on `answered_at` still being null, so two submissions racing each
  // other cannot both write. The loser reads zero rows back and falls through
  // to the stored result on its next attempt.
  const { data: updated, error: updateError } = await supabase
    .from('tutor_listening_checks')
    .update({
      answered_at: new Date().toISOString(),
      correct_count: grade.correctCount,
      total_count: grade.total,
    })
    .eq('tutor_session_id', request.sessionId)
    .eq('user_id', userId)
    .is('answered_at', null)
    .select('tutor_session_id');

  if (updateError) {
    console.error('[tutor-session] listening check write failed:', updateError.message);
    return { status: 500, body: { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' } };
  }
  if (!updated || updated.length === 0) {
    // Somebody else got there first. Re-read rather than claiming this
    // submission's grade, which was never recorded.
    const { data: fresh } = await supabase
      .from('tutor_listening_checks')
      .select('correct_count, total_count')
      .eq('tutor_session_id', request.sessionId)
      .eq('user_id', userId)
      .maybeSingle();
    const stored = fresh as { correct_count: number | null; total_count: number | null } | null;
    return {
      status: 200,
      body: {
        alreadyAnswered: true,
        correctCount: stored?.correct_count ?? 0,
        total: stored?.total_count ?? items.length,
      },
    };
  }

  // `correct` per item is returned so the client can mark the answers up. The
  // correct INDEX is deliberately not returned for items the learner got
  // wrong: this endpoint says whether they were right, and the key stays ours.
  return {
    status: 200,
    body: {
      alreadyAnswered: false,
      correct: grade.correct,
      correctCount: grade.correctCount,
      total: grade.total,
    },
  };
}

/** The questions for a session, answers stripped. Used by tests and by any
 *  caller that has the row rather than the debrief. */
export function promptsFor(row: ListeningCheckRow): TutorListeningPrompt[] {
  return toPrompts(Array.isArray(row.items) ? row.items : []);
}
