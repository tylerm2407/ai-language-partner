// Pure synthesis parameters and cache-path derivation for the tts function.
//
// Split out of index.ts so it can be unit-tested without standing up serve():
// the cache-path rules in here decide whether the existing warm tts-cache
// bucket keeps paying for itself or is silently thrown away, which is the one
// thing in the TTS path that must not be got wrong by inspection.

/** What the audio is for. Selects both the synthesis profile and the quota. */
export type SpeechPurpose = 'lesson' | 'voice';

export interface ElevenLabsProfile {
  model_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost?: boolean;
  /** Not accepted by every ElevenLabs model; omitted when 1.0. */
  speed?: number;
}

/**
 * Synthesis profiles, keyed by what the audio is for.
 *
 * `voice` is the historical setting and must not change: it is what every
 * cached chat line in the bucket was rendered with, and it is the right trade
 * for a streamed reply where the learner is waiting on the first byte.
 *
 * `lesson` inverts every one of those trades, because a lesson clip is
 * prefetched and nobody is waiting on it:
 *   - `eleven_multilingual_v2` over `eleven_flash_v2_5` — flash is the distilled
 *     latency model, and a 0.6-second clip of a single word has nothing to hide
 *     its artefacts behind.
 *   - `stability` 0.85 and `style` 0 — a vocabulary item wants the canonical
 *     citation realisation, not an interpretation. Expressiveness is precisely
 *     what makes a lone word hard to transcribe by ear.
 *   - `speed` 0.9 — a learner hearing a word for the first time is not a
 *     native listener, and the model's default cadence is pitched at one.
 */
export const ELEVEN_PROFILES: Record<SpeechPurpose, ElevenLabsProfile> = {
  lesson: {
    model_id: 'eleven_multilingual_v2',
    stability: 0.85,
    similarity_boost: 0.85,
    style: 0.0,
    use_speaker_boost: true,
    speed: 0.9,
  },
  voice: {
    model_id: 'eleven_flash_v2_5',
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.3,
  },
};

/** Slowest and fastest a learner may ask a lesson clip to be rendered. */
export const MIN_RATE = 0.7;
export const MAX_RATE = 1.0;
export const DEFAULT_RATE = 1.0;

/** The "play it slower" rate the lesson UI requests. */
export const SLOW_RATE = 0.75;

/**
 * Clamp a client-supplied rate into the supported band. Anything unusable
 * (missing, NaN, non-finite) becomes the default rather than an error: rate is
 * a comfort control, and refusing to speak because it arrived malformed is a
 * worse outcome than speaking at normal speed.
 */
export function clampRate(rate: unknown): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return DEFAULT_RATE;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

/**
 * Give a bare word a sentence to end.
 *
 * Without terminal punctuation a lone token has no prosodic target, so the
 * model guesses between citation and mid-sentence intonation — which usually
 * means a clipped onset and a swallowed final consonant, the two things a
 * learner most needs to hear. One character fixes it.
 *
 * Deliberately not a carrier phrase ("The word is X"): that teaches the learner
 * to expect a frame that will not be there in the wild, and bills for it.
 */
export function asCitationForm(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  return /[.!?…。！？；;:,、，]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Bump when lesson synthesis parameters change audibly.
 *
 * This is a PATH PREFIX rather than a field inside the hashed key, and that is
 * load-bearing. Bucket keys are opaque sha256, so a version folded into the
 * hash leaves every superseded object unfindable — you could never sweep them.
 * A prefix makes the next invalidation a prefix delete instead of archaeology.
 */
export const LESSON_PROFILE_VERSION = 2;

/**
 * Where a rendered clip lives in the tts-cache bucket.
 *
 * Voice audio keeps the EXACT flat legacy path. That is the whole point: every
 * chat line already rendered stays warm and is never re-billed. Only lesson
 * audio moves under a versioned prefix, because only lesson audio changed
 * parameters — and it has to move, since the hashed key contains neither the
 * model nor the voice settings, so without this the fix would silently keep
 * serving the old muddy renderings forever.
 *
 * A non-default rate gets its own segment so a "slower" replay never collides
 * with the canonical rendering, while rate 1.0 adds no segment at all and keeps
 * the common case on one path.
 */
export function cachePathFor(opts: {
  hash: string;
  purpose: SpeechPurpose;
  rate?: number;
}): string {
  const { hash, purpose } = opts;
  if (purpose !== 'lesson') return `${hash}.mp3`;

  const rate = clampRate(opts.rate);
  const rateSegment = rate === DEFAULT_RATE ? '' : `r${String(Math.round(rate * 100)).padStart(3, '0')}/`;
  return `lesson/v${LESSON_PROFILE_VERSION}/${rateSegment}${hash}.mp3`;
}
