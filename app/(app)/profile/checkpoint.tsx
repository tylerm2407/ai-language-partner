/**
 * The check-in: a voluntary five-minute, four-strand measurement.
 *
 * ── WHAT IT DOES NOT DO ──
 *
 * It does not set the learner's level. That still comes from
 * `buildProficiencyReport`, estimated from practice history. A checkpoint moves
 * which cohort board they sit on, and this screen says so in as many words —
 * see `checkpointOutcomeLine`, which is written never to claim a promotion.
 *
 * The case for eventually letting a checkpoint gate promotion is real: the
 * report's weighted blend is compensatory and accumulative, where a fresh
 * standardized sample is neither. But no learner has ever taken one of these,
 * so gating the most visible number in the app on it would be betting on an
 * untested instrument. Shipping it as a measurement people can choose to take
 * is what produces the data that decision needs.
 *
 * ── THE SPEAKING STRAND IS DIFFERENT ──
 *
 * Every other strand is an answer string posted to `checkpoint`. Speaking is
 * scored by `score-pronunciation` with `source: 'checkpoint'`, under the
 * service role, and the checkpoint function reads it back — a client-supplied
 * speaking score would be a self-assigned leaderboard rank. So the answer
 * recorded here is only a marker that the attempt happened; the number comes
 * from the server or not at all.
 *
 * It is also asked LAST on purpose (`CHECKPOINT_STRAND_ORDER`). It is the only
 * strand that can fail for reasons that are not the learner's — a denied
 * microphone, a noisy room — and `composite` excludes a skipped strand rather
 * than scoring it zero, so a failure there costs one strand and not the
 * check-in.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../../hooks/useAuth';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useScreenView } from '../../../hooks/useScreenView';
import { useAudioRecorder } from '../../../hooks/useAudioRecorder';
import { usePressed } from '../../../hooks/usePressed';
import { useUi2Theme } from '../../../hooks/useUi2Theme';
import { useAppStore } from '../../../stores/useAppStore';
import { Ui2Header } from '../../../components/ui2/Ui2Header';
import { SlabCard } from '../../../components/ui2/SlabCard';
import { SlabButton } from '../../../components/ui2/SlabButton';
import { Body, Caption, Heading } from '../../../components/ui2/Ui2Text';
import { haptic } from '../../../lib/haptics';
import { loadErrorCopy, saveErrorCopy } from '../../../lib/error-copy';
import { scorePronunciation, startCheckpoint, submitCheckpoint } from '../../../lib/ai';
import type { CheckpointItem, CheckpointResult } from '../../../lib/ai';
import {
  STRAND_LABELS,
  canSubmitCheckpoint,
  checkpointOutcomeLine,
  checkpointProgress,
  checkpointScoreLines,
  checkpointSubmission,
  isCheckpointAnswered,
  orderCheckpointItems,
  skippedCheckpointStrands,
} from '../../../lib/checkpoint-flow';
import { normalizeBand } from '../../../lib/cefr-proficiency';
import { spacing } from '../../../config/theme';
import type { LanguageCode } from '../../../types';

/** What the speaking answer carries. The real score comes from the server. */
const SPOKEN = 'spoken';

export default function CheckpointScreen() {
  const { c } = useUi2Theme();
  const goBack = useSafeBack();
  useScreenView('checkpoint');

  const { user } = useAuth();
  const profile = useAppStore((s) => s.profile);
  const targetLanguage = profile?.targetLanguage ?? null;
  const band = normalizeBand(profile?.placementBand) ?? 'A1';

  const [items, setItems] = useState<CheckpointItem[] | null>(null);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckpointResult | null>(null);

  const load = useCallback(async () => {
    if (!targetLanguage) return;
    setLoadError(null);
    try {
      const started = await startCheckpoint(targetLanguage, band, 'monthly');
      setCheckpointId(started.checkpointId);
      setItems(orderCheckpointItems(started.items));
    } catch (err) {
      // Surfaced with a retry rather than swallowed (CLAUDE.md §5). The most
      // likely cause by far is an unseeded item pool for this (language, band),
      // which is a real state and not a bug on the learner's side.
      setLoadError(loadErrorCopy(err, 'the check-in').message);
    }
  }, [targetLanguage, band]);

  useEffect(() => {
    void load();
  }, [load]);

  const setAnswer = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const submit = useCallback(async () => {
    if (!checkpointId || !items || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await submitCheckpoint(checkpointId, checkpointSubmission(items, answers));
      setResult(response);
      haptic('complete');
    } catch (err) {
      setSubmitError(saveErrorCopy(err, 'your check-in').message);
    } finally {
      setSubmitting(false);
    }
  }, [checkpointId, items, answers, submitting]);

  const progress = useMemo(
    () => checkpointProgress(items ?? [], answers),
    [items, answers],
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <Ui2Header
          title="Check in on your level"
          subtitle={result ? 'Your result' : `About five minutes · ${band}`}
          onBack={() => goBack()}
        />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {result ? (
            <ResultBody result={result} items={items ?? []} answers={answers} />
          ) : loadError ? (
            <SlabCard tint="pink" style={styles.card}>
              <Body size="sm">{loadError}</Body>
              <SlabButton label="Try again" onPress={load} arrow={false} style={styles.spaced} />
            </SlabCard>
          ) : !items ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={c.primary} />
              <Caption tone="tertiary" style={styles.centered}>
                Putting your check-in together…
              </Caption>
            </View>
          ) : (
            <>
              {/* Said before the first question, not after the result. A
                  learner should know what this does to their level BEFORE
                  they spend five minutes on it. */}
              <SlabCard style={styles.card}>
                <Caption tone="tertiary">What this is</Caption>
                <Body size="sm" tone="secondary" style={styles.spaced}>
                  Fresh questions you have not seen, graded by Fluenci rather than scored from
                  your practice. It does not change the level on your report — it is a second
                  opinion you can compare against it.
                </Body>
              </SlabCard>

              {items.map((item, index) => (
                <CheckpointQuestion
                  key={item.id}
                  item={item}
                  index={index}
                  value={answers[item.id] ?? ''}
                  onAnswer={setAnswer}
                  userId={user?.id ?? null}
                  language={targetLanguage as LanguageCode | null}
                  locked={submitting}
                />
              ))}

              {submitError ? (
                <SlabCard tint="pink" style={styles.card}>
                  <Body size="sm">{submitError}</Body>
                </SlabCard>
              ) : null}

              <Caption tone="tertiary" style={styles.spaced}>
                {progress.answered} of {progress.total} answered
              </Caption>

              <SlabButton
                label={submitting ? 'Checking…' : 'Finish check-in'}
                onPress={submit}
                arrow={false}
                disabled={!canSubmitCheckpoint(items, answers) || submitting}
                style={styles.spaced}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── One question ───────────────────────────────────────────────

interface QuestionProps {
  item: CheckpointItem;
  index: number;
  value: string;
  onAnswer: (id: string, value: string) => void;
  userId: string | null;
  language: LanguageCode | null;
  locked: boolean;
}

function CheckpointQuestion({ item, index, value, onAnswer, userId, language, locked }: QuestionProps) {
  // `shape` rather than a literal radius: the option rows follow
  // `components/ui2/OptionRow`, the established picker idiom.
  const { c, shape } = useUi2Theme();

  return (
    <SlabCard style={styles.card}>
      <Caption tone="tertiary">
        {STRAND_LABELS[item.strand]} · {index + 1}
      </Caption>
      <Body weight="semibold" style={styles.spaced}>
        {item.prompt}
      </Body>

      {item.strand === 'listening' && item.audioUrl ? (
        <AudioPrompt url={item.audioUrl} />
      ) : null}

      {item.options && item.options.length > 0 ? (
        <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={item.prompt}>
          {item.options.map((option) => (
            <CheckpointOption
              key={option}
              label={option}
              selected={value === option}
              locked={locked}
              onPress={() => onAnswer(item.id, option)}
            />
          ))}
        </View>
      ) : item.strand === 'speaking' ? (
        <SpeakingAnswer
          item={item}
          answered={value === SPOKEN}
          onAnswered={() => onAnswer(item.id, SPOKEN)}
          userId={userId}
          language={language}
          locked={locked}
        />
      ) : (
        <TextInput
          value={value}
          onChangeText={(text) => onAnswer(item.id, text)}
          editable={!locked}
          multiline={item.strand === 'writing'}
          placeholder={item.strand === 'writing' ? 'Write your answer' : 'Your answer'}
          placeholderTextColor={c.muted}
          accessibilityLabel={item.prompt}
          style={[
            styles.input,
            item.strand === 'writing' && styles.inputTall,
            { color: c.ink, backgroundColor: c.card, borderColor: c.cardBorder, borderRadius: shape.radiusCard },
          ]}
        />
      )}
    </SlabCard>
  );
}

interface CheckpointOptionProps {
  label: string;
  selected: boolean;
  locked: boolean;
  onPress: () => void;
}

/**
 * One multiple-choice option.
 *
 * A component rather than an inline `Pressable` so it can hold press state as a
 * boolean. The callback form of `style` is unusable here: NativeWind wraps
 * Pressable and drops a style function silently, so the row would render with
 * no background and no padding — see `hooks/usePressed.ts`, and
 * `lib/no-callback-style.test.ts`, which fails the build over it.
 */
function CheckpointOption({ label, selected, locked, onPress }: CheckpointOptionProps) {
  const { c, shape } = useUi2Theme();
  const { pressed, pressHandlers } = usePressed();

  return (
    <Pressable
      onPress={() => {
        if (locked) return;
        haptic('select');
        onPress();
      }}
      disabled={locked}
      {...pressHandlers}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: locked }}
      accessibilityLabel={label}
      style={[
        styles.option,
        {
          backgroundColor: selected ? c.primary : c.card,
          borderColor: selected ? c.primary : c.cardBorder,
          borderRadius: shape.radiusCard,
          opacity: pressed && !locked ? 0.85 : 1,
        },
      ]}
    >
      <Body size="sm" style={{ color: selected ? c.onPrimary : c.ink }}>
        {label}
      </Body>
    </Pressable>
  );
}

/** Plays a listening item's clip. The URL is signed and expires. */
function AudioPrompt({ url }: { url: string }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      // Unload on unmount: a sound left loaded holds the audio session and the
      // next recording — the speaking strand — will not start.
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    },
    [],
  );

  const play = useCallback(async () => {
    try {
      setPlaying(true);
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: url });
        soundRef.current = sound;
      }
      await soundRef.current.replayAsync();
    } catch {
      // A dead signed URL is the likely cause and there is nothing the learner
      // can do about it. The item stays answerable; a failed clip must not
      // block the question.
    } finally {
      setPlaying(false);
    }
  }, [url]);

  return (
    <SlabButton
      label={playing ? 'Playing…' : 'Play'}
      onPress={play}
      arrow={false}
      variant="tint"
      style={styles.spaced}
    />
  );
}

interface SpeakingAnswerProps {
  item: CheckpointItem;
  answered: boolean;
  onAnswered: () => void;
  userId: string | null;
  language: LanguageCode | null;
  locked: boolean;
}

/**
 * Record once, send to `score-pronunciation`, and mark the item answered.
 *
 * The score is never handled here — it is written server-side under the
 * service role and read back by `checkpoint` on submit. What this sets locally
 * is only "an attempt happened", which is what stops `composite` treating the
 * strand as skipped.
 */
function SpeakingAnswer({ item, answered, onAnswered, userId, language, locked }: SpeakingAnswerProps) {
  const { recording, startRecording, stopRecording, getBase64 } = useAudioRecorder();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      await stopRecording();
      const audioBase64 = await getBase64();
      if (!audioBase64 || !userId || !language) {
        setError('That recording did not come through. Try once more.');
        return;
      }
      await scorePronunciation({
        userId,
        audioBase64,
        expectedText: item.prompt,
        language,
        source: 'checkpoint',
      });
      onAnswered();
      haptic('complete');
    } catch (err) {
      // Named, not swallowed — but the strand stays skippable. A learner who
      // cannot record still gets a checkpoint over the other three.
      setError(saveErrorCopy(err, 'your recording').message);
    } finally {
      setSending(false);
    }
  }, [stopRecording, getBase64, userId, language, item.prompt, onAnswered]);

  if (answered) {
    return (
      <Caption tone="tertiary" style={styles.spaced}>
        Recorded. Your score is worked out when you finish.
      </Caption>
    );
  }

  return (
    <View style={styles.spaced}>
      <SlabButton
        label={sending ? 'Sending…' : recording ? 'Stop recording' : 'Record your answer'}
        onPress={recording ? finish : startRecording}
        arrow={false}
        disabled={locked || sending}
      />
      {error ? (
        <Caption tone="tertiary" style={styles.spaced}>
          {error} You can leave this one out — the rest still counts.
        </Caption>
      ) : null}
    </View>
  );
}

// ─── Result ─────────────────────────────────────────────────────

function ResultBody({
  result,
  items,
  answers,
}: {
  result: CheckpointResult;
  items: CheckpointItem[];
  answers: Record<string, string>;
}) {
  const lines = checkpointScoreLines(result);
  const skipped = skippedCheckpointStrands(items, answers);

  return (
    <>
      <SlabCard tint="primary" style={styles.card}>
        <Caption tone="accent">Check-in</Caption>
        <Heading level={2} style={styles.spaced}>
          {result.composite === null ? 'Not scored' : `${Math.round(result.composite * 100)}%`}
        </Heading>
        <Body size="sm" style={styles.spaced}>
          {checkpointOutcomeLine(result)}
        </Body>
      </SlabCard>

      <SlabCard style={styles.card}>
        <Caption tone="tertiary">By strand</Caption>
        {lines.map((line) => (
          <View key={line.strand} style={styles.scoreRow}>
            <Body size="sm">{STRAND_LABELS[line.strand]}</Body>
            <Body size="sm" tone={line.percent === null ? 'tertiary' : 'primary'}>
              {line.percent === null ? 'Not measured' : `${line.percent}%`}
            </Body>
          </View>
        ))}
      </SlabCard>

      {skipped.length > 0 ? (
        // Named rather than counted: a composite over three strands is a
        // different claim from one over four, and a learner who skipped
        // speaking must not read their number as though it included it.
        <Caption tone="tertiary" style={styles.spaced}>
          {skipped.map((s) => STRAND_LABELS[s]).join(' and ')}{' '}
          {skipped.length === 1 ? 'was' : 'were'} left out, so {skipped.length === 1 ? 'it is' : 'they are'} not in this score.
        </Caption>
      ) : null}

      {/* The whole point, restated where it cannot be missed. */}
      <SlabCard style={[styles.card, styles.row]}>
        <Ionicons name="information-circle-outline" size={18} style={styles.icon} />
        <Body size="sm" tone="secondary" style={styles.flex}>
          Your level on the proficiency report has not changed. That still comes from everything
          you have practised — this is a second opinion to compare it against.
        </Body>
      </SlabCard>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.xxs,
  },
  row: { flexDirection: 'row', gap: spacing.xs },
  icon: { marginTop: 2 },
  spaced: { marginTop: spacing.xs },
  centered: { textAlign: 'center' },
  options: { marginTop: spacing.xs, gap: spacing.xxs },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  input: {
    marginTop: spacing.xs,
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inputTall: { minHeight: 120, textAlignVertical: 'top' },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  waiting: { paddingVertical: spacing.xxl, gap: spacing.sm },
});
