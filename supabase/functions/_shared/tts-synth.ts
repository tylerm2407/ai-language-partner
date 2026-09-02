// Speech synthesis for pre-rendered, SHARED audio.
//
// Extracted so the checkpoint's listening items and the audiobook reader can
// use one implementation rather than two. It is deliberately NOT the `tts`
// function's path: that one serves a single learner a single phrase against a
// per-user quota, whereas everything here is rendered once and served to
// everyone, so it is metered by how much content exists rather than by who
// listens.
//
// Voice selection reuses news-audio/voices.ts — the same narrator a language
// already reads its news in should read its books and its checkpoints, or a
// learner hears three different people claiming to be the same language.
//
// fish.audio first, ElevenLabs as the floor. Note that ElevenLabs is currently
// dead in production (the stored key is an API key ID, not an `sk_` key), so
// in practice a language with no fish voice cannot be narrated at all today —
// the caller gets an error rather than silence.

import { PROVIDER_TIMEOUT_MS, providerFetch } from './provider-fetch.ts';
import {
  parseChatVoiceMap,
  parseNewsVoiceMap,
  resolveNarrator,
  type Narrator,
} from '../news-audio/voices.ts';

const FISH_API_KEY = Deno.env.get('FISH_KEY');
const ELEVENLABS_KEY = Deno.env.get('ELEVENLABS_KEY');

const FISH_NEWS_VOICE_MAP = parseNewsVoiceMap(Deno.env.get('FISH_NEWS_VOICE_MAP'));
const FISH_VOICE_MAP = parseChatVoiceMap(Deno.env.get('FISH_VOICE_MAP'));

/** Longest text one synthesis call may carry. fish bills per UTF-8 BYTE, and
 *  CJK runs ~3 bytes a character, so this is a spend guard as much as a
 *  request-size one. */
export const MAX_SYNTH_CHARS = 4000;

export class SynthesisError extends Error {
  readonly provider: string;
  constructor(provider: string, message: string) {
    super(message);
    this.name = 'SynthesisError';
    this.provider = provider;
  }
}

export function narratorFor(language: string): Narrator {
  return resolveNarrator({
    language,
    newsMap: FISH_NEWS_VOICE_MAP,
    chatMap: FISH_VOICE_MAP,
    fishEnabled: Boolean(FISH_API_KEY),
  });
}

async function synthesizeWithFish(voiceId: string, text: string): Promise<ArrayBuffer> {
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
        reference_id: voiceId,
        format: 'mp3',
        // Nobody is waiting on pre-rendered audio, so there is no reason to
        // trade fidelity for turnaround — and prosody drift over a long read
        // is exactly what the faster setting costs.
        latency: 'normal',
      }),
    },
    { provider: 'fish.audio', timeoutMs: PROVIDER_TIMEOUT_MS.narration },
  );
  if (!response.ok) {
    throw new SynthesisError('fish', `fish.audio ${response.status}: ${await response.text()}`);
  }
  return response.arrayBuffer();
}

async function synthesizeWithElevenLabs(voiceId: string, text: string): Promise<ArrayBuffer> {
  if (!ELEVENLABS_KEY) {
    throw new SynthesisError('elevenlabs', 'ELEVENLABS_KEY not configured');
  }
  const response = await providerFetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_KEY,
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    },
    { provider: 'elevenlabs', timeoutMs: PROVIDER_TIMEOUT_MS.narration },
  );
  if (!response.ok) {
    throw new SynthesisError('elevenlabs', `elevenlabs ${response.status}: ${await response.text()}`);
  }
  return response.arrayBuffer();
}

export interface SynthesisResult {
  audio: ArrayBuffer;
  provider: string;
  voiceId: string;
}

/**
 * Render text to MP3 bytes, failing over from fish to ElevenLabs.
 *
 * Throws rather than returning empty audio: a zero-byte MP3 uploaded to a
 * bucket is a track that exists, plays nothing, and looks like a content bug
 * forever. The caller must be able to tell it did not happen.
 */
export async function synthesizeSpeech(
  text: string,
  language: string,
): Promise<SynthesisResult> {
  const trimmed = text.trim().slice(0, MAX_SYNTH_CHARS);
  if (!trimmed) throw new SynthesisError('none', 'nothing to synthesise');

  const narrator = narratorFor(language);

  if (narrator.provider === 'fish') {
    try {
      const audio = await synthesizeWithFish(narrator.voiceId, trimmed);
      if (audio.byteLength > 0) {
        return { audio, provider: 'fish', voiceId: narrator.voiceId };
      }
      throw new SynthesisError('fish', 'empty audio');
    } catch (err) {
      console.warn('[tts-synth] fish failed, trying elevenlabs:', (err as Error).message);
    }
  }

  const fallback = resolveNarrator({
    language,
    newsMap: {},
    chatMap: {},
    fishEnabled: false,
  });
  const audio = await synthesizeWithElevenLabs(fallback.voiceId, trimmed);
  if (audio.byteLength === 0) throw new SynthesisError('elevenlabs', 'empty audio');
  return { audio, provider: 'elevenlabs', voiceId: fallback.voiceId };
}
