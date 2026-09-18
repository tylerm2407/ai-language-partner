/**
 * The sign-up ask. Reciprocity (DESIGN.md §UX Psychology Principles #3) and
 * the IKEA effect (#4): the learner has already been taught something before
 * an email was ever asked for. The ask is to keep what they have, not to
 * unlock what they might get.
 */
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { cefrCanDo } from '../../../lib/cefr-labels';
import type { CefrBand } from '../../../lib/cefr-proficiency';
import type { PlacementChoice, PlacementOption } from '../../../lib/course-placement';
import type { NotificationPrefs } from '../../../lib/notification-prefs';
import { haptic } from '../../../lib/haptics';
import { formatPrefTime } from '../NotificationBuilder';
import { Ui2Screen } from '../../ui2/Ui2Screen';
import { SlabButton } from '../../ui2/SlabButton';
import { SlabCard } from '../../ui2/SlabCard';
import { Ui2Mascot } from '../../ui2/Ui2Mascot';
import type { TopicPack } from '../topic-packs';
import { planHeadline } from '../PlanReveal';
import type { StepFrame } from './bits';

export function SaveStep({
  frame,
  signedIn,
  reduceMotion,
  pack,
  trialCompleted,
  idealText,
  languageName,
  band,
  placementOptions,
  courseChoice,
  dailyGoal,
  notificationPrefs,
  saving,
  onFinish,
  onChangeSetup,
}: {
  frame: Pick<StepFrame, 'enter'>;
  /** An existing account finishing its setup, rather than a sign-up. */
  signedIn: boolean;
  reduceMotion: boolean;
  pack: TopicPack | null;
  trialCompleted: boolean;
  idealText: string | null;
  languageName: string;
  band: CefrBand;
  placementOptions: PlacementOption[];
  courseChoice: PlacementChoice;
  dailyGoal: number;
  notificationPrefs: NotificationPrefs;
  saving: boolean;
  onFinish: () => void;
  onChangeSetup: () => void;
}) {
  const { c, type } = useUi2Theme();

  // The sentence the learner can now say. Only real when the trial actually
  // ran AND it ran from a pack — the `trialExercisesFor` floor teaches a
  // different set of words and has no single sentence to point at.
  const spokenSentence = trialCompleted && pack ? pack.sentence.target : null;

  /**
   * What the account saves, in the order it was earned.
   *
   * Every row is a thing that already exists on this device and will be gone
   * when the app closes. That is the entire argument for the form on the next
   * screen, and it only works if each line is literally true — which is why a
   * row is omitted rather than softened when its thing was not built.
   *
   * NO XP. There were two stat cards here ("n/m correct", "1 lesson done")
   * and an XP figure beside them. XP is hidden by design in this product
   * (CLAUDE.md §1): progress is a CEFR level and a can-do statement, never a
   * score. The lesson is still named — by the words it taught.
   */
  const owned: { title: string; detail: string }[] = [];
  if (trialCompleted && pack) {
    owned.push({
      title: `${pack.words.length} words and 1 sentence`,
      detail: pack.words.map((w) => w.target).join(' · '),
    });
  }
  owned.push({
    title: 'Your plan',
    // The headline is the learner's own sentence and usually ends in a full
    // stop; drop it before the separator so the row does not read "home. · 6".
    detail: `${planHeadline(idealText, pack, languageName).replace(/[.!?。]+$/, '')} · 6 lessons`,
  });
  // The summary must be literally true: a warm-up learner's lessons start a
  // band below the level they declared, and a no-path learner has none.
  const chosen = placementOptions.find((o) => o.choice === courseChoice);
  const levelDetail =
    chosen && chosen.choice === 'none'
      ? `${band} · ${cefrCanDo(band)} · reading, chat and tutor — no lessons yet`
      : chosen && chosen.band && chosen.band !== band
        ? `${band} · ${cefrCanDo(band)} · lessons start at ${chosen.band}`
        : `${band} · ${cefrCanDo(band)}`;
  owned.push({ title: 'Your level', detail: levelDetail });

  // Only the reminders that are actually switched on are named. A learner who
  // turned the daily nudge off must not be told they have one.
  const reminderParts = [`${dailyGoal} min a day`];
  if (notificationPrefs.dailyGoal.enabled) {
    reminderParts.push(`${formatPrefTime('dailyGoal', notificationPrefs.dailyGoal)} nudge`);
  }
  if (notificationPrefs.reviewsDue.enabled) reminderParts.push('review alerts');
  owned.push({ title: 'Your goal and reminders', detail: reminderParts.join(' · ') });

  return (
    <Ui2Screen
      footer={
        <>
          <SlabButton
            label={signedIn ? 'Start learning' : 'Save my progress'}
            onPress={onFinish}
            loading={saving}
            disabled={saving}
            arrow={false}
          />
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
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(360)} style={styles.centerCol}>
        <Ui2Mascot size={110} mood="celebrate" />
        <Text
          accessibilityRole="header"
          style={{ fontFamily: type.heading, fontSize: 30, lineHeight: 36, color: c.ink, textAlign: 'center' }}
        >
          {spokenSentence ?? 'Ready when you are.'}
        </Text>
        <Text style={{ fontFamily: type.ui, fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center' }}>
          {spokenSentence ? 'You can already say that. ' : ''}
          {signedIn
            ? 'Save this setup to your account to keep everything below.'
            : 'Create an account to keep everything below. Without one it is gone when you close the app.'}
        </Text>
      </Animated.View>

      <Animated.View entering={frame.enter(1)}>
        <SlabCard style={styles.ownedCard}>
          {owned.map((row) => (
            <View key={row.title} style={styles.ownedRow}>
              {/* Icon AND text, never the tick alone: a green disc on its own
                  is colour-only feedback (DESIGN.md). */}
              <View style={[styles.checkDisc, { backgroundColor: c.greenTint, borderColor: c.greenBorder }]}>
                <Ionicons name="checkmark" size={14} color={c.green} />
              </View>
              <View style={styles.ownedText}>
                <Text style={{ fontFamily: type.uiBold, fontSize: 14, lineHeight: 19, color: c.ink }}>
                  {row.title}
                </Text>
                <Text style={{ fontFamily: type.ui, fontSize: 13, lineHeight: 18, color: c.muted }}>
                  {row.detail}
                </Text>
              </View>
            </View>
          ))}
        </SlabCard>
      </Animated.View>
    </Ui2Screen>
  );
}

const styles = StyleSheet.create({
  centerCol: { alignItems: 'center', gap: 12, paddingTop: 8 },
  ownedCard: { gap: 14 },
  ownedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownedText: { flex: 1, gap: 2 },
  checkDisc: { width: 24, height: 24, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
