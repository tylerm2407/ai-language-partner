import { useState, useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system/next';
import { setAudioSessionMode, speechRecordingOptions } from '../lib/audio-session';

/** Read a recording as base64. Null on failure; the caller reports it. */
async function encodeFile(uri: string): Promise<string | null> {
  try {
    return await new File(uri).base64();
  } catch {
    return null;
  }
}

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  // The base64 read starts the moment a recording stops, not when the caller
  // asks for it — on a speaking exercise there is a "Score My Answer" tap in
  // between, and the encode is done by the time it lands. Keyed by uri so a
  // stale encode can never be handed out for a newer recording.
  const encodedRef = useRef<{ uri: string; base64: Promise<string | null> } | null>(null);

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

      const { recording: rec } = await Audio.Recording.createAsync(speechRecordingOptions());
      recordingRef.current = rec;
      encodedRef.current = null;
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
      if (uri) encodedRef.current = { uri, base64: encodeFile(uri) };
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
    const cached = encodedRef.current;
    const base64 = cached?.uri === audioUri ? await cached.base64 : await encodeFile(audioUri);
    if (base64 === null) setError('Could not process the recording');
    return base64;
  }, [audioUri]);

  return { recording, audioUri, error, startRecording, stopRecording, getBase64 };
}
