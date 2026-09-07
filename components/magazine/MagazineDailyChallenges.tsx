import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MagazineGlassCard } from './MagazineGlassCard';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { QuestCountdown } from '../gamification/QuestCountdown';
import { useDailyChallenges } from '../../hooks/useDailyChallenges';
import { typography, radii, ui2Dark, ui2Light, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { DailyStats } from '../../types';

interface MagazineDailyChallengesProps {
  dailyStats: DailyStats | null;
}

// Editorial face. Fraunces_600SemiBold carries its own weight — never pair it
// with fontWeight, which makes Android synthesize a second bolding pass.
const serifFont = typography.family.serif;

/**
 * The theme is destructured as `palette`, not `c`: the challenge rows below
 * already bind `c` to the challenge itself, and shadowing it would silently
 * swap the two inside the map.
 */
export function MagazineDailyChallenges({ dailyStats }: MagazineDailyChallengesProps) {
  const { c: palette, scheme } = useUi2Theme();
  const { challenges, allCompleted } = useDailyChallenges();

  return (
    <MagazineGlassCard style={themed[scheme].card}>
      {/* Header */}
      <View style={themed[scheme].headerRow}>
        <Text style={themed[scheme].headerTitle}>Your daily three</Text>
        <QuestCountdown />
      </View>

      {/* Challenge rows */}
      {challenges.map((c) => {
        const progress = c.target > 0 ? Math.min(c.current / c.target, 1) : 0;
        const isComplete = c.current >= c.target;

        return (
          <View key={c.type} style={themed[scheme].challengeRow}>
            <View style={[themed[scheme].iconCircle, { backgroundColor: c.color + '20' }]}>
              {isComplete ? (
                <Ionicons name="checkmark" size={14} color={palette.green} />
              ) : (
                <Ionicons name={c.icon as any} size={14} color={c.color} />
              )}
            </View>
            <View style={themed[scheme].challengeText}>
              <Text
                style={[
                  themed[scheme].challengeTitle,
                  isComplete && themed[scheme].challengeComplete,
                ]}
              >
                {c.title}
              </Text>
              <View style={themed[scheme].progressRow}>
                <View style={themed[scheme].progressBarWrap}>
                  <Ui2ProgressBar progress={progress} height={4} />
                </View>
              </View>
            </View>
          </View>
        );
      })}

      {/* Finishing all three is worth saying out loud. There is nothing to
          claim: the reward for practising is the practice, and points are not
          something this product shows a learner any more. */}
      {allCompleted && (
        <View style={themed[scheme].bonusSection}>
          <Text style={themed[scheme].bonusClaimed}>All three done today</Text>
        </View>
      )}
    </MagazineGlassCard>
  );
}

const makeStyles = (c: Ui2Palette) =>
  StyleSheet.create({
  card: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: serifFont,
    fontSize: 18,
    color: c.ink,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  challengeText: {
    flex: 1,
  },
  challengeTitle: {
    fontFamily: typography.family.regular,
    fontSize: 14,
    color: c.ink,
    marginBottom: 4,
  },
  challengeComplete: {
    color: c.green,
    textDecorationLine: 'line-through',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarWrap: {
    flex: 1,
  },
  xpPill: {
    backgroundColor: c.yellowTint,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 10,
  },
  xpText: {
    fontFamily: typography.family.monoMedium,
    fontSize: 11,
    color: c.ink,
  },
  bonusSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.cardBorder,
    alignItems: 'center',
  },
  bonusClaimed: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: c.green,
    fontWeight: '600',
  },
  bonusClaim: {
    fontFamily: typography.family.regular,
    fontSize: 13,
    color: c.ink,
    fontWeight: '600',
  },
  });

/** Both schemes built once at module load — see DateLabel for why. */
const themed = { light: makeStyles(ui2Light), dark: makeStyles(ui2Dark) } as const;
