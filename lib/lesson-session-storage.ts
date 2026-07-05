/**
 * Mid-lesson session persistence (resume after backgrounding / kill / crash).
 *
 * Small pure wrapper over AsyncStorage. LessonRunner saves a snapshot after
 * every answered exercise, silently restores it on mount, and clears it on
 * lesson completion or explicit quit. Snapshots expire after 24 hours.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LESSON_SESSION_SCHEMA_VERSION = 1;
export const LESSON_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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
  /** Epoch ms when the lesson session first started — the TTL reference. */
  startedAt: number;
}

export function lessonSessionKey(userId: string, lessonId: string): string {
  return `lesson-session:${userId}:${lessonId}`;
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

export async function saveLessonSession(
  userId: string,
  lessonId: string,
  snapshot: Omit<LessonSessionSnapshot, 'version'>,
): Promise<void> {
  const payload: LessonSessionSnapshot = {
    version: LESSON_SESSION_SCHEMA_VERSION,
    ...snapshot,
  };
  await AsyncStorage.setItem(lessonSessionKey(userId, lessonId), JSON.stringify(payload));
}

/**
 * Load a snapshot for this user + lesson. Returns null (and removes the
 * stored entry) when the snapshot is missing, corrupt, from a different
 * schema version, or older than LESSON_SESSION_TTL_MS.
 */
export async function loadLessonSession(
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

  if (Date.now() - parsed.startedAt > LESSON_SESSION_TTL_MS) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  return parsed;
}

export async function clearLessonSession(userId: string, lessonId: string): Promise<void> {
  await AsyncStorage.removeItem(lessonSessionKey(userId, lessonId));
}
