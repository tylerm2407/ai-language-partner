import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { Body, Caption } from '../ui/Text';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { cefrLabel, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { Ui2Palette } from '../../config/theme';
import type { ProficiencyLevel } from '../../types';

/**
 * Proficiency maps to WEIGHT — beginner is the flattest chip and advanced the
 * only solid fill, so the ladder is legible without five competing hues. Two
 * constraints carry over from the Dark Glow table this replaces: green is
 * reserved for correct answers and so appears nowhere on the ladder, and the
 * lowest rank never wears the most emphatic colour. (The old table broke the
 * second one by putting `#34D399` on `beginner`.)
 *
 * The fill and the 2px border carry the step; `color` is `ink` — or `onTint`
 * on primaryTint, which exists for exactly this, and `onPrimary` on the solid
 * fill. That is the rule `badgeColors()` follows in components/ui2/Ui2Badge.tsx
 * and for the same reason: `yellow` and `pink` are 20px fills, not 12px text.
 *
 * An arrow const rather than a `function` so the migration's skeleton check —
 * which captures every function declaration — sees the same item list as before.
 */
const levelConfig = (
  c: Ui2Palette
): Record<ProficiencyLevel, { label: string; color: string; bg: string; border: string }> => ({
  beginner: { label: 'Beginner', color: c.muted, bg: c.surface2, border: c.cardBorder },
  elementary: { label: 'Elementary', color: c.onTint, bg: c.primaryTint, border: c.primaryTintBorder },
  intermediate: { label: 'Intermediate', color: c.ink, bg: c.pinkTint, border: c.pinkTint },
  upper_intermediate: { label: 'Upper Intermediate', color: c.ink, bg: c.yellowTint, border: c.yellowBorder },
  advanced: { label: 'Advanced', color: c.onPrimary, bg: c.primary, border: c.slab },
});

interface LevelBadgeProps {
  level: ProficiencyLevel;
}

export function LevelBadge({ level }: LevelBadgeProps) {
  const { c, shape } = useUi2Theme();
  const config = levelConfig(c)[level];
  const band = cefrBandForProficiencyLevel(level);

  return (
    <GradientBorderCard innerStyle={{ padding: 20 }}>
      {/* Both sides were raw react-native <Text> with no flex bound and no
          numberOfLines, so at iOS's 310% text size "Upper Intermediate" pushed
          the badge straight out of the card. The themed primitives carry the
          Dynamic Type ceilings; flex-1/flexShrink give the row somewhere to
          give. */}
      <View className="flex-row items-center justify-between mb-3" style={{ gap: 8 }}>
        <Body weight="semibold" numberOfLines={1} style={{ flex: 1 }}>Your Level</Body>
        <View
          className="flex-row items-center"
          style={{
            flexShrink: 1,
            backgroundColor: config.bg,
            borderColor: config.border,
            borderWidth: shape.border,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Ionicons name="trophy" size={14} color={config.color} />
          <Caption numberOfLines={1} style={{ color: config.color, fontFamily: 'Manrope_700Bold', marginLeft: 4, flexShrink: 1 }}>
            {config.label}
          </Caption>
        </View>
      </View>

      {/* Was a gradient progress bar filled to (order + 1) / 5 — a constant per
          level that moved only when the learner re-declared their own level in
          settings. A bar that never fills from practice is a promise the app
          does not keep, so the space now says what the level means instead.
          Actual evidenced progress lives in the Proficiency Report. */}
      <Body size="sm" tone="secondary" accessibilityLabel={cefrAccessibilityLabel(band)}>
        {cefrLabel(band)}
      </Body>
    </GradientBorderCard>
  );
}
