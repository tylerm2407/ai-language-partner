import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useProficiencyReport } from '../../../hooks/useProficiencyReport';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { cefrCanDo, cefrAccessibilityLabel } from '../../../lib/cefr-labels';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to.
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { spacing, type Ui2Palette } from '../../../config/theme';
import type {
  BandBreakdown,
  Confidence,
  SkillAssessment,
} from '../../../lib/cefr-proficiency';

const SKILL_LABELS: Record<SkillAssessment['skill'], string> = {
  vocabulary: 'Vocabulary',
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
  speaking: 'Speaking',
};

const SKILL_ICONS: Record<SkillAssessment['skill'], keyof typeof Ionicons.glyphMap> = {
  vocabulary: 'albums-outline',
  reading: 'book-outline',
  writing: 'create-outline',
  listening: 'headset-outline',
  speaking: 'mic-outline',
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  none: 'Not enough data yet',
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

/** The same four confidence steps; the palette is now the scheme-aware one, so
 *  the dot is legible in light mode as well. */
function confidenceColor(c: Ui2Palette, confidence: Confidence): string {
  switch (confidence) {
    case 'low':
      return c.yellow;
    case 'medium':
      return c.primary;
    case 'high':
      return c.green;
    default:
      return c.idle;
  }
}

function bandStatusColor(c: Ui2Palette, status: BandBreakdown['status']): string {
  switch (status) {
    case 'mastered':
      return c.green;
    case 'developing':
      return c.primary;
    case 'weak':
      return c.yellow;
    default:
      return c.idle;
  }
}

function bandStatusLabel(status: BandBreakdown['status']): string {
  switch (status) {
    case 'mastered':
      return 'Mastered';
    case 'developing':
      return 'Developing';
    case 'weak':
      return 'Needs work';
    default:
      return 'Not started';
  }
}

/**
 * Proficiency report — the learner's estimated CEFR level and the evidence
 * behind it.
 *
 * The screen shows the working, not just the verdict. That is the entire
 * point: a number a learner cannot interrogate is a vanity metric with extra
 * steps. Every claim here traces back to something they did.
 */
export default function ProficiencyScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(app)');
  const { report, isLoading, error, refresh } = useProficiencyReport();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <Ui2Header
          title="Proficiency Report"
          subtitle="Estimated from your practice history"
          onBack={() => goBack()}
        />

        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.primary} />
            <Text className="text-sm mt-3" style={{ color: c.muted }}>Reviewing your history…</Text>
          </View>
        )}

        {!isLoading && error && (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="alert-circle-outline" size={40} color={c.error} />
            <Text className="text-base font-semibold mt-3 text-center" style={{ color: c.ink }}>
              Could not build your report
            </Text>
            <Text className="text-sm mt-1 mb-4 text-center" style={{ color: c.muted }}>{error}</Text>
            <Pressable
              className="px-6 py-3 rounded-[14px]"
              style={{ backgroundColor: c.primary }}
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel="Retry loading your proficiency report"
            >
              <Text className="text-base font-semibold" style={{ color: c.onPrimary }}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !error && report && (
          <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Overall level */}
            <SlabCard
              style={{
                padding: spacing.lg,
                alignItems: 'center',
                marginTop: spacing.xs,
                marginBottom: spacing.md,
              }}
            >
              <Text className="text-sm font-semibold uppercase tracking-wide" style={{ color: c.muted }}>
                Overall level
              </Text>
              <Text
                className="font-bold my-2"
                style={{ fontSize: 56, lineHeight: 64, color: c.ink }}
                accessibilityLabel={
                  report.overallLevel
                    ? `Estimated level. ${cefrAccessibilityLabel(report.overallLevel)}`
                    : 'Not yet assessed'
                }
              >
                {report.overallLevel ?? '—'}
              </Text>
              {report.overallLevel ? (
                /* A 56pt "B1" on its own is the single largest thing on this
                   screen and the least informative. This is what it claims. */
                <Text
                  className="text-base text-center mb-1"
                  style={{ color: c.muted }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {cefrCanDo(report.overallLevel)}
                </Text>
              ) : (
                <Text className="text-base font-semibold mb-1" style={{ color: c.ink }}>
                  Not yet assessed
                </Text>
              )}
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: confidenceColor(c, report.confidence),
                    marginRight: 6,
                  }}
                />
                <Text className="text-sm" style={{ color: c.muted }}>
                  {CONFIDENCE_LABELS[report.confidence]}
                </Text>
              </View>
            </SlabCard>

            {/* Honesty notice. Do not remove — the report's value depends on it
                being read as an estimate, not a certificate. */}
            <SlabCard style={{ marginBottom: spacing.lg, flexDirection: 'row' }}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={c.idle}
                style={{ marginTop: 2 }}
              />
              <Text className="text-sm ml-3 flex-1" style={{ color: c.idle }}>
                This is an estimate based on what you have practised in Fluenci. It is not an
                official CEFR certification.
              </Text>
            </SlabCard>

            {/* Next step */}
            {report.nextLevelRequirement && (
              <SlabCard tint="primary" style={{ marginBottom: spacing.lg }}>
                <Text
                  className="text-sm font-semibold uppercase tracking-wide mb-1"
                  style={{ color: c.onTint }}
                  accessibilityLabel={
                    report.nextLevel
                      ? `To reach ${cefrAccessibilityLabel(report.nextLevel)}`
                      : 'Next step'
                  }
                >
                  {report.nextLevel ? `To reach ${report.nextLevel}` : 'Next step'}
                </Text>
                {report.nextLevel ? (
                  <Text
                    className="text-sm mb-2"
                    style={{ color: c.muted }}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  >
                    {cefrCanDo(report.nextLevel)}
                  </Text>
                ) : null}
                <Text className="text-base font-semibold" style={{ color: c.ink }}>
                  {report.nextLevelRequirement}
                </Text>
              </SlabCard>
            )}

            {/* Per-skill breakdown */}
            <Text className="text-xl font-bold mb-3" style={{ color: c.ink }}>By skill</Text>
            {report.skills.map((skill) => (
              <SlabCard
                key={skill.skill}
                style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'flex-start' }}
              >
                <Ionicons
                  name={SKILL_ICONS[skill.skill]}
                  size={22}
                  color={c.onTint}
                  style={{ marginTop: 2 }}
                />
                <View className="ml-4 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold" style={{ color: c.ink }}>
                      {SKILL_LABELS[skill.skill]}
                    </Text>
                    <Text
                      className="text-base font-bold"
                      style={{
                        color: skill.level ? c.green : c.idle,
                      }}
                      accessibilityLabel={
                        skill.level
                          ? cefrAccessibilityLabel(skill.level)
                          : skill.status === 'not_assessed'
                            ? 'Not scored'
                            : 'Not yet assessed'
                      }
                    >
                      {skill.level ?? (skill.status === 'not_assessed' ? 'Not scored' : '—')}
                    </Text>
                  </View>
                  {/* The code on the right is the verdict; this is what it means.
                      `detail` below is the evidence for it. */}
                  {skill.level ? (
                    <Text
                      className="text-sm mt-1"
                      style={{ color: c.muted }}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      {cefrCanDo(skill.level)}
                    </Text>
                  ) : null}
                  <Text className="text-sm mt-1" style={{ color: c.muted }}>{skill.detail}</Text>
                </View>
              </SlabCard>
            ))}

            {/* Band ladder */}
            <Text className="text-xl font-bold mt-4 mb-1" style={{ color: c.ink }}>
              Vocabulary retention by level
            </Text>
            <Text className="text-sm mb-3" style={{ color: c.muted }}>
              How much of what you have studied at each level you still remember in long-term
              review.
            </Text>
            {report.bands.map((band) => (
              <SlabCard key={band.band} style={{ marginBottom: spacing.xs }}>
                <View className="flex-row items-start justify-between mb-2" style={{ gap: 12 }}>
                  <View className="flex-1">
                    <Text
                      className="text-base font-bold"
                      style={{ color: c.ink }}
                      accessibilityLabel={cefrAccessibilityLabel(band.band)}
                    >
                      {band.band}
                    </Text>
                    <Text
                      className="text-sm mt-0.5"
                      style={{ color: c.idle }}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      {cefrCanDo(band.band)}
                    </Text>
                  </View>
                  {/* Status is a word, not just the bar's colour — the bar below
                      repeats it as length and hue, neither of which is a cue on
                      its own. */}
                  <Text className="text-sm font-semibold" style={{ color: bandStatusColor(c, band.status) }}>
                    {bandStatusLabel(band.status)}
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: c.track,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(band.retentionRate * 100)}%`,
                      height: '100%',
                      backgroundColor: bandStatusColor(c, band.status),
                    }}
                  />
                </View>
                {/* Denominator is `mature`, not `seen`, because that is what
                    the bar above is drawn from. Labelling it "34 of 50" under
                    an 85% bar is just a wrong readout — the 16 unscored items
                    are still-settling new cards, which are deliberately kept
                    out of the rate so that starting new material cannot make
                    the learner's level appear to drop. */}
                <Text className="text-sm mt-2" style={{ color: c.idle }}>
                  {band.seen === 0
                    ? 'No items studied yet'
                    : band.mature === 0
                      ? `${band.seen} ${band.seen === 1 ? 'item' : 'items'} started — too new to score yet`
                      : `${band.retained} of ${band.mature} retained${
                          band.seen > band.mature ? ` · ${band.seen - band.mature} still settling` : ''
                        }`}
                </Text>
              </SlabCard>
            ))}

            <Text className="text-sm text-center mt-6" style={{ color: c.idle }}>
              Generated {new Date(report.generatedAt).toLocaleDateString()}
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
