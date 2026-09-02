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
import { getEffectiveLimits } from '../_shared/plan-limits.ts';
import { getUserToday } from '../_shared/user-day.ts';
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
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier, is_active')
      .eq('user_id', authUser.userId)
      .single();
    // Effective, not personal: the other half of a spoken turn (`tts`) honours
    // the school's dailyVoiceMinutes override, and both halves bill the same
    // counter, so reading a different limit here would gate a classroom
    // learner's microphone against a cap their playback never applied.
    const tier = sub?.is_active && sub.tier ? sub.tier : 'starter';
    const limits = await getEffectiveLimits(authUser.userId, supabase, tier);

    // Day key must match what increment_daily_usage writes (user-local
    // midnight rollover, migration 044) — not UTC.
    const userDay = await getUserToday(supabase, authUser.userId);
    const { data: usageRow } = await supabase
      .from('daily_usage')
      .select('voice_minutes')
      .eq('user_id', authUser.userId)
      .eq('date', userDay)
      .single();

    const usedVoiceMinutes = parseFloat(usageRow?.voice_minutes as string) || 0;
    if (usedVoiceMinutes >= limits.dailyVoiceMinutes) {
      return new Response(
        JSON.stringify({
          error: "You've reached your daily voice limit. Upgrade your plan for more.",
          code: 'DAILY_VOICE_LIMIT_REACHED',
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 to binary
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

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

    const response = await providerFetch(
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Charge what was actually transcribed. verbose_json reports the audio's
    // duration in seconds, which is exactly what OpenAI bills on — so a normal
    // ten-second turn costs ~0.17 of a minute and is invisible, while a caller
    // pushing the 10MB cap spends most of a day's allowance in one request.
    // Best-effort: the learner already has their transcript, so a metering
    // failure is logged, not surfaced.
    const durationSeconds = typeof data.duration === 'number' ? data.duration : 0;
    if (durationSeconds > 0) {
      const { error: usageErr } = await supabase.rpc('increment_daily_usage', {
        p_user_id: authUser.userId,
        p_voice_minutes: durationSeconds / 60,
      });
      if (usageErr) {
        console.error('[transcribe] failed to increment voice_minutes:', usageErr.message);
      }
    }

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
