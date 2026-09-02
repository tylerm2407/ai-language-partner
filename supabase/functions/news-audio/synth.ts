// Rendering a `daily_news` row into a narrated MP3 in the private
// `news-audio` bucket.
//
// Shared by BOTH entry points — the user-facing news-audio function (lazy
// fallback path) and daily-news-audio-cron (the normal path) — so the two
// can never drift on how a narration is produced, and so each index.ts stays
// well under 500 lines.
//
// Secrets: FISH_KEY + FISH_VOICE_MAP (the voices chat already uses),
// FISH_NEWS_VOICE_MAP (optional editorial override), ELEVENLABS_KEY (last
// resort). Narrator resolution and the defensive parsing of both fish maps
// live in ./voices.ts, which is pure and therefore tested.
//
// The short version: a language narrates on the fish voice chat already
// uses for it, deterministically (so the feed does not change reader day to
// day), and falls back to ElevenLabs only when fish has nothing. Reusing the
// populated chat secret rather than standing up a second one is the whole
// reason this works today — and ElevenLabs is currently broken in prod (the
// key is an API key ID, not an `sk_` key), so a language with no fish voice
// fails outright. NARRATOR_COVERAGE below reports which those are.

import {
  buildNarrationScript,
  didSplit,
  estimateDurationMs,
  MAX_NEWS_TOTAL_CHARS,
  splitForSynthesis,
} from './script.ts';
import { parseMp3DurationMs } from '../_shared/mp3-duration.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import {
  ELEVEN_NEWS_VOICES,
  DEFAULT_ELEVEN_VOICE,
  narratorCoverage,
  parseChatVoiceMap,
  parseNewsVoiceMap,
  resolveNarrator,
} from './voices.ts';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_KEY');
const FISH_API_KEY = Deno.env.get('FISH_KEY');

export const NEWS_AUDIO_BUCKET = 'news-audio';

/** How long a minted playback URL stays valid. Long enough to listen to a
 *  4-minute article twice without a refetch; short enough that a leaked URL
 *  is worthless by the time anyone finds it. */
export const SIGNED_URL_TTL_SECONDS = 1800;

export type NewsAudioProvider = 'fish' | 'elevenlabs';

/** Parsed once at module load. The raw secrets are read here and the
 *  parsing lives in ./voices.ts, which takes strings and therefore tests
 *  without a runtime. Both degrade to {} rather than throwing — see there. */
const FISH_NEWS_VOICE_MAP = parseNewsVoiceMap(Deno.env.get('FISH_NEWS_VOICE_MAP'));
const FISH_VOICE_MAP = parseChatVoiceMap(Deno.env.get('FISH_VOICE_MAP'));

/** Which provider each publishable language resolves to, computed once so
 *  the cron can report coverage without re-deriving it. Providers only,
 *  never voice ids — this reaches an HTTP response and a log line. */
export const NARRATOR_COVERAGE = narratorCoverage({
  newsMap: FISH_NEWS_VOICE_MAP,
  chatMap: FISH_VOICE_MAP,
  fishEnabled: Boolean(FISH_API_KEY),
});

/** Narration profile for ElevenLabs.
 *
 *  `eleven_multilingual_v2`, not the `eleven_flash_v2_5` that chat uses: a
 *  pre-rendered narration has no latency budget to protect, and flash is the
 *  distilled latency-optimised model. High stability and zero style because
 *  a news reader should be even — expressive variation across 250 words
 *  reads as a model losing the thread, not as personality. */
const ELEVEN_NEWS_PROFILE = {
  model_id: 'eleven_multilingual_v2',
  stability: 0.6,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true,
};

/** The subset of a `daily_news` row this module needs. */
export interface NewsRow {
  id: string;
  date: string;
  language: string;
  title: string;
  summary: string;
  content: string;
}

export interface RenderResult {
  audioPath: string;
  durationMs: number;
  voiceId: string;
  provider: NewsAudioProvider;
}

/** Thrown for conditions the caller should record as `failed` rather than
 *  retry forever — a script over the hard cap, no provider configured. */
export class NewsAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsAudioError';
  }
}

async function synthesizeWithFish(referenceId: string, text: string): Promise<ArrayBuffer> {
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
        // 'normal', not the 'balanced' chat uses. Nobody is waiting on a
        // pre-rendered narration, so there is no reason to trade fidelity for
        // turnaround — and prosody drift over a long read is exactly what the
        // faster setting costs.
        latency: 'normal',
      }),
    },
    { provider: 'fish.audio', timeoutMs: PROVIDER_TIMEOUT_MS.narration },
  );
  if (!response.ok) {
    throw new Error(`fish.audio API error: ${response.status} - ${await response.text()}`);
  }
  return await response.arrayBuffer();
}

async function synthesizeWithElevenLabs(voiceId: string, text: string): Promise<ArrayBuffer> {
  const { model_id, ...voice_settings } = ELEVEN_NEWS_PROFILE;
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
    { provider: 'elevenlabs', timeoutMs: PROVIDER_TIMEOUT_MS.narration },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status} - ${await response.text()}`);
  }
  return await response.arrayBuffer();
}

/** Concatenate MP3 chunks byte-wise.
 *
 *  Only reachable through the dormant splitter (see ./script.ts), and only
 *  approximately correct: naively joining two independently-encoded MP3s
 *  leaves encoder-delay padding at the seam, audible as a short gap. That is
 *  acceptable for a safety valve that has never fired on real data, and is
 *  loudly logged when it does — but it is not a design anyone should extend
 *  to a routine multi-chunk path without re-encoding. */
function concatBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const buffer of buffers) {
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return merged.buffer;
}

/** Where an article's narration lives.
 *
 *  Date-prefixed so the 30-day sweep can enumerate whole days and delete
 *  them, instead of listing a flat bucket that grows by 18 objects a day
 *  forever and paging through it to read every object's created_at. */
export function audioPathFor(row: Pick<NewsRow, 'id' | 'date'>): string {
  return `${row.date}/${row.id}.mp3`;
}

/**
 * Render one article to MP3, upload it, and stamp the row `ready`.
 *
 * fish.audio first when the language has a vetted narrator, ElevenLabs
 * otherwise and on any fish failure. The failover is silent by design: an
 * article that narrates on the backup voice is strictly better than one that
 * does not narrate, and the provider actually used is recorded on the row so
 * a quality complaint can be traced to a voice.
 *
 * Throws on failure. The caller owns marking the row `failed` — this
 * function does not, because the two callers want different retry
 * behaviour (the cron leaves it for tomorrow, the lazy path surfaces an
 * error to a person who is waiting).
 */
export async function renderNewsAudio(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  row: NewsRow,
): Promise<RenderResult> {
  const script = buildNarrationScript(row);
  if (script.length === 0) {
    throw new NewsAudioError(`article ${row.id} has no narratable text`);
  }
  if (script.length > MAX_NEWS_TOTAL_CHARS) {
    // Fail loudly rather than synthesise it. Past this length something
    // upstream has changed and the bill is unbounded; a missing podcast is
    // a recoverable problem, an unbounded spend is not.
    throw new NewsAudioError(
      `article ${row.id} script is ${script.length} chars, over the ${MAX_NEWS_TOTAL_CHARS} hard cap`,
    );
  }

  const chunks = splitForSynthesis(script);
  if (didSplit(chunks)) {
    // The single-pass assumption just expired. This has never happened on
    // real data; if it starts happening, the 3,000-char cap needs revisiting
    // and the seam-gap caveat on concatBuffers is now shipping to listeners.
    console.warn(
      `[news-audio] SPLITTER ENGAGED — article ${row.id} (${row.language}) script is ${script.length} chars, split into ${chunks.length} chunks. The single-pass assumption no longer holds; revisit MAX_NEWS_SCRIPT_CHARS.`,
    );
  }

  // Editorial fish voice → the fish voice chat already uses → ElevenLabs.
  // See ./voices.ts for why step 2 is what actually carries this today.
  const narrator = resolveNarrator({
    language: row.language,
    newsMap: FISH_NEWS_VOICE_MAP,
    chatMap: FISH_VOICE_MAP,
    fishEnabled: Boolean(FISH_API_KEY),
  });
  const elevenVoice = ELEVEN_NEWS_VOICES[row.language] ?? DEFAULT_ELEVEN_VOICE;

  if (narrator.provider === 'elevenlabs' && !ELEVENLABS_API_KEY) {
    throw new NewsAudioError('no TTS provider configured (ELEVENLABS_KEY missing)');
  }

  let provider: NewsAudioProvider = narrator.provider;
  let voiceId = narrator.voiceId;
  let buffers: ArrayBuffer[];

  const synthesizeAll = (fn: (text: string) => Promise<ArrayBuffer>) =>
    // Serial, not Promise.all: chunking is the exceptional path, and one
    // article racing its own chunks against a per-key provider rate limit
    // would turn a rare event into a rare *failure*.
    chunks.reduce<Promise<ArrayBuffer[]>>(
      async (acc, chunk) => [...(await acc), await fn(chunk)],
      Promise.resolve([]),
    );

  if (provider === 'fish') {
    try {
      buffers = await synthesizeAll((text) => synthesizeWithFish(narrator.voiceId, text));
    } catch (fishError) {
      if (!ELEVENLABS_API_KEY) throw fishError;
      console.error(
        `[news-audio] fish.audio failed for ${row.language}, falling back to ElevenLabs:`,
        fishError,
      );
      provider = 'elevenlabs';
      voiceId = elevenVoice;
      buffers = await synthesizeAll((text) => synthesizeWithElevenLabs(elevenVoice, text));
    }
  } else {
    buffers = await synthesizeAll((text) => synthesizeWithElevenLabs(elevenVoice, text));
  }

  const audio = buffers.length === 1 ? buffers[0] : concatBuffers(buffers);

  // Measure the real file; estimate only when the bytes cannot be read.
  const durationMs = parseMp3DurationMs(audio) ?? estimateDurationMs(script);

  const audioPath = audioPathFor(row);
  // upsert so a re-render (a reclaimed stale claim, a manual retry) replaces
  // the object instead of colliding with its own previous attempt.
  const { error: uploadError } = await supabase.storage
    .from(NEWS_AUDIO_BUCKET)
    .upload(audioPath, audio, { contentType: 'audio/mpeg', upsert: true });
  if (uploadError) {
    throw new Error(`storage upload failed: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from('daily_news')
    .update({
      audio_path: audioPath,
      audio_duration_ms: durationMs,
      audio_voice_id: voiceId,
      audio_provider: provider,
      audio_generated_at: new Date().toISOString(),
      audio_status: 'ready',
    })
    .eq('id', row.id);
  if (updateError) {
    // The object is uploaded but the row does not point at it. Surfacing
    // this rather than swallowing it matters: the row stays 'generating',
    // the stale-claim clause reclaims it in five minutes, and the upsert
    // above makes the re-render harmless.
    throw new Error(`row update failed: ${updateError.message}`);
  }

  return { audioPath, durationMs, voiceId, provider };
}

/**
 * Mint a short-lived playback URL for an already-rendered narration.
 *
 * NEW PRECEDENT IN THIS CODEBASE, flagged deliberately: every other audio
 * path in the app returns base64 JSON from the edge function (see
 * ../tts/index.ts). News audio is 1–3 MB, which is 4 MB of base64 buffered
 * in function memory and again in JS on the device — so this returns a URL
 * and lets the platform stream the bytes. The bucket stays private and the
 * URL expires, so the object is no more public than before; what changed is
 * only who moves the bytes.
 *
 * Returns null when the object is missing, which is a real state: the row
 * can say `ready` while the 30-day sweep has already deleted the file.
 */
export async function signNewsAudioUrl(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  audioPath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(NEWS_AUDIO_BUCKET)
    .createSignedUrl(audioPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn(`[news-audio] could not sign ${audioPath}:`, error?.message ?? 'no url returned');
    return null;
  }
  return data.signedUrl as string;
}
