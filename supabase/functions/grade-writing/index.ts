// Supabase Edge Function: Grade Writing
// Provides AI-powered feedback on user writing submissions.
// Uses Claude Haiku for cost-efficient grading at scale.
// Deploy: npx supabase functions deploy grade-writing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsResponse, corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { resolveEntitlement } from '../_shared/entitlement.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { isValidUUID, isValidCefrLevel, isValidLanguage, sanitizeText } from '../_shared/validation.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import { gradeWithValidation, shouldRefundQuota } from './grading.ts';
import { buildGradingPrompt } from './prompt.ts';
import { countWritingUnits } from './writing-length.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

interface GradeRequest {
  submissionId: string;
  submissionText: string;
  promptId: string;
  targetLanguage: string;
  cefrLevel: string;
  /** Client-side length estimate. Informational only: the server recounts
   * (writing-length.ts) because Hermes has no Intl.Segmenter, so a Japanese
   * or Chinese client can only send a character count flagged 'unavailable'. */
  wordCount?: number;
  countMethod?: string;
}

type ServiceClient = ReturnType<typeof createClient>;

/**
 * Overwrite the stored `word_count` for the caller's own submission row with a
 * server measurement. The number is counted from the row's OWN stored
 * `submission_text`, never from the request body, so the stored count always
 * describes the stored row — a retry naming a stale submission id can no longer
 * stamp the length of different text onto it. Scoped to `(id, user_id)`, so a
 * caller can only ever touch a row they own. The client already writes this
 * column unguarded at insert (`submitWriting`), so this only corrects it.
 *
 * A failure must not block the grade the learner is waiting on: it is logged as
 * a structured event and grading continues.
 */
async function storeServerWordCount(
  supabase: ServiceClient,
  submissionId: string,
  userId: string,
  language: string,
): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from('user_writing_submissions')
    .select('submission_text')
    .eq('id', submissionId)
    .eq('user_id', userId)
    .maybeSingle();
  const storedText: unknown = row?.submission_text;
  if (readErr || typeof storedText !== 'string') {
    console.error(JSON.stringify({
      evt: 'writing_length_store_failed',
      fn: 'grade-writing',
      stage: 'read',
      error: readErr?.message ?? 'no submission row with this id for this user',
      ts: new Date().toISOString(),
    }));
    return;
  }
  const { error: writeErr } = await supabase
    .from('user_writing_submissions')
    .update({ word_count: countWritingUnits(storedText, language).count })
    .eq('id', submissionId)
    .eq('user_id', userId);
  if (writeErr) {
    console.error(JSON.stringify({
      evt: 'writing_length_store_failed',
      fn: 'grade-writing',
      stage: 'write',
      error: writeErr.message,
      ts: new Date().toISOString(),
    }));
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ── Authenticate the user ─────────────────────────────────
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers }
      );
    }
    const userId = authUser.userId;

    const body = (await req.json()) as GradeRequest;
    const { submissionId, submissionText, promptId, targetLanguage, cefrLevel } = body;

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers }
      );
    }

    // ── Validate inputs ──────────────────────────────────────
    if (!isValidUUID(promptId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt ID' }),
        { status: 400, headers }
      );
    }
    if (!isValidCefrLevel(cefrLevel)) {
      return new Response(
        JSON.stringify({ error: 'Invalid CEFR level' }),
        { status: 400, headers }
      );
    }
    if (!isValidLanguage(targetLanguage)) {
      return new Response(
        JSON.stringify({ error: 'Invalid target language' }),
        { status: 400, headers }
      );
    }

    if (typeof submissionText !== 'string' || !submissionText.trim() || submissionText.length > 5000) {
      return new Response(JSON.stringify({ error: 'Writing must contain 1–5000 characters' }), { status: 400, headers });
    }

    // The assigned prompt and its course are authoritative. A profile language
    // switch must not cause an existing French task to be graded as Spanish.
    // Missing content is an error, never an empty generic assignment, and it
    // is checked before consuming the learner's grading allowance.
    const { data: prompt, error: promptError } = await supabase
      .from('writing_prompts')
      .select('*, courses!inner(target_language)')
      .eq('id', promptId)
      .single();
    if (promptError || !prompt) {
      return new Response(JSON.stringify({ error: 'Writing prompt unavailable' }), { status: 404, headers });
    }
    const assignedLanguage = prompt.courses?.target_language;
    if (!isValidLanguage(assignedLanguage) || !isValidCefrLevel(prompt.cefr_level)) {
      return new Response(JSON.stringify({ error: 'Writing prompt configuration is invalid' }), { status: 422, headers });
    }

    // ── Rate limit: check BEFORE calling AI ──────────────────
    // Up to three Haiku calls per request, and until now no burst limit at
    // all — the daily quota was the only ceiling, and the refund path could
    // hand it back.
    const burstOk = await checkBurstLimit(supabase, userId, 'grade-writing', 6, 60);
    if (!burstOk) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }),
        { status: 429, headers }
      );
    }

    const { limits } = await resolveEntitlement(supabase, userId);

    // Atomic check-and-consume (migration 037) — race-free under
    // concurrent requests, replaces read-then-increment.
    const { data: quotaOk, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
      p_user_id: userId,
      p_counter: 'writing_grades',
      p_limit: limits.dailyWritingGrades,
    });
    if (quotaErr) {
      console.error('[grade-writing] consume_daily_quota failed:', quotaErr.message);
    }
    if (quotaErr || quotaOk !== true) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily writing grade limit. Upgrade your plan for more.",
          code: 'DAILY_WRITING_LIMIT_REACHED',
        }),
        { status: 429, headers }
      );
    }

    // The server count is authoritative for min_words/max_words. Deno has full
    // ICU, so Japanese and Chinese are measured in dictionary word segments;
    // the client's number is only ever a hint (on Hermes it is a character
    // count for those two languages) and is never passed to the grader.
    const submissionLength = countWritingUnits(submissionText, assignedLanguage);
    if (typeof body.wordCount === 'number' && body.wordCount !== submissionLength.count) {
      console.log(JSON.stringify({
        evt: 'writing_length_client_mismatch',
        fn: 'grade-writing',
        language: assignedLanguage,
        client: { count: body.wordCount, method: body.countMethod ?? null },
        server: submissionLength,
        ts: new Date().toISOString(),
      }));
    }
    // The client inserted the row with its own estimate before grading; the
    // stored word_count is proficiency evidence, so overwrite it with a server
    // measurement of the row's own stored text. See storeServerWordCount.
    if (isValidUUID(submissionId)) {
      await storeServerWordCount(supabase, submissionId, userId, assignedLanguage);
    }

    const systemPrompt = buildGradingPrompt({
      targetLanguage: assignedLanguage,
      cefrLevel: prompt.cefr_level,
      promptText: sanitizeText(prompt.prompt_text ?? '', 2000),
      exampleResponse: sanitizeText(prompt.example_response ?? '', 2000),
      targetVocabulary: prompt.target_vocabulary ?? [],
      targetGrammar: prompt.target_grammar ?? [],
      minWords: prompt.min_words,
      maxWords: prompt.max_words,
      scaffoldType: prompt.scaffold_type,
      scaffoldData: prompt.scaffold_data,
      submissionLength,
    });

    // Safety + parse orchestration (retry → safety-retry → parse-retry →
    // honest fallback). See grading.ts. Never fabricates scores: on
    // unrecoverable failure the response carries graded: false and zeros.
    const { feedback, fallbackReason } = await gradeWithValidation(async () => {
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
            // Feedback on a short learner text does not need 1500 tokens.
            max_tokens: 900,
            system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: sanitizeText(submissionText, 5000) }],
          }),
        },
        { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.textLong },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text ?? '';
    });

    // Quota was consumed atomically before the LLM call. If the honest
    // no-grade fallback shipped (graded: false), the user paid for nothing —
    // refund the writing_grades unit (migration 045, service-role only).
    // A refund failure never blocks the response: the fallback still ships.
    if (shouldRefundQuota(feedback, fallbackReason)) {
      const { error: refundErr } = await supabase.rpc('refund_daily_quota', {
        p_user_id: userId,
        p_counter: 'writing_grades',
        p_amount: 1,
      });
      if (refundErr) {
        console.error(JSON.stringify({
          evt: 'quota_refund_failed',
          fn: 'grade-writing',
          counter: 'writing_grades',
          error: refundErr.message,
          ts: new Date().toISOString(),
        }));
      }
    }

    return new Response(
      JSON.stringify(feedback),
      { headers }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[grade-writing] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to grade writing. Please try again.' }),
      { status: 500, headers }
    );
  }
});
