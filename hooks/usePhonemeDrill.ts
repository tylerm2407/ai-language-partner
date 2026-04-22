import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { getTextToSpeech, VoiceError } from '../lib/ai';
import type { LanguageCode } from '../types';

/**
 * usePhonemeDrill
 *
 * Rotates through `voiceIndex` 0..N-1 on each call to `playNext`. For HVPT
 * (High-Variability Phonetic Training) phoneme drills, this ensures the
 * learner hears the same target phoneme / word / utterance in ≥4 distinct
 * voices across repetitions (Thomson meta-analyses; see research.md §9).
 *
 * Playback strategy:
 *   1. Preferred path — hit the server TTS edge function with the rotated
 *      `voiceIndex`. The function returns base64 audio that we decode into a
 *      `data:` URI and play via expo-av.
 *   2. Fallback — if the server TTS call fails (network, plan limit, etc.),
 *      degrade to expo-speech (single-voice). Degraded playback still
 *      completes the repetition so the drill flow doesn't stall; the voice
 *      variability just drops to 1 until the next successful server call.
 *
 * Callers typically wire this into a "replay" / "listen again" button so
 * each replay cycles to the next voice. New exercises that mount should
 * call `reset()` to start the cycle at index 0.
 */

const LANGUAGE_MAP: Record<string, string> = {
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ru: 'ru-RU',
  en: 'en-US',
  ar: 'ar-SA',
  hi: 'hi-IN',
};

interface PhonemeDrillOptions {
  /** Supabase user id for per-tier voice-minute metering. Pass `undefined` for
   *  anonymous / preview flows; the server allows missing userId. */
  userId?: string;
}

export function usePhonemeDrill(
  language: LanguageCode | string,
  voiceCount: number = 4,
  options: PhonemeDrillOptions = {}
) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const unload = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {
        /* noop */
      }
      soundRef.current = null;
    }
  }, []);

  /** Speak `text` using the voice at `index % voiceCount`, then advance the
   *  rotation. Returns the voice index that was used for this call. */
  const playNext = useCallback(
    async (text: string): Promise<number> => {
      const i = index % Math.max(1, voiceCount);
      // Advance immediately so rapid double-taps still rotate.
      setIndex((prev) => prev + 1);

      setIsPlaying(true);

      // 1) Preferred path — server TTS with rotated voiceIndex.
      try {
        const base64 = await getTextToSpeech(text, language, options.userId, {
          voiceIndex: i,
        });
        await unload();
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mpeg;base64,${base64}` },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if ('didJustFinish' in status && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
        return i;
      } catch (err) {
        // 2) Fallback — expo-speech (single-voice). Still completes the
        // repetition so the drill continues.
        if (!(err instanceof VoiceError)) {
          // Unexpected error — still fall through to expo-speech.
        }
        try {
          const bcp47 = LANGUAGE_MAP[language] ?? language;
          Speech.stop();
          Speech.speak(text, {
            language: bcp47,
            onDone: () => setIsPlaying(false),
            onStopped: () => setIsPlaying(false),
          });
        } catch {
          setIsPlaying(false);
        }
        return i;
      }
    },
    [index, voiceCount, language, options.userId, unload]
  );

  const reset = useCallback(() => setIndex(0), []);

  const stop = useCallback(async () => {
    Speech.stop();
    await unload();
    setIsPlaying(false);
  }, [unload]);

  return {
    playNext,
    reset,
    stop,
    isPlaying,
    currentVoiceIndex: index % Math.max(1, voiceCount),
  };
}
