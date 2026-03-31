import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';

export function useAudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const play = useCallback(async (uri: string) => {
    try {
      setLoading(true);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setPlaying(true);
      setLoading(false);

      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setPlaying(false);
        }
      });
    } catch {
      setPlaying(false);
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setPlaying(false);
    }
  }, []);

  const cleanup = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  }, []);

  return { playing, loading, play, stop, cleanup };
}
