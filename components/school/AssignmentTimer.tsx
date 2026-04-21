import React from 'react';
import { Text } from 'react-native';
import { GlassSurface } from '../ui/GlassSurface';

interface AssignmentTimerProps {
  elapsedSeconds: number;
  requiredMinutes: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${pad(mins)}:${pad(secs)}`;
}

export default function AssignmentTimer({ elapsedSeconds, requiredMinutes }: AssignmentTimerProps) {
  const requiredSeconds = requiredMinutes * 60;
  const met = elapsedSeconds >= requiredSeconds;

  return (
    <GlassSurface
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
      }}
      innerStyle={{
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
      borderRadius={12}
    >
      <Text
        style={{
          color: met ? '#22C55E' : '#94A3B8',
          fontSize: 14,
          fontFamily: 'Inter_600SemiBold',
          fontVariant: ['tabular-nums'],
        }}
        accessibilityLabel={`Timer: ${formatTime(elapsedSeconds)} of ${formatTime(requiredSeconds)}`}
        accessibilityRole="timer"
      >
        {formatTime(elapsedSeconds)} / {formatTime(requiredSeconds)}
      </Text>
    </GlassSurface>
  );
}
