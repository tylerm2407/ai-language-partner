import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface RecordButtonProps {
  onRecordingComplete: (result: { uri: string; base64: string; durationMs: number }) => void;
  size?: number;
}

export function RecordButton({ onRecordingComplete, size = 64 }: RecordButtonProps) {
  const { recording, startRecording, stopRecording, getBase64 } = useAudioRecorder();
  const [durationMs, setDurationMs] = useState(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handlePressIn = async () => {
    startTimeRef.current = Date.now();
    setDurationMs(0);
    await startRecording();
    timerRef.current = setInterval(() => {
      setDurationMs(Date.now() - startTimeRef.current);
    }, 100);
  };

  const handlePressOut = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const uri = await stopRecording();
    if (uri) {
      const base64 = (await getBase64()) ?? '';
      onRecordingComplete({ uri, base64, durationMs: Date.now() - startTimeRef.current });
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
          backgroundColor: recording ? '#EF4444' : '#6366F1',
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: recording ? 4 : 0,
          borderColor: '#FCA5A5',
        }}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Release to stop recording' : 'Hold to record'}
      >
        <Text style={{ color: '#fff', fontSize: size * 0.3, fontWeight: '700' }}>
          {recording ? `${durationSec}s` : 'REC'}
        </Text>
      </Pressable>

      <Text style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        {recording ? 'Release to stop' : 'Hold to speak'}
      </Text>
    </View>
  );
}
