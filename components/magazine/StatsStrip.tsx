/**
 * StatsStrip — the progress line under the Home greeting.
 *
 * Was: three saturated Chips (XP in amber, hearts, streak). Then: one mono meta
 * row reading `1,240 XP`. Now: the learner's level and what it means.
 *
 * The point total is gone from view — not from the ledger, which still accrues
 * server-side and still backs achievements and offline replay. It went because
 * a number the learner is not being asked to act on was spending the top of
 * Home on a scoreboard, and because "1,240 XP" answers a question nobody asked.
 * "A2 · Handle short, routine exchanges on familiar topics" answers the one
 * they did.
 *
 * This used to be the adult-mode branch only. Adults are not the only people
 * who would rather know what they can do, so it is now what everyone sees.
 *
 * Hearts used to sit here as a glyph row. They are gone with the mechanic —
 * free usage is metered by the daily new-card cap instead, which is surfaced
 * where it applies (inside a lesson) rather than as ambient chrome.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../stores/useAppStore';
import { cefrBandForProficiencyLevel } from '../../lib/cefr-proficiency';
import { cefrCanDo, cefrAccessibilityLabel } from '../../lib/cefr-labels';
import { colors, spacing, typography } from '../../config/theme';

interface StatsStripProps {
  /** `center` lines the strip up under a centered greeting. */
  align?: 'left' | 'center';
}

export function StatsStrip({ align = 'left' }: StatsStripProps) {
  const profile = useAppStore((s) => s.profile);
  const band = cefrBandForProficiencyLevel(profile?.level ?? 'beginner');
  const centered = align === 'center';

  return (
    <View style={[styles.block, centered && styles.blockCentered]}>
      <View style={[styles.row, centered && styles.rowCentered]}>
        <Ionicons name="ribbon-outline" size={13} color={colors.action.accent} />
        {/* The code is the eyebrow; the sentence below is the substance. Read as
            one utterance by VoiceOver so the two are never separated. */}
        <Text
          style={[styles.meta, styles.emphasis]}
          accessibilityLabel={cefrAccessibilityLabel(band)}
        >
          LEVEL {band}
        </Text>
      </View>
      <Text
        style={[styles.canDo, centered && styles.canDoCentered]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {cefrCanDo(band)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: spacing.lg,
  },
  blockCentered: {
    alignItems: 'center',
  },
  rowCentered: {
    justifyContent: 'center',
  },
  canDoCentered: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Wraps rather than clips: at the accessibility text sizes this row's
    // 12pt mono runs past the screen width and the row clips.
    flexWrap: 'wrap',
    gap: spacing.xxs,
  },
  /** Mono meta voice, matching DateLabel. lineHeight is deliberately left to
   *  the face's natural line box — see config/theme.ts §leading. */
  meta: {
    fontFamily: typography.family.mono,
    fontSize: 12,
    letterSpacing: typography.tracking.eyebrow,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  /** The value itself, not its unit. Brighter than the unit label so the pair
   *  reads as one figure with a caption rather than two words. */
  emphasis: {
    fontFamily: typography.family.monoMedium,
    color: colors.text.primary,
  },
  /** Sentence case, body face — the eyebrow above is the only mono here. Set in
   *  the same tertiary as the eyebrow so the pair reads as one block. */
  canDo: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
});
