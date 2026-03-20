import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface PronunciationRecorderProps {
  targetText: string;
  onRecordingComplete: (audioBase64: string) => void;
  scoring: boolean;
  disabled?: boolean;
}

export function PronunciationRecorder({
  targetText,
  onRecordingComplete,
  scoring,
  disabled = false,
}: PronunciationRecorderProps) {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [recorded, setRecorded] = useState(false);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result?.base64) {
        setRecorded(true);
        onRecordingComplete(result.base64);
      }
    } else {
      setRecorded(false);
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording, onRecordingComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.textBox}>
        <Text style={styles.instruction}>Read this aloud:</Text>
        <Text style={styles.targetText} selectable>{targetText}</Text>
      </View>

      <Pressable
        style={[
          styles.micButton,
          isRecording && styles.micButtonRecording,
          (disabled || scoring) && styles.micButtonDisabled,
        ]}
        onPress={handleToggleRecording}
        disabled={disabled || scoring}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {scoring ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
        )}
      </Pressable>

      <Text style={styles.statusText}>
        {scoring
          ? 'Analyzing pronunciation...'
          : isRecording
          ? 'Recording... Tap to stop'
          : recorded
          ? 'Recording complete'
          : 'Tap the mic to start reading'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  textBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    width: '100%',
  },
  instruction: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  targetText: {
    fontSize: 20,
    lineHeight: 32,
    color: '#111827',
    fontWeight: '500',
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  micButtonRecording: {
    backgroundColor: '#EF4444',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  micIcon: {
    fontSize: 32,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
