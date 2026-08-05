/**
 * LiveComposer — the live-chat composer card (deck screen 08).
 *
 * One opaque card holding [keypad] [waveform] [mic]. Both voice branches of
 * ChatInput render this, so hold-to-talk and hands-free finally share a
 * composer shape instead of each drawing its own centred column.
 *
 * Two deliberate departures from the deck:
 *
 *  - The deck floats the card (`position: absolute; bottom: 24`). Here it stays
 *    in flow with margins. Chat is a tab screen, so the composer has to clear
 *    the FloatingTabBar *and* live inside KeyboardAvoidingView — absolute
 *    positioning would fight both. Margins give the same inset-card read.
 *
 *  - The deck's 20 bars run a fixed CSS shimmer. These are driven by the real
 *    `meterLevel`, because faking amplitude on a live mic would misreport
 *    whether the app is actually hearing the learner. Idle sits at the deck's
 *    0.35 scaleY floor, which is where its keyframe starts anyway.
 */

import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../config/theme';

/** Deck: 20 bars, w3 / h24 / r1.5, gap 3, opacity .35 + (i % 5) * 0.13. */
const BAR_COUNT = 20;
const BAR_WIDTH = 3;
const BAR_MAX_HEIGHT = spacing.lg; // 24
const BAR_MIN_SCALE = 0.35; // fl-wave keyframe floor

/** Centre-weighted profile so the waveform peaks mid-card, as the deck reads. */
function barScale(index: number, level: number): number {
  const distanceFromCentre = Math.abs(index - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
  const shape = 1 - distanceFromCentre * 0.55;
  return BAR_MIN_SCALE + Math.max(0, Math.min(1, level)) * (1 - BAR_MIN_SCALE) * shape;
}

interface LiveComposerProps {
  /** 0..1 microphone amplitude. Idle bars when 0 or when `live` is false. */
  meterLevel: number;
  /** True while the mic is actually open — drives the waveform. */
  live: boolean;
  micIcon: keyof typeof Ionicons.glyphMap;
  micColor: string;
  micAccessibilityLabel: string;
  /** Status line above the card ("Listening…", "Hold to talk", …). */
  statusText: string;
  statusColor: string;
  /** Shown in place of the mic glyph while a turn is in flight. */
  busy?: boolean;
  /** Omit to render the mic as a non-interactive indicator (hands-free mode,
   *  where the loop opens and closes the mic rather than the user). */
  onMicPress?: () => void;
  onMicPressIn?: () => void;
  onMicPressOut?: () => void;
  /** Omit to hide the keypad affordance. */
  onKeypad?: () => void;
  keypadAccessibilityLabel?: string;
  /** Error text rendered under the card. */
  errorMessage?: string | null;
  /** Bottom padding — caller adds safe-area inset + tab bar clearance. */
  bottomPadding: number;
}

export function LiveComposer({
  meterLevel,
  live,
  micIcon,
  micColor,
  micAccessibilityLabel,
  statusText,
  statusColor,
  busy = false,
  onMicPress,
  onMicPressIn,
  onMicPressOut,
  onKeypad,
  keypadAccessibilityLabel = 'Switch to keyboard',
  errorMessage,
  bottomPadding,
}: LiveComposerProps) {
  const level = live ? meterLevel : 0;
  const interactive = Boolean(onMicPress || onMicPressIn);

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: bottomPadding }}>
      <Text
        style={{
          color: statusColor,
          fontFamily: typography.family.semibold,
          fontSize: typography.scale.caption.fontSize,
          lineHeight: typography.scale.caption.lineHeight,
          textAlign: 'center',
          marginBottom: spacing.xs,
        }}
      >
        {statusText}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          borderRadius: radii.xxl,
          backgroundColor: colors.surface.card,
          borderWidth: 1,
          borderColor: colors.border.default,
        }}
      >
        {onKeypad && (
          <Pressable
            onPress={onKeypad}
            accessibilityRole="button"
            accessibilityLabel={keypadAccessibilityLabel}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: radii.md,
              backgroundColor: colors.surface.cardAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="keypad-outline" size={18} color={colors.text.secondary} />
          </Pressable>
        )}

        {/* Waveform — decorative; statusText carries the state for VoiceOver. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            height: spacing.xl,
          }}
        >
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <View
              key={i}
              style={{
                width: BAR_WIDTH,
                height: BAR_MAX_HEIGHT * barScale(i, level),
                borderRadius: BAR_WIDTH / 2,
                backgroundColor: colors.success.base,
                opacity: 0.35 + (i % 5) * 0.13,
              }}
            />
          ))}
        </View>

        <Pressable
          onPress={onMicPress}
          onPressIn={onMicPressIn}
          onPressOut={onMicPressOut}
          disabled={!interactive}
          accessibilityRole={interactive ? 'button' : 'image'}
          accessibilityLabel={micAccessibilityLabel}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: micColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <Ionicons name={micIcon} size={36} color={colors.text.onPrimary} />
          )}
        </Pressable>
      </View>

      {errorMessage && (
        <View
          style={{
            marginTop: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radii.md,
            backgroundColor: colors.error.tint,
          }}
        >
          <Text
            style={{
              color: colors.error.light,
              fontFamily: typography.family.medium,
              fontSize: typography.scale.tiny.fontSize,
              lineHeight: typography.scale.tiny.lineHeight,
              textAlign: 'center',
            }}
          >
            {errorMessage}
          </Text>
        </View>
      )}
    </View>
  );
}
