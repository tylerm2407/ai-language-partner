import { useState, useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system/next';
import { setAudioSessionMode } from '../lib/audio-session';

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // If the consumer unmounts mid-recording (e.g. user navigates away while
  // holding the mic button), tear down the native recording — expo-av only
  // allows one Recording prepared at a time, so a leak here would break any
  // subsequent recording elsewhere in the app.
  useEffect(() => {
    return () => {
      const rec = recordingRef.current;
      if (rec) {
        recordingRef.current = null;
        rec.stopAndUnloadAsync().catch(() => { /* already dead */ });
        // Unmounting mid-recording leaves the session in record mode, which
        // would route the next screen's playback to the earpiece.
        void setAudioSessionMode('idle');
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      // Clean up any stale recording before creating a new one
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {
          // Already stopped/unloaded — safe to ignore
        }
        recordingRef.current = null;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission denied. Enable the microphone in Settings to record.');
        return;
      }

      await setAudioSessionMode('record');

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setRecording(true);
      setAudioUri(null);
    } catch (err) {
      setRecording(false);
      setError(err instanceof Error ? err.message : 'Could not start recording');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    try {
      const rec = recordingRef.current;
      recordingRef.current = null; // Null ref BEFORE async work to prevent races
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      // Hand the session back. Without this iOS stays in PlayAndRecord and
      // routes every subsequent playback to the earpiece — the bug this hook
      // shipped with, and the reason lesson audio went quiet after a speaking
      // exercise.
      await setAudioSessionMode('idle');
      setRecording(false);
      setAudioUri(uri);
      return uri;
    } catch (err) {
      // Restore on the failure path too — a stop that threw still leaves the
      // session in record mode.
      await setAudioSessionMode('idle');
      setRecording(false);
      setError(err instanceof Error ? err.message : 'Recording failed');
      return null;
    }
  }, []);

  const getBase64 = useCallback(async (): Promise<string | null> => {
    if (!audioUri) return null;
    try {
      const file = new File(audioUri);
      const base64 = await file.base64();
      return base64;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the recording');
      return null;
    }
  }, [audioUri]);

  return { recording, audioUri, error, startRecording, stopRecording, getBase64 };
}
