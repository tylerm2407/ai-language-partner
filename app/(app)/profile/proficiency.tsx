import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useProficiencyReport } from '../../../hooks/useProficiencyReport';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { GradientBackground } from '../../../components/ui/GradientBackground';
import { colors } from '../../../config/theme';
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

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  none: colors.text.quaternary,
  low: colors.warning.base,
  medium: colors.action.accent,
  high: colors.success.base,
};

function bandStatusColor(status: BandBreakdown['status']): string {
  switch (status) {
    case 'mastered':
      return colors.success.base;
    case 'developing':
      return colors.action.accent;
    case 'weak':
      return colors.warning.base;
    default:
      return colors.text.quaternary;
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
  const goBack = useSafeBack('/(app)');
  const { report, isLoading, error, refresh } = useProficiencyReport();

  return (
    <GradientBackground>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScreenHeader
          title="Proficiency Report"
          subtitle="Estimated from your practice history"
          onBack={() => goBack()}
        />

        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.action.accent} />
            <Text className="text-sm text-text-secondary mt-3">Reviewing your history…</Text>
          </View>
        )}

        {!isLoading && error && (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="alert-circle-outline" size={40} color={colors.error.base} />
            <Text className="text-base font-semibold text-text-primary mt-3 text-center">
              Could not build your report
            </Text>
            <Text className="text-sm text-text-secondary mt-1 mb-4 text-center">{error}</Text>
            <Pressable
              className="bg-primary px-6 py-3 rounded-[14px]"
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel="Retry loading your proficiency report"
            >
              <Text className="text-base font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !error && report && (
          <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Overall level */}
            <View className="bg-dark-card rounded-2xl p-6 items-center mt-2 mb-4">
              <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Overall level
              </Text>
              <Text
                className="text-text-primary font-bold my-2"
                style={{ fontSize: 56, lineHeight: 64 }}
                accessibilityLabel={
                  report.overallLevel
                    ? `Estimated CEFR level ${report.overallLevel}`
                    : 'Not yet assessed'
                }
              >
                {report.overallLevel ?? '—'}
              </Text>
              {!report.overallLevel && (
                <Text className="text-base font-semibold text-text-primary mb-1">
                  Not yet assessed
                </Text>
              )}
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: CONFIDENCE_COLORS[report.confidence],
                    marginRight: 6,
                  }}
                />
                <Text className="text-sm text-text-secondary">
                  {CONFIDENCE_LABELS[report.confidence]}
                </Text>
              </View>
            </View>

            {/* Honesty notice. Do not remove — the report's value depends on it
                being read as an estimate, not a certificate. */}
            <View className="bg-dark-card-alt rounded-2xl p-4 mb-6 flex-row">
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.text.tertiary}
                style={{ marginTop: 2 }}
              />
              <Text className="text-sm text-text-tertiary ml-3 flex-1">
                This is an estimate based on what you have practised in Fluenci. It is not an
                official CEFR certification.
              </Text>
            </View>

            {/* Next step */}
            {report.nextLevelRequirement && (
              <View className="bg-primary-tint border border-primary rounded-2xl p-5 mb-6">
                <Text className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-1">
                  {report.nextLevel ? `To reach ${report.nextLevel}` : 'Next step'}
                </Text>
                <Text className="text-base font-semibold text-text-primary">
                  {report.nextLevelRequirement}
                </Text>
              </View>
            )}

            {/* Per-skill breakdown */}
            <Text className="text-xl font-bold text-text-primary mb-3">By skill</Text>
            {report.skills.map((skill) => (
              <View
                key={skill.skill}
                className="bg-dark-card rounded-2xl p-5 mb-3 flex-row items-start"
              >
                <Ionicons
                  name={SKILL_ICONS[skill.skill]}
                  size={22}
                  color={colors.premium.base}
                  style={{ marginTop: 2 }}
                />
                <View className="ml-4 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-text-primary">
                      {SKILL_LABELS[skill.skill]}
                    </Text>
                    <Text
                      className="text-base font-bold"
                      style={{
                        color: skill.level ? colors.success.base : colors.text.quaternary,
                      }}
                    >
                      {skill.level ?? (skill.status === 'not_assessed' ? 'Not scored' : '—')}
                    </Text>
                  </View>
                  <Text className="text-sm text-text-secondary mt-1">{skill.detail}</Text>
                </View>
              </View>
            ))}

            {/* Band ladder */}
            <Text className="text-xl font-bold text-text-primary mt-4 mb-1">
              Vocabulary retention by level
            </Text>
            <Text className="text-sm text-text-secondary mb-3">
              How much of what you have studied at each level you still remember in long-term
              review.
            </Text>
            {report.bands.map((band) => (
              <View key={band.band} className="bg-dark-card rounded-2xl p-4 mb-2">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-text-primary">{band.band}</Text>
                  <Text className="text-sm font-semibold" style={{ color: bandStatusColor(band.status) }}>
                    {bandStatusLabel(band.status)}
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.surface.sunken,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(band.retentionRate * 100)}%`,
                      height: '100%',
                      backgroundColor: bandStatusColor(band.status),
                    }}
                  />
                </View>
                {/* Denominator is `mature`, not `seen`, because that is what
                    the bar above is drawn from. Labelling it "34 of 50" under
                    an 85% bar is just a wrong readout — the 16 unscored items
                    are still-settling new cards, which are deliberately kept
                    out of the rate so that starting new material cannot make
                    the learner's level appear to drop. */}
                <Text className="text-sm text-text-tertiary mt-2">
                  {band.seen === 0
                    ? 'No items studied yet'
                    : band.mature === 0
                      ? `${band.seen} ${band.seen === 1 ? 'item' : 'items'} started — too new to score yet`
                      : `${band.retained} of ${band.mature} retained${
                          band.seen > band.mature ? ` · ${band.seen - band.mature} still settling` : ''
                        }`}
                </Text>
              </View>
            ))}

            <Text className="text-sm text-text-quaternary text-center mt-6">
              Generated {new Date(report.generatedAt).toLocaleDateString()}
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}
