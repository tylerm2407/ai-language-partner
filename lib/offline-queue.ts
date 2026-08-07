/**
 * Offline write queue — learning progress must survive network blips.
 *
 * AsyncStorage-backed FIFO per user (`offline-queue:{userId}`). Exactly
 * three write types are queued, and only when they fail with a
 * network-ish error (4xx/validation failures must NOT be queued — they
 * would fail forever):
 *
 *   • review-upsert     — SRS results (LessonRunner warm-up + lesson grading).
 *                         Replay is guarded against staleness: if the server
 *                         row was reviewed more recently than the queued
 *                         payload, the item is skipped so a fresher online
 *                         review is never clobbered.
 *   • lesson-completion — lesson_completions upsert. Conflict-safe on
 *                         (user_id, lesson_id), so replay is idempotent.
 *   • xp-award          — increment_xp_idempotent RPC (migration 046) keyed
 *                         by an idempotency key generated at ENQUEUE time,
 *                         so a lost-response retry can never double-award.
 *
 * flush() replays sequentially in FIFO order: success removes the item; a
 * failure increments `attempts` and stops the flush (retried on the next
 * trigger — reconnect / foreground / mount, see hooks/useOfflineQueueFlush.ts);
 * an item that has failed OFFLINE_QUEUE_MAX_ATTEMPTS times is dead-lettered
 * (dropped + Sentry captureMessage). Items older than 7 days are dropped on
 * load; the queue is capped at 200 items (oldest dropped, logged).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import {
  fetchReviewItemsByCardIds,
  incrementXpIdempotent,
  insertReviewLogIdempotent,
  upsertLessonCompletion,
  upsertReviewItem,
} from './supabase-queries';
import type { ReviewItem, ReviewLog } from '../types';

export const OFFLINE_QUEUE_SCHEMA_VERSION = 1;
export const OFFLINE_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_QUEUE_MAX_ITEMS = 200;
export const OFFLINE_QUEUE_MAX_ATTEMPTS = 10;

export type ReviewUpsertPayload = Omit<ReviewItem, 'id'> & { id?: string };

export interface LessonCompletionPayload {
  lessonId: string;
  courseId: string;
  score: number;
  xpEarned: number;
  timeSpentMs: number;
}

export interface XpAwardPayload {
  amount: number;
}

/**
 * A review log awaiting replay.
 *
 * `clientLogId` is minted at SUBMIT time, not at enqueue time, so the online
 * attempt and every queued retry all carry the same id. Generating it here
 * would defeat the point — each retry would look like a new review.
 */
export type ReviewLogPayload = Omit<ReviewLog, 'id'> & { clientLogId: string };

interface QueueItemBase {
  id: string;
  createdAt: number;
  attempts: number;
}

export type OfflineQueueItem =
  | (QueueItemBase & { type: 'review-upsert'; payload: ReviewUpsertPayload })
  | (QueueItemBase & { type: 'review-log'; payload: ReviewLogPayload })
  | (QueueItemBase & { type: 'lesson-completion'; payload: LessonCompletionPayload })
  | (QueueItemBase & { type: 'xp-award'; payload: XpAwardPayload; key: string });

/** What callers pass to enqueue() — id/createdAt/attempts are added here. */
export type OfflineQueueInput =
  | { type: 'review-upsert'; payload: ReviewUpsertPayload }
  | { type: 'review-log'; payload: ReviewLogPayload }
  | { type: 'lesson-completion'; payload: LessonCompletionPayload }
  | { type: 'xp-award'; payload: XpAwardPayload; key: string };

export function offlineQueueKey(userId: string): string {
  return `offline-queue:${userId}`;
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Idempotency key for a review log, generated at SUBMIT time so the online
 * attempt and every queued replay carry the same id and the database de-dupes
 * them (migration 059).
 *
 * Uses the same generator as the XP keys rather than a UUID: expo-crypto is
 * not installed, and pulling in a native dependency to produce an id whose
 * only requirement is per-user uniqueness would be disproportionate.
 */
export function newClientLogId(): string {
  return `rl:${randomId()}`;
}

/**
 * Idempotency key for an XP award, generated at enqueue time so every
 * retry of the same award reuses the same key (the server de-dupes on it —
 * migration 046). `context` is a short label like a lessonId or 'earn'.
 * Server constraint: 8-128 chars — the prefix alone guarantees ≥ 8.
 */
export function makeXpKey(context: string): string {
  return `xp:${context}:${randomId()}`.slice(0, 128);
}

/**
 * Heuristic: is this a network-ish failure (worth queueing for replay)?
 *
 * Matches fetch TypeErrors ('Network request failed' on RN, 'Failed to
 * fetch' on web, 'Load failed' on WebKit, 'fetch failed' on undici),
 * AbortError/TimeoutError, and PostgrestError objects whose message wraps
 * one of those (postgrest-js stringifies the underlying fetch error).
 * Deliberately does NOT match a bare TypeError with another message — a
 * programming bug must not be re-queued — and never matches 4xx /
 * validation errors, which would fail forever on replay.
 */
export function isNetworkError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const record = err as { name?: unknown; message?: unknown };
  const name = typeof record.name === 'string' ? record.name : '';
  const message = typeof record.message === 'string' ? record.message : '';
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  return /network request failed|failed to fetch|fetch failed|network ?error|load failed|socket|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(
    `${name} ${message}`,
  );
}

// ─── Storage ─────────────────────────────────────────────────────

interface QueueEnvelope {
  version: number;
  items: OfflineQueueItem[];
}

function isValidItem(value: unknown): value is OfflineQueueItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.createdAt !== 'number' || typeof v.attempts !== 'number') {
    return false;
  }
  if (typeof v.payload !== 'object' || v.payload === null) return false;
  if (v.type === 'xp-award') return typeof v.key === 'string';
  // A review log without its client id cannot be replayed idempotently, so
  // reject it here rather than letting a retry double-log.
  if (v.type === 'review-log') {
    return typeof (v.payload as Record<string, unknown>).clientLogId === 'string';
  }
  return v.type === 'review-upsert' || v.type === 'lesson-completion';
}

async function saveQueue(userId: string, items: OfflineQueueItem[]): Promise<void> {
  const key = offlineQueueKey(userId);
  if (items.length === 0) {
    await AsyncStorage.removeItem(key);
    return;
  }
  const envelope: QueueEnvelope = { version: OFFLINE_QUEUE_SCHEMA_VERSION, items };
  await AsyncStorage.setItem(key, JSON.stringify(envelope));
}

/**
 * Load the queue, discarding corrupt payloads, foreign schema versions,
 * structurally invalid items, and items older than OFFLINE_QUEUE_TTL_MS.
 * Persists back whenever anything was dropped.
 */
async function loadQueue(userId: string): Promise<OfflineQueueItem[]> {
  const key = offlineQueueKey(userId);
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[offline-queue] corrupt queue payload; discarding');
    Sentry.addBreadcrumb({
      category: 'offline-queue',
      message: 'corrupt queue payload discarded',
      level: 'error',
    });
    await AsyncStorage.removeItem(key);
    return [];
  }

  const envelope = parsed as Partial<QueueEnvelope> | null;
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    envelope.version !== OFFLINE_QUEUE_SCHEMA_VERSION ||
    !Array.isArray(envelope.items)
  ) {
    console.error('[offline-queue] unknown queue schema version; discarding');
    Sentry.addBreadcrumb({
      category: 'offline-queue',
      message: 'queue with unknown schema version discarded',
      level: 'error',
    });
    await AsyncStorage.removeItem(key);
    return [];
  }

  const structurallyValid = envelope.items.filter(isValidItem);
  const now = Date.now();
  const fresh = structurallyValid.filter((item) => now - item.createdAt <= OFFLINE_QUEUE_TTL_MS);
  const expired = structurallyValid.length - fresh.length;
  if (expired > 0) {
    console.error(`[offline-queue] dropped ${expired} queued item(s) older than 7 days`);
    Sentry.addBreadcrumb({
      category: 'offline-queue',
      message: `dropped ${expired} expired queue item(s)`,
      level: 'error',
    });
  }
  if (fresh.length !== envelope.items.length) {
    await saveQueue(userId, fresh);
  }
  return fresh;
}

// Per-user promise chain serializing storage read-modify-write cycles so a
// concurrent enqueue can never be lost to a flush's save (and vice versa).
const queueLocks = new Map<string, Promise<void>>();

function withQueueLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = queueLocks.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  queueLocks.set(
    userId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function mutateQueue(
  userId: string,
  mutator: (items: OfflineQueueItem[]) => OfflineQueueItem[],
): Promise<void> {
  await withQueueLock(userId, async () => {
    const items = await loadQueue(userId);
    await saveQueue(userId, mutator(items));
  });
}

// ─── Public API ──────────────────────────────────────────────────

export async function enqueue(userId: string, input: OfflineQueueInput): Promise<void> {
  if (!userId) return;
  await mutateQueue(userId, (items) => {
    const next = [
      ...items,
      { ...input, id: randomId(), createdAt: Date.now(), attempts: 0 } as OfflineQueueItem,
    ];
    while (next.length > OFFLINE_QUEUE_MAX_ITEMS) {
      const dropped = next.shift();
      console.warn(
        '[offline-queue] queue full; dropping oldest item:',
        dropped?.type,
        dropped?.id,
      );
      Sentry.addBreadcrumb({
        category: 'offline-queue',
        message: `queue full; dropped oldest ${dropped?.type ?? 'unknown'} item`,
        level: 'warning',
      });
    }
    return next;
  });
}

/** Executes one queued item. Returns 'skip' when the item is obsolete. */
async function executeItem(userId: string, item: OfflineQueueItem): Promise<'done' | 'skip'> {
  switch (item.type) {
    case 'review-upsert': {
      const payload = item.payload;
      // Staleness guard: a fresher online review must not be clobbered by
      // a stale replay.
      const serverRows = await fetchReviewItemsByCardIds(userId, [payload.cardId]);
      const server = serverRows[0];
      if (
        server?.lastReviewedAt &&
        payload.lastReviewedAt &&
        new Date(server.lastReviewedAt).getTime() > new Date(payload.lastReviewedAt).getTime()
      ) {
        console.warn('[offline-queue] skipping stale review upsert for card', payload.cardId);
        return 'skip';
      }
      await upsertReviewItem(payload);
      return 'done';
    }
    case 'review-log': {
      // Idempotent by construction: the unique index on
      // (user_id, client_log_id) drops a duplicate rather than trusting the
      // client to send exactly once. No staleness guard is needed — unlike a
      // review item, a log is an immutable historical fact.
      await insertReviewLogIdempotent(item.payload);
      return 'done';
    }
    case 'lesson-completion': {
      const payload = item.payload;
      await upsertLessonCompletion(
        userId,
        payload.lessonId,
        payload.courseId,
        payload.score,
        payload.xpEarned,
        payload.timeSpentMs,
      );
      return 'done';
    }
    case 'xp-award':
      await incrementXpIdempotent(item.payload.amount, item.key);
      return 'done';
  }
}

// Single-flight guard: overlapping flush triggers (mount + NetInfo +
// AppState can all fire together) no-op while one is running.
const flushInFlight = new Set<string>();

/**
 * Replay the queue sequentially in FIFO order. Never throws for per-item
 * failures: a failing item stops the flush (retried on the next trigger)
 * and is dead-lettered after OFFLINE_QUEUE_MAX_ATTEMPTS failures.
 *
 * Returns the number of items completed (executed or staleness-skipped) so
 * callers can invalidate stale cached reads only when server state changed.
 */
export async function flush(userId: string): Promise<number> {
  if (!userId || flushInFlight.has(userId)) return 0;
  flushInFlight.add(userId);
  let processed = 0;
  try {
    // Reload the head each iteration so items enqueued mid-flush are seen
    // and every removal is a fresh read-modify-write under the lock.
    for (;;) {
      const items = await withQueueLock(userId, () => loadQueue(userId));
      const item = items[0];
      if (!item) return processed;

      try {
        await executeItem(userId, item);
      } catch (err) {
        const attempts = item.attempts + 1;
        if (attempts >= OFFLINE_QUEUE_MAX_ATTEMPTS) {
          console.error(
            `[offline-queue] dead-letter: dropping ${item.type} ${item.id} after ${attempts} attempts:`,
            err,
          );
          Sentry.captureMessage(
            `offline-queue dead-letter: ${item.type} dropped after ${attempts} attempts`,
            'error',
          );
          await mutateQueue(userId, (current) => current.filter((it) => it.id !== item.id));
          continue;
        }
        await mutateQueue(userId, (current) =>
          current.map((it) => (it.id === item.id ? { ...it, attempts } : it)),
        );
        return processed; // stop the flush; retry on the next trigger
      }

      // Success or staleness skip — either way the item is done.
      await mutateQueue(userId, (current) => current.filter((it) => it.id !== item.id));
      processed += 1;
    }
  } finally {
    flushInFlight.delete(userId);
  }
}
