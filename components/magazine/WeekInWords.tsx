import { View, Text, StyleSheet } from 'react-native';
import { MagazineGlassCard } from './MagazineGlassCard';
import { colors, typography } from '../../config/theme';
import { localDayKey } from '../../lib/dates';
import type { DailyStats } from '../../types';

interface WeekInWordsProps {
  stats: DailyStats[];
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Editorial face. Fraunces_600SemiBold carries its own weight — never pair it
// with fontWeight, which makes Android synthesize a second bolding pass.
const serifFont = typography.family.serif;

export function WeekInWords({ stats }: WeekInWordsProps) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  let totalXp = 0;
  const dots: { label: string; active: boolean; isToday: boolean }[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - mondayOffset + i);
    const dateStr = localDayKey(date);
    const dayStat = stats.find((s) => s.date === dateStr);
    const xp = dayStat?.xpEarned ?? 0;
    totalXp += xp;
    dots.push({
      label: DAY_LABELS[i],
      active: xp > 0,
      isToday: date.toDateString() === today.toDateString(),
    });
  }

  return (
    <MagazineGlassCard style={styles.card}>
      <Text style={styles.sectionTitle}>Week in words</Text>
      <View style={styles.content}>
        {/* Big number */}
        <Text style={styles.bigNumber}>{totalXp}</Text>
        <Text style={styles.bigLabel}>XP THIS WEEK</Text>

        {/* 7-day dot grid */}
        <View style={styles.dotRow}>
          {dots.map((dot, i) => (
            <View key={i} style={styles.dotCol}>
              <View
                style={[
                  styles.dot,
                  dot.active && styles.dotActive,
                  dot.isToday && styles.dotToday,
                ]}
              />
              <Text
                style={[
                  styles.dotLabel,
                  dot.isToday && styles.dotLabelToday,
                ]}
              >
                {dot.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </MagazineGlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: serifFont,
    fontSize: 18,
    color: colors.text.primary,
    marginBottom: 16,
  },
  content: {
    alignItems: 'center',
  },
  bigNumber: {
    fontFamily: serifFont,
    fontSize: 56,
    color: colors.text.primary,
    // Deliberately under minLineHeight(56, 'display') = 70. This renders digits
    // only, which stop at Fraunces' capHeight (0.700em = 39px here) while the
    // line box still reserves 60 - descent(14px) = 46px above the baseline. Do
    // not raise it to 70 — that would add 10px of dead space. If this ever
    // renders letters, it must go to 70.
    lineHeight: 60,
  },
  bigLabel: {
    fontFamily: typography.family.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.text.tertiary,
    marginTop: 4,
    marginBottom: 20,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dotCol: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dotActive: {
    backgroundColor: colors.magazine.accentViolet,
  },
  dotToday: {
    backgroundColor: colors.magazine.accentBlue,
    borderWidth: 1.5,
    borderColor: 'rgba(79,142,247,0.4)',
  },
  dotLabel: {
    fontFamily: typography.family.mono,
    fontSize: 10,
    color: colors.text.quaternary,
  },
  dotLabelToday: {
    color: colors.magazine.accentBlue,
  },
});
