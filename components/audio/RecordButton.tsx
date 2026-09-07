import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface RecordButtonProps {
  onRecordingComplete: (result: { uri: string; base64: string; durationMs: number }) => void;
  size?: number;
}

export function RecordButton({ onRecordingComplete, size = 64 }: RecordButtonProps) {
  const { c } = useUi2Theme();
  const { recording, error, startRecording, stopRecording, getBase64 } = useAudioRecorder();
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
          backgroundColor: recording ? c.error : c.primary,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: recording ? 4 : 0,
          // A lighter red than the fill, so the ring reads as a ring on both
          // grounds — `error` on `error` would be invisible and `card` would
          // vanish into a white screen.
          borderColor: c.pink,
        }}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Release to stop recording' : 'Hold to record'}
      >
        <Text style={{ color: c.onPrimary, fontSize: size * 0.3, fontWeight: '700' }}>
          {recording ? `${durationSec}s` : 'REC'}
        </Text>
      </Pressable>

      <Text style={{ marginTop: 8, fontSize: 12, color: c.muted }}>
        {recording ? 'Release to stop' : 'Hold to speak'}
      </Text>

      {error && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
          accessibilityRole="alert"
          accessibilityLabel={`Recording error: ${error}`}
        >
          <Ionicons name="alert-circle" size={14} color={c.error} />
          <Text style={{ marginLeft: 4, fontSize: 12, color: c.error }}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}
