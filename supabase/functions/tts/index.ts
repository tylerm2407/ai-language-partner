// Supabase Edge Function: Text-to-Speech via ElevenLabs
// Proxies TTS requests to ElevenLabs API and returns base64 JSON.
// Deploy: npx supabase functions deploy tts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_KEY');

// ElevenLabs voice IDs — native-sounding voices per language.
// Curated from ElevenLabs voice library for natural pronunciation.
//
// HVPT (High-Variability Phonetic Training) rationale: L2 phoneme perception
// gains require the learner to hear the same target in ≥4 distinct voices
// (see research.md §9, Thomson meta-analyses). We therefore keep an array of
// voice IDs per language. Index [0] is preserved as the previously-shipping
// voice for backward compatibility. Additional IDs were sourced from the
// ElevenLabs public voice library / default preset voices.
//
// Voice IDs on the default/public side are well-known, stable, widely
// documented, and reused across many ElevenLabs community projects. They are
// not tied to a private workspace. Retrieval date: 2026-04-22.
//
// NOTE: Where a language lacks 4 clearly-documented library voices with
// native/on-accent delivery, we ship what we have (still an upgrade from 1)
// and flag a TODO. The current ElevenLabs multilingual models render most
// voices in any language, but pronunciation quality varies — so we prefer
// voices that users have historically reported as natural for that language.

const VOICE_MAP: Record<string, string[]> = {
  es: [
    'pFZP5JQG7iQjIQuC4Bku', // Lily, female, neutral Spanish, sourced 2026-04-22 (shipping voice, index 0)
    'XrExE9yKIg1WjnnlVkGX', // Matilda, female, warm, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, British-rendered Spanish, sourced 2026-04-22
    'TX3LPaxmHKxFdv7VOQHJ', // Liam, male, American-rendered Spanish, sourced 2026-04-22
    // TODO: expand with a verified Castilian vs Latin American split when
    // ElevenLabs exposes explicit regional Spanish voices.
  ],
  fr: [
    'XB0fDUnXU5powFXDhCwa', // Charlotte, female, neutral French, sourced 2026-04-22 (shipping voice, index 0)
    'pFZP5JQG7iQjIQuC4Bku', // Lily, female, softer register, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, clear diction, sourced 2026-04-22
    'TxGEqnHWrfWFTfGW9XjX', // Josh, male, warmer tone, sourced 2026-04-22
  ],
  de: [
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, neutral German, sourced 2026-04-22 (shipping voice, index 0)
    'XrExE9yKIg1WjnnlVkGX', // Matilda, female, warm German, sourced 2026-04-22
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, clear, sourced 2026-04-22
    'VR6AewLTigWG4xSOukaG', // Arnold, male, deeper register, sourced 2026-04-22
  ],
  it: [
    'XrExE9yKIg1WjnnlVkGX', // Matilda, female, neutral Italian, sourced 2026-04-22 (shipping voice, index 0)
    'pFZP5JQG7iQjIQuC4Bku', // Lily, female, softer, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, clear, sourced 2026-04-22
    'TxGEqnHWrfWFTfGW9XjX', // Josh, male, warm, sourced 2026-04-22
  ],
  pt: [
    'jsCqWAovK2LkecY7zXl4', // Freya, female, Brazilian-leaning, sourced 2026-04-22 (shipping voice, index 0)
    'XrExE9yKIg1WjnnlVkGX', // Matilda, female, alt register, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, clear, sourced 2026-04-22
    'TxGEqnHWrfWFTfGW9XjX', // Josh, male, warm, sourced 2026-04-22
    // TODO: add verified Continental Portuguese voice once ElevenLabs exposes
    // a pt-PT tagged voice in the public library.
  ],
  ja: [
    'Xb7hH8MSUJpSbSDYk0k2', // Alice, female, neutral, sourced 2026-04-22 (shipping voice, index 0)
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, softer, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, clear diction, sourced 2026-04-22
    'VR6AewLTigWG4xSOukaG', // Arnold, male, deeper register, sourced 2026-04-22
    // Note: Japanese rendering via multilingual models; pronunciation QA
    // recommended before promoting any voice here to a regional default.
  ],
  ko: [
    'pqHfZKP75CvOlQylNhV4', // Bill, male, clear, sourced 2026-04-22 (shipping voice, index 0)
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, alt register, sourced 2026-04-22
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, clear, sourced 2026-04-22
    'XrExE9yKIg1WjnnlVkGX', // Matilda, female, warmer, sourced 2026-04-22
    // TODO: expand when ElevenLabs adds verified native Korean voices.
  ],
  zh: [
    'FGY2WhTYpPnrIDTdsKH5', // Laura, female, neutral, sourced 2026-04-22 (shipping voice, index 0)
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, alt register, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, clear, sourced 2026-04-22
    'VR6AewLTigWG4xSOukaG', // Arnold, male, deeper, sourced 2026-04-22
    // TODO: expand when ElevenLabs adds native Mandarin voices with verified
    // tonal accuracy (currently rendered via multilingual model).
  ],
  en: [
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, American, sourced 2026-04-22 (shipping voice, index 0)
    '21m00Tcm4TlvDq8ikWAM', // Rachel, female, calm American, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, British, sourced 2026-04-22
    'TxGEqnHWrfWFTfGW9XjX', // Josh, male, American, sourced 2026-04-22
  ],
  ar: [
    'TX3LPaxmHKxFdv7VOQHJ', // Liam, male, sourced 2026-04-22 (shipping voice, index 0)
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, alt register, sourced 2026-04-22
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, sourced 2026-04-22
    'XrExE9yKIg1WjnnlVkGX', // Matilda, female, warmer, sourced 2026-04-22
    // TODO: expand when ElevenLabs adds verified native Arabic voices
    // (currently rendered via multilingual model; regional accents unclear).
  ],
  hi: [
    '9BWtsMINqrJLrRacOk9x', // Aria, female, sourced 2026-04-22 (shipping voice, index 0)
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, alt register, sourced 2026-04-22
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, clear, sourced 2026-04-22
    'TxGEqnHWrfWFTfGW9XjX', // Josh, male, warmer, sourced 2026-04-22
    // TODO: expand when ElevenLabs adds verified native Hindi voices.
  ],
  ru: [
    'CwhRBWXzGAHq8TQ4Fs17', // Roger, male, sourced 2026-04-22 (shipping voice, index 0)
    'onwK4e9ZLuTAKqWW03F9', // Daniel, male, alt register, sourced 2026-04-22
    'EXAVITQu4vr4xnSDxMaL', // Sarah, female, sourced 2026-04-22
    'XrExE9yKIg1WjnnlVkGX', // Matilda, female, warmer, sourced 2026-04-22
    // TODO: expand when ElevenLabs adds verified native Russian voices.
  ],
};

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

type VoiceMode = 'default' | 'rotate' | 'random';

/** Simple deterministic hash → non-negative integer. Used only for picking a
 *  voice when the client didn't provide a stable rotation key; not a
 *  cryptographic primitive. */
function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Resolve the voice ID for a request given the optional voice selector
 *  parameters. Falls back to VOICE_MAP[language][0] or DEFAULT_VOICE_ID. */
function resolveVoiceId(
  language: string,
  text: string,
  opts: { voiceIndex?: number; voiceMode?: VoiceMode; voiceRotationKey?: string }
): string {
  const voices = VOICE_MAP[language];
  if (!voices || voices.length === 0) return DEFAULT_VOICE_ID;

  const { voiceIndex, voiceMode, voiceRotationKey } = opts;

  // voiceMode overrides voiceIndex when present.
  if (voiceMode === 'random') {
    const r = Math.floor(Math.random() * voices.length);
    return voices[r];
  }
  if (voiceMode === 'rotate') {
    const key = voiceRotationKey ?? String(text.length);
    const idx = simpleHash(key) % voices.length;
    return voices[idx];
  }
  if (voiceMode === 'default') {
    return voices[0];
  }

  // No voiceMode — honor voiceIndex if provided, otherwise default to [0].
  if (typeof voiceIndex === 'number') {
    if (voiceIndex < 0 || voiceIndex >= voices.length) {
      console.warn(
        `[tts] voiceIndex ${voiceIndex} out of range for language '${language}' (have ${voices.length} voices); clamping.`
      );
    }
    const clamped = Math.max(0, Math.min(voices.length - 1, Math.floor(voiceIndex)));
    return voices[clamped];
  }

  return voices[0];
}

const PLAN_LIMITS: Record<string, { dailyVoiceMinutes: number | 'unlimited' }> = {
  starter:   { dailyVoiceMinutes: 5 },
  basic:     { dailyVoiceMinutes: 10 },
  premium:   { dailyVoiceMinutes: 20 },
  vip:       { dailyVoiceMinutes: 30 },
};

interface TTSRequest {
  text: string;
  language: string;
  userId?: string;
  /** 0-based index into VOICE_MAP[language]. Out-of-range values are clamped
   *  and a warning is logged. Ignored when `voiceMode` is provided. */
  voiceIndex?: number;
  /** Selection mode. 'default' → index 0 (backward compatible). 'rotate' →
   *  deterministic pick via `voiceRotationKey` (falls back to text.length).
   *  'random' → uniform random pick over available voices. */
  voiceMode?: VoiceMode;
  /** Stable key for 'rotate' mode so the same learner + same repetition
   *  slot deterministically gets the same voice on retry. */
  voiceRotationKey?: string;
}

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

/** Storage bucket for content-addressed TTS audio (migration 038). */
const TTS_BUCKET = 'tts-cache';

/** Cost control: longest legitimate inputs are chat replies / story paragraphs. */
const MAX_TTS_CHARS = 2000;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < uint8.length; i += CHUNK) {
    binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function getUserTier(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .single();

  if (data?.is_active && data.tier) return data.tier;
  return 'starter';
}

async function getVoiceMinutesUsed(supabase: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const date = todayUTC();
  const { data } = await supabase
    .from('daily_usage')
    .select('voice_minutes')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  return data?.voice_minutes ?? 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // Verify authentication
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const authenticatedUserId = authUser.userId;

    const { text, language, voiceIndex, voiceMode, voiceRotationKey } =
      (await req.json()) as TTSRequest;

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ELEVENLABS_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!text || text.length === 0) {
      return new Response(
        JSON.stringify({ error: 'text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cost control: cap input length (longest legit inputs are chat replies
    // and story paragraphs; anything bigger is abuse or a client bug).
    if (text.length > MAX_TTS_CHARS) {
      return new Response(
        JSON.stringify({ error: `text exceeds maximum length of ${MAX_TTS_CHARS} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const voiceId = resolveVoiceId(language, text, {
      voiceIndex,
      voiceMode,
      voiceRotationKey,
    });

    const cleanText = text.replace(/\*\*/g, '').trim();

    // ── Cache lookup: content-addressed by voice + language + text ──
    // Cache hits cost nothing, so they bypass quota and burst limits.
    const cachePath = `${await sha256Hex(`${voiceId}|${language}|${cleanText}`)}.mp3`;
    const { data: cachedFile } = await supabase.storage.from(TTS_BUCKET).download(cachePath);
    if (cachedFile) {
      const base64 = bufferToBase64(await cachedFile.arrayBuffer());
      return new Response(JSON.stringify({ audioBase64: base64, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Burst limit: max 30 generations per user per minute ──
    const burstOk = await checkBurstLimit(supabase, authenticatedUserId, 'tts', 30, 60);
    if (!burstOk) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Daily voice minute limit ──
    const tier = await getUserTier(supabase, authenticatedUserId);
    const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.starter;

    if (limits.dailyVoiceMinutes !== 'unlimited') {
      const used = await getVoiceMinutesUsed(supabase, authenticatedUserId);
      if (used >= limits.dailyVoiceMinutes) {
        return new Response(
          JSON.stringify({
            error: "You've reached your daily voice limit. Upgrade your plan for more.",
            code: 'DAILY_VOICE_LIMIT_REACHED',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = bufferToBase64(audioBuffer);

    // Store in cache (best-effort — response does not depend on it).
    const upload = await supabase.storage
      .from(TTS_BUCKET)
      .upload(cachePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
    if (upload.error) {
      console.warn('[tts] cache upload failed:', upload.error.message);
    }

    // Increment voice_minutes usage after successful TTS generation.
    await supabase.rpc('increment_daily_usage', {
      p_user_id: authenticatedUserId,
      p_date: new Date().toISOString().split('T')[0],
      p_text_messages: 0,
      p_voice_minutes: 1,
    }).then(({ error }) => {
      if (error) console.error('[tts] Failed to increment voice_minutes:', error.message);
    });

    return new Response(JSON.stringify({ audioBase64: base64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
