// Supabase Edge Function: Explain Passage
// Plain-language explanation of one paragraph a learner is reading, written in
// their native language at their CEFR level.
//
// Called by the reader's "Explain this" affordance on a paragraph. Imported
// Gutenberg text is identical for every learner, so an explanation is worth
// generating once and serving to everyone: `explanation_cache` (migration 094)
// is keyed on a hash of (language, native language, level, normalised span)
// and NOT on which book the span came from.
//
// Auth: deployed with verify_jwt: false. Authentication is performed by the
// function body via _shared/auth.ts getAuthenticatedUser(), matching translate
// and ai-chat. DO NOT flip verify_jwt back to true without first fixing the
// project-wide UNAUTHORIZED_LEGACY_JWT root cause.
//
// Deploy: npx supabase functions deploy explain-passage --project-ref <ref>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { getEffectiveLimits } from '../_shared/plan-limits.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import { isValidCefrLevel, isValidLanguage, isValidUUID } from '../_shared/validation.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import { cacheExpiryIso, shouldRefreshCacheEntry } from '../_shared/cache-retention.ts';
import type { CEFR } from '../_shared/level-checker.ts';
import { buildExplainSystemPrompt, checkSpan, explanationCacheKey } from './explain-core.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

// Four sentences of plain prose. 400 tokens leaves headroom for a language
// that runs long without paying for an essay.
const MAX_OUTPUT_TOKENS = 400;

// Lower than translate's 30/60s. Each of these is a ~400-token generation
// rather than a ~20-token one, and no honest reader taps Explain ten times a
// minute.
const BURST_MAX = 10;
const BURST_WINDOW_SECONDS = 60;

interface ExplainRequest {
  text: string;
  language: string;
  nativeLanguage: string;
  cefrLevel: string;
  bookId?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Extend a cache entry's life when it is nearing expiry. Non-fatal — a failed
 * refresh costs at most one future regeneration. Policy is shared with
 * translate via _shared/cache-retention.ts.
 */
async function touchCacheEntry(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  hash: string,
  expiresAt: string | null,
): Promise<void> {
  if (!shouldRefreshCacheEntry(expiresAt)) return;

  const { error } = await supabase
    .from('explanation_cache')
    .update({ expires_at: cacheExpiryIso() })
    .eq('hash', hash);
  if (error) {
    console.warn('[explain-passage] cache refresh failed (non-fatal):', error.message);
  }
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
    'explain-passage',
    BURST_MAX,
    BURST_WINDOW_SECONDS,
  );
  if (!burstOk) {
    return json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }, 429);
  }

  let body: ExplainRequest;
  try {
    body = (await req.json()) as ExplainRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { text, language, nativeLanguage, cefrLevel, bookId } = body;
  if (!text || !language || !nativeLanguage || !cefrLevel) {
    return json(
      { error: 'Missing required fields: text, language, nativeLanguage, cefrLevel' },
      400,
    );
  }
  // All three of these interpolate into the system prompt AND into the cache
  // key. Unvalidated they are two separate holes: an instruction channel
  // wearing a parameter's name, and a way to force unbounded cache misses by
  // varying a field the model barely reads. They name closed sets, so require
  // that they be in them. The passage itself needs no such treatment — it goes
  // to the model as a user-role message, which is where untrusted prose
  // belongs.
  if (!isValidLanguage(language) || !isValidLanguage(nativeLanguage) || !isValidCefrLevel(cefrLevel)) {
    return json({ error: 'Invalid request' }, 400);
  }
  if (bookId !== undefined && !isValidUUID(bookId)) {
    return json({ error: 'Invalid request' }, 400);
  }

  const span = checkSpan(text);
  if (!span.ok) {
    return json(
      {
        error:
          span.code === 'SPAN_TOO_LONG'
            ? 'That passage is too long to explain in one go.'
            : 'Select a full sentence or more.',
        code: span.code,
      },
      400,
    );
  }

  // ── Daily ceiling ──────────────────────────────────────────────────────
  // Charged BEFORE the cache lookup, unlike translate and for get-hint's
  // reason: a learner told they get 25 of these a day must not discover the
  // number silently meant 25 cache misses. It also bounds the one abuse this
  // endpoint has that translate does not — the span is arbitrary client text,
  // so a caller who wanted to could keep missing the cache on purpose.
  const limits = await getEffectiveLimits(authUser.userId, supabase);
  const { data: allowed, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
    p_user_id: authUser.userId,
    p_counter: 'text_messages',
    p_limit: limits.dailyTextMessages,
  });
  if (quotaErr) {
    // Fail CLOSED: an outage in the meter is not a reason to hand out
    // unmetered generation.
    console.error('[explain-passage] consume_daily_quota failed:', quotaErr.message);
    return json({ error: 'Explanations are temporarily unavailable.', code: 'QUOTA_UNAVAILABLE' }, 503);
  }
  if (!allowed) {
    return json(
      {
        error: "That's all your explanations for today.",
        code: 'DAILY_MESSAGE_LIMIT_REACHED',
      },
      429,
    );
  }

  /** Give the quota back. Best-effort — a failed refund must not change the
   *  status the learner sees, and the counter self-clears at their next local
   *  midnight either way. */
  const refund = async (): Promise<void> => {
    const { error } = await supabase.rpc('refund_daily_quota', {
      p_user_id: authUser.userId,
      p_counter: 'text_messages',
    });
    if (error) console.error('[explain-passage] refund_daily_quota failed:', error.message);
  };

  const hash = await explanationCacheKey(language, nativeLanguage, cefrLevel, span.span);
  const { data: cached, error: cacheErr } = await supabase
    .from('explanation_cache')
    .select('explanation, expires_at')
    .eq('hash', hash)
    .maybeSingle();
  if (cacheErr) {
    console.warn('[explain-passage] cache lookup failed (non-fatal):', cacheErr.message);
  }
  if (cached && typeof cached.explanation === 'string') {
    await touchCacheEntry(supabase, hash, cached.expires_at as string | null);
    return json({ explanation: cached.explanation, cached: true });
  }

  const systemPrompt = buildExplainSystemPrompt(language, nativeLanguage, cefrLevel);

  // There is no pre-authored explanation of an arbitrary paragraph to fall
  // back to, so the fallback is an explicit empty sentinel and `usedFallback`
  // is read as "this failed" — an honest 502 rather than a confident wrong
  // answer. The level check is aimed at the learner's target language; this
  // text is written in their native one, so it is skipped.
  const result = await generateValidated({
    fn: 'explain-passage',
    targetLevel: cefrLevel as CEFR,
    language: nativeLanguage,
    safetyRetries: 1,
    skipLevelCheck: true,
    fallback: () => Promise.resolve(''),
    generate: async () => {
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
            system: systemPrompt,
            messages: [{ role: 'user', content: span.span }],
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

  if (result.usedFallback || !result.text) {
    await refund();
    return json(
      {
        error: 'Explanations are temporarily unavailable. Please try again.',
        code: 'EXPLANATION_UNAVAILABLE',
        // Which half failed: the provider call, or our own safety check on its
        // output. Coarse by design — it names no model, prompt or vendor error.
        reason: result.fallbackReason ?? 'provider',
      },
      502,
    );
  }

  // Populate the cache for the next learner on this paragraph. Conflicts
  // (concurrent identical requests) and write failures are non-fatal.
  const { error: insertErr } = await supabase
    .from('explanation_cache')
    .upsert(
      {
        hash,
        explanation: result.text,
        book_id: bookId ?? null,
        expires_at: cacheExpiryIso(),
      },
      { onConflict: 'hash', ignoreDuplicates: true },
    );
  if (insertErr) {
    console.warn('[explain-passage] cache write failed (non-fatal):', insertErr.message);
  }

  return json({ explanation: result.text, cached: false });
});
