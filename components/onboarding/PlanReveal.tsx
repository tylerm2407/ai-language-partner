/**
 * PlanReveal — what the learner just built, shown as six lessons (board P3).
 *
 * REPLACES THE FAKE LOADER. Until now this slot held `PlanBuilder`: a ~2.4s
 * progress animation over three stages that fetched nothing, because there is
 * nothing to fetch — the level is the learner's own answer and the lessons are
 * bundled. It bought the feeling of work being done with two and a half seconds
 * of the learner's attention and handed back no information. This screen spends
 * the same moment showing the actual plan: their sentence at the top, the three
 * words they already know, and the six lesson titles that follow from them.
 *
 * WHY THE LOCKS ARE HONEST. Lessons 3-6 are behind the paywall and are drawn
 * locked, right here, before the sign-up ask. The alternative — showing six
 * open lessons and letting the wall land after the account exists — converts
 * better and is a lie the learner finds out in about four minutes. A lock is
 * also not a countdown: no timer, no "unlocks in", nothing that implies waiting
 * will open it.
 *
 * The headline is the learner's OWN sentence wherever there is one. It is the
 * single thing on this screen they wrote, and the plan reads as theirs or as a
 * template depending entirely on whether it is at the top.
 */
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '../ui2/Chip';
import { MascotSol } from '../ui2/MascotSol';
import { SlabButton } from '../ui2/SlabButton';
import { SlabCard } from '../ui2/SlabCard';
import { Ui2Screen } from '../ui2/Ui2Screen';
import { useMotion } from '../../hooks/useMotion';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { haptic } from '../../lib/haptics';
import { TOPIC_CHIPS, type TopicPack } from './topic-packs';

/** Lessons the learner can open before the paywall. The rest draw locked. */
export const FREE_PLAN_LESSONS = 2;

interface PlanRevealProps {
  languageName: string;
  /** Null only when the language has no pack at all — the list is then empty. */
  pack: TopicPack | null;
  /** The learner's ideal-self sentence, if they wrote or tapped one. */
  idealText: string | null;
  band: string;
  dailyGoalMinutes: number;
  /** Whether the trial lesson actually ran. Drives the "you already know" card. */
  trialCompleted: boolean;
  onSave: () => void;
  onChangeSetup: () => void;
}

/**
 * The headline, in order of how much it belongs to the learner: what they
 * typed, then the chip sentence their topic came from, then a generic line.
 */
export function planHeadline(
  idealText: string | null,
  pack: TopicPack | null,
  languageName: string,
): string {
  const typed = idealText?.trim();
  if (typed) return typed;
  const chip = pack ? TOPIC_CHIPS.find((entry) => entry.key === pack.topic) : undefined;
  if (chip) return chip.text(languageName);
  return `Your first weeks in ${languageName}`;
}

export function PlanReveal({
  languageName,
  pack,
  idealText,
  band,
  dailyGoalMinutes,
  trialCompleted,
  onSave,
  onChangeSetup,
}: PlanRevealProps) {
  const { c, type } = useUi2Theme();
  const { shouldReduce } = useMotion();
  const enter = (i: number) =>
    shouldReduce ? undefined : FadeInDown.delay(80 + i * 60).duration(360);

  const headline = planHeadline(idealText, pack, languageName);
  // Narrowed to the pack itself, not a boolean: the card reads three fields off
  // it, and `trialCompleted && pack` would not narrow `pack` for any of them.
  const taught: TopicPack | null = trialCompleted ? pack : null;

  return (
    <Ui2Screen
      footer={
        <>
          <SlabButton label="Save my plan" onPress={onSave} arrow={false} />
          <SlabButton
            label="Change my setup"
            variant="ghost"
            onPress={() => {
              haptic('buttonPress');
              onChangeSetup();
            }}
            accessibilityHint="Go back and change your answers"
          />
        </>
      }
    >
      <Animated.View entering={enter(0)} style={styles.head}>
        <Text style={[styles.eyebrow, { fontFamily: type.uiHeavy, color: c.onTint }]}>Your plan</Text>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: type.heading, fontSize: 28, lineHeight: 34, letterSpacing: -0.4, color: c.ink }}
        >
          {headline}
        </Text>
        <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted }}>
          Six lessons, {dailyGoalMinutes} minutes a day. Built from your level ({band}) and your
          moment.
        </Text>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <SlabCard tint="green" style={styles.solCard}>
          <MascotSol size={44} mood="cheer" />
          <View style={styles.solText}>
            {taught ? (
              <>
                <Text style={{ fontFamily: type.uiBold, fontSize: 14, lineHeight: 19, color: c.ink }}>
                  You already know {taught.words.length} words and 1 sentence.
                </Text>
                <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
                  {taught.sentence.target}. Sol keeps building from here.
                </Text>
              </>
            ) : (
              <Text style={{ fontFamily: type.uiBold, fontSize: 14, lineHeight: 19, color: c.ink }}>
                Lesson 1 is ready when you are.
              </Text>
            )}
          </View>
        </SlabCard>
      </Animated.View>

      <View style={styles.rows}>
        {(pack?.plan ?? []).map((lesson, i) => {
          const locked = i >= FREE_PLAN_LESSONS;
          return (
            <Animated.View key={lesson.title} entering={enter(2 + i)}>
              <SlabCard
                style={styles.row}
                accessible
                accessibilityLabel={
                  locked
                    ? `Lesson ${i + 1}, ${lesson.title}, locked`
                    : `Lesson ${i + 1}, ${lesson.title}. ${lesson.words.join(', ')}`
                }
              >
                {locked ? (
                  <View style={[styles.lock, { backgroundColor: c.surface2 }]}>
                    <Ionicons name="lock-closed-outline" size={16} color={c.idle} />
                  </View>
                ) : (
                  <Chip label={`${i + 1}`} />
                )}
                <View style={styles.rowText}>
                  <Text
                    style={{
                      fontFamily: type.uiBold,
                      fontSize: 15,
                      lineHeight: 20,
                      color: locked ? c.muted : c.ink,
                    }}
                  >
                    {lesson.title}
                  </Text>
                  {locked ? null : (
                    <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
                      {lesson.words.join(' · ')}
                    </Text>
                  )}
                </View>
              </SlabCard>
            </Animated.View>
          );
        })}
      </View>
    </Ui2Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8 },
  eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  solCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  solText: { flex: 1, gap: 3 },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowText: { flex: 1, gap: 2 },
  lock: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
