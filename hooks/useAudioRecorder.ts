import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async () => {
    try {
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
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
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
      const base64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: 'base64' as const,
      });
      return base64;
    } catch {
      return null;
    }
  }, [audioUri]);

  return { recording, audioUri, startRecording, stopRecording, getBase64 };
}
