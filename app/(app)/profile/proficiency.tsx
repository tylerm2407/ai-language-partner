import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import { useProficiencyReport } from '../../../hooks/useProficiencyReport';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { CefrExplainerSheet, useCefrExplainer } from '../../../components/ui2/CefrExplainerSheet';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { ProgressRing } from '../../../components/ui2/home/HomeSections';
import { cefrCanDo, cefrAccessibilityLabel } from '../../../lib/cefr-labels';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to.
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { spacing, type Ui2Palette } from '../../../config/theme';
import {
  STRAND_WEIGHTS,
  type Confidence,
  type SkillAssessment,
  type SkillKey,
} from '../../../lib/cefr-proficiency';
import {
  ringForReport,
  ringIsMeasured,
  type NextBandProgress,
  type StrandProgress,
} from '../../../lib/next-band-progress';
import type { LevelHistoryEntry } from '../../../types';

const SKILL_LABELS: Record<SkillKey, string> = {
  interaction: 'Conversation',
  vocabulary: 'Vocabulary',
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
  speaking: 'Speaking',
};

const SKILL_ICONS: Record<SkillKey, keyof typeof Ionicons.glyphMap> = {
  interaction: 'chatbubbles-outline',
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

/**
 * The eyebrow over the ring. Mirrors Home's `levelEyebrow` word for word, so
 * the two surfaces cannot name the same band as both held and being proved.
 */
function ringEyebrow(next: string | null, percent: number | null, measured: boolean): string {
  if (percent === null) return 'Level';
  if (next === null) return 'Top band';
  if (!measured) return `Proving ${next} · ${percent}%`;
  return `${percent}% to ${next}`;
}

/**
 * One strand's row inside "How this works".
 *
 * The three numbers that decide a level, in the order they matter: what the
 * strand is worth, how far along it is, and the countable evidence behind it.
 * Before this row existed the report showed six per-skill cards with no weight
 * on them at all, so a learner grinding flashcards had no way to learn that
 * vocabulary is 0.12 of their level and conversation is 0.55.
 */
function StrandRow({
  c,
  skill,
  progress,
  assessment,
  target,
}: {
  c: Ui2Palette;
  skill: SkillKey;
  progress: StrandProgress | null;
  assessment: SkillAssessment | undefined;
  target: string | null;
}) {
  const weightPct = Math.round(STRAND_WEIGHTS[skill] * 100);
  const fraction = progress?.fraction ?? 0;
  const met = progress?.met ?? false;
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View className="flex-row items-center" style={{ gap: spacing.sm }}>
        <Ionicons name={SKILL_ICONS[skill]} size={18} color={c.onTint} />
        <Text className="text-base font-semibold flex-1" style={{ color: c.ink }}>
          {SKILL_LABELS[skill]}
        </Text>
        {/* The weight is the point of this row. It is not decoration: it is the
            reason to spend the next fifteen minutes on one strand over another. */}
        <Text
          className="text-xs font-semibold"
          style={{ color: c.muted }}
          accessibilityLabel={`Worth ${weightPct} percent of your level`}
        >
          {weightPct}% of level
        </Text>
      </View>

      {target ? (
        <View
          className="mt-2"
          accessibilityRole="progressbar"
          accessibilityLabel={
            met
              ? `${cefrAccessibilityLabel(target)} held in ${SKILL_LABELS[skill].toLowerCase()}`
              : `${pct} percent of the way to ${cefrAccessibilityLabel(target)} in ${SKILL_LABELS[skill].toLowerCase()}`
          }
          accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
          <View style={{ height: 4, borderRadius: 2, backgroundColor: c.track, overflow: 'hidden' }}>
            <View
              style={{ width: `${pct}%`, height: '100%', backgroundColor: met ? c.green : c.primary }}
            />
          </View>
        </View>
      ) : null}

      {/* `detail` is the countable evidence: "12 conversations across 9 days".
          It is what makes the bar above interrogable rather than decorative. */}
      <Text className="text-sm mt-1.5" style={{ color: c.muted }}>
        {assessment?.detail ?? 'Nothing logged yet.'}
      </Text>
    </View>
  );
}

/**
 * How long ago, in the coarsest unit that is still true.
 *
 * Coarse on purpose: "3 weeks ago" is what a learner wants from a level change,
 * and a timestamp to the minute would imply a precision the measurement does
 * not have. Days rather than hours below a week for the same reason.
 */
function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * One recorded band change.
 *
 * This is the only thing on the screen that can answer "am I moving?". The
 * report itself is recomputed from evidence on every load, so it has always
 * been able to say what the learner IS and never what they WERE — see migration
 * 143. A row that went DOWN renders exactly like one that went up, in the same
 * grey: hiding demotions would make the list a trophy shelf rather than a
 * record, and a learner whose level dropped is owed the reason more than
 * anyone.
 */
function HistoryRow({ c, entry, now }: { c: Ui2Palette; entry: LevelHistoryEntry; now: Date }) {
  const moved = entry.previousBand ? `${entry.previousBand} → ${entry.band}` : entry.band;
  return (
    <View
      className="flex-row items-center"
      style={{ paddingVertical: spacing.xs }}
      accessible
      accessibilityLabel={
        entry.previousBand
          ? `${cefrAccessibilityLabel(entry.previousBand)} to ${cefrAccessibilityLabel(entry.band)}, ${timeAgo(entry.measuredAt, now)}, from your ${entry.source === 'test' ? 'level test' : 'practice'}`
          : `${cefrAccessibilityLabel(entry.band)}, ${timeAgo(entry.measuredAt, now)}`
      }
    >
      <Text
        className="text-base font-semibold"
        style={{ color: c.ink, minWidth: 92 }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {moved}
      </Text>
      <Text
        className="text-sm flex-1"
        style={{ color: c.muted }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {timeAgo(entry.measuredAt, now)}
      </Text>
      {/* The source is not decoration: a band from a five-minute test and a band
          from six weeks of practice are different claims, and a history that
          flattened them would be unreadable the moment both appear in it. */}
      <Text
        className="text-xs"
        style={{ color: c.idle }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {entry.source === 'test' ? 'Level test' : 'Practice'}
      </Text>
    </View>
  );
}

/**
 * Proficiency report — the learner's estimated CEFR level, one thing to do
 * next, and the working behind both.
 *
 * Structure is deliberate and was chosen over the previous long scroll (six
 * skill cards plus a six-rung vocabulary-retention ladder, ~500pt of evidence
 * before any instruction). A learner opens this screen with two questions —
 * what am I, and what do I do — and the old layout answered neither above the
 * fold. So: level, one action, the test, then everything else behind one
 * disclosure.
 *
 * What did NOT change is that the working is still *here*. A number a learner
 * cannot interrogate is a vanity metric with extra steps; collapsing the
 * evidence is not the same as withholding it, and "How this works" now shows
 * something the old cards never did — each strand's WEIGHT, which is the only
 * way to understand why a month of flashcards moved the level by nothing.
 */
export default function ProficiencyScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack('/(app)/profile');
  const router = useRouter();
  const { report, history, isLoading, error, refresh } = useProficiencyReport();
  const cefrExplainer = useCefrExplainer();
  const [showWorking, setShowWorking] = useState(false);

  // `ringForReport` is the SAME function Home's level card calls, so the bars
  // here and the ring there are one number rather than two implementations of
  // the same idea. It also owns the target choice, including the case where the
  // level came from a test and the practice model has proved nothing.
  const ring: NextBandProgress | null = report ? ringForReport(report) : null;

  // "Measured" means measured FROM PRACTICE. A test-published level is a level
  // and still has every rung of the strand model left to prove, so the ring
  // says "Proving B1" under a B1 badge — which is the honest reading.
  const measured = report ? ringIsMeasured(report) : false;
  const fromTest = report?.levelSource === 'test';
  const hasLevel = !!report?.overallLevel;
  // The band the ring is drawn around: the level the learner has, else the one
  // being proved. Never a bare dash when either exists.
  const heroBand = report?.overallLevel ?? report?.nextLevel ?? null;

  /**
   * The one thing to do next.
   *
   * `nextLevelSteps` is ordered conversation-first because conversation is 0.55
   * of the score. The exception is the publish gate: when confidence is `none`
   * no band is published at all regardless of strand work, and that step is
   * appended last, so it has to be promoted or the screen would tell a brand
   * new learner to hold twelve conversations while the actual blocker is thirty
   * logged reviews.
   */
  // One clock for the render. `generatedAt` is the report's own timestamp, so
  // "3 weeks ago" is measured from the same instant the numbers above it were.
  const generatedAt = report ? new Date(report.generatedAt) : new Date();

  const steps = report?.nextLevelSteps ?? [];
  const primaryAction =
    report?.confidence === 'none' && steps.length > 0 ? steps[steps.length - 1] : steps[0] ?? null;
  const remainingSteps = steps.filter((s) => s !== primaryAction);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <Ui2Header
          title="Proficiency Report"
          subtitle="Estimated from your practice history"
          onBack={() => goBack()}
          right={
            <Pressable
              onPress={cefrExplainer.open}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="What is a CEFR level?"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="help-circle-outline" size={24} color={c.muted} />
            </Pressable>
          }
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
            {/* ── The level, as one number ────────────────────────────────── */}
            <SlabCard
              hero
              style={{
                padding: spacing.lg,
                alignItems: 'center',
                marginTop: spacing.xs,
                marginBottom: spacing.md,
              }}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={
                measured
                  ? `Measured level. ${cefrAccessibilityLabel(report.overallLevel as string)}`
                  : fromTest
                    ? `Level from your test. ${cefrAccessibilityLabel(report.overallLevel as string)}. Not yet measured from practice.`
                    : heroBand
                      ? `Not yet measured. Working toward ${cefrAccessibilityLabel(heroBand)}`
                      : 'Not yet assessed'
              }
              accessibilityValue={
                ring
                  ? {
                      min: 0,
                      max: 100,
                      now: ring.percent,
                      text: ringEyebrow(ring.next, ring.percent, measured),
                    }
                  : undefined
              }
            >
              <Text
                className="text-sm font-semibold uppercase tracking-wide mb-3"
                style={{ color: c.muted }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {ring ? ringEyebrow(ring.next, ring.percent, measured) : 'Level'}
              </Text>

              {/* A ring rather than a bare 56pt band, and it is the whole fix
                  for the unassessed dead end: an unmeasured learner used to get
                  "—" and a list of things they had not touched, which reads as
                  "nothing you have done counts". The arithmetic for their
                  progress already existed — `progressToward` — and was only
                  being spent on six small per-skill bars further down. */}
              <ProgressRing
                pct={ring ? ring.fraction : 0}
                size={132}
                stroke={12}
                color={hasLevel ? c.primary : c.yellow}
                track={c.track}
              >
                {heroBand ? (
                  /* A learner who HAS a level sees the band; one who does not
                     sees how far they are from getting one. The percentage is
                     the fix for the old dead end, not a replacement for a band
                     the learner has actually earned — so a tested level renders
                     as a band even though the ring around it is still filling. */
                  <View style={{ alignItems: 'center' }}>
                    <Text
                      className="font-bold"
                      style={{
                        fontSize: hasLevel ? 40 : 30,
                        lineHeight: hasLevel ? 46 : 34,
                        color: c.ink,
                      }}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      {hasLevel ? heroBand : `${ring?.percent ?? 0}%`}
                    </Text>
                    {!hasLevel ? (
                      <Text
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: c.muted }}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      >
                        to {heroBand}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text className="font-bold" style={{ fontSize: 34, lineHeight: 40, color: c.idle }}>
                    —
                  </Text>
                )}
              </ProgressRing>

              {heroBand ? (
                /* A band code on its own is the least informative thing on this
                   screen. This is what it claims. */
                <Text
                  className="text-base text-center mt-3"
                  style={{ color: c.muted }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {cefrCanDo(heroBand)}
                </Text>
              ) : (
                <Text className="text-base font-semibold text-center mt-3" style={{ color: c.ink }}>
                  Not yet assessed
                </Text>
              )}

              {!measured && heroBand && !fromTest ? (
                <Text className="text-sm text-center mt-1" style={{ color: c.muted }}>
                  Not measured yet — this is the level you are working toward.
                </Text>
              ) : null}

              {report.levelBasis ? (
                /* Which rungs under the level were assumed from placement rather
                   than measured. Part of the honesty the notice below promises,
                   so it sits with the level, not in a footnote. */
                <Text className="text-sm text-center mt-1" style={{ color: c.muted }}>
                  {report.levelBasis}
                </Text>
              ) : null}

              <View className="flex-row items-center mt-2">
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

            {/* ── One action ──────────────────────────────────────────────── */}
            {primaryAction ? (
              <SlabCard tint="primary" style={{ marginBottom: spacing.md }}>
                <Text
                  className="text-sm font-semibold uppercase tracking-wide mb-1"
                  style={{ color: c.onTint }}
                >
                  Do this next
                </Text>
                <Text className="text-base font-semibold" style={{ color: c.ink }}>
                  {primaryAction}
                </Text>
                {remainingSteps.length > 0 ? (
                  /* The other requirements are real and are not hidden — they
                     are in "How this works", one tap away. Showing all five here
                     is what made the old card read as a chore list. */
                  <Text className="text-xs mt-2" style={{ color: c.muted }}>
                    {remainingSteps.length} more requirement
                    {remainingSteps.length === 1 ? '' : 's'} for{' '}
                    {report.nextLevel ?? 'the next level'} — see How this works
                  </Text>
                ) : null}
              </SlabCard>
            ) : null}

            {/* ── Am I moving? ────────────────────────────────────────────── */}
            {history.length > 0 ? (
              <SlabCard style={{ marginBottom: spacing.md }}>
                <Text
                  className="text-sm font-semibold uppercase tracking-wide mb-2"
                  style={{ color: c.muted }}
                >
                  Your level over time
                </Text>
                {history.slice(0, 5).map((entry) => (
                  <HistoryRow key={entry.id} c={c} entry={entry} now={generatedAt} />
                ))}
                {history.length > 5 ? (
                  <Text className="text-xs mt-2" style={{ color: c.idle }}>
                    Showing the 5 most recent of {history.length} changes
                  </Text>
                ) : null}
              </SlabCard>
            ) : null}

            {/* ── The test ────────────────────────────────────────────────── */}
            <Pressable
              onPress={() => router.push('/(app)/profile/checkpoint')}
              accessibilityRole="button"
              accessibilityLabel="Take the level test"
              accessibilityHint="A five minute test of listening, reading, writing and speaking"
              style={{ marginBottom: spacing.md }}
            >
              <SlabCard style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="clipboard-outline" size={22} color={c.onTint} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text className="text-base font-semibold" style={{ color: c.ink }}>
                    Take the level test
                  </Text>
                  <Text className="text-sm mt-0.5" style={{ color: c.muted }}>
                    {measured
                      ? 'Five minutes of fresh questions. Compare it against this report.'
                      : 'Five minutes of fresh questions — the fastest way to a level.'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </SlabCard>
            </Pressable>

            {/* Honesty notice. Do not remove — the report's value depends on it
                being read as an estimate, not a certificate. */}
            <SlabCard style={{ marginBottom: spacing.md, flexDirection: 'row' }}>
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

            {/* ── How this works ─────────────────────────────────────────── */}
            <Pressable
              onPress={() => setShowWorking((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="How this works"
              accessibilityHint="Shows the six strands your level is measured from"
              accessibilityState={{ expanded: showWorking }}
            >
              <SlabCard style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calculator-outline" size={22} color={c.onTint} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text className="text-base font-semibold" style={{ color: c.ink }}>
                    How this works
                  </Text>
                  <Text className="text-sm mt-0.5" style={{ color: c.muted }}>
                    The six strands behind your level, and what each is worth
                  </Text>
                </View>
                <Ionicons
                  name={showWorking ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={c.muted}
                />
              </SlabCard>
            </Pressable>

            {showWorking ? (
              <SlabCard style={{ marginTop: spacing.xs, padding: spacing.md }}>
                <Text className="text-sm mb-4" style={{ color: c.muted }}>
                  Your level is a weighted score across six strands. A band is held once that
                  score reaches 70% and every band below it does too — so no single strand can
                  carry a level on its own.
                </Text>

                {report.skills.map((skill) => (
                  <StrandRow
                    key={skill.skill}
                    c={c}
                    skill={skill.skill}
                    progress={ring?.strands.find((s) => s.skill === skill.skill) ?? null}
                    assessment={skill}
                    target={ring?.next ?? null}
                  />
                ))}

                {remainingSteps.length > 0 ? (
                  <View style={{ marginTop: spacing.xs }}>
                    <Text className="text-base font-semibold mb-2" style={{ color: c.ink }}>
                      Everything still needed for {report.nextLevel}
                    </Text>
                    {steps.map((step) => (
                      <Text key={step} className="text-sm mb-1.5" style={{ color: c.muted }}>
                        • {step}
                      </Text>
                    ))}
                  </View>
                ) : null}

                <Text className="text-xs mt-3" style={{ color: c.idle }}>
                  Generated {new Date(report.generatedAt).toLocaleDateString()}
                </Text>
              </SlabCard>
            ) : null}
          </ScrollView>
        )}
        {/* No report link: this is the report. */}
        <CefrExplainerSheet
          visible={cefrExplainer.visible}
          onDismiss={cefrExplainer.close}
          band={report?.overallLevel ?? null}
        />
      </SafeAreaView>
    </View>
  );
}
