/**
 * The listening check on the debrief screen.
 *
 * ── WHY IT IS HERE AND NOT IN THE CALL ──
 *
 * It asks what the TUTOR said, so it can only be asked once the conversation
 * is over. It is also the only route by which a live conversation evidences
 * LISTENING: the measured CEFR level otherwise reads that strand from graded
 * lesson exercises alone, so a learner who spends every session talking — and
 * who plainly understood the tutor in order to reply — had nothing in it.
 * Minutes of audio are exposure, never a level.
 *
 * ── THE SCORE IS NOT OURS TO COMPUTE ──
 *
 * This component never knows the right answer. `debrief.listeningCheck` is
 * questions and options only; the key lives in `tutor_listening_checks`, which
 * clients cannot read, and `answerListeningCheck` posts the submission to be
 * graded on the server. That is deliberate and load-bearing — the result moves
 * a measured level, so a check graded on the phone would be self-assigned. It
 * also means "which one was right" is genuinely unavailable here: the response
 * says whether each answer was correct, never what the correct option was.
 *
 * ── ANSWERING IS ONCE ──
 *
 * The server grades a session once and returns the stored tally afterwards, so
 * there is no second attempt to offer and the UI must not imply one. A learner
 * returning to an old debrief sees their score, not a fresh set of buttons.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { haptic } from '../../lib/haptics';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { SlabButton } from '../ui2/SlabButton';
import { SlabCard } from '../ui2/SlabCard';
import { Body, Caption } from '../ui2/Ui2Text';
import { answerListeningCheck } from '../../lib/tutor-api';
import { saveErrorCopy } from '../../lib/error-copy';
import type { TutorListeningPrompt } from '../../types';
import { spacing } from '../../config/theme';

/** Nothing selected yet. Not 0, which is a real option index. */
const UNANSWERED = -1;

interface ListeningCheckCardProps {
  sessionId: string;
  items: TutorListeningPrompt[];
  /** Fires once, after a successful first submission. */
  onGraded?: (correctCount: number, total: number) => void;
}

export function ListeningCheckCard({ sessionId, items, onGraded }: ListeningCheckCardProps) {
  const { c } = useUi2Theme();
  const [answers, setAnswers] = useState<number[]>(() => items.map(() => UNANSWERED));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    correct: boolean[];
    correctCount: number;
    total: number;
    alreadyAnswered: boolean;
  } | null>(null);

  const graded = result !== null;
  const allAnswered = useMemo(() => answers.every((a) => a !== UNANSWERED), [answers]);

  const select = useCallback(
    (questionIndex: number, optionIndex: number) => {
      if (graded || submitting) return;
      haptic('select');
      setAnswers((prev) => {
        const next = [...prev];
        next[questionIndex] = optionIndex;
        return next;
      });
    },
    [graded, submitting],
  );

  const submit = useCallback(async () => {
    if (submitting || graded || !allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await answerListeningCheck({ sessionId, answers });
      setResult({
        correct: response.correct,
        correctCount: response.correctCount,
        total: response.total || items.length,
        alreadyAnswered: response.alreadyAnswered,
      });
      // A verdict, so a notification haptic rather than an acknowledgement. The
      // bar is the same 0.7 the band gate uses; below it the answer is "not
      // yet", which is not the same feeling as a win.
      haptic(response.correctCount / Math.max(1, response.total) >= 0.7 ? 'correct' : 'incorrect');
      if (!response.alreadyAnswered) onGraded?.(response.correctCount, response.total);
    } catch (err) {
      // Surfaced with a retry rather than swallowed (CLAUDE.md §5). The
      // submission is idempotent server-side, so retrying is always safe: a
      // second call returns the stored grade instead of regrading.
      setError(saveErrorCopy(err, 'your answers').message);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, graded, allAnswered, sessionId, answers, items.length, onGraded]);

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Caption tone="tertiary">Did you catch that?</Caption>

      {/* Said once, at the top. Without it the questions read as a quiz the
          app sprang on them; with it they read as the thing that lets talking
          count toward the listening half of their level. */}
      <Caption tone="tertiary" style={styles.intro}>
        {graded
          ? 'These answers count toward the listening part of your level.'
          : 'A few questions about what the tutor said. Your answers count toward the listening part of your level.'}
      </Caption>

      {items.map((item, questionIndex) => (
        <SlabCard key={`${item.question}-${questionIndex}`} style={styles.card}>
          <Body weight="semibold">{item.question}</Body>
          <View
            style={styles.options}
            accessibilityRole="radiogroup"
            accessibilityLabel={item.question}
          >
            {item.options.map((option, optionIndex) => (
              <OptionButton
                key={`${option}-${optionIndex}`}
                label={option}
                selected={answers[questionIndex] === optionIndex}
                // Per-item correctness only lands on the option the learner
                // actually chose. The server never says which one was right,
                // so marking any other option would be inventing the key.
                verdict={
                  graded && answers[questionIndex] === optionIndex
                    ? (result?.correct[questionIndex] ?? null)
                    : null
                }
                locked={graded || submitting}
                onPress={() => select(questionIndex, optionIndex)}
              />
            ))}
          </View>
        </SlabCard>
      ))}

      {error ? (
        <SlabCard tint="pink" style={styles.card}>
          <Body size="sm">{error}</Body>
          <SlabButton label="Try again" onPress={submit} arrow={false} style={styles.retry} />
        </SlabCard>
      ) : null}

      {graded ? (
        <SlabCard tint="green" style={styles.card}>
          <Caption tone="primary">
            {result!.correctCount} of {result!.total} right
          </Caption>
          {result!.alreadyAnswered ? (
            // Honest about why there are no ticks: the server keeps the tally,
            // not the individual answers, and the check is graded once.
            <Body size="sm" tone="secondary" style={styles.resultBody}>
              You already answered this one.
            </Body>
          ) : null}
        </SlabCard>
      ) : (
        <SlabButton
          label={submitting ? 'Checking…' : 'Check answers'}
          onPress={submit}
          arrow={false}
          disabled={!allAnswered || submitting}
          style={styles.submit}
        />
      )}

      {submitting ? (
        <View style={styles.spinner} accessibilityElementsHidden>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : null}
    </View>
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  /** true = right, false = wrong, null = not graded (or not this learner's pick). */
  verdict: boolean | null;
  locked: boolean;
  onPress: () => void;
}

/**
 * One answer.
 *
 * Three states and none of them is colour alone: selection is a filled block,
 * a verdict adds an icon AND a word to the accessibility label, so the result
 * survives both a colour-blind reader and VoiceOver. The 44pt minimum is the
 * HIG floor and applies even to a one-word option.
 */
function OptionButton({ label, selected, verdict, locked, onPress }: OptionButtonProps) {
  const { c } = useUi2Theme();

  const bg = verdict === true ? c.greenTint : verdict === false ? c.pinkTint : selected ? c.primary : c.card;
  const border =
    verdict === true ? c.greenBorder : verdict === false ? c.error : selected ? c.primary : c.cardBorder;
  const ink = verdict !== null ? c.ink : selected ? c.onPrimary : c.ink;

  const verdictWord = verdict === true ? 'correct' : verdict === false ? 'incorrect' : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: locked }}
      accessibilityLabel={verdictWord ? `${label}, ${verdictWord}` : label}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: pressed && !locked ? 0.85 : 1,
        },
      ]}
    >
      <Body size="sm" style={[styles.optionLabel, { color: ink }]}>
        {label}
      </Body>
      {verdict !== null ? (
        <Ionicons
          name={verdict ? 'checkmark-circle' : 'close-circle'}
          size={18}
          color={verdict ? c.greenBorder : c.error}
          // The word is already in the label above; the icon would read it twice.
          accessibilityElementsHidden
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  intro: {
    marginBottom: spacing.xxs,
  },
  card: {
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  options: {
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    // 44pt is the HIG minimum touch target and the reason this is minHeight
    // rather than a fixed height: a long option that wraps must grow, not clip.
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: 12,
  },
  optionLabel: {
    flex: 1,
  },
  submit: {
    marginTop: spacing.xs,
  },
  retry: {
    marginTop: spacing.xs,
  },
  resultBody: {
    marginTop: spacing.xxs,
  },
  spinner: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
});
