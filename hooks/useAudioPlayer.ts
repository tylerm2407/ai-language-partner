import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  durationMs: number;
  positionMs: number;
  play: (uri: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
}

/**
 * Hook for playing audio files. Manages a single Audio.Sound instance.
 * Automatically unloads on unmount.
 *
 * Usage:
 *   const { play, pause, isPlaying } = useAudioPlayer();
 *   <Button onPress={() => play(audioUrl)} title={isPlaying ? 'Pause' : 'Play'} />
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);

  // Configure audio session for iOS
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true, // Play audio even in silent mode
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    return () => {
      // Cleanup on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) setError(status.error);
      return;
    }
    setIsPlaying(status.isPlaying);
    setDurationMs(status.durationMillis ?? 0);
    setPositionMs(status.positionMillis);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
    }
  }, []);

  const play = useCallback(
    async (uri: string) => {
      try {
        setError(null);
        setIsLoading(true);

        // Unload previous sound
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to play audio');
      } finally {
        setIsLoading(false);
      }
    },
    [onPlaybackStatusUpdate]
  );

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
    }
  }, []);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setPositionMs(0);
    }
  }, []);

  const seekTo = useCallback(async (position: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(position);
    }
  }, []);

  return { isPlaying, isLoading, error, durationMs, positionMs, play, pause, stop, seekTo };
}
