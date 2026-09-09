// Supabase Edge Function: Speech-to-Text via OpenAI Whisper
// Accepts base64-encoded audio and returns transcribed text plus the language
// Whisper actually heard. Used by both hold-to-talk and the hands-free loop.
//
// The caller's `language` is a HINT, never a constraint: passing Whisper a
// `language` forces decoding into it, so a learner who drops into their native
// language mid-session gets mistranslated word-salad back. Learners code-switch
// constantly, so we let Whisper detect and report instead, and the tutor adapts.
//
// Deploy: npx supabase functions deploy transcribe

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { MAX_AUDIO_BASE64_SIZE } from '../_shared/validation.ts';
import { toLanguageCode } from '../_shared/language.ts';
import { resolveEntitlement } from '../_shared/entitlement.ts';
import { maxSecondsForBytes, parseMp4DurationSeconds } from '../_shared/mp4-duration.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import { summarizeSegments } from './confidence.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TranscribeRequest {
  audioBase64: string;
  /** Hint only — see the header note. Used as a fallback if detection fails. */
  language: string;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Require authenticated user
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { audioBase64, language } = (await req.json()) as TranscribeRequest;

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: 'audioBase64 is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Cost/abuse guard: cap audio size and rate before hitting Whisper.
    if (audioBase64.length > MAX_AUDIO_BASE64_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio too large.' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const burstOk = await checkBurstLimit(supabase, authUser.userId, 'transcribe', 30, 60);
    if (!burstOk) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Daily cap. voice-session-end's header has claimed since the voice-proxy
    // removal that transcribe gates on DAILY_VOICE_LIMIT_REACHED; it never
    // did. Until now the burst limiter was the only thing between a signed-in
    // account and unbounded Whisper spend — and burst-limit.ts fails OPEN when
    // Redis cannot answer and there is nothing to fall back to, so "only" was
    // doing a lot of work.
    //
    // voice_minutes is the counter, not one of consume_daily_quota's fixed
    // set: none of those describe seconds of audio, and Whisper bills by the
    // second. Charging real duration after the call (below) is what makes this
    // check converge instead of reading a number this path never moves.
    // Effective, not personal: the other half of a spoken turn (`tts`) honours
    // the school's dailyVoiceMinutes override, and both halves bill the same
    // counter, so reading a different limit here would gate a classroom
    // learner's microphone against a cap their playback never applied.
    const { limits } = await resolveEntitlement(supabase, authUser.userId);

    // Decode base64 to binary
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // ── Reserve, atomically, BEFORE Whisper ──────────────────────────────
    // This was a read-then-increment: thirty concurrent requests all read the
    // same total and all passed, and the byte cap did not bound duration — at
    // 8 kbps a 7.5 MB file is two hours of Whisper against a six-minute plan.
    // The container header carries the duration, so it is reserved up front
    // (consume_voice_seconds, migration 113) and settled to what OpenAI
    // actually billed once the answer is back. A file whose duration cannot
    // be read is reserved at the most audio its bytes could hold.
    const containerSeconds = parseMp4DurationSeconds(bytes);
    const reservedSeconds = Math.max(1, Math.ceil(containerSeconds ?? maxSecondsForBytes(bytes.length)));
    const { data: reserved, error: reserveErr } = await supabase.rpc('consume_voice_seconds', {
      p_user_id: authUser.userId,
      p_limit_minutes: limits.dailyVoiceMinutes,
      p_seconds: reservedSeconds,
    });
    if (reserveErr) {
      // Fail CLOSED: an outage in the meter is not a reason to transcribe unmetered.
      console.error('[transcribe] consume_voice_seconds failed:', reserveErr.message);
      return new Response(
        JSON.stringify({ error: 'Could not verify your daily limit. Try again shortly.', code: 'QUOTA_UNAVAILABLE' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (reserved !== true) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily voice limit. Upgrade your plan for more.",
          code: 'DAILY_VOICE_LIMIT_REACHED',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
    /** Settle the reservation to what was actually billed. Best-effort. */
    const settleVoice = async (actualSeconds: number | null): Promise<void> => {
      const delta = (actualSeconds ?? reservedSeconds) - reservedSeconds;
      if (delta === 0) return;
      const { error } = await supabase.rpc('adjust_voice_seconds', {
        p_user_id: authUser.userId,
        p_delta_seconds: delta,
      });
      if (error) console.error('[transcribe] adjust_voice_seconds failed:', error.message);
    };

    // Build multipart form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([bytes], { type: 'audio/m4a' });
    formData.append('file', audioBlob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    // verbose_json is the only response format that reports detected language,
    // and the only one carrying `segments[]` with the per-segment
    // `avg_logprob` / `no_speech_prob` that ./confidence.ts folds into the
    // confidence the caller gates on.
    formData.append('response_format', 'verbose_json');

    let response: Response;
    try {
      response = await providerFetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      },
      { provider: 'openai-whisper', timeoutMs: PROVIDER_TIMEOUT_MS.transcription },
      );
    } catch (err) {
      await settleVoice(0);
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text();
      // Nothing was billed by the provider; give the whole reservation back.
      await settleVoice(0);
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Settle to what was actually transcribed. verbose_json reports the
    // audio's duration in seconds, which is exactly what OpenAI bills on. A
    // missing duration leaves the reservation as charged — the conservative
    // side. Best-effort: the learner already has their transcript.
    const durationSeconds = typeof data.duration === 'number' && data.duration > 0 ? data.duration : null;
    await settleVoice(durationSeconds);

    // Whisper's own read on whether it heard the learner. Returned, not just
    // logged: `lib/handsfree-grading.ts` has a calibrated `sttConfidence()`
    // that consumes exactly these two numbers, and until now received null
    // for both on every turn — so its gate against grading a misheard answer
    // has never fired. Null stays a legal value and still means "no signal".
    const { avgLogprob, noSpeechProb } = summarizeSegments(data.segments);

    return new Response(
      JSON.stringify({
        text: data.text ?? '',
        // Whisper reports an English language *name* ("spanish"), not a code.
        // Unrecognised names fall back to the caller's hint rather than null so
        // downstream code always has something to key on.
        language: toLanguageCode(data.language) ?? language ?? null,
        avgLogprob,
        noSpeechProb,
        durationSeconds: durationSeconds > 0 ? durationSeconds : null,
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (error: unknown) {
    // Never echo this outward: it carries the Whisper response body, which
    // quotes request parameters back (CLAUDE.md §6). Detail to the logs, a
    // stable code to the caller.
    const message = error instanceof Error ? error.message : String(error);
    console.error('[transcribe] unhandled error:', message);
    return new Response(
      JSON.stringify({
        error: 'Transcription is temporarily unavailable. Please try again.',
        code: 'TRANSCRIPTION_FAILED',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
