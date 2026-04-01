import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function getTimeUntilMidnightUTC(): { hours: number; minutes: number } {
  const now = new Date();
  const midnightUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  const diffMs = midnightUTC.getTime() - now.getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function QuestCountdown() {
  const [time, setTime] = useState(getTimeUntilMidnightUTC);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeUntilMidnightUTC());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="time-outline" size={12} color="#9CA3AF" />
      <Text className="text-text-secondary" style={{ fontSize: 12 }}>
        Resets in {time.hours}h {time.minutes}m
      </Text>
    </View>
  );
}
