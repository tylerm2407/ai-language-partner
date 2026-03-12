import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  durationMs: number;
  error: string | null;
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
}

interface RecordingResult {
  uri: string;
  durationMs: number;
  base64: string; // for sending to pronunciation scoring API
}

/**
 * Hook for recording audio. Handles iOS permissions and audio session config.
 * Returns recorded audio as both a local URI and base64 string.
 *
 * Usage:
 *   const { startRecording, stopRecording, isRecording, requestPermission } = useAudioRecorder();
 *
 *   // On mount or before first use:
 *   await requestPermission();
 *
 *   // Record:
 *   await startRecording();
 *   const result = await stopRecording();
 *   // result.base64 can be sent to pronunciation scoring
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      setHasPermission(granted);
      return granted;
    } catch {
      setHasPermission(false);
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setError('Microphone permission is required for speaking exercises.');
          return;
        }
      }

      // Configure audio session for recording on iOS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setDurationMs(0);

      // Track duration
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setDurationMs(status.durationMillis);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start recording');
    }
  }, [hasPermission, requestPermission]);

  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    try {
      if (!recordingRef.current) return null;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        setError('Recording URI is null');
        return null;
      }

      // Reset audio mode back to playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // Read file as base64 for API transmission
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return {
        uri,
        durationMs: status.durationMillis ?? durationMs,
        base64,
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop recording');
      setIsRecording(false);
      return null;
    }
  }, [durationMs]);

  return {
    isRecording,
    durationMs,
    error,
    hasPermission,
    requestPermission,
    startRecording,
    stopRecording,
  };
}
