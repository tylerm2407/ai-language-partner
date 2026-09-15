// Supabase Edge Function: Grade Response
// AI semantic grading for OPEN learner responses — a lesson `free_production`
// sentence or a reading `short_answer` — where authored alternatives cannot
// exhaust the acceptable wording. Authorised by the user decision of
// 2026-09-14: fixed-key matching is the fast path and the fallback, the paid
// writing quota is never touched, and entitlements do not change.
//
// Auth: deployed with verify_jwt: false (see supabase/config.toml).
// Authentication is performed by the function body via _shared/auth.ts
// getAuthenticatedUser(), matching translate, explain-passage and ai-chat.
//
// Metering: ONE per-user daily counter, in Redis
// (`ratelimit:semantic-grade-day`, one-day TTL), via the same fixed-window
// primitive burst limiting uses. It is NOT a daily_usage counter:
// consume_daily_quota whitelists its counters in SQL and this branch writes no
// migrations. There is deliberately NO second store: an increment_rate_limit
// fallback would count in Postgres under its own key, so a mid-day Redis blip
// would hand the learner a fresh full cap and double worst-case spend. A burst
// window can afford that trade (burst-limit.ts says so); a daily COST cap
// cannot. When Redis cannot count, the function refuses to spend — the client
// gets the fixed verdict, labelled 'quota'.
//
// Language: for a reading `short_answer` the grading language is read from the
// passage's course row here, never taken from the request body. The rubric
// fails a right answer given in the wrong language, so a profile language
// switch must not re-grade an older passage against the new language. Same
// class of bug, same fix as grade-writing's assigned-prompt lookup.
//
// Deploy: npx supabase functions deploy grade-response --project-ref <ref>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit, rateLimitKey } from '../_shared/burst-limit.ts';
import { redisRateLimit } from '../_shared/redis.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import {
  BURST_MAX,
  BURST_WINDOW_SECONDS,
  checkRequest,
  DAILY_SEMANTIC_GRADES,
  DAILY_WINDOW_SECONDS,
  type GradeRequest,
  gradeResponse,
} from './grade-core.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// One small JSON object. 160 tokens is generous for a 20-word reason plus a
// normalised sentence; anything longer is the model ignoring the format.
const MAX_OUTPUT_TOKENS = 160;

const DAILY_ACTION = 'semantic-grade-day';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Take one unit of the day's semantic allowance.
 *
 * Redis is the ONLY counter. When it cannot answer we refuse to spend, rather
 * than counting somewhere else: a second store means a second budget, and the
 * cap this enforces is a cost ceiling, not a fairness window. Refusing costs
 * the learner nothing they can see — they still get the fixed-key verdict,
 * labelled so they know the AI check did not run.
 *
 * The window starts at the learner's first semantic grade and runs one day
 * from there, not from their local midnight — a Redis TTL, not a calendar.
 */
async function reserveDailyGrade(userId: string, cap: number): Promise<boolean> {
  const { allowed, counted } = await redisRateLimit(
    rateLimitKey(DAILY_ACTION, userId),
    cap,
    DAILY_WINDOW_SECONDS,
  );
  if (!counted) {
    console.error('[grade-response] daily meter unavailable, refusing to spend');
    return false;
  }
  return allowed;
}

/**
 * The authoritative grading language.
 *
 * A reading answer is judged in the language of the passage's COURSE, read
 * here from the database. A lesson answer keeps the language the runner sent,
 * which it takes from the loaded profile and refuses to default.
 *
 * `null` means "do not grade": an unresolvable passage is not a reason to
 * guess, because guessing wrong marks a correct answer incorrect.
 */
async function resolveLanguage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  request: GradeRequest,
): Promise<string | null> {
  if (request.kind !== 'short_answer') return request.language || null;
  if (!request.passageId) return null;

  const { data, error } = await supabase
    .from('reading_passages')
    .select('courses!inner(target_language)')
    .eq('id', request.passageId)
    .single();
  if (error || !data) {
    console.error('[grade-response] passage language unresolved:', error?.message ?? 'no row');
    return null;
  }
  const course = data.courses;
  const language = Array.isArray(course) ? course[0]?.target_language : course?.target_language;
  return typeof language === 'string' && language ? language : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const burstOk = await checkBurstLimit(
    supabase,
    authUser.userId,
    'grade-response',
    BURST_MAX,
    BURST_WINDOW_SECONDS,
  );
  if (!burstOk) {
    return json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const checked = checkRequest(body);
  if (!checked.ok) return json({ error: checked.error }, 400);

  // Free vs paid decides the cap and nothing else. Same lookup grade-writing
  // uses; an inactive or missing subscription is the free tier.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', authUser.userId)
    .single();
  const isPaid = sub?.is_active === true && typeof sub.tier === 'string' && sub.tier !== 'starter';
  const cap = isPaid ? DAILY_SEMANTIC_GRADES.paid : DAILY_SEMANTIC_GRADES.starter;

  try {
    const result = await gradeResponse(checked.request, {
      reserveSemanticGrade: () => reserveDailyGrade(authUser.userId, cap),
      resolveLanguage: (request) => resolveLanguage(supabase, request),
      generate: async (system, user) => {
        const response = await providerFetch(
          'https://api.anthropic.com/v1/messages',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: TEXT_MODEL,
              max_tokens: MAX_OUTPUT_TOKENS,
              system,
              messages: [{ role: 'user', content: user }],
            }),
          },
          { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.textShort },
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        const out = (data.content?.[0]?.text ?? '').trim();
        if (!out) throw new Error('Empty completion');
        return out;
      },
    });
    return json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[grade-response] unhandled error:', message);
    return json({ error: 'Failed to grade the answer. Please try again.' }, 500);
  }
});
