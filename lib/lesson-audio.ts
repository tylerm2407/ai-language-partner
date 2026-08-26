/**
 * The single entry point for lesson listening audio.
 *
 * Before this existed, each exercise component held its synthesised clip in
 * local state and lost it on unmount, so every Previous/Next round trip
 * re-hit the network for a word the learner had already heard. That got worse
 * once a wrong answer started remounting the exercise for a second attempt,
 * which guarantees the unmount.
 *
 * So lesson clips go through the on-device file cache the hands-free session
 * already uses. Three consequences worth stating plainly:
 *   - a replay is instant, free, and works with no connection;
 *   - it costs no lesson-audio allowance, because nothing is requested;
 *   - the next exercise can be warmed ahead of the learner cheaply.
 */
import { getTextToSpeech, VoiceError } from './ai';
import { getCachedTts, putCachedTts, ttsCacheKey } from './tts-cache';

/**
 * Device-cache namespace for lesson clips.
 *
 * Deliberately not shared with hands-free: the two are now synthesised with
 * different parameters, and a clip rendered for a conversation must not be
 * served as a vocabulary prompt.
 */
const LESSON_VOICE_KEY = 'lesson';

/** The rate the "slower" affordance asks for. Mirrors SLOW_RATE on the server. */
export const LESSON_SLOW_RATE = 0.75;

/** Normal speed — no rate is sent, so the clip keeps the canonical cache path. */
export const LESSON_NORMAL_RATE = 1;

export interface LessonAudioRequest {
  text: string;
  language: string;
  userId?: string;
  /** Omit (or pass 1) for the canonical rendering. */
  rate?: number;
}

/**
 * A playable URI for a lesson prompt — a cached file when we have one, a
 * freshly synthesised clip otherwise.
 *
 * Always requests `voiceIndex: 0` and never a voice gender. Index 0 is the
 * documented shipping voice for each language, so every learner shares one
 * cached object per word server-side — vocabulary prompts are the most
 * cacheable content in the app, and splitting that cache by a per-learner
 * gender preference would halve the hit rate for no pedagogical gain. Voice
 * variability, which the pronunciation research does want, lives in the
 * separate replay path (usePhonemeDrill) where it is the point.
 *
 * Throws whatever `getTextToSpeech` throws — quota exhaustion in particular
 * arrives as a VoiceError with code 'DAILY_LIMIT' and must reach the UI.
 */
export async function getLessonAudioUri(req: LessonAudioRequest): Promise<string> {
  const rate = req.rate ?? LESSON_NORMAL_RATE;
  const key = ttsCacheKey(req.text, req.language, LESSON_VOICE_KEY, rate);

  const cached = getCachedTts(key);
  if (cached) return cached;

  const base64 = await getTextToSpeech(req.text, req.language, req.userId, {
    purpose: 'lesson',
    voiceIndex: 0,
    ...(rate === LESSON_NORMAL_RATE ? {} : { rate }),
  });

  // A cache write failure is not a playback failure — fall back to the data
  // URI so the learner still hears the word.
  return putCachedTts(key, base64) ?? `data:audio/mpeg;base64,${base64}`;
}

/**
 * Warm a clip without playing it. Returns true when the clip is now available
 * locally. Never throws: a failed warm must be invisible, because the learner
 * did not ask for it and the real request will surface its own error.
 */
export async function warmLessonAudio(req: LessonAudioRequest): Promise<boolean> {
  try {
    await getLessonAudioUri(req);
    return true;
  } catch (err) {
    if (err instanceof VoiceError && err.code === 'DAILY_LIMIT') throw err;
    return false;
  }
}
