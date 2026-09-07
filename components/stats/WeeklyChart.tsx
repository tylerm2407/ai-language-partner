import { View, Text } from 'react-native';
import { GlassSurface } from '../ui/GlassSurface';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { localDayKey } from '../../lib/dates';
import type { DailyStats } from '../../types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Bar fills: today-with-data is the full accent, a bar that merely has data (or
 * is today but empty) steps down to the tint border, and an empty past day is
 * the inert progress track. That mirrors the old three-step
 * `bg-primary` / `bg-primary-light` / `bg-dark-card-alt` ladder, which resolved
 * against tailwind.config.js and so pinned the chart to the dark scheme.
 */
interface WeeklyChartProps {
  stats: DailyStats[];
  metric?: 'xpEarned' | 'minutesPracticed';
}

export function WeeklyChart({ stats, metric = 'xpEarned' }: WeeklyChartProps) {
  const { c } = useUi2Theme();
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const days: { label: string; value: number; isToday: boolean }[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - mondayOffset + i);
    const dateStr = localDayKey(date);
    const dayStat = stats.find((s) => s.date === dateStr);
    const value = dayStat ? dayStat[metric] : 0;
    const isToday = date.toDateString() === today.toDateString();
    days.push({ label: DAY_LABELS[i], value, isToday });
  }

  const maxValue = Math.max(...days.map((d) => d.value), 1);
  const unit = metric === 'xpEarned' ? 'XP' : 'min';
  const totalWeek = days.reduce((sum, d) => sum + d.value, 0);

  return (
    <GlassSurface innerStyle={{ padding: 20 }}>
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base font-semibold" style={{ color: c.ink }}>This Week</Text>
        <Text className="text-sm" style={{ color: c.muted }}>
          {totalWeek} {unit} total
        </Text>
      </View>

      <View className="flex-row items-end justify-between" style={{ height: 100 }}>
        {days.map((day) => {
          const barHeight = maxValue > 0 ? Math.max((day.value / maxValue) * 80, day.value > 0 ? 8 : 4) : 4;
          return (
            <View key={day.label} className="items-center flex-1">
              <Text className="text-[10px] mb-1" style={{ color: c.muted }}>
                {day.value > 0 ? day.value : ''}
              </Text>
              <View
                className="w-6 rounded-t-md"
                style={{
                  height: barHeight,
                  backgroundColor:
                    day.isToday && day.value > 0
                      ? c.primary
                      : day.isToday || day.value > 0
                      ? c.primaryTintBorder
                      : c.track,
                }}
              />
              <Text
                className={`text-[11px] mt-1 ${day.isToday ? 'font-bold' : ''}`}
                style={{ color: day.isToday ? c.primary : c.idle }}
              >
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    </GlassSurface>
  );
}
