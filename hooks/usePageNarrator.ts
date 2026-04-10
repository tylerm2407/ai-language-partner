import { useState, useCallback, useRef, useEffect } from 'react';
import * as Speech from 'expo-speech';

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

  const speak = useCallback((text: string, language: string, onDone?: () => void) => {
    Speech.stop();
    onDoneRef.current = onDone ?? null;

    const bcp47 = LANGUAGE_MAP[language] ?? language;

    setIsPlaying(true);
    setIsPaused(false);

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
  }, [speed]);

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
