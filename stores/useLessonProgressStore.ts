/**
 * Lesson completions — ONE shared store, not per-hook state.
 *
 * This used to live inside `useLessonProgress`, which meant every caller got
 * its own `completions` map. The lesson screen marked a lesson complete in
 * *its* map; the Learn tab's `UnitPath` — still mounted underneath the pushed
 * lesson route — held a different map, and its fetch effect only re-ran on
 * `user.id` / `courseId` change. Popping back to Learn therefore rendered the
 * pre-lesson state: the learner finished a lesson and stayed exactly where
 * they were. Same for the home screen's unit tiles.
 *
 * With a single store, `markComplete` is visible to every consumer on the
 * next render, and `refresh()` (called on screen focus) reconciles progress
 * made on another device.
 *
 * Durability contract — a finished lesson is NEVER silently dropped:
 *   1. the completion lands in this map immediately (the learner advances),
 *   2. the `lesson_completions` upsert is attempted (conflict-safe on
 *      (user_id, lesson_id), so it is idempotent),
 *   3. if that write fails for ANY reason it is handed to the offline queue,
 *      which retries on reconnect/foreground/mount and dead-letters to Sentry
 *      after OFFLINE_QUEUE_MAX_ATTEMPTS rather than losing the row.
 * `markComplete` reports which of those happened via `persisted` so the UI
 * can say "saved" vs "will sync".
 */
import { create } from 'zustand';
import * as Sentry from '@sentry/react-native';
import { fetchLessonCompletions, upsertLessonCompletion } from '../lib/supabase-queries';
import { enqueue, isNetworkError } from '../lib/offline-queue';
import type { LessonCompletion } from '../types';

export interface MarkCompleteResult {
  completion: LessonCompletion;
  /** true = the row is in Postgres. false = queued for replay. */
  persisted: boolean;
}

interface LessonProgressStore {
  /** Whose completions `completions` holds. Guards against user switches. */
  userId: string | null;
  /** Keyed by lessonId. Lesson ids are unique across courses, so this map
   *  spans every course the learner has touched — switching course needs no
   *  refetch, which is what used to strand the carousel on unit 1. */
  completions: Map<string, LessonCompletion>;
  loading: boolean;
  error: string | null;

  /** Load once per user. Concurrent callers share the in-flight request. */
  load: (userId: string) => Promise<void>;
  /**
   * Force a re-read (screen focus, pull-to-refresh, retry after error).
   * Revalidation is SILENT when there is already data to show: flipping
   * `loading` on every focus would replace the learner's path with a spinner
   * each time they came back from a lesson.
   */
  refresh: (userId: string) => Promise<void>;
  markComplete: (
    userId: string,
    lessonId: string,
    courseId: string,
    score: number,
    xpEarned: number,
    timeSpentMs: number,
  ) => Promise<MarkCompleteResult>;
  reset: () => void;
}

/** In-flight fetch, shared so N mounting consumers issue ONE request. */
let inFlight: { userId: string; promise: Promise<void> } | null = null;

export const useLessonProgressStore = create<LessonProgressStore>((set, get) => ({
  userId: null,
  completions: new Map(),
  loading: true,
  error: null,

  load: async (userId: string) => {
    const state = get();
    // Already have this user's data and no error → nothing to do.
    if (state.userId === userId && !state.loading && !state.error) return;
    if (inFlight?.userId === userId) return inFlight.promise;
    return get().refresh(userId);
  },

  refresh: async (userId: string) => {
    if (inFlight?.userId === userId) return inFlight.promise;

    const previousUser = get().userId;
    const switchingUser = previousUser !== null && previousUser !== userId;
    // Only block the UI when there is nothing to show: no data yet, or the
    // data on screen belongs to a different account.
    const hasSomethingToShow = !switchingUser && get().userId === userId;
    set({
      loading: !hasSomethingToShow,
      error: null,
      // A different user's completions must never be read as this user's.
      ...(switchingUser ? { completions: new Map<string, LessonCompletion>() } : {}),
    });

    const promise = (async () => {
      try {
        // No course filter: one fetch covers every course, so switching the
        // course pill re-reads nothing and never flashes "all locked".
        const rows = await fetchLessonCompletions(userId);
        const map = new Map<string, LessonCompletion>();
        for (const row of rows) map.set(row.lessonId, row);

        // Merge in anything marked complete while this fetch was in flight
        // (or queued offline, which the server can't know about yet) so a
        // refresh never walks the learner backwards.
        const pending = get();
        if (pending.userId === userId || pending.userId === null) {
          for (const [lessonId, local] of pending.completions) {
            if (!map.has(lessonId)) map.set(lessonId, local);
          }
        }

        set({ userId, completions: map, loading: false, error: null });
      } catch (err) {
        set({
          userId,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load lesson progress',
        });
      } finally {
        inFlight = null;
      }
    })();

    inFlight = { userId, promise };
    return promise;
  },

  markComplete: async (userId, lessonId, courseId, score, xpEarned, timeSpentMs) => {
    const payload = { lessonId, courseId, score, xpEarned, timeSpentMs };

    const applyLocally = (completion: LessonCompletion) => {
      set((prev) => {
        const next = new Map(prev.completions);
        next.set(lessonId, completion);
        return { completions: next, userId: prev.userId ?? userId };
      });
    };

    // Optimistic: the learner advances the instant the lesson ends, before
    // the round-trip. Replaced by the server row on success.
    const optimistic: LessonCompletion = {
      id: `pending:${lessonId}`,
      userId,
      lessonId,
      courseId,
      score,
      xpEarned,
      timeSpentMs,
      completedAt: new Date().toISOString(),
    };
    applyLocally(optimistic);

    try {
      const completion = await upsertLessonCompletion(
        userId,
        lessonId,
        courseId,
        score,
        xpEarned,
        timeSpentMs,
      );
      applyLocally(completion);
      return { completion, persisted: true };
    } catch (err) {
      // Every failure is queued, not just network blips. A 4xx/5xx here would
      // previously vanish into a console.error and the completion was gone
      // for good; the queue retries it and dead-letters to Sentry if it
      // really is unreplayable, so the loss is at worst observable.
      if (!isNetworkError(err)) {
        console.error('[lesson-progress] completion upsert failed; queueing:', err);
        Sentry.captureException(err, {
          tags: { area: 'lesson-completion' },
          extra: { lessonId, courseId },
        });
      }
      await enqueue(userId, { type: 'lesson-completion', payload }).catch((queueErr) => {
        // Queueing itself failing (storage full/unavailable) is the only path
        // that can still lose the row — make it loud.
        console.error('[lesson-progress] failed to queue completion:', queueErr);
        Sentry.captureException(queueErr, { tags: { area: 'lesson-completion-queue' } });
      });
      return { completion: optimistic, persisted: false };
    }
  },

  reset: () => {
    inFlight = null;
    set({ userId: null, completions: new Map(), loading: true, error: null });
  },
}));

/** Test seam — clears the shared in-flight request between cases. */
export function __resetLessonProgressStore(): void {
  useLessonProgressStore.getState().reset();
}
