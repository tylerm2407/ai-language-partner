/**
 * ScenarioPicker — what the Situations tab shows before a conversation.
 *
 * "Situations", not "AI Chat" (Tyler, 2026-09-08): the old title named the
 * technology rather than what the learner gets. The AI is still disclosed —
 * the consent sheet, and the subtitle's "your tutor".
 *
 * Direction G1 "Gallery" (canvas "AI Chat · picker", 2026-09-08): a
 * two-column grid of scene tiles, Free Chat last and full width, a sheet per
 * scene, and ONE button. The old "Text Chat" / "Live Voice" pair is gone:
 * Live Voice only started the same chat with hands-free on, and every mode
 * is a toggle inside the chat. The real-time call is the Talk tab.
 *
 * Header (S1 "Question", canvas "Situations · header"): a violet eyebrow
 * with the language + level pill, then a question that rotates by day.
 *
 * ── MISSIONS (2026-09-13) ──
 *
 * Every built-in scene is a four-stage ladder (`types/missions.ts`). The tile
 * shows where the learner is on it as four 8pt dots beside the icon well —
 * filled = passed, ring = the one to play, thin ring = locked — so SHAPE
 * carries the state and the dots read in greyscale. The sheet names the
 * mission, its CEFR band with the can-do line (never a bare code), the
 * objectives as a plain list with the ones already met ticked, and the ONE
 * button says what it will do: start, continue, replay, or see plans.
 *
 * All of it is optional and additive. Without `missions` the picker is the
 * picker it was — the chat screen compiles untouched — and a scene without an
 * entry (Free Chat, a teacher-authored scene, the first frame before the read
 * lands) gets the old sheet. Ordering follows the goal track when one is
 * given: the learner's own scenes first, Free Chat always last.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { spacing } from '../../config/theme';
import { cefrLabel } from '../../lib/cefr-labels';
import { missionCtaLabel, missionResumeHint, orderScenarios, stageLabel, type MissionCta, type StageDot } from '../../lib/missions';
import { MISSION_META, type MissionScenarioKey } from '../../types/missions';
import type { ScenarioKey } from '../../types/scenarios';
import { floatingTabBarSpace } from '../navigation/FloatingTabBar';
import { SlabButton } from '../ui2/SlabButton';
import { Ui2InlineError } from '../ui2/Ui2InlineError';
import { Ui2Sheet } from '../ui2/Ui2Sheet';
import { Body, Caption, Heading } from '../ui2/Ui2Text';
import type { Ui2Palette } from '../../config/theme';
import type { PickerMissionState } from '../../hooks/useMissionProgress';

/** The entry shape is defined beside `buildPickerMissions` in the hook file —
 *  a type-only re-export, so this component never loads the Supabase client. */
export type { PickerMissionState } from '../../hooks/useMissionProgress';

export interface PickerScenario {
  /** Built-in key, or null for a teacher-authored scene. */
  key: string | null;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ScenarioPickerProps {
  scenarios: PickerScenario[];
  /** "Spanish". */
  languageName: string;
  /** The learner's CEFR line, never a bare code — see lib/cefr-labels.ts. */
  levelLine: string;
  /** The bare band for the header pill ("A2"). Its meaning is carried by
   *  `levelAccessibilityLabel` and by `levelLine` in the sheet — the same
   *  two-place rule CoursePills follows. */
  levelBand: string;
  levelAccessibilityLabel: string;
  /** Scenario keys (or labels for keyless scenes) with a saved conversation. */
  resumable: ReadonlySet<string>;
  onStart: (scenario: PickerScenario) => void;
  /** Per-scene ladder state from `buildPickerMissions`. Absent = the picker as it was. */
  missions?: ReadonlyMap<string, PickerMissionState>;
  /** Shown above the grid with a retry; the tiles stay tappable. */
  missionsError?: string | null;
  onRetryMissions?: () => void;
  /** The goal track's scenes; they lead the grid. Default `[]` = the existing order. */
  goalScenes?: readonly string[];
  /** When given, the sheet's one button calls this for a scene with a mission
   *  entry instead of `onStart`. Free Chat and keyless scenes still use `onStart`. */
  onMissionStart?: (scenario: ScenarioKey, cta: MissionCta, stage: number | null) => void;
}

/** One of four tints, rotated so a wall of tiles is not one colour. Pure so it can be asserted. */
export function tileTone(index: number, c: Ui2Palette): { bg: string; fg: string } {
  const tones = [
    { bg: c.primaryTint, fg: c.primary },
    { bg: c.greenTint, fg: c.green },
    { bg: c.yellowTint, fg: c.yellow },
    { bg: c.pinkTint, fg: c.pink },
  ];
  return tones[index % tones.length];
}

/** The identity a saved conversation is keyed on: the built-in key, or the label for a custom scene. */
export function scenarioIdentity(scenario: Pick<PickerScenario, 'key' | 'label'>): string {
  return scenario.key ?? scenario.label;
}

/** Copy for the legacy sheet's resume line. Pure so both branches are asserted. */
export function resumeHint(hasHistory: boolean): string {
  return hasHistory ? 'Picks up where you left off.' : 'A new conversation.';
}

const QUESTIONS = [
  'Where do you want to find yourself today?',
  'What would you like to be able to say today?',
  'Which moment shall we rehearse today?',
] as const;

/** The headline for a given day. Pure: the same day always asks the same question. */
export function questionForDay(date: Date): string {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  return QUESTIONS[day % QUESTIONS.length];
}

/** The scene's key when it has a mission ladder; null for Free Chat and keyless scenes. */
export function missionSceneKey(scenario: Pick<PickerScenario, 'key'>): MissionScenarioKey | null {
  return scenario.key !== null && Object.prototype.hasOwnProperty.call(MISSION_META, scenario.key)
    ? (scenario.key as MissionScenarioKey)
    : null;
}

/** What VoiceOver reads for a tile. The dots themselves are hidden from it. */
export function tileAccessibilityLabel(label: string, state: PickerMissionState | undefined): string {
  if (!state || state.dots === null) return label;
  if (state.stage === null) return `${label}. All missions passed.`;
  return `${label}. ${stageLabel(state.stage)}.`;
}

/** The sheet's caption under the scene name. */
export function sheetStageCaption(stage: number | null): string {
  return stage === null ? 'All missions passed' : stageLabel(stage);
}

/** "Best so far: 82% accuracy". Accuracy is 0..1, as the debrief's `accuracyLine` reads it. */
export function bestAccuracyLine(accuracy: number): string {
  return `Best so far: ${Math.round(Math.min(1, Math.max(0, accuracy)) * 100)}% accuracy`;
}

/** Shape first, colour second: a filled disc, a 2px ring, a 1px ring. Pure so all three are asserted. */
export function dotStyle(dot: StageDot, c: Ui2Palette): { backgroundColor: string; borderColor: string; borderWidth: number } {
  switch (dot) {
    case 'done':
      return { backgroundColor: c.primary, borderColor: c.primary, borderWidth: 0 };
    case 'current':
      return { backgroundColor: 'transparent', borderColor: c.primary, borderWidth: 2 };
    default:
      return { backgroundColor: 'transparent', borderColor: c.idle, borderWidth: 1 };
  }
}

/**
 * `orderScenarios` wants built-in keys; picker scenes may be keyless. A
 * keyless scene's identity is its label, which can never equal a goal scene
 * key nor `free_chat`, so it simply keeps its place among the unranked.
 */
export function orderPickerScenarios<T extends PickerScenario>(scenarios: readonly T[], goalScenes: readonly string[]): T[] {
  const wrapped = scenarios.map((s) => ({ key: scenarioIdentity(s) as ScenarioKey, s }));
  return orderScenarios(wrapped, goalScenes).map((w) => w.s);
}

const NO_GOAL: readonly string[] = [];

function StageDots({ dots, c, entering }: { dots: StageDot[]; c: Ui2Palette; entering: ReturnType<typeof FadeIn.duration> | undefined }) {
  return (
    <Animated.View
      entering={entering}
      style={styles.dots}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {dots.map((dot, i) => (
        <View key={i} style={[styles.dot, dotStyle(dot, c)]} />
      ))}
    </Animated.View>
  );
}

export function ScenarioPicker({
  scenarios,
  languageName,
  levelLine,
  levelBand,
  levelAccessibilityLabel,
  resumable,
  onStart,
  missions,
  missionsError,
  onRetryMissions,
  goalScenes = NO_GOAL,
  onMissionStart,
}: ScenarioPickerProps) {
  const { c, type, shape } = useUi2Theme();
  const { shouldReduce, duration } = useMotion();
  const [open, setOpen] = useState<PickerScenario | null>(null);
  const [question] = useState(() => questionForDay(new Date()));

  const ordered = useMemo(() => orderPickerScenarios(scenarios, goalScenes), [scenarios, goalScenes]);
  const dotsEntering = shouldReduce ? undefined : FadeIn.duration(duration.micro);

  const openTone = open ? tileTone(ordered.indexOf(open), c) : null;
  const openMission = open ? missions?.get(scenarioIdentity(open)) : undefined;
  const hasHistory = open ? resumable.has(scenarioIdentity(open)) : false;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: floatingTabBarSpace() + spacing.sm }]}
        showsVerticalScrollIndicator={false}
        // The SafeAreaView above already pays the status-bar inset; without
        // these iOS adds it again inside the scroll view and the header
        // floats ~40pt too low.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.primary }]} accessibilityRole="header">
              Situations
            </Text>
            <View
              style={[styles.levelPill, { backgroundColor: c.primaryTint }]}
              accessibilityRole="text"
              accessibilityLabel={`${languageName}. ${levelAccessibilityLabel}`}
            >
              <View style={[styles.levelDot, { backgroundColor: c.green }]} />
              <Text style={[styles.levelText, { fontFamily: type.uiHeavy, color: c.onTint }]}>
                {languageName} · {levelBand}
              </Text>
            </View>
          </View>
          <Heading level={1} style={styles.question}>
            {question}
          </Heading>
        </View>

        {missionsError ? (
          onRetryMissions ? (
            <Ui2InlineError copy={{ title: "Couldn't load your missions", message: missionsError }} onRetry={onRetryMissions} />
          ) : (
            <Caption tone="error" accessibilityLiveRegion="polite">
              {missionsError}
            </Caption>
          )
        ) : null}

        <View style={styles.grid}>
          {ordered.map((scenario, index) => {
            const tone = tileTone(index, c);
            const wide = scenario.key === 'free_chat';
            const state = missions?.get(scenarioIdentity(scenario));
            const iconWell = (
              <View style={[styles.iconWell, { backgroundColor: tone.bg }]}>
                <Ionicons name={scenario.icon} size={22} color={tone.fg} />
              </View>
            );
            return (
              <Pressable
                key={scenarioIdentity(scenario)}
                onPress={() => setOpen(scenario)}
                accessibilityRole="button"
                accessibilityLabel={tileAccessibilityLabel(scenario.label, state)}
                accessibilityHint="Shows what this scene practises and lets you start it."
                style={[
                  styles.tile,
                  wide ? styles.tileWide : styles.tileHalf,
                  { backgroundColor: c.card, borderRadius: shape.radiusCard },
                ]}
              >
                {wide ? (
                  iconWell
                ) : (
                  <View style={styles.tileTop}>
                    {iconWell}
                    {state?.dots ? <StageDots dots={state.dots} c={c} entering={dotsEntering} /> : null}
                  </View>
                )}
                <Body
                  size="sm"
                  weight="extrabold"
                  style={[styles.tileLabel, wide && styles.tileLabelWide]}
                  numberOfLines={2}
                >
                  {scenario.label}
                </Body>
                {wide ? (
                  <Caption tone="tertiary" numberOfLines={1}>
                    Any topic
                  </Caption>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Ui2Sheet visible={open !== null} onDismiss={() => setOpen(null)}>
        {open && openTone ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={[styles.iconWellLarge, { backgroundColor: openTone.bg }]}>
                <Ionicons name={open.icon} size={24} color={openTone.fg} />
              </View>
              <View style={styles.sheetTitle}>
                <Heading level={3} accessibilityRole="header">
                  {open.label}
                </Heading>
                <Caption tone="tertiary">
                  {openMission ? sheetStageCaption(openMission.stage) : `${languageName} · ${levelLine}`}
                </Caption>
              </View>
            </View>

            {openMission?.mission ? (
              <>
                <Body weight="extrabold">{openMission.mission.title}</Body>
                <Caption tone="tertiary">{cefrLabel(openMission.mission.band)}</Caption>
                <View style={styles.objectives} accessibilityRole="list">
                  {openMission.mission.objectives.map((objective) => {
                    const met = openMission.objectivesMet.includes(objective.id);
                    return (
                      <View
                        key={objective.id}
                        style={styles.objective}
                        accessible
                        accessibilityLabel={`${met ? 'Done' : 'To do'}. ${objective.text}`}
                      >
                        <Ionicons
                          name={met ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={met ? c.green : c.idle}
                        />
                        <Body size="sm" tone={met ? 'primary' : 'secondary'} style={styles.objectiveText}>
                          {objective.text}
                        </Body>
                      </View>
                    );
                  })}
                </View>
                {openMission.bestAccuracy !== null ? (
                  <Caption tone="tertiary">{bestAccuracyLine(openMission.bestAccuracy)}</Caption>
                ) : null}
                {openMission.cta === 'resume' ? (
                  <Caption tone="tertiary" accessibilityLiveRegion="polite">
                    {missionResumeHint(openMission.objectivesMet.length, openMission.mission.objectives.length)}
                  </Caption>
                ) : null}
              </>
            ) : (
              <>
                <Body tone="secondary">{open.description}</Body>
                <Caption tone="tertiary" accessibilityLiveRegion="polite">
                  {resumeHint(hasHistory)}
                </Caption>
              </>
            )}

            <SlabButton
              label={openMission ? missionCtaLabel(openMission.cta, openMission.stage) : 'Continue'}
              onPress={() => {
                const picked = open;
                const state = openMission;
                const scene = missionSceneKey(picked);
                setOpen(null);
                if (state && scene && onMissionStart) onMissionStart(scene, state.cta, state.stage);
                else onStart(picked);
              }}
              accessibilityHint={
                openMission?.cta === 'plans'
                  ? 'Shows the plans that include the tutor.'
                  : 'Opens the chat. You can type, or tap the microphone to speak.'
              }
            />
          </View>
        ) : null}
      </Ui2Sheet>
    </View>
  );
}

const TILE_GAP = spacing.xs + 2;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.xxs, gap: spacing.md },
  header: { gap: spacing.xs + 2 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
  },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
  levelText: { fontSize: 12 },
  question: { letterSpacing: -0.6, paddingRight: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  tile: {
    // Icon well top, label pinned to the bottom, so a two-line label and a
    // one-line label make the same tile. Nine tiles plus the header clear the
    // floating tab bar on a 6.1" phone without a scroll.
    // 116 leaves 46pt under a 36pt icon well: two lines of the 14pt label.
    padding: spacing.sm + 2,
    gap: spacing.xxs,
    height: 116,
    justifyContent: 'space-between',
  },
  tileHalf: {
    // Two per row: half the width less half the gap.
    flexBasis: '48%',
    flexGrow: 1,
  },
  tileWide: { flexBasis: '100%', height: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWell: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconWellLarge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tileLabel: { flexShrink: 1 },
  tileLabelWide: { flex: 1 },
  sheet: { gap: spacing.sm + 2, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetTitle: { flex: 1, gap: 2 },
  objectives: { gap: spacing.xs },
  objective: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  objectiveText: { flex: 1 },
});
