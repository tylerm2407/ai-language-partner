import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import type { VoiceSessionState } from '../../types';

interface DrivingModeUIProps {
  state: VoiceSessionState;
  elapsedSeconds: number;
  lastAIMessage: string | null;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function DrivingModeUI({ state, elapsedSeconds, lastAIMessage, onStop }: DrivingModeUIProps) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.7);

  useEffect(() => {
    if (state === 'listening' || state === 'ai-speaking') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0.5, { duration: 1000 })),
        -1
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      pulseOpacity.value = withTiming(0.7, { duration: 300 });
    }
  }, [state]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const circleColor =
    state === 'listening'
      ? '#3B82F6'
      : state === 'ai-speaking'
        ? '#8B5CF6'
        : state === 'connecting'
          ? '#F59E0B'
          : '#4B5563';

  const stateLabel =
    state === 'listening'
      ? 'Listening...'
      : state === 'ai-speaking'
        ? 'AI is speaking...'
        : state === 'connecting'
          ? 'Connecting...'
          : '';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#111827',
        justifyContent: 'space-between',
        paddingVertical: 40,
      }}
    >
      {/* Timer at top */}
      <View style={{ alignItems: 'center', paddingTop: 20 }}>
        <Text
          style={{
            fontSize: 48,
            fontWeight: '200',
            color: '#fff',
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatTime(elapsedSeconds)}
        </Text>
        <Text style={{ fontSize: 16, color: '#9CA3AF', marginTop: 4 }}>{stateLabel}</Text>
      </View>

      {/* Large pulsing circle in center */}
      <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <Animated.View
          style={[
            {
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: circleColor,
              justifyContent: 'center',
              alignItems: 'center',
            },
            pulseStyle,
          ]}
        >
          <Text style={{ fontSize: 60 }}>🎙</Text>
        </Animated.View>
      </View>

      {/* Last AI message */}
      {lastAIMessage && (
        <View
          style={{
            marginHorizontal: 24,
            marginBottom: 24,
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: 20,
            borderRadius: 16,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              color: '#E5E7EB',
              lineHeight: 28,
              textAlign: 'center',
            }}
            numberOfLines={4}
          >
            {lastAIMessage}
          </Text>
        </View>
      )}

      {/* Large stop button — 60pt+ touch target for driving safety */}
      <View style={{ alignItems: 'center', paddingBottom: 20 }}>
        <Pressable
          onPress={onStop}
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#EF4444',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Stop driving mode session"
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              backgroundColor: '#fff',
            }}
          />
        </Pressable>
        <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 12 }}>Stop</Text>
      </View>
    </View>
  );
}
