/**
 * The mission attempt: resolving it before a turn, recording what a turn
 * achieved, and scoring it when the learner taps Finish.
 *
 * Split out of index.ts for the usual reason — index.ts calls `serve()` at
 * module scope and cannot be imported from a test — and takes a loose client
 * type like `_shared/chat-vocabulary.ts` so mission-attempt.test.ts can drive
 * it with a fake. No Deno globals.
 *
 * WHAT THE ROW IS FOR
 * `chat_mission_attempts` (migration 126) is the server's memory of one
 * attempt: which stage is running, which objective ids have been met so far,
 * and — once finished — the result. The client sends `missionStage` on every
 * turn, but THE ROW'S STAGE WINS: a client that changes its mind mid-attempt,
 * or a replayed request, cannot move a running attempt to a stage it did not
 * unlock. `chat_sessions` is client-writable, so nothing here trusts it beyond
 * "exists and is mine".
 *
 * FINISH IS IDEMPOTENT
 * The finish turn is scored exactly once, by a conditional UPDATE that claims
 * `finished_at IS NULL`. A retried finish — the client timed out, the learner
 * tapped twice — finds the row already claimed and gets the stored result
 * back verbatim, with no second progress write. That is what lets the client
 * retry a finish safely, and it is why the result is stored on the row at all.
 */

import type { Mission } from '../_shared/missions.ts';
import { MISSION_STAGE_COUNT } from '../_shared/missions.ts';
import {
  type CorrectionRow,
  type EvidenceRow,
  type MissionCorrectionGroup,
  type MissionFailReason,
  type MissionObjectiveResult,
  computeMissionResult,
  groupCorrections,
} from './mission-result.ts';

/** The slice of the Supabase client this module uses. Loose on purpose —
 *  see `ChatVocabularyClient` for why. */
// deno-lint-ignore no-explicit-any
export type MissionAttemptClient = { from: (table: string) => any };

export interface MissionAttempt {
  chatSessionId: string;
  scenarioKey: string;
  /** The row's stage — authoritative over whatever the client sent. */
  stage: number;
  objectivesMet: string[];
  savedWords: string[];
  finished: boolean;
}

export type ResolveMissionAttemptResult =
  | { ok: true; attempt: MissionAttempt }
  | { ok: false; code: 'SESSION_NOT_FOUND' | 'MISSION_LOCKED' | 'MISSION_FINISHED' };

/** Mirrors `MissionResult` in lib/ai.ts. Keep the two in step by hand; there
 *  is no shared type between the app and the edge runtime. */
export interface MissionResult {
  scenarioKey: string;
  stage: number;
  band: string;
  title: string;
  passed: boolean;
  reason: MissionFailReason | null;
  accuracy: number | null;
  scoredTurns: number;
  objectives: MissionObjectiveResult[];
  /** Highest stage now available for this scene, 1..5 (5 = ladder done). */
  unlockedStage: number;
  savedWords: string[];
  corrections: MissionCorrectionGroup[];
  sendoff: string;
}

/** Bounded reads on user-growable tables (CLAUDE.md §3). An attempt is a
 *  handful of turns; these are ceilings, not expectations. */
const MAX_EVIDENCE_ROWS = 200;
const MAX_CORRECTION_ROWS = 100;

function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

function union(a: readonly string[], b: readonly string[]): string[] {
  const out = [...a];
  for (const v of b) if (!out.includes(v)) out.push(v);
  return out;
}

// deno-lint-ignore no-explicit-any
function toAttempt(row: any): MissionAttempt {
  return {
    chatSessionId: String(row.chat_session_id),
    scenarioKey: String(row.scenario_key),
    stage: Number(row.stage),
    objectivesMet: stringList(row.objectives_met),
    savedWords: stringList(row.saved_words),
    finished: row.finished_at !== null && row.finished_at !== undefined,
  };
}

/**
 * Find or start the attempt this turn belongs to.
 *
 * Order matters: the session-ownership check comes before the lock check so a
 * caller holding someone else's session id learns nothing about that user's
 * progress, and the lock check comes before the insert so a locked stage
 * never leaves a row behind. The caller runs this BEFORE the daily quota, so
 * a refused attempt is never charged.
 *
 * Throws on a read that fails outright: an attempt whose state cannot be read
 * must not proceed as if it were new, and the handler's catch turns the throw
 * into the generic 500.
 */
export async function resolveMissionAttempt(
  supabase: MissionAttemptClient,
  input: {
    userId: string;
    chatSessionId: string;
    scenarioKey: string;
    targetLanguage: string;
    requestedStage: number;
    /** The caller is finishing. A finished row is then not a conflict but the
     *  idempotent second finish, which `finishMissionAttempt` handles. */
    finishing?: boolean;
  },
): Promise<ResolveMissionAttemptResult> {
  const { data: existing, error: readErr } = await supabase
    .from('chat_mission_attempts')
    .select('chat_session_id, user_id, scenario_key, stage, objectives_met, saved_words, finished_at')
    .eq('chat_session_id', input.chatSessionId)
    .maybeSingle();
  if (readErr) throw new Error(`chat_mission_attempts read failed: ${readErr.message}`);

  if (existing) {
    // Not-found rather than forbidden: the id is a UUID the caller should not
    // have, and "exists but not yours" is information.
    if (existing.user_id !== input.userId) return { ok: false, code: 'SESSION_NOT_FOUND' };
    const attempt = toAttempt(existing);
    if (attempt.finished && input.finishing !== true) return { ok: false, code: 'MISSION_FINISHED' };
    return { ok: true, attempt };
  }

  const { data: session, error: sessionErr } = await supabase
    .from('chat_sessions')
    .select('id, user_id, mission_stage')
    .eq('id', input.chatSessionId)
    .maybeSingle();
  if (sessionErr) throw new Error(`chat_sessions read failed: ${sessionErr.message}`);
  if (!session || session.user_id !== input.userId) return { ok: false, code: 'SESSION_NOT_FOUND' };

  if (input.requestedStage > 1) {
    const { data: previous, error: progressErr } = await supabase
      .from('chat_mission_progress')
      .select('passed_at')
      .eq('user_id', input.userId)
      .eq('target_language', input.targetLanguage)
      .eq('scenario_key', input.scenarioKey)
      .eq('stage', input.requestedStage - 1)
      .maybeSingle();
    if (progressErr) throw new Error(`chat_mission_progress read failed: ${progressErr.message}`);
    if (!previous || previous.passed_at === null || previous.passed_at === undefined) {
      return { ok: false, code: 'MISSION_LOCKED' };
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('chat_mission_attempts')
    .insert({
      chat_session_id: input.chatSessionId,
      user_id: input.userId,
      target_language: input.targetLanguage,
      scenario_key: input.scenarioKey,
      stage: input.requestedStage,
    })
    .select('chat_session_id, user_id, scenario_key, stage, objectives_met, saved_words, finished_at')
    .single();
  if (insertErr || !inserted) {
    // Two first turns racing: the loser's insert hits the primary key. Read
    // the winner's row and continue on it — the row's stage wins either way.
    const { data: raced } = await supabase
      .from('chat_mission_attempts')
      .select('chat_session_id, user_id, scenario_key, stage, objectives_met, saved_words, finished_at')
      .eq('chat_session_id', input.chatSessionId)
      .maybeSingle();
    if (!raced || raced.user_id !== input.userId) {
      throw new Error(`chat_mission_attempts insert failed: ${insertErr?.message ?? 'no row'}`);
    }
    return { ok: true, attempt: toAttempt(raced) };
  }

  // Informational only (migration 126 header): lets the client's
  // getOrCreateChatSession keep a plain scene chat from resuming this attempt.
  if (session.mission_stage === null || session.mission_stage === undefined) {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ mission_stage: input.requestedStage })
        .eq('id', input.chatSessionId);
      if (error) console.warn('[ai-chat] chat_sessions.mission_stage write failed (non-fatal):', error.message);
    } catch (err) {
      console.warn('[ai-chat] chat_sessions.mission_stage write failed (non-fatal):', err);
    }
  }

  return { ok: true, attempt: toAttempt(inserted) };
}

/**
 * Persist what a turn achieved: the objective ids and the words that became
 * cards, unioned into the row. Read-union-write rather than a blind write so
 * two turns in flight cannot overwrite each other's ids.
 *
 * Best-effort. The learner has their reply; a lost tick costs them a repeat
 * of the objective, not the conversation. Never throws.
 */
export async function recordMissionTurn(
  supabase: MissionAttemptClient,
  input: { chatSessionId: string; objectivesMet: readonly string[]; savedWords: readonly string[] },
): Promise<void> {
  if (input.objectivesMet.length === 0 && input.savedWords.length === 0) return;
  try {
    const { data: row, error: readErr } = await supabase
      .from('chat_mission_attempts')
      .select('objectives_met, saved_words')
      .eq('chat_session_id', input.chatSessionId)
      .maybeSingle();
    if (readErr || !row) {
      console.warn('[ai-chat] mission turn read failed (non-fatal):', readErr?.message ?? 'no row');
      return;
    }
    const { error: writeErr } = await supabase
      .from('chat_mission_attempts')
      .update({
        objectives_met: union(stringList(row.objectives_met), input.objectivesMet),
        saved_words: union(stringList(row.saved_words), input.savedWords),
      })
      .eq('chat_session_id', input.chatSessionId);
    if (writeErr) console.warn('[ai-chat] mission turn write failed (non-fatal):', writeErr.message);
  } catch (err) {
    console.warn('[ai-chat] mission turn write failed (non-fatal):', err);
  }
}

/**
 * Score the attempt, claim it as finished, and record progress.
 *
 * The claim is one conditional UPDATE on `finished_at IS NULL`. If it claims
 * nothing the attempt was already finished, and the stored result is returned
 * verbatim — same sendoff, same unlockedStage — with no second progress
 * write. `unlockedStage` is computed from the progress rows read BEFORE the
 * claim plus this attempt's own outcome, which is exactly what a read after
 * the upsert would return, and it lets the full result be stored in the same
 * statement that claims the row.
 *
 * Throws when the claim itself fails: a finish that cannot be recorded must
 * not be reported as a pass.
 */
export async function finishMissionAttempt(
  supabase: MissionAttemptClient,
  input: {
    userId: string;
    chatSessionId: string;
    scenarioKey: string;
    targetLanguage: string;
    mission: Mission;
    attempt: MissionAttempt;
    sendoff: string;
  },
): Promise<MissionResult> {
  const { userId, chatSessionId, scenarioKey, targetLanguage, mission } = input;

  // The row is re-read rather than trusted from the start of the request:
  // `recordMissionTurn` may have run since, and the union it wrote is what
  // the score must be based on.
  let attempt = input.attempt;
  const { data: fresh } = await supabase
    .from('chat_mission_attempts')
    .select('chat_session_id, user_id, scenario_key, stage, objectives_met, saved_words, finished_at, result')
    .eq('chat_session_id', chatSessionId)
    .maybeSingle();
  if (fresh && fresh.user_id === userId) {
    attempt = toAttempt(fresh);
    if (attempt.finished && fresh.result && typeof fresh.result === 'object') {
      return fresh.result as MissionResult;
    }
  }

  const { data: evidenceRows, error: evidenceErr } = await supabase
    .from('conversation_evidence')
    .select('accuracy, intelligibility')
    .eq('chat_session_id', chatSessionId)
    .eq('user_id', userId)
    .limit(MAX_EVIDENCE_ROWS);
  if (evidenceErr) throw new Error(`conversation_evidence read failed: ${evidenceErr.message}`);

  const { data: correctionRows, error: correctionErr } = await supabase
    .from('correction_log')
    .select('error_type, original, corrected')
    .eq('chat_session_id', chatSessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(MAX_CORRECTION_ROWS);
  if (correctionErr) throw new Error(`correction_log read failed: ${correctionErr.message}`);

  const score = computeMissionResult({
    mission,
    objectivesMet: attempt.objectivesMet,
    evidence: (evidenceRows ?? []) as EvidenceRow[],
  });
  const corrections = groupCorrections((correctionRows ?? []) as CorrectionRow[]);

  // Progress for this scene, read before the claim so unlockedStage can be
  // part of the stored result. At most four rows per scene.
  const { data: progressRows, error: progressErr } = await supabase
    .from('chat_mission_progress')
    .select('stage, attempts, best_accuracy, passed_at')
    .eq('user_id', userId)
    .eq('target_language', targetLanguage)
    .eq('scenario_key', scenarioKey)
    .limit(MISSION_STAGE_COUNT);
  if (progressErr) throw new Error(`chat_mission_progress read failed: ${progressErr.message}`);
  // deno-lint-ignore no-explicit-any
  const progress: any[] = Array.isArray(progressRows) ? progressRows : [];
  const existing = progress.find((p) => Number(p.stage) === attempt.stage) ?? null;
  let maxPassed = 0;
  for (const p of progress) {
    if (p.passed_at !== null && p.passed_at !== undefined) maxPassed = Math.max(maxPassed, Number(p.stage));
  }
  if (score.passed) maxPassed = Math.max(maxPassed, attempt.stage);
  const unlockedStage = Math.min(MISSION_STAGE_COUNT + 1, maxPassed + 1);

  const result: MissionResult = {
    scenarioKey,
    stage: attempt.stage,
    band: mission.band,
    title: mission.title,
    passed: score.passed,
    reason: score.reason,
    accuracy: score.accuracy,
    scoredTurns: score.scoredTurns,
    objectives: score.objectives,
    unlockedStage,
    savedWords: attempt.savedWords,
    corrections,
    sendoff: input.sendoff,
  };

  const now = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('chat_mission_attempts')
    .update({
      finished_at: now,
      passed: score.passed,
      accuracy: score.accuracy,
      scored_turns: score.scoredTurns,
      result,
    })
    .eq('chat_session_id', chatSessionId)
    .is('finished_at', null)
    .select('chat_session_id');
  if (claimErr) throw new Error(`chat_mission_attempts claim failed: ${claimErr.message}`);

  if (!Array.isArray(claimed) || claimed.length === 0) {
    // Lost the race to another finish of the same attempt. Its result is the
    // one the learner already saw; return that.
    const { data: stored } = await supabase
      .from('chat_mission_attempts')
      .select('result')
      .eq('chat_session_id', chatSessionId)
      .maybeSingle();
    if (stored?.result && typeof stored.result === 'object') return stored.result as MissionResult;
    return result;
  }

  // Progress. After the claim, so exactly one finish per attempt reaches it.
  // Non-fatal past this point: the result is stored and the learner has their
  // debrief; a lost progress write is logged loudly because it is the thing
  // that unlocks the next stage.
  const bestAccuracy =
    score.accuracy === null
      ? (existing?.best_accuracy ?? null)
      : existing?.best_accuracy === null || existing?.best_accuracy === undefined
        ? score.accuracy
        : Math.max(Number(existing.best_accuracy), score.accuracy);
  const { error: upsertErr } = await supabase.from('chat_mission_progress').upsert(
    {
      user_id: userId,
      target_language: targetLanguage,
      scenario_key: scenarioKey,
      stage: attempt.stage,
      attempts: Number(existing?.attempts ?? 0) + 1,
      best_accuracy: bestAccuracy,
      passed_at: existing?.passed_at ?? (score.passed ? now : null),
      last_attempt_at: now,
    },
    { onConflict: 'user_id,target_language,scenario_key,stage' },
  );
  if (upsertErr) {
    console.error('[ai-chat] chat_mission_progress upsert failed — stage not unlocked:', upsertErr.message);
  }

  return result;
}
