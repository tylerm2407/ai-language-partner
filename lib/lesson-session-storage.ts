/**
 * Mid-lesson session persistence (resume after backgrounding / kill / crash).
 *
 * Two tiers, same one-day life:
 *
 *   • Redis (via the `lesson-session` edge function) — the shared copy. Makes
 *     an unfinished lesson resumable on another device and expires it in one
 *     place. See lib/lesson-session-remote.ts.
 *   • AsyncStorage — the on-device copy. Instant, works offline, and is what
 *     the learner falls back to whenever Redis can't be reached.
 *
 * Both enforce the SAME rule: a session lives for LESSON_SESSION_TTL_MS from
 * when the lesson STARTED, not from the last answer. Answering more questions
 * does not buy another day — a lesson left unfinished past its day is gone and
 * the learner starts it over. That is deliberate: partial progress is a
 * convenience, and it must not accumulate indefinitely.
 *
 * Finished lessons never live here. They go to `lesson_completions` in
 * Postgres via stores/useLessonProgressStore and are permanent.
 *
 * LessonRunner saves a snapshot after every answered exercise, silently
 * restores it on mount, and clears it on lesson completion or explicit quit.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttemptStatus } from './lesson-attempts';
import {
  clearRemoteLessonSession,
  loadRemoteLessonSession,
  remoteSessionsAvailable,
  saveRemoteLessonSession,
} from './lesson-session-remote';

export const LESSON_SESSION_SCHEMA_VERSION = 1;
export const LESSON_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How long the Redis read may hold up the start of a lesson. Restoring is a
 * nicety; making someone stare at "Preparing your lesson…" because a cache is
 * slow is not. Past this we use the device copy.
 */
export const REMOTE_RESTORE_TIMEOUT_MS = 2500;

export interface LessonSessionAnswer {
  exerciseId: string;
  correct: boolean;
  answer: string;
}

export interface LessonSessionSnapshot {
  version: number;
  /** Index of the next exercise to show on resume. */
  exerciseIndex: number;
  answers: LessonSessionAnswer[];
  /**
   * The learner's raw pick per exercise id. The runner owns this so Previous
   * can restore an answered exercise's selection, option colours and note —
   * per-question local state could not survive going backwards.
   *
   * Optional on the wire: snapshots written before the exercise chrome
   * landed have no `picks`, and `loadLessonSession` rebuilds one from
   * `answers` rather than dropping a mid-lesson session on upgrade.
   */
  picks?: Record<string, string>;
  /**
   * Where each exercise stands — see lib/lesson-attempts.ts.
   *
   * Needed because `answers` cannot express two of the six states: a
   * second-attempt-correct is stored there as `correct: false` and would come
   * back re-graded as a plain wrong answer, and a skipped exercise has no
   * `answers` entry at all so it would come back unanswered and silently move
   * the score on resume.
   *
   * Optional, and deliberately NOT a schema-version bump: both this module and
   * the edge function REJECT a foreign version, so bumping would delete every
   * learner's in-flight lesson on upgrade. An old server drops this field
   * harmlessly and an old client ignores it.
   */
  statuses?: Record<string, AttemptStatus>;
  /** Epoch ms when the lesson session first started — the TTL reference. */
  startedAt: number;
}

/** Shared prefix, so abandoned snapshots can be swept without a key registry. */
export const LESSON_SESSION_KEY_PREFIX = 'lesson-session:';

export function lessonSessionKey(userId: string, lessonId: string): string {
  return `${LESSON_SESSION_KEY_PREFIX}${userId}:${lessonId}`;
}

export interface LessonSessionLoadResult {
  /** null means "start this lesson from the top". */
  snapshot: LessonSessionSnapshot | null;
  /**
   * true when a session existed but its day had run out. Distinct from "there
   * was never one": the learner did real work and is about to lose it, so the
   * UI owes them an explanation rather than silently restarting the lesson.
   */
  expired: boolean;
}

function isValidSnapshot(value: unknown): value is LessonSessionSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === 'number' &&
    typeof v.exerciseIndex === 'number' &&
    typeof v.startedAt === 'number' &&
    Array.isArray(v.answers)
  );
}

/** True once the lesson's day is up, wherever the snapshot came from. */
export function isSessionExpired(snapshot: LessonSessionSnapshot, now = Date.now()): boolean {
  return now - snapshot.startedAt > LESSON_SESSION_TTL_MS;
}

/**
 * Pre-chrome snapshots carry no pick map, but every answer already holds the
 * raw text the learner submitted, so it is recoverable — better than asking
 * them to redo work they had done.
 */
function withPicks(snapshot: LessonSessionSnapshot): LessonSessionSnapshot {
  if (snapshot.picks) return snapshot;
  return {
    ...snapshot,
    picks: Object.fromEntries(snapshot.answers.map((a) => [a.exerciseId, a.answer])),
  };
}

/**
 * Which of two live snapshots represents more work?
 *
 * Compared by answer count rather than a timestamp: device clocks disagree,
 * and the only thing that matters is not making someone redo an exercise.
 */
function furthest(
  a: LessonSessionSnapshot | null,
  b: LessonSessionSnapshot | null,
): LessonSessionSnapshot | null {
  if (!a) return b;
  if (!b) return a;
  if (b.answers.length !== a.answers.length) {
    return b.answers.length > a.answers.length ? b : a;
  }
  return b.exerciseIndex > a.exerciseIndex ? b : a;
}

// ─── Device copy ─────────────────────────────────────────────────

async function readLocal(
  userId: string,
  lessonId: string,
): Promise<LessonSessionSnapshot | null> {
  const key = lessonSessionKey(userId, lessonId);
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }

  if (!isValidSnapshot(parsed) || parsed.version !== LESSON_SESSION_SCHEMA_VERSION) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  if (isSessionExpired(parsed)) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  return withPicks(parsed);
}

async function writeLocal(
  userId: string,
  lessonId: string,
  snapshot: LessonSessionSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(lessonSessionKey(userId, lessonId), JSON.stringify(snapshot));
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Persist mid-lesson progress. The device write is awaited first so an
 * immediate kill still resumes; the Redis write follows and is best-effort.
 */
export async function saveLessonSession(
  userId: string,
  lessonId: string,
  snapshot: Omit<LessonSessionSnapshot, 'version'>,
): Promise<void> {
  const payload: LessonSessionSnapshot = {
    version: LESSON_SESSION_SCHEMA_VERSION,
    ...snapshot,
  };

  if (isSessionExpired(payload)) {
    // The lesson's day ran out mid-session. Don't write a snapshot that
    // would only be rejected on load — clear both copies instead.
    await clearLessonSession(userId, lessonId);
    return;
  }

  await writeLocal(userId, lessonId, payload);

  if (remoteSessionsAvailable()) {
    await saveRemoteLessonSession(userId, lessonId, payload).catch((err) =>
      console.warn('[lesson-session] remote save failed:', err),
    );
  }
}

/**
 * Load a snapshot for this user + lesson, preferring whichever of the shared
 * (Redis) and device copies holds more progress, and re-syncing the other.
 *
 * Returns null — meaning "start this lesson over" — when neither copy has a
 * live session. A Redis miss on its own is NOT enough: a session created
 * offline exists only on the device, and the device copy self-expires on the
 * same one-day rule, so trusting it can't extend a lesson past its day.
 */
export async function loadLessonSession(
  userId: string,
  lessonId: string,
): Promise<LessonSessionLoadResult> {
  // readLocal drops an expired entry and returns null, so ask it separately
  // whether one WAS there — that is the difference between "you never started
  // this" and "your day ran out", and only the second needs explaining.
  const expiredLocally = await hadExpiredLocalSession(userId, lessonId);

  const [local, remote] = await Promise.all([
    readLocal(userId, lessonId).catch((err) => {
      console.warn('[lesson-session] local read failed:', err);
      return null;
    }),
    fetchRemoteWithTimeout(userId, lessonId),
  ]);

  const winner = furthest(local, remote.snapshot);
  if (!winner || isSessionExpired(winner)) {
    // Nothing live anywhere: make sure a stale device copy can't come back.
    if (local) await AsyncStorage.removeItem(lessonSessionKey(userId, lessonId));
    return { snapshot: null, expired: expiredLocally || Boolean(winner) || Boolean(remote.expired) };
  }

  const normalized = withPicks(winner);

  // Re-sync whichever side is behind. Both are best-effort.
  if (winner !== local) {
    await writeLocal(userId, lessonId, normalized).catch((err) =>
      console.warn('[lesson-session] local re-sync failed:', err),
    );
  }
  if (remote.reached && winner !== remote.snapshot) {
    await saveRemoteLessonSession(userId, lessonId, normalized).catch((err) =>
      console.warn('[lesson-session] remote re-sync failed:', err),
    );
  }

  return { snapshot: normalized, expired: false };
}

/**
 * Was there a device snapshot that has aged out? Peeked BEFORE readLocal,
 * which deletes such entries as a side effect of reading them.
 */
async function hadExpiredLocalSession(userId: string, lessonId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(lessonSessionKey(userId, lessonId));
    if (raw === null) return false;
    const parsed: unknown = JSON.parse(raw);
    return isValidSnapshot(parsed) && isSessionExpired(parsed);
  } catch {
    return false;
  }
}

/** Redis read, bounded so a slow cache can't stall the start of a lesson. */
async function fetchRemoteWithTimeout(
  userId: string,
  lessonId: string,
): Promise<{ snapshot: LessonSessionSnapshot | null; reached: boolean; expired: boolean }> {
  if (!remoteSessionsAvailable()) return { snapshot: null, reached: false, expired: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ snapshot: null; reached: false; expired: false }>((resolve) => {
    timer = setTimeout(
      () => resolve({ snapshot: null, reached: false, expired: false }),
      REMOTE_RESTORE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([loadRemoteLessonSession(userId, lessonId), timeout]);
  } catch (err) {
    console.warn('[lesson-session] remote load failed:', err);
    return { snapshot: null, reached: false, expired: false };
  } finally {
    // Without this the pending timer keeps the JS runtime (and a Jest worker)
    // alive for the full timeout after the request has already answered.
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Drop the session from both tiers (lesson finished, or explicitly quit). */
export async function clearLessonSession(userId: string, lessonId: string): Promise<void> {
  await AsyncStorage.removeItem(lessonSessionKey(userId, lessonId));
  if (remoteSessionsAvailable()) {
    await clearRemoteLessonSession(userId, lessonId).catch((err) =>
      console.warn('[lesson-session] remote clear failed:', err),
    );
  }
}

/**
 * Drop device snapshots whose day has run out.
 *
 * Redis expires its own keys; AsyncStorage does not. Without this, a lesson
 * started once and never reopened leaves a key behind forever, because
 * `readLocal` only cleans up entries someone actually comes back to. Mirrors
 * the sweep in lib/read-cache.ts (clearReadCache).
 *
 * Pass a userId to limit the sweep to that account; omit it to sweep every
 * account's leftovers on this device. Best-effort and safe to call often —
 * it only ever removes entries that are already unusable.
 *
 * Returns how many keys were removed.
 */
export async function pruneExpiredLessonSessions(userId?: string): Promise<number> {
  let keys: readonly string[];
  try {
    keys = await AsyncStorage.getAllKeys();
  } catch (err) {
    console.warn('[lesson-session] prune failed to list keys:', err);
    return 0;
  }

  const prefix = userId
    ? `${LESSON_SESSION_KEY_PREFIX}${userId}:`
    : LESSON_SESSION_KEY_PREFIX;
  const candidates = keys.filter((key) => key.startsWith(prefix));
  if (candidates.length === 0) return 0;

  const stale: string[] = [];
  for (const key of candidates) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) continue;
      const parsed: unknown = JSON.parse(raw);
      // Unparseable or foreign-version entries are dead weight too — they
      // would be discarded on read anyway.
      if (!isValidSnapshot(parsed) || parsed.version !== LESSON_SESSION_SCHEMA_VERSION) {
        stale.push(key);
      } else if (isSessionExpired(parsed)) {
        stale.push(key);
      }
    } catch {
      stale.push(key);
    }
  }

  if (stale.length > 0) {
    await AsyncStorage.multiRemove(stale).catch((err) =>
      console.warn('[lesson-session] prune failed to remove keys:', err),
    );
  }
  return stale.length;
}
