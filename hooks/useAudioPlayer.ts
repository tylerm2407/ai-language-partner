import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { setAudioSessionMode } from '../lib/audio-session';

export function useAudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const play = useCallback(async (uri: string) => {
    try {
      setLoading(true);
      setError(null);
      // Claim playback mode explicitly. This hook previously set nothing and
      // inherited whatever the last recorder left behind — which, before the
      // restore was added to useAudioRecorder, meant playing out the earpiece.
      await setAudioSessionMode('playback');
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
    } catch (err) {
      setPlaying(false);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Audio playback failed');
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

  return { playing, loading, error, play, stop, cleanup };
}
