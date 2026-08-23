// Supabase Edge Function: lesson-session
//
// Server-side storage for MID-LESSON progress — the snapshot of a lesson a
// learner started and walked away from. Backed by Redis with a hard one-day
// expiry, so an unfinished lesson is resumable for a day and then restarts
// from the beginning.
//
// Why Redis and not Postgres: this state is deliberately disposable. It has a
// natural expiry, it is rewritten after every single answer, and losing it
// costs a learner one partial lesson — never their record of work. FINISHED
// lessons go to `lesson_completions` in Postgres and are never stored here.
//
// Auth: deployed with verify_jwt: false. Authentication is performed by the
// function body via _shared/auth.ts getAuthenticatedUser(), which calls
// supabase.auth.getUser(token) and works with any JWT signing algorithm.
// Matches the ai-chat / translate pattern. DO NOT flip verify_jwt back to
// true without first fixing the project-wide UNAUTHORIZED_LEGACY_JWT /
// UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM root cause.
//
// The key is built from the SERVER's view of the caller (`authUser.userId`),
// never from the request body, so one learner can never read or overwrite
// another's session.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { isValidUUID } from '../_shared/validation.ts';
import {
  isRedisConfigured,
  redisDel,
  redisGet,
  redisSetEx,
  RedisUnavailableError,
} from '../_shared/redis.ts';
import {
  LESSON_SESSION_TTL_MS,
  lessonSessionRedisKey,
  parseSnapshot,
  remainingTtlSeconds,
  type LessonSessionSnapshot,
} from './snapshot.ts';

type Action = 'load' | 'save' | 'clear';

interface LessonSessionRequest {
  action?: Action;
  /**
   * Who the client believes it is. Advisory only — the key below is built
   * from the verified token — but a mismatch means the client's on-device
   * cache is keyed to a different account than the session it is calling
   * with, so refuse rather than merge two learners' lessons together.
   */
  userId?: string;
  lessonId?: string;
  snapshot?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);

  // Not configured is not an error the learner should ever see — the client
  // falls back to its on-device snapshot. Distinct code so it can tell this
  // apart from a transient outage.
  if (!isRedisConfigured()) {
    return json(
      { error: 'Lesson session storage is not configured', code: 'REDIS_NOT_CONFIGURED' },
      503,
    );
  }

  let body: LessonSessionRequest;
  try {
    body = (await req.json()) as LessonSessionRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const action = body.action;
  if (action !== 'load' && action !== 'save' && action !== 'clear') {
    return json({ error: 'action must be one of: load, save, clear' }, 400);
  }

  const lessonId = typeof body.lessonId === 'string' ? body.lessonId : '';
  if (!isValidUUID(lessonId)) {
    return json({ error: 'lessonId must be a UUID' }, 400);
  }

  if (typeof body.userId === 'string' && body.userId !== authUser.userId) {
    return json({ error: 'Forbidden', code: 'USER_MISMATCH' }, 403);
  }

  const key = lessonSessionRedisKey(authUser.userId, lessonId);

  try {
    if (action === 'clear') {
      await redisDel(key);
      return json({ ok: true });
    }

    if (action === 'save') {
      const snapshot = parseSnapshot(body.snapshot);
      if (!snapshot) {
        return json({ error: 'Invalid session snapshot' }, 400);
      }

      // Absolute deadline from when the lesson STARTED. Answering another
      // question rewrites the value with a shorter TTL — it never buys the
      // learner another day.
      const ttlSeconds = remainingTtlSeconds(snapshot.startedAt, Date.now());
      if (ttlSeconds <= 0) {
        // The lesson's day is already up: drop whatever is stored so the next
        // load restarts it, rather than writing a snapshot that is born dead.
        await redisDel(key);
        return json({ ok: true, expired: true });
      }

      await redisSetEx(key, JSON.stringify(snapshot), ttlSeconds);
      return json({ ok: true, expiresInSeconds: ttlSeconds });
    }

    // action === 'load'
    const raw = await redisGet(key);
    if (raw === null) return json({ snapshot: null });

    let stored: unknown;
    try {
      stored = JSON.parse(raw);
    } catch {
      await redisDel(key);
      return json({ snapshot: null });
    }

    const snapshot: LessonSessionSnapshot | null = parseSnapshot(stored);
    if (!snapshot) {
      await redisDel(key);
      return json({ snapshot: null });
    }

    // Belt and braces: Redis expiry is the primary mechanism, but a key
    // written with a bad TTL must still not resurrect a stale lesson.
    if (Date.now() - snapshot.startedAt > LESSON_SESSION_TTL_MS) {
      await redisDel(key);
      return json({ snapshot: null, expired: true });
    }

    return json({ snapshot });
  } catch (err) {
    if (err instanceof RedisUnavailableError) {
      // Degrade, don't fail the lesson: the client keeps its local snapshot.
      console.error('[lesson-session] redis unavailable:', err.message);
      return json({ error: 'Session storage unavailable', code: 'REDIS_UNAVAILABLE' }, 503);
    }
    console.error('[lesson-session] unexpected error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
