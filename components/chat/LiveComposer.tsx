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
import { radii, spacing, typography, ui2Shape } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { VoiceGender } from '../../lib/voice-preference';

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
  /** Tutor voice preference. Omit both to hide the switch. */
  voiceGender?: VoiceGender;
  onVoiceGenderChange?: (gender: VoiceGender) => void;
}

const VOICE_OPTIONS: { value: VoiceGender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

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
  voiceGender,
  onVoiceGenderChange,
}: LiveComposerProps) {
  const { c } = useUi2Theme();
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

      {/* Voice switch. Sits above the card rather than inside it because the
          card's three controls are all per-turn actions and this is a setting —
          and because a fourth pill would crowd the mic below 44pt. */}
      {voiceGender && onVoiceGenderChange && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Tutor voice"
          style={{
            flexDirection: 'row',
            alignSelf: 'center',
            gap: spacing.xxs,
            padding: spacing.xxs,
            marginBottom: spacing.xs,
            borderRadius: radii.pill,
            backgroundColor: c.surface2,
          }}
        >
          {VOICE_OPTIONS.map(({ value, label }) => {
            const selected = voiceGender === value;
            return (
              <Pressable
                key={value}
                onPress={() => onVoiceGenderChange(value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${label} tutor voice`}
                hitSlop={8}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radii.pill,
                  backgroundColor: selected ? c.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: selected ? c.onPrimary : c.idle,
                    fontFamily: typography.family.semibold,
                    fontSize: typography.scale.caption.fontSize,
                    lineHeight: typography.scale.caption.lineHeight,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          borderRadius: radii.xxl,
          backgroundColor: c.card,
          // Slab treatment: on a light phone `card` and `bg` are both #FFFFFF,
          // so the 2px outline plus the 5px bottom edge is the only thing that
          // holds the composer off the screen behind it.
          borderWidth: ui2Shape.border,
          borderBottomWidth: ui2Shape.slab,
          borderColor: c.cardBorder,
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
              backgroundColor: c.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="keypad-outline" size={18} color={c.muted} />
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
                backgroundColor: c.green,
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
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Ionicons name={micIcon} size={36} color={c.onPrimary} />
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
            // No error TINT token exists in UI 2.0, and inventing one here
            // would be a palette change. An outline plus error-coloured text
            // is the same signal Ui2Input uses and it reads in both schemes.
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.error,
          }}
        >
          <Text
            style={{
              color: c.error,
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
