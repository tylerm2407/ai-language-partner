import { Pressable, Text, View } from 'react-native';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface RecordButtonProps {
  onRecordingComplete: (result: { uri: string; base64: string; durationMs: number }) => void;
  size?: number;
}

/**
 * Hold-to-record button for speaking exercises.
 * Shows recording duration while active.
 */
export function RecordButton({ onRecordingComplete, size = 64 }: RecordButtonProps) {
  const { isRecording, durationMs, startRecording, stopRecording, error } = useAudioRecorder();

  const handlePressIn = async () => {
    await startRecording();
  };

  const handlePressOut = async () => {
    const result = await stopRecording();
    if (result) {
      onRecordingComplete(result);
    }
  };

  const durationSec = Math.floor(durationMs / 1000);

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isRecording ? '#EF4444' : '#6366F1',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: isRecording ? 4 : 0,
          borderColor: '#FCA5A5',
        }}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? 'Release to stop recording' : 'Hold to record'}
      >
        <Text style={{ color: '#fff', fontSize: size * 0.3, fontWeight: '700' }}>
          {isRecording ? `${durationSec}s` : 'REC'}
        </Text>
      </Pressable>

      <Text style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        {isRecording ? 'Release to stop' : 'Hold to speak'}
      </Text>

      {error && (
        <Text style={{ marginTop: 4, fontSize: 12, color: '#EF4444' }}>
          {error}
        </Text>
      )}
    </View>
  );
}
