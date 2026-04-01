import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system/next';

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async () => {
    try {
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
      if (!permission.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setRecording(true);
      setAudioUri(null);
    } catch {
      setRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    try {
      const rec = recordingRef.current;
      recordingRef.current = null; // Null ref BEFORE async work to prevent races
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      setRecording(false);
      setAudioUri(uri);
      return uri;
    } catch {
      setRecording(false);
      return null;
    }
  }, []);

  const getBase64 = useCallback(async (): Promise<string | null> => {
    if (!audioUri) return null;
    try {
      const file = new File(audioUri);
      const base64 = file.base64();
      return base64;
    } catch {
      return null;
    }
  }, [audioUri]);

  return { recording, audioUri, startRecording, stopRecording, getBase64 };
}
