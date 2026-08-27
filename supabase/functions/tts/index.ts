// Supabase Edge Function: Text-to-Speech
// Proxies TTS requests to a provider and returns base64 JSON.
//
// Two providers: ElevenLabs (default) and fish.audio (~8x cheaper per
// character). fish is used only for languages explicitly listed in the
// FISH_VOICE_MAP secret, and falls back to ElevenLabs if the call fails.
// That opt-in-per-language shape is deliberate: this app teaches pronunciation,
// so a voice ships only after someone has listened to it in that language.
//
// Synthesis parameters depend on what the audio is FOR, not just who asked:
// chat keeps the fast expressive settings it has always used, while lesson
// audio (a single word, prefetched, nobody waiting) buys fidelity with the
// latency it does not need. See ./synthesis.ts — including why the lesson
// cache path is versioned and the chat one must never move.
//
// Secrets: ELEVENLABS_KEY (required), FISH_KEY + FISH_VOICE_MAP (optional).
// FISH_VOICE_MAP is JSON: {"es":["<reference_id>", ...], "fr":[...]}
//
// Deploy: npx supabase functions deploy tts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { getPlanLimits } from '../_shared/plan-limits.ts';
import { getUserToday } from '../_shared/user-day.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import {
  asCitationForm,
  cachePathFor,
  clampRate,
  DEFAULT_RATE,
  ELEVEN_PROFILES,
  type SpeechPurpose,
} from './synthesis.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_KEY');
const FISH_API_KEY = Deno.env.get('FISH_KEY');

type TTSProvider = 'elevenlabs' | 'fish';
export type VoiceGender = 'male' | 'female';

const GENDERS: VoiceGender[] = ['male', 'female'];

/** Per-language, per-gender fish.audio reference_ids, opt-in via the
 *  FISH_VOICE_MAP secret:
 *    {"es": {"male": ["<id>"], "female": ["<id>", "<id>"]}}
 *  A malformed value must not take voice down, so it degrades to "no fish"
 *  and every request falls through to ElevenLabs. */
const FISH_VOICE_MAP: Record<string, Partial<Record<VoiceGender, string[]>>> = (() => {
  const raw = Deno.env.get('FISH_VOICE_MAP');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[tts] FISH_VOICE_MAP must be a JSON object; ignoring.');
      return {};
    }
    const map: Record<string, Partial<Record<VoiceGender, string[]>>> = {};
    for (const [lang, byGender] of Object.entries(parsed)) {
      if (!byGender || typeof byGender !== 'object' || Array.isArray(byGender)) {
        console.error(`[tts] FISH_VOICE_MAP.${lang} must be {male:[],female:[]}; skipping.`);
        continue;
      }
      const entry: Partial<Record<VoiceGender, string[]>> = {};
      for (const gender of GENDERS) {
        const ids = (byGender as Record<string, unknown>)[gender];
        const valid = Array.isArray(ids)
          ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : [];
        if (valid.length > 0) entry[gender] = valid;
      }
      if (Object.keys(entry).length > 0) map[lang] = entry;
    }
    return map;
  } catch (err) {
    console.error('[tts] FISH_VOICE_MAP is not valid JSON; ignoring.', err);
    return {};
  }
})();

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

/** Gender of each ElevenLabs voice used in VOICE_MAP above, so the learner's
 *  male/female preference works on the ElevenLabs path too — including the
 *  languages where fish has no vetted voice for the requested gender.
 *  Keyed by id rather than restructuring VOICE_MAP, because the same voices
 *  recur across languages and the HVPT rotation ordering matters. */
const ELEVENLABS_VOICE_GENDER: Record<string, VoiceGender> = {
  '21m00Tcm4TlvDq8ikWAM': 'female', // Rachel
  '9BWtsMINqrJLrRacOk9x': 'female', // Aria
  CwhRBWXzGAHq8TQ4Fs17: 'male', // Roger
  EXAVITQu4vr4xnSDxMaL: 'female', // Sarah
  FGY2WhTYpPnrIDTdsKH5: 'female', // Laura
  jsCqWAovK2LkecY7zXl4: 'female', // Freya
  onwK4e9ZLuTAKqWW03F9: 'male', // Daniel
  pFZP5JQG7iQjIQuC4Bku: 'female', // Lily
  pqHfZKP75CvOlQylNhV4: 'male', // Bill
  TX3LPaxmHKxFdv7VOQHJ: 'male', // Liam
  TxGEqnHWrfWFTfGW9XjX: 'male', // Josh
  VR6AewLTigWG4xSOukaG: 'male', // Arnold
  XB0fDUnXU5powFXDhCwa: 'female', // Charlotte
  Xb7hH8MSUJpSbSDYk0k2: 'female', // Alice
  XrExE9yKIg1WjnnlVkGX: 'female', // Matilda
};

/** ElevenLabs voices for a language, narrowed to the requested gender.
 *  Falls back to the full list when the language has none of that gender, so a
 *  preference never leaves the learner with no voice at all. */
function elevenLabsVoices(language: string, gender?: VoiceGender): string[] | undefined {
  const all = VOICE_MAP[language];
  if (!all || !gender) return all;
  const matching = all.filter((id) => ELEVENLABS_VOICE_GENDER[id] === gender);
  return matching.length > 0 ? matching : all;
}

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
 *  parameters. `voices` is the provider's voice list for the language; an empty
 *  one falls back to DEFAULT_VOICE_ID (an ElevenLabs id, so fish callers must
 *  check for a non-empty list before calling). */
function resolveVoiceId(
  voices: string[] | undefined,
  language: string,
  text: string,
  opts: { voiceIndex?: number; voiceMode?: VoiceMode; voiceRotationKey?: string }
): string {
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
  /** Learner's preferred tutor voice gender. Honoured per provider where a
   *  matching voice exists; otherwise the language's default voices are used. */
  voiceGender?: VoiceGender;
  /**
   * What the audio is for, which decides WHICH quota pays for it.
   *
   * 'lesson' — a listening/dictation exercise inside a lesson. Metered on
   *   `lesson_tts_plays` (migration 077), which the free tier has a small
   *   allowance of so its lessons are not silently broken.
   * 'voice' (default) — chat playback, voice practice, narration. Metered on
   *   `voice_minutes`, which the free tier has none of.
   *
   * Client-supplied and therefore NOT trusted as a claim about entitlement:
   * it selects between two counters that are both enforced here, and the
   * lesson allowance is the smaller one. The worst a caller can do by lying
   * is spend the wrong small bucket. */
  purpose?: 'lesson' | 'voice';
  /**
   * Playback rate for LESSON audio only, clamped server-side to [0.7, 1.0].
   *
   * This is the "play it slower" affordance, not a global speed control: a
   * learner who could not catch a word asks to hear it again, slower. Chat
   * ignores it — a tutor who slows down mid-conversation reads as broken.
   *
   * Client-supplied and clamped, so it widens the request but not the trust
   * surface: it selects a synthesis parameter and a cache namespace, both of
   * which are bounded here.
   */
  rate?: number;
}

/** Storage bucket for content-addressed TTS audio (migration 038). */
const TTS_BUCKET = 'tts-cache';

/** Cost control: longest legitimate inputs are chat replies / story paragraphs. */
const MAX_TTS_CHARS = 2000;

/** Generate speech with ElevenLabs. Throws on a non-2xx response.
 *
 *  The synthesis profile comes from `purpose` (see ./synthesis.ts): chat keeps
 *  the fast, expressive settings it has always used, while lesson audio buys
 *  fidelity with the latency it does not need. */
async function generateWithElevenLabs(
  voiceId: string,
  text: string,
  purpose: SpeechPurpose,
  rate: number,
): Promise<ArrayBuffer> {
  const profile = ELEVEN_PROFILES[purpose];
  const { model_id, ...voiceSettings } = profile;
  // Only send `speed` when it actually differs — not every model accepts the
  // field, and a rate the learner did not ask for is not worth a 422.
  const effectiveSpeed = purpose === 'lesson' ? rate * (profile.speed ?? 1) : undefined;
  const voice_settings =
    effectiveSpeed !== undefined && effectiveSpeed !== 1
      ? { ...voiceSettings, speed: Number(effectiveSpeed.toFixed(2)) }
      : (({ speed: _drop, ...rest }) => rest)(voiceSettings);

  const response = await providerFetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({ text, model_id, voice_settings }),
    },
    { provider: 'elevenlabs', timeoutMs: PROVIDER_TIMEOUT_MS.speech },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} - ${await response.text()}`);
  }
  return await response.arrayBuffer();
}

/** Generate speech with fish.audio. Throws on a non-2xx response. */
async function generateWithFish(
  referenceId: string,
  text: string,
  purpose: SpeechPurpose,
): Promise<ArrayBuffer> {
  const response = await providerFetch(
    'https://api.fish.audio/v1/tts',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FISH_API_KEY!}`,
        'model': 's2-pro',
      },
      body: JSON.stringify({
        text,
        reference_id: referenceId,
        format: 'mp3',
        // Chat streams, so conversational turnaround matters more than maximum
        // fidelity. A lesson clip is prefetched and nobody is waiting on it, so
        // there the trade inverts completely.
        latency: purpose === 'lesson' ? 'normal' : 'balanced',
      }),
    },
    { provider: 'fish.audio', timeoutMs: PROVIDER_TIMEOUT_MS.speech },
  );

  if (!response.ok) {
    throw new Error(`fish.audio API error: ${response.status} - ${await response.text()}`);
  }
  return await response.arrayBuffer();
}

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

// deno-lint-ignore no-explicit-any
async function getUserTier(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier, is_active')
    .eq('user_id', userId)
    .single();

  if (data?.is_active && data.tier) return data.tier;
  return 'starter';
}

/** `date` is the user's local day from getUserToday — must match the day
 *  key increment_daily_usage writes (migration 044). */
// deno-lint-ignore no-explicit-any
async function getVoiceMinutesUsed(supabase: any, userId: string, date: string): Promise<number> {
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

    const { text, language, voiceIndex, voiceMode, voiceRotationKey, voiceGender: rawGender, purpose: rawPurpose, rate: rawRate } =
      (await req.json()) as TTSRequest;
    // Anything but the explicit lesson marker meters as voice — the stricter
    // of the two buckets, so a malformed or missing value cannot widen access.
    const isLessonAudio = rawPurpose === 'lesson';
    const purpose: SpeechPurpose = isLessonAudio ? 'lesson' : 'voice';
    // Rate is a lesson affordance; chat always renders at the canonical speed.
    const rate = isLessonAudio ? clampRate(rawRate) : DEFAULT_RATE;
    const voiceGender = GENDERS.includes(rawGender as VoiceGender)
      ? (rawGender as VoiceGender)
      : undefined;

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

    const stripped = text.replace(/\*\*/g, '').trim();
    // A lesson prompt is usually one bare word, which has no prosodic target
    // without terminal punctuation. Applied BEFORE hashing, so the cache is
    // keyed on what was actually sent to the provider.
    const cleanText = isLessonAudio ? asCitationForm(stripped) : stripped;
    const voiceOpts = { voiceIndex, voiceMode, voiceRotationKey };

    // fish only handles languages it has vetted voices for, and only in the
    // genders it has them for — a learner who asked for a male tutor in a
    // language where fish has only a female voice goes to ElevenLabs rather
    // than silently getting the wrong voice.
    const fishForLanguage = FISH_API_KEY ? FISH_VOICE_MAP[language] : undefined;
    const fishVoices = fishForLanguage
      ? voiceGender
        ? fishForLanguage[voiceGender]
        : fishForLanguage.female ?? fishForLanguage.male
      : undefined;
    const provider: TTSProvider = fishVoices && fishVoices.length > 0 ? 'fish' : 'elevenlabs';
    const voiceId = resolveVoiceId(
      provider === 'fish' ? fishVoices : elevenLabsVoices(language, voiceGender),
      language,
      cleanText,
      voiceOpts
    );

    /** Cache is content-addressed by voice + language + text, namespaced per
     *  provider so the two renderings of the same line never collide.
     *  ElevenLabs deliberately keeps the original un-namespaced key so the
     *  existing tts-cache bucket stays warm across this change. */
    const cacheKeyFor = async (p: TTSProvider, v: string) => {
      const key = p === 'fish' ? `fish|${v}|${language}|${cleanText}` : `${v}|${language}|${cleanText}`;
      // The hash deliberately still carries no model and no voice settings —
      // changing it would orphan every object in the bucket. Parameter changes
      // are versioned by the PATH instead; see cachePathFor in ./synthesis.ts.
      return cachePathFor({ hash: await sha256Hex(key), purpose, rate });
    };
    const readCache = async (path: string): Promise<ArrayBuffer | null> => {
      const { data } = await supabase.storage.from(TTS_BUCKET).download(path);
      return data ? await data.arrayBuffer() : null;
    };

    // ── Cache lookup ── hits cost nothing, so they bypass quota and burst limits.
    let cachePath = await cacheKeyFor(provider, voiceId);
    const cached = await readCache(cachePath);
    if (cached) {
      return new Response(JSON.stringify({ audioBase64: bufferToBase64(cached), cached: true }), {
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

    // ── Daily limit ── which bucket pays depends on what the audio is for.
    const tier = await getUserTier(supabase, authenticatedUserId);
    const limits = getPlanLimits(tier);

    if (isLessonAudio) {
      // Lesson audio draws on `lesson_tts_plays`, not voice minutes, so the
      // free tier can hear its listening exercises without being handed chat
      // or voice-practice minutes it has not paid for.
      //
      // consume_daily_quota is a single atomic check-and-increment, unlike the
      // read-then-write below: the counter moves HERE, before generation, so
      // concurrent taps cannot all pass the check. That means a provider
      // failure costs the learner one play from their allowance — acceptable
      // for a 5/day bucket, and the alternative (checking now, incrementing
      // after) is the race this RPC exists to close.
      const { data: quotaOk, error: quotaErr } = await supabase.rpc('consume_daily_quota', {
        p_user_id: authenticatedUserId,
        p_counter: 'lesson_tts_plays',
        p_limit: limits.dailyLessonTtsPlays,
      });
      if (quotaErr) {
        // Fail closed. Broken quota accounting must not hand out unmetered
        // synthesis, which costs real money per call.
        console.error('[tts] consume_daily_quota failed:', quotaErr.message);
        return new Response(
          JSON.stringify({ error: 'Could not verify your daily limit. Try again shortly.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (quotaOk !== true) {
        return new Response(
          JSON.stringify({
            error: "You've used today's lesson audio. It resets tomorrow, or upgrade for more.",
            code: 'DAILY_LESSON_AUDIO_LIMIT_REACHED',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // dailyVoiceMinutes is always a finite number — no unlimited tier exists
      // (see _shared/plan-limits.ts), so the limit check is unconditional.
      // User-local day key (migration 044), fetched once and reused for the
      // usage increment after generation.
      const userDay = await getUserToday(supabase, authenticatedUserId);
      const used = await getVoiceMinutesUsed(supabase, authenticatedUserId, userDay);
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

    let audioBuffer: ArrayBuffer;
    if (provider === 'fish') {
      try {
        audioBuffer = await generateWithFish(voiceId, cleanText, purpose);
      } catch (fishError) {
        // Voice is a core surface — a fish outage must not silence the tutor.
        console.error('[tts] fish.audio failed, falling back to ElevenLabs:', fishError);
        const fallbackVoiceId = resolveVoiceId(
          elevenLabsVoices(language, voiceGender),
          language,
          cleanText,
          voiceOpts
        );
        cachePath = await cacheKeyFor('elevenlabs', fallbackVoiceId);

        // Check the fallback's own cache entry first: if fish is down for a
        // while, every request lands here and would otherwise re-bill ElevenLabs
        // for lines it has already rendered.
        const fallbackCached = await readCache(cachePath);
        if (fallbackCached) {
          return new Response(
            JSON.stringify({ audioBase64: bufferToBase64(fallbackCached), cached: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        audioBuffer = await generateWithElevenLabs(fallbackVoiceId, cleanText, purpose, rate);
      }
    } else {
      audioBuffer = await generateWithElevenLabs(voiceId, cleanText, purpose, rate);
    }

    const base64 = bufferToBase64(audioBuffer);

    // Store in cache (best-effort — response does not depend on it).
    const upload = await supabase.storage
      .from(TTS_BUCKET)
      .upload(cachePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
    if (upload.error) {
      console.warn('[tts] cache upload failed:', upload.error.message);
    }

    // Increment voice_minutes usage after successful TTS generation.
    //
    // Do NOT pass p_date. It used to be sent "for consistency" while the SQL
    // ignored it (migration 044 resolves the day from the user's timezone),
    // and that alone broke this call: prod carried three p_date overloads
    // whose every later parameter defaulted, so PostgREST could not pick one
    // and returned PGRST203 on every single synthesis. Voice minutes went
    // unmetered and the per-plan voice quota was never enforced. Migration
    // 076 collapsed the function to one signature, which takes no date.
    // Lesson audio already paid for itself above, atomically, in
    // `lesson_tts_plays`. Incrementing voice_minutes here as well would bill
    // one synthesis to two buckets and quietly drain a paid learner's voice
    // allowance every time they replayed an exercise.
    if (!isLessonAudio) {
      await supabase.rpc('increment_daily_usage', {
        p_user_id: authenticatedUserId,
        p_text_messages: 0,
        p_voice_minutes: 1,
      }).then(({ error }) => {
        if (error) console.error('[tts] Failed to increment voice_minutes:', error.message);
      });
    }

    return new Response(JSON.stringify({ audioBase64: base64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[tts] unhandled error:', message);
    return new Response(
      JSON.stringify({ error: 'Failed to generate audio. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
