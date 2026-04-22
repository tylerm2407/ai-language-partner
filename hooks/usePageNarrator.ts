import { useState, useCallback, useRef, useEffect } from 'react';
import * as Speech from 'expo-speech';

/** Voice selector for the (future) server-TTS path. Accepted here so callers
 *  can adopt HVPT-style voice rotation without a second refactor when
 *  usePageNarrator gains a server-TTS branch. Currently the hook renders via
 *  expo-speech only (single-voice), so these options are forwarded on when a
 *  server path is added and are a safe no-op today. See
 *  supabase/functions/tts/index.ts for the VOICE_MAP. */
export type NarratorVoiceMode = 'default' | 'rotate' | 'random';
export interface NarratorVoiceOptions {
  voiceIndex?: number;
  voiceMode?: NarratorVoiceMode;
  voiceRotationKey?: string;
}

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
};

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25] as const;
type Speed = (typeof SPEED_OPTIONS)[number];

export function usePageNarrator() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(0.75);
  const onDoneRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      Speech.stop();
    };
  }, []);

  const speak = useCallback(
    (
      text: string,
      language: string,
      onDone?: () => void,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _voiceOptions?: NarratorVoiceOptions,
    ) => {
      Speech.stop();
      onDoneRef.current = onDone ?? null;

      const bcp47 = LANGUAGE_MAP[language] ?? language;

      setIsPlaying(true);
      setIsPaused(false);

      // NOTE: _voiceOptions is accepted but not consumed by this expo-speech
      // implementation (single-voice fallback). Wire through if/when this
      // hook gains a server-TTS branch that hits supabase/functions/tts.
      Speech.speak(text, {
        language: bcp47,
        rate: speed,
        onDone: () => {
          if (!isMountedRef.current) return;
          setIsPlaying(false);
          setIsPaused(false);
          onDoneRef.current?.();
        },
        onStopped: () => {
          if (!isMountedRef.current) return;
          setIsPlaying(false);
          setIsPaused(false);
        },
      });
    },
    [speed],
  );

  const pause = useCallback(() => {
    Speech.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    Speech.resume();
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    Speech.stop();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      return SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    });
  }, []);

  return { isPlaying, isPaused, speed, speak, pause, resume, stop, cycleSpeed };
}
