/**
 * The conversation header — deck screen 08: chevron · mascot · title/status
 * stack · elapsed chip · controls. Lifted out of `app/(app)/chat/index.tsx`
 * unchanged; the screen composes `rightActions` from the pills exported
 * below so the header itself knows nothing about assignments or missions.
 *
 * DESIGN.md "Live AI Chat › Header": the 6px dot and the word "Live" appear
 * only while hands-free is active, and the hands-free toggle collapses to
 * icon-only once live because the status row already says so. A running
 * mission collapses it too — the Finish pill needs the width on a 375pt
 * phone, and the mission strip below the transcript already advertises what
 * is going on.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { Mascot, type MascotState } from '../mascot/Mascot';
import { Chip } from '../ui2/Chip';
import { Body, Caption } from '../ui2/Ui2Text';

export interface ChatHeaderProps {
  /** The scenario label. */
  label: string;
  /** The can-do line under it — never a bare band (lib/cefr-labels.ts). */
  statusLine: string;
  /** Spoken form of `statusLine`. */
  statusA11y: string;
  /** Hands-free is active: shows the dot and prefixes "Live". */
  live: boolean;
  mascotState: MascotState;
  /** Elapsed time, shown as a chip when present. */
  timer?: string;
  onBack: () => void;
  rightActions?: ReactNode;
}

export function ChatHeader({
  label,
  statusLine,
  statusA11y,
  live,
  mascotState,
  timer,
  onBack,
  rightActions,
}: ChatHeaderProps) {
  const { c } = useUi2Theme();
  return (
    <View className="flex-row items-center px-4 py-3 border-b" style={{ borderColor: c.cardBorder, gap: spacing.sm }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={c.idle} />
      </Pressable>

      {/* The mascot sits in the header as the tutor's face: thinking while a reply
          is on its way, listening while the mic is open, idle otherwise. */}
      <Mascot state={mascotState} size={44} />

      <View className="flex-1">
        <Body weight="extrabold" numberOfLines={1}>
          {label}
        </Body>
        <View className="flex-row items-center" style={{ gap: spacing.xxs }}>
          {live && <View style={[styles.liveDot, { backgroundColor: c.green }]} />}
          <Caption size="sm" numberOfLines={2} accessibilityLabel={`${live ? 'Live. ' : ''}${statusA11y}`}>
            {live ? 'Live · ' : ''}
            {statusLine}
          </Caption>
        </View>
      </View>

      {timer ? <Chip label={timer} variant="primary" /> : null}

      {rightActions}
    </View>
  );
}

/** Submit the assignment once its minimum time is met. */
export function SubmitPill({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const { c } = useUi2Theme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Submit assignment"
      className="min-h-9 py-1.5 px-3 rounded-full items-center justify-center flex-row"
      style={{ backgroundColor: c.green }}
    >
      <Ionicons name="checkmark-circle-outline" size={16} color={c.onPrimary} />
      <Text className="text-xs font-semibold ml-1.5" style={{ color: c.onPrimary }}>
        {busy ? 'Submitting...' : 'Submit'}
      </Text>
    </Pressable>
  );
}

/** Finish the running mission. Same shape as the assignment Submit pill. */
export function FinishPill({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { c } = useUi2Theme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Finish mission"
      accessibilityState={{ disabled: !!disabled }}
      className="min-h-9 py-1.5 px-3 rounded-full items-center justify-center flex-row"
      style={{ backgroundColor: c.primary, opacity: disabled ? 0.6 : 1 }}
    >
      <Ionicons name="flag-outline" size={16} color={c.onPrimary} />
      <Text className="text-xs font-semibold ml-1.5" style={{ color: c.onPrimary }}>
        Finish
      </Text>
    </Pressable>
  );
}

/**
 * Hands-free toggle. Icon-only while `active` (the status row reads "Live")
 * or while `compact` (a mission is running); otherwise it keeps its "Live
 * Voice" label, where it is the only thing advertising the feature.
 */
export function HandsFreeToggle({
  active,
  compact,
  onPress,
}: {
  active: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  const { c } = useUi2Theme();
  const iconOnly = active || !!compact;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? 'End live voice conversation' : 'Start live voice conversation'}
      accessibilityHint="Real-time bidirectional voice conversation with AI tutor"
      className={`min-h-9 py-1.5 rounded-full items-center justify-center flex-row ${iconOnly ? 'w-9' : 'px-3'}`}
      style={{ backgroundColor: active ? c.green : c.card }}
    >
      <Ionicons name={active ? 'mic' : 'mic-outline'} size={16} color={active ? c.onPrimary : c.idle} />
      {!iconOnly && (
        <Text className="text-xs font-sans-semibold ml-1.5" style={{ color: c.idle }}>
          Live Voice
        </Text>
      )}
    </Pressable>
  );
}

/** Spoken-reply toggle. The screen hides it while hands-free is active. */
export function VoiceModeToggle({ active, onPress }: { active: boolean; onPress: () => void }) {
  const { c } = useUi2Theme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Switch to text mode' : 'Switch to voice mode'}
      className="w-9 h-9 rounded-full items-center justify-center"
      style={{ backgroundColor: active ? c.primary : c.card }}
    >
      <Ionicons name={active ? 'mic' : 'mic-outline'} size={20} color={active ? c.onPrimary : c.onTint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  liveDot: { width: 6, height: 6, borderRadius: radii.pill },
});
