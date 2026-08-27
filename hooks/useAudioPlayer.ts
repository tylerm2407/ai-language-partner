import { useState, useCallback, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import { setAudioSessionMode } from '../lib/audio-session';

export function useAudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  /**
   * Playback status arrives from native and can land after unmount — a
   * listening exercise that advances while its clip is still playing is the
   * ordinary case, not an edge case. Without this guard those callbacks set
   * state on a dead component.
   */
  const mountedRef = useRef(true);

  /**
   * Release the native player when the component goes away.
   *
   * `cleanup` below has always existed, but nothing invoked it on unmount and
   * only one of the five call sites even destructured it — so every exercise
   * that played a clip left its `Audio.Sound` loaded. On iOS those are real
   * native players holding a decoder and a slice of the audio session, and
   * they accumulated for the length of a lesson: audible bleed between
   * exercises, then jetsam pressure.
   *
   * Deliberately not depending on `cleanup`: this must run exactly once, on
   * teardown, and reading the ref directly keeps it independent of callback
   * identity.
   */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        // Fire-and-forget: unmount cannot await, and a failed unload on a
        // player that is already gone is not actionable.
        sound.setOnPlaybackStatusUpdate(null);
        void sound.unloadAsync().catch(() => {});
      }
    };
  }, []);

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
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      // Unmounted while the clip was loading: the component is gone, so this
      // player would never be released by the teardown above — it already ran.
      if (!mountedRef.current) {
        void sound.unloadAsync().catch(() => {});
        return;
      }

      soundRef.current = sound;
      setPlaying(true);
      setLoading(false);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!mountedRef.current) return;
        if ('didJustFinish' in status && status.didJustFinish) {
          setPlaying(false);
        }
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setPlaying(false);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Audio playback failed');
    }
  }, []);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      if (mountedRef.current) setPlaying(false);
    }
  }, []);

  const cleanup = useCallback(async () => {
    if (soundRef.current) {
      soundRef.current.setOnPlaybackStatusUpdate(null);
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  }, []);

  return { playing, loading, error, play, stop, cleanup };
}
