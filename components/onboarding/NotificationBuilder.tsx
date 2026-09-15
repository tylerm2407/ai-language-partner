/**
 * NotificationBuilder — the four reminders, each with its own switch and its
 * own time (onboarding board P4).
 *
 * WHY A COMPONENT AND NOT A STEP. The same four rows have to exist in Settings,
 * where a learner changes their mind about them, and the onboarding step is the
 * FIRST of the two rather than the only one. Two copies of this would drift the
 * moment one of them gained a fifth kind, and the drift would be invisible —
 * both screens would look right in isolation. So the rows, the copy and the
 * time picker live here, and the caller owns nothing but the prefs object.
 *
 * WHY A CONTROLLED COMPONENT. `prefs` in, `onChange` out, no internal copy of
 * the preferences. Onboarding keeps them in its draft (they have to survive a
 * killed app before there is an account to save them to) and Settings keeps
 * them in the stored blob; a component holding its own second copy would have
 * to reconcile with both.
 *
 * WHAT IS DELIBERATELY NOT HERE. No permission request. Nothing this screen
 * does can send a notification — the OS prompt comes after sign-up, and asking
 * for it here would spend the one permission prompt iOS gives us on a learner
 * who has not yet seen the app work. The footer note says so in as many words,
 * because a switch that looks live and is not is worse than no switch.
 *
 * The copy carries the product rule too: Fluenci has no streaks and no hearts
 * (CLAUDE.md §3), so not one of these four lines frames a missed day as a loss.
 */
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Chip } from '../ui2/Chip';
import { SlabCard } from '../ui2/SlabCard';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { haptic } from '../../lib/haptics';
import { DEFAULT_DAILY_GOAL_MINUTES } from '../../lib/active-time';
import {
  isWeeklyKind,
  SUNDAY,
  type NotificationKind,
  type NotificationPref,
  type NotificationPrefs,
} from '../../lib/notification-prefs';

/**
 * The hours a reminder can be set to.
 *
 * A short list, not a wheel. Every one of these is a real slot in a day —
 * before work, mid-morning, lunch, the commute home, the evening — and the
 * gaps between them (02:00, 14:00) are hours nobody deliberately chooses for a
 * daily habit. A full 24-entry picker would be a longer list that answers the
 * same question worse, and a native date picker would be a third of a second
 * of modal for a value that fits in a row of pills.
 */
export const PICKER_HOURS: readonly number[] = [6, 7, 8, 9, 12, 17, 18, 19, 20, 21];

/** On the hour or on the half hour. Nobody needs 19:07. */
export const PICKER_MINUTES: readonly number[] = [0, 30];

/**
 * Monday first, because a week does — but the VALUES are 1 = Sunday, which is
 * what `NotificationPref.weekday` and expo-notifications' WEEKLY trigger both
 * mean. Display order and storage convention are different questions and this
 * is the one place they meet.
 */
export const WEEKDAY_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 2, label: 'Mon' },
  { value: 3, label: 'Tue' },
  { value: 4, label: 'Wed' },
  { value: 5, label: 'Thu' },
  { value: 6, label: 'Fri' },
  { value: 7, label: 'Sat' },
  { value: SUNDAY, label: 'Sun' },
];

/** `19, 0` -> `"7:00 pm"`. 12-hour, because the chips are read at a glance. */
export function formatClock(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** The label on a row's time chip: `"7:00 pm"`, or `"Sun 6:00 pm"` weekly. */
export function formatPrefTime(kind: NotificationKind, pref: NotificationPref): string {
  const clock = formatClock(pref.hour, pref.minute);
  if (!isWeeklyKind(kind)) return clock;
  const day = WEEKDAY_OPTIONS.find((d) => d.value === (pref.weekday ?? SUNDAY));
  return day ? `${day.label} ${clock}` : clock;
}

interface RowSpec {
  kind: NotificationKind;
  title: string;
  subtitle: (dailyGoalMinutes: number) => string;
}

/**
 * The four rows, in `NOTIFICATION_KINDS` order.
 *
 * Each subtitle answers "when would this actually fire?", not "what is this
 * for". A learner deciding whether to switch something on is asking how often
 * their phone will light up, and "When 10 or more are due" answers that where
 * "Stay on top of your reviews" does not.
 */
export const NOTIFICATION_ROWS: readonly RowSpec[] = [
  {
    kind: 'dailyGoal',
    title: 'Daily goal',
    subtitle: (goal) => `${goal} minutes · silent once you hit it`,
  },
  {
    kind: 'reviewsDue',
    title: 'Words ready to review',
    subtitle: () => 'When 10 or more are due',
  },
  {
    kind: 'idealMoment',
    title: 'Your moment',
    subtitle: () => 'Weekly: how much closer you are',
  },
  {
    kind: 'weeklyRecap',
    title: 'Weekly recap',
    subtitle: () => 'Minutes, words, level movement',
  },
];

interface NotificationBuilderProps {
  prefs: NotificationPrefs;
  onChange: (prefs: NotificationPrefs) => void;
  /**
   * Settings density: tighter rows and no footer note. The note explains that
   * nothing is sent until notifications are allowed, which is true exactly
   * once — before the OS prompt — and stale everywhere after it.
   */
  compact?: boolean;
  /** Named in the daily-goal row. Only the copy depends on it. */
  dailyGoalMinutes?: number;
}

export function NotificationBuilder({
  prefs,
  onChange,
  compact,
  dailyGoalMinutes = DEFAULT_DAILY_GOAL_MINUTES,
}: NotificationBuilderProps) {
  const { c, type } = useUi2Theme();
  // At most one picker is open. Two open pickers is four extra rows of chips
  // on a phone screen, and the second one is always the accident.
  const [openKind, setOpenKind] = useState<NotificationKind | null>(null);

  const patch = (kind: NotificationKind, next: Partial<NotificationPref>) => {
    onChange({ ...prefs, [kind]: { ...prefs[kind], ...next } });
  };

  return (
    <View style={compact ? styles.listCompact : styles.list}>
      {NOTIFICATION_ROWS.map((row) => {
        const pref = prefs[row.kind];
        const open = openKind === row.kind;
        const timeLabel = formatPrefTime(row.kind, pref);
        return (
          <SlabCard key={row.kind} style={compact ? styles.cardCompact : styles.card}>
            <View style={styles.rowTop}>
              <View style={styles.rowText}>
                <Text style={{ fontFamily: type.uiBold, fontSize: 15, lineHeight: 20, color: c.ink }}>
                  {row.title}
                </Text>
                <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
                  {row.subtitle(dailyGoalMinutes)}
                </Text>
              </View>
              <View style={styles.controls}>
                <Chip
                  label={timeLabel}
                  variant={pref.enabled ? 'primary' : 'neutral'}
                  onPress={() => setOpenKind(open ? null : row.kind)}
                />
                {/* 44pt: the switch itself is 31pt tall, so the target comes
                    from the box around it plus the hit slop. */}
                <View style={styles.switchBox}>
                  <Switch
                    value={pref.enabled}
                    onValueChange={(enabled) => {
                      haptic('select');
                      patch(row.kind, { enabled });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    trackColor={{ false: c.track, true: c.primary }}
                    thumbColor={c.onPrimary}
                    ios_backgroundColor={c.track}
                    accessibilityLabel={row.title}
                    accessibilityHint={`Turn this reminder ${pref.enabled ? 'off' : 'on'}`}
                  />
                </View>
              </View>
            </View>

            {open ? (
              <View
                style={styles.picker}
                accessibilityRole="radiogroup"
                accessibilityLabel={`${row.title} reminder time: ${timeLabel}`}
              >
                {isWeeklyKind(row.kind) ? (
                  <>
                    <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.muted }]}>Day</Text>
                    <View style={styles.chips}>
                      {WEEKDAY_OPTIONS.map((day) => (
                        <Chip
                          key={day.value}
                          label={day.label}
                          variant={(pref.weekday ?? SUNDAY) === day.value ? 'primary' : 'neutral'}
                          onPress={() => patch(row.kind, { weekday: day.value })}
                        />
                      ))}
                    </View>
                  </>
                ) : null}
                <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.muted }]}>Time</Text>
                <View style={styles.chips}>
                  {PICKER_HOURS.map((hour) =>
                    PICKER_MINUTES.map((minute) => (
                      <Chip
                        key={`${hour}:${minute}`}
                        label={formatClock(hour, minute)}
                        variant={pref.hour === hour && pref.minute === minute ? 'primary' : 'neutral'}
                        onPress={() => patch(row.kind, { hour, minute })}
                      />
                    )),
                  )}
                </View>
              </View>
            ) : null}
          </SlabCard>
        );
      })}

      {compact ? null : (
        <SlabCard tint="primary">
          <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 19, color: c.ink }}>
            Nothing is sent until you allow notifications after sign-up. No streaks, no guilt.
          </Text>
        </SlabCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  listCompact: { gap: 8 },
  card: { gap: 12 },
  cardCompact: { gap: 8, padding: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchBox: { minHeight: 44, justifyContent: 'center' },
  picker: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
});
