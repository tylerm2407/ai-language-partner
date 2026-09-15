import React from 'react';
import { Text } from 'react-native';
import { SlabCard } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';

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
  const { c } = useUi2Theme();
  const requiredSeconds = requiredMinutes * 60;
  const met = elapsedSeconds >= requiredSeconds;

  return (
    <SlabCard
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
      }}
    >
      <Text
        style={{
          color: met ? c.green : c.muted,
          fontSize: 14,
          fontFamily: 'Manrope_600SemiBold',
          fontVariant: ['tabular-nums'],
        }}
        accessibilityLabel={`Timer: ${formatTime(elapsedSeconds)} of ${formatTime(requiredSeconds)}`}
        accessibilityRole="timer"
      >
        {formatTime(elapsedSeconds)} / {formatTime(requiredSeconds)}
      </Text>
    </SlabCard>
  );
}
