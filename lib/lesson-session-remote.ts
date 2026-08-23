/**
 * Remote (Redis) half of mid-lesson session persistence.
 *
 * Talks to the `lesson-session` edge function, which stores the snapshot in
 * Redis under a one-day expiry keyed by the *server's* view of the caller.
 * Redis is the shared source of truth so an unfinished lesson resumes on a
 * second device and expires everywhere at the same moment.
 *
 * Every function here is best-effort by contract: a failure returns
 * null/false rather than throwing, because the on-device snapshot
 * (lesson-session-storage.ts) already covers the learner and a cache outage
 * must never interrupt a lesson. `remoteSessionsAvailable()` reports whether
 * the last call actually reached Redis, so callers can tell "no session" from
 * "couldn't ask".
 *
 * `userId` is passed on every call purely as an assertion of who the caller
 * believes it is. The Redis key is always built server-side from the verified
 * token; a mismatch is rejected with 403. Without it, the local tier (keyed by
 * the userId the caller passes) and the remote tier (keyed by the session's
 * user) could disagree after an account switch and merge one learner's
 * mid-lesson state into another's.
 */
import { supabase } from './supabase';
import type { LessonSessionSnapshot } from './lesson-session-storage';

const FUNCTION_NAME = 'lesson-session';

/**
 * false once a call comes back with REDIS_NOT_CONFIGURED — there is no point
 * paying a round trip per answer for a backend that isn't set up. Reset on
 * app restart, which is when configuration realistically changes.
 */
let redisConfigured = true;

export function remoteSessionsAvailable(): boolean {
  return redisConfigured;
}

/** Test seam — restores the "assume available" default. */
export function __resetRemoteSessionAvailability(): void {
  redisConfigured = true;
}

interface InvokeResult<T> {
  data: T | null;
  ok: boolean;
}

async function invoke<T>(body: Record<string, unknown>): Promise<InvokeResult<T>> {
  if (!redisConfigured) return { data: null, ok: false };
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body });
    if (error) {
      // A 503 carries a code in its body; read it to decide whether to keep
      // trying for the rest of this app session.
      const code = await readErrorCode(error);
      if (code === 'REDIS_NOT_CONFIGURED') {
        redisConfigured = false;
        console.warn('[lesson-session] remote session storage is not configured; using device only');
      } else {
        console.warn('[lesson-session] remote call failed:', error.message ?? error);
      }
      return { data: null, ok: false };
    }
    return { data: (data ?? null) as T | null, ok: true };
  } catch (err) {
    console.warn('[lesson-session] remote call threw:', err);
    return { data: null, ok: false };
  }
}

async function readErrorCode(error: { context?: unknown; message?: string }): Promise<string | null> {
  if (!(error.context instanceof Response)) return null;
  try {
    const body = (await error.context.json()) as { code?: string };
    return body.code ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the snapshot Redis holds for this lesson.
 * Returns `{ snapshot: null, reached: false }` when Redis could not be asked —
 * the caller must then trust its local copy rather than restarting the lesson.
 */
export async function loadRemoteLessonSession(
  userId: string,
  lessonId: string,
): Promise<{ snapshot: LessonSessionSnapshot | null; reached: boolean }> {
  const { data, ok } = await invoke<{ snapshot: LessonSessionSnapshot | null }>({
    action: 'load',
    userId,
    lessonId,
  });
  if (!ok) return { snapshot: null, reached: false };
  return { snapshot: data?.snapshot ?? null, reached: true };
}

/** Push the snapshot to Redis. Returns whether it landed. */
export async function saveRemoteLessonSession(
  userId: string,
  lessonId: string,
  snapshot: LessonSessionSnapshot,
): Promise<boolean> {
  const { ok } = await invoke<{ ok: boolean }>({ action: 'save', userId, lessonId, snapshot });
  return ok;
}

/** Drop the snapshot from Redis (lesson finished, or explicitly quit). */
export async function clearRemoteLessonSession(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  const { ok } = await invoke<{ ok: boolean }>({ action: 'clear', userId, lessonId });
  return ok;
}
