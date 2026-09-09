// Supabase Edge Function: Pronunciation Scoring
// Accepts base64 audio and expected text, returns a pronunciation score.
// Enforces per-plan daily voice minute limits before processing.
// Uses OpenAI speech-to-text (STT_MODEL below) for real transcription.
// Deploy: npx supabase functions deploy score-pronunciation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveEntitlement } from '../_shared/entitlement.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import {
  MAX_AUDIO_BASE64_SIZE,
  isValidPronunciationSource,
  isValidUUID,
  sanitizeText,
} from '../_shared/validation.ts';
import { validateContentSafety } from '../_shared/content-safety.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import { runInBackground } from '../_shared/background.ts';
import { calculatePronunciationScore } from './scoring.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');

/**
 * Speech-to-text model. `gpt-4o-mini-transcribe` answers a few-second clip
 * noticeably faster than `whisper-1` and is what the learner is waiting on,
 * so latency decides this. Env-overridable so a regression in what it hears
 * (it is an LLM-backed model and may tidy a mispronunciation that Whisper
 * would have transcribed literally) can be rolled back without a deploy.
 */
const STT_MODEL = Deno.env.get('PRONUNCIATION_STT_MODEL') ?? 'gpt-4o-mini-transcribe';

interface ScoreRequest {
  audioBase64: string;
  expectedText: string;
  language: string;
  acceptedVariants?: string[];
  targetWord?: string;
  targetGrammar?: string;
  /** Where the attempt came from; defaults to 'practice' (migration 089). */
  source?: string;
  /** Card the attempt was against. Absent for read-aloud and free practice. */
  cardId?: string;
}

/** Cap on the text persisted per attempt, so one row cannot grow unbounded. */
const MAX_STORED_TEXT = 2000;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // Per-phase timings, logged on success. The learner is staring at a
  // spinner for the whole of this, so where the time goes is worth knowing.
  const startedAt = performance.now();
  const timing: Record<string, number> = {};
  const mark = (phase: string, from: number) => {
    timing[phase] = Math.round(performance.now() - from);
  };

  try {
    // Verify authentication
    const authUser = await getAuthenticatedUser(req);
    mark('auth', startedAt);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const authenticatedUserId = authUser.userId;

    const {
      audioBase64,
      expectedText,
      language,
      acceptedVariants,
      targetWord,
      targetGrammar,
      source,
      cardId,
    } = (await req.json()) as ScoreRequest;

    if (!audioBase64 || !expectedText) {
      return new Response(
        JSON.stringify({ error: 'audioBase64 and expectedText are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Provenance of the attempt (migration 089). Validated here, before any
    // quota is consumed, so a bad value costs the learner nothing. Unset means
    // free practice, which is the honest default for an unlabelled attempt.
    if (source !== undefined && !isValidPronunciationSource(source)) {
      return new Response(
        JSON.stringify({ error: 'Invalid source.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (cardId !== undefined && !isValidUUID(cardId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid cardId.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const attemptSource = source ?? 'practice';

    // Cost/abuse guard: cap audio size and burst rate before the STT call.
    if (audioBase64.length > MAX_AUDIO_BASE64_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio too large.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // The burst counter (Redis) and the tier lookup (Postgres) are independent
    // round trips, so they run together; only the quota consume below needs
    // the tier. Serially this was two waits on the learner's critical path.
    const gatesAt = performance.now();
    const [burstOk, { limits }] = await Promise.all([
      checkBurstLimit(supabase, authenticatedUserId, 'score-pronunciation', 20, 60),
      resolveEntitlement(supabase, authenticatedUserId),
    ]);
    if (!burstOk) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Enforce daily pronunciation score limit ───────────────

    // Atomic check-and-consume (migration 037) — race-free under
    // concurrent requests, replaces read-then-increment.
    const { data: quotaOk, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
      p_user_id: authenticatedUserId,
      p_counter: 'pronunciation_scores',
      p_limit: limits.dailyPronunciationScores,
    });
    if (quotaErr) {
      console.error('[score-pronunciation] consume_daily_quota failed:', quotaErr.message);
    }
    if (quotaErr || quotaOk !== true) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily pronunciation scoring limit. Upgrade your plan for more.",
          code: 'DAILY_PRONUNCIATION_LIMIT_REACHED',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    mark('gates', gatesAt);

    // Step 1: Transcribe audio
    const sttAt = performance.now();
    const transcription = await transcribeAudio(audioBase64, language);
    mark('stt', sttAt);

    // Step 2: Score the transcription against expected text and accepted variants
    const score = calculatePronunciationScore(transcription, expectedText, acceptedVariants ?? []);

    // Step 3: Check if target word/grammar appears in transcription
    const normalizedTranscription = transcription.toLowerCase().trim();
    const targetPresent =
      (targetWord ? normalizedTranscription.includes(targetWord.toLowerCase().trim()) : false) ||
      (targetGrammar ? normalizedTranscription.includes(targetGrammar.toLowerCase().trim()) : false);

    // Step 4: STT output is user-audio-derived and unfiltered — safety
    // check before echoing it back. The score (computed above from the raw
    // transcription) is still returned; only the echoed text is replaced.
    // phonemeErrors quote transcribed words, so they are suppressed too.
    const transcriptionSafety = await validateContentSafety(transcription, {
      language,
      fn: 'score-pronunciation',
    });
    if (!transcriptionSafety.safe) {
      console.log(JSON.stringify({
        evt: 'safety_reject',
        fn: 'score-pronunciation',
        reasons: transcriptionSafety.reasons,
        ts: new Date().toISOString(),
      }));
    }
    const safeTranscription = transcriptionSafety.safe
      ? transcription
      : '[transcription unavailable]';
    const safePhonemeErrors = transcriptionSafety.safe ? score.phonemeErrors : [];

    // Quota already consumed atomically before transcription.

    const isCorrect = score.score >= 60;

    // Step 5: keep the attempt (migration 089). Before this, the score was
    // computed and thrown away, which is why the CEFR report could only ever
    // show speaking as `not_assessed`.
    //
    // Non-fatal, exactly like ai-chat's correction_log write: a learner who
    // recorded audio and waited for transcription gets their score even if the
    // insert fails. The write is service-role — there is no client INSERT
    // policy on the table, by design.
    //
    // What is stored is the *safe* transcription, not the raw one: if the
    // safety pipeline rejected what the model heard, we do not tell the learner
    // and we do not keep it either. The score, computed from the raw text
    // above, is unaffected.
    //
    // Written after the response goes out (EdgeRuntime.waitUntil): the verdict
    // is already final, nothing in the reply depends on the row, and the
    // insert is one more Postgres round trip the learner would otherwise wait
    // through. Being non-fatal already, it loses nothing by being deferred.
    runInBackground(persistAttempt(supabase, {
      user_id: authenticatedUserId,
      // Bounded rather than rejected: `language` is already accepted as free
      // text by the transcription call above and changing that is out of scope here.
      target_language: sanitizeText(language ?? '', 32),
      expected_text: sanitizeText(expectedText, MAX_STORED_TEXT),
      transcription: sanitizeText(safeTranscription, MAX_STORED_TEXT),
      score: score.score,
      is_correct: isCorrect,
      phoneme_errors: safePhonemeErrors,
      source: attemptSource,
      card_id: cardId ?? null,
    }));

    mark('total', startedAt);
    console.log(JSON.stringify({
      evt: 'score_timing',
      fn: 'score-pronunciation',
      model: STT_MODEL,
      audioBytes: Math.round(audioBase64.length * 0.75),
      ...timing,
    }));

    return new Response(
      JSON.stringify({
        score: score.score,
        feedback: score.feedback,
        phonemeErrors: safePhonemeErrors,
        transcription: safeTranscription,
        isCorrect,
        matchedVariant: score.matchedVariant,
        targetPresent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[score-pronunciation] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to score pronunciation. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/** The deferred pronunciation_scores write. Never throws: it runs after the response. */
// deno-lint-ignore no-explicit-any
async function persistAttempt(supabase: any, row: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await supabase.from('pronunciation_scores').insert(row);
    if (error) {
      console.warn('[score-pronunciation] pronunciation_scores write failed (non-fatal):', error.message);
    }
  } catch (err) {
    console.warn('[score-pronunciation] pronunciation_scores write threw (non-fatal):', err);
  }
}

/**
 * Transcribe audio with OpenAI speech-to-text (see STT_MODEL).
 * Pattern copied from supabase/functions/transcribe/index.ts, minus
 * `verbose_json`: only the text is used here, and the plain `json` shape is
 * the one every current model supports.
 */
async function transcribeAudio(audioBase64: string, language: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_KEY not configured. Speech-to-text is unavailable.');
  }

  // Decode base64 to binary
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Build multipart form data for the transcription API
  const formData = new FormData();
  const audioBlob = new Blob([bytes], { type: 'audio/m4a' });
  formData.append('file', audioBlob, 'audio.m4a');
  formData.append('model', STT_MODEL);
  formData.append('response_format', 'json');
  if (language) {
    formData.append('language', language);
  }

  const response = await providerFetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    },
    { provider: 'openai-stt', timeoutMs: PROVIDER_TIMEOUT_MS.transcription },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`STT API error (${STT_MODEL}): ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.text ?? '';
}
