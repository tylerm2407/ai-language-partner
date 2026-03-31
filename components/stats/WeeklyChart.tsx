import { View, Text } from 'react-native';
import type { DailyStats } from '../../types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeeklyChartProps {
  stats: DailyStats[];
  metric?: 'xpEarned' | 'minutesPracticed';
}

export function WeeklyChart({ stats, metric = 'xpEarned' }: WeeklyChartProps) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const days: { label: string; value: number; isToday: boolean }[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - mondayOffset + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayStat = stats.find((s) => s.date === dateStr);
    const value = dayStat ? dayStat[metric] : 0;
    const isToday = date.toDateString() === today.toDateString();
    days.push({ label: DAY_LABELS[i], value, isToday });
  }

  const maxValue = Math.max(...days.map((d) => d.value), 1);
  const unit = metric === 'xpEarned' ? 'XP' : 'min';
  const totalWeek = days.reduce((sum, d) => sum + d.value, 0);

  return (
    <View className="bg-dark-card rounded-2xl p-5">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base font-semibold text-text-primary">This Week</Text>
        <Text className="text-sm text-text-secondary">
          {totalWeek} {unit} total
        </Text>
      </View>

      <View className="flex-row items-end justify-between" style={{ height: 100 }}>
        {days.map((day) => {
          const barHeight = maxValue > 0 ? Math.max((day.value / maxValue) * 80, day.value > 0 ? 8 : 4) : 4;
          return (
            <View key={day.label} className="items-center flex-1">
              <Text className="text-[10px] text-text-secondary mb-1">
                {day.value > 0 ? day.value : ''}
              </Text>
              <View
                className={`w-6 rounded-t-md ${
                  day.isToday
                    ? day.value > 0
                      ? 'bg-primary'
                      : 'bg-primary-light'
                    : day.value > 0
                    ? 'bg-primary-light'
                    : 'bg-dark-card-alt'
                }`}
                style={{ height: barHeight }}
              />
              <Text
                className={`text-[11px] mt-1 ${
                  day.isToday ? 'font-bold text-primary' : 'text-text-tertiary'
                }`}
              >
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
