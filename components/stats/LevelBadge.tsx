import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientBorderCard } from '../ui/GradientBorderCard';
import { Body, Caption } from '../ui/Text';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { cefrLabel, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import type { ProficiencyLevel } from '../../types';

const LEVEL_CONFIG: Record<ProficiencyLevel, { label: string; color: string; bg: string }> = {
  // Proficiency maps to BRIGHTNESS — beginner is the dimmest label and advanced
  // the brightest, so the ladder is legible without five competing hues. The
  // green that briefly landed on `beginner` here was wrong twice over: it is
  // the lowest rank wearing the most emphatic colour, and green is reserved for
  // correct answers (config/theme.ts §Semantic).
  beginner: { label: 'Beginner', color: '#34D399', bg: '#0D261A' },
  elementary: { label: 'Elementary', color: '#60A5FA', bg: '#1A2340' },
  intermediate: { label: 'Intermediate', color: '#38BDF8', bg: '#0C1A2E' },
  upper_intermediate: { label: 'Upper Intermediate', color: '#A78BFA', bg: '#251A35' },
  advanced: { label: 'Advanced', color: '#FBBF24', bg: '#26210F' },
};

interface LevelBadgeProps {
  level: ProficiencyLevel;
}

export function LevelBadge({ level }: LevelBadgeProps) {
  const config = LEVEL_CONFIG[level];
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
          style={{ flexShrink: 1, backgroundColor: config.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
        >
          <Ionicons name="trophy" size={14} color={config.color} />
          <Caption numberOfLines={1} style={{ color: config.color, fontFamily: 'Nunito_700Bold', marginLeft: 4, flexShrink: 1 }}>
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
