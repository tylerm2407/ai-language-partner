/**
 * Record one conversation turn as proficiency evidence.
 *
 * Extracted from `ai-chat/index.ts` so a second conversation surface can leave
 * the same evidence trail. Copying it would have been the obvious move and the
 * wrong one: `conversation_evidence` is what makes a measured CEFR level move,
 * and two copies of "what counts as a language sample" is two answers to that
 * question — a learner's level would then depend on which surface they
 * practised on, which is exactly the thing a measured level must not do.
 *
 * `ai-chat/index.ts` calls `serve()` at module scope, so nothing in it could be
 * imported from a test without standing up an HTTP listener. That is the same
 * reason `prompt.ts`, `parse.ts` and `turn-accuracy.ts` were split out, and it
 * is why this file exists rather than a shared import from there.
 *
 * Everything here is best-effort by construction. By the time this runs the
 * learner already has their reply, so every failure path logs and returns
 * rather than throwing: a lost data point must never cost someone their
 * conversation.
 */

import { scoreTurn, type TurnCorrection, type TurnModality } from './turn-accuracy.ts';

/**
 * The slice of the Supabase client this module uses.
 *
 * Deliberately loose, matching `learner-context.ts` and `plan-limits.ts`: the
 * PostgREST builder is a long fluent chain whose real type is generated
 * per-schema, and pinning it here would only make the test double harder to
 * write without catching anything this module can get wrong.
 */
// deno-lint-ignore no-explicit-any
export type ConversationEvidenceClient = { from: (table: string) => any };

export interface ConversationEvidenceInput {
  userId: string;
  targetLanguage: string;
  cefrLevel: string;
  /**
   * Which skill this turn is evidence about. A spoken turn is evidence about
   * speaking, a typed one about written production — they are scored on
   * different axes (only speaking carries an intelligibility number), so this
   * is a parameter and not a constant. `ai-chat` passes whichever the client
   * reported; the voice tutor always passes `'speaking'`.
   */
  modality: TurnModality;
  /** The learner's own words. Not the tutor's reply. */
  text: string;
  /** The single correction this turn produced, or null. Typed loosely as
   *  `TurnCorrection` so any caller's richer correction shape is accepted. */
  correction: TurnCorrection | null;
  recognizerConfidence?: number;
  /** Log prefix, so a failure is attributable to the surface that caused it.
   *  Defaults to the historical `ai-chat` value. */
  fn?: string;
}

/**
 * Record this turn as proficiency evidence, if it is any.
 *
 * `scoreTurn` returns null for turns that should not count — too short to be
 * a language sample, or spoken and not clearly heard. That refusal is the
 * point, not an edge case: a wrong data point in a measured CEFR level is
 * worse than a missing one, because the learner reads the level and acts on
 * it. Callers must not "helpfully" write a default row when this declines.
 *
 * Returns whether a row was written — observability only. Nothing about the
 * turn should branch on it, and no caller may treat `false` as an error.
 */
export async function recordConversationEvidence(
  supabase: ConversationEvidenceClient,
  input: ConversationEvidenceInput,
): Promise<boolean> {
  const fn = input.fn ?? 'ai-chat';
  try {
    const score = scoreTurn({
      modality: input.modality,
      text: input.text,
      correction: input.correction,
      recognizerConfidence: input.recognizerConfidence ?? null,
    });
    if (!score) return false;

    const { error } = await supabase.from('conversation_evidence').insert({
      user_id: input.userId,
      target_language: input.targetLanguage,
      cefr_level: input.cefrLevel,
      modality: input.modality,
      intelligibility: score.intelligibility,
      accuracy: score.accuracy,
      word_count: score.wordCount,
    });
    // PostgREST reports a rejected insert as a returned `error`, not a throw,
    // so the original `await` here swallowed every write failure in complete
    // silence — a constraint change or an RLS mistake would have stopped all
    // proficiency measurement with nothing in the logs to say so. Still
    // non-fatal, still no throw; it is now merely visible.
    if (error) {
      console.warn(`[${fn}] conversation_evidence insert failed (non-fatal):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[${fn}] conversation_evidence write failed (non-fatal):`, err);
    return false;
  }
}
