import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MagazineGlassCard } from './MagazineGlassCard';
import { typography, ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { localDayKey } from '../../lib/dates';
import type { ErrorCopy } from '../../lib/error-copy';
import type { DailyStats } from '../../types';

interface WeekInWordsProps {
  stats: DailyStats[];
  /**
   * Set when the week's stats failed to load. Without this the card renders
   * 0 XP and seven empty dots, which is exactly what a real week of no
   * practice looks like — an outage would read as the learner's own record.
   */
  error?: ErrorCopy | null;
  onRetry?: () => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Editorial face. Fraunces_600SemiBold carries its own weight — never pair it
// with fontWeight, which makes Android synthesize a second bolding pass.
const serifFont = typography.family.serif;

export function WeekInWords({ stats, error, onRetry }: WeekInWordsProps) {
  const { scheme } = useUi2Theme();

  if (error) {
    return (
      <MagazineGlassCard style={themed[scheme].card}>
        <Text style={themed[scheme].sectionTitle}>Week in words</Text>
        <Text style={themed[scheme].errorTitle}>{error.title}</Text>
        <Text style={themed[scheme].errorBody}>{error.message}</Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Try loading this week's stats again"
            style={themed[scheme].retry}
          >
            <Text style={themed[scheme].retryLabel}>Try again</Text>
          </Pressable>
        )}
      </MagazineGlassCard>
    );
  }

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
    <MagazineGlassCard style={themed[scheme].card}>
      <Text style={themed[scheme].sectionTitle}>Week in words</Text>
      <View style={themed[scheme].content}>
        {/* Big number */}
        <Text style={themed[scheme].bigNumber}>{totalXp}</Text>
        <Text style={themed[scheme].bigLabel}>XP THIS WEEK</Text>

        {/* 7-day dot grid */}
        <View style={themed[scheme].dotRow}>
          {dots.map((dot, i) => (
            <View key={i} style={themed[scheme].dotCol}>
              <View
                style={[
                  themed[scheme].dot,
                  dot.active && themed[scheme].dotActive,
                  dot.isToday && themed[scheme].dotToday,
                ]}
              />
              <Text
                style={[
                  themed[scheme].dotLabel,
                  dot.isToday && themed[scheme].dotLabelToday,
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

const makeStyles = (c: Ui2Palette) =>
  StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: serifFont,
    fontSize: 18,
    color: c.ink,
    marginBottom: 16,
  },
  content: {
    alignItems: 'center',
  },
  errorTitle: {
    fontFamily: typography.family.semibold,
    fontSize: 15,
    color: c.ink,
  },
  errorBody: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: c.muted,
    marginTop: 4,
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: typography.family.semibold,
    fontSize: 13,
    color: c.primary,
  },
  bigNumber: {
    fontFamily: serifFont,
    fontSize: 56,
    color: c.ink,
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
    color: c.muted,
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
    backgroundColor: c.track,
  },
  dotActive: {
    backgroundColor: c.primary,
  },
  dotToday: {
    backgroundColor: c.green,
    borderWidth: 1.5,
    borderColor: c.greenBorder,
  },
  dotLabel: {
    fontFamily: typography.family.mono,
    fontSize: 10,
    color: c.idle,
  },
  dotLabelToday: {
    color: c.green,
  },
  });

/** Both schemes built once at module load — see DateLabel for why. */
const themed = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) } as const;
