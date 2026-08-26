import { useEffect, useRef } from 'react';
import { VoiceError } from '../lib/ai';
import { warmLessonAudio } from '../lib/lesson-audio';
import type { Exercise } from '../types';

/** Exercise types whose prompt is spoken rather than shown. */
const AUDIO_TYPES = new Set(['listening_choice', 'listening_type', 'dictation']);

/**
 * Warm the NEXT listening exercise's audio while the learner works on the
 * current one, so tapping play feels instant.
 *
 * Deliberately one exercise ahead, not the whole lesson. Each warm spends a
 * unit of the daily lesson-audio allowance, which the free tier has only a
 * small amount of — prefetching ten clips up front would exhaust the day
 * before the learner reached question two, and most of those clips would never
 * be played. One speculative unit in flight buys the whole perceived benefit.
 *
 * Serial by construction (one clip at a time) because the TTS function caps
 * generations at 30 per user per minute.
 */
export function useLessonAudioPrewarm(opts: {
  exercises: readonly Exercise[];
  currentIndex: number;
  language?: string;
  userId?: string;
  /** Warm-up items are their own flow and are not prefetched. */
  enabled: boolean;
}): void {
  const { exercises, currentIndex, language, userId, enabled } = opts;
  // Once the allowance is gone it stays gone for the day, so stop firing
  // requests that can only be refused.
  const quotaExhaustedRef = useRef(false);
  const warmedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !language || quotaExhaustedRef.current) return;

    const next = exercises[currentIndex + 1];
    if (!next || !AUDIO_TYPES.has(next.type)) return;
    // A pre-recorded clip needs no synthesis.
    if (next.promptAudioUrl || !next.prompt) return;
    if (warmedRef.current.has(next.id)) return;
    warmedRef.current.add(next.id);

    let cancelled = false;
    warmLessonAudio({ text: next.prompt, language, userId }).catch((err: unknown) => {
      if (cancelled) return;
      if (err instanceof VoiceError && err.code === 'DAILY_LIMIT') {
        quotaExhaustedRef.current = true;
      }
      // Any other failure is invisible on purpose: the learner did not ask for
      // this clip, and the real play will surface its own error if it happens.
      console.warn('[lesson-audio] prewarm failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, language, userId, exercises, currentIndex]);
}
