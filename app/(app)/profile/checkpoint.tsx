/**
 * The level test: an eight-minute, five-strand measurement, asked as a
 * staircase and ending in a spoken conversation.
 *
 * ── WHAT IT DOES TO THE LEVEL ──
 *
 * It publishes the learner's level WHEN PRACTICE HAS NOT MEASURED ONE, and
 * never otherwise. `testPublishesLevel` is the rule and `publishes` below is
 * the value; the screen states the consequence before the first question and
 * again on the result, because a five-minute test that silently did or did not
 * set the app's central number would be worse than either behaviour.
 *
 * It used to do nothing at all to the level, deliberately: a compensatory
 * weighted blend of weeks of work is better evidence than a fresh sample, no
 * learner had ever taken one of these, and gating the most visible number in
 * the app on an untested instrument was not a bet worth making. Two things
 * changed. The instrument became a staircase — each strand asked below, at, and
 * above the band, so the result LOCATES a band rather than nudging one (see
 * `bandFromStaircase`) — and the cost of the old behaviour became clear: an
 * unmeasured learner faced `MIN_INTERACTION_DAYS` plus the confidence gate,
 * which is a fortnight of "Not yet assessed" no matter what they did.
 *
 * The asymmetry is the safeguard. The test does not measure live conversation
 * at all, and conversation is 0.55 of the practice score, so it fills the gap
 * and then stands down. It is not the higher of the two and not the more recent
 * — either would let a learner pick their band by testing on a good day.
 *
 * ── THE CONVERSATION ──
 *
 * Interaction is 0.55 of the practice model and was 0% of this test, which
 * since the publish rule above can set a learner's level. So the test ends with
 * four spoken turns against `ai-chat` on the server-only `level_test` scenario.
 * Nothing about the scoring is test-specific: the turns are written as
 * `conversation_evidence` by the same shared module practice uses, and the
 * checkpoint reads them back at submit. A turn has to be worth the same here as
 * anywhere else, or the test and the report would measure different things and
 * call both a CEFR band.
 *
 * It is spoken-only, which makes it the most failure-prone part of the test and
 * by far the most expensive to lose — a denied microphone costs 0.55 where a
 * failed pronunciation item costs 0.08. Hence: the strand is EXCLUDED and never
 * zeroed (`interactionScore` returns null under three scored turns), it never
 * blocks Finish, and the result screen says in words that it was left out
 * rather than counted against them.
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
import { sttConfidence } from '../../../lib/handsfree-grading';
import {
  scorePronunciation,
  sendChatMessage,
  startCheckpoint,
  submitCheckpoint,
  transcribeAudio,
} from '../../../lib/ai';
import type { CheckpointItem, CheckpointResult } from '../../../lib/ai';
import {
  STRAND_LABELS,
  canSubmitCheckpoint,
  checkpointOutcomeLine,
  checkpointProgress,
  checkpointScoreLines,
  checkpointRungLabel,
  MIN_INTERACTION_REPLIES,
  checkpointSubmission,
  interactionIsEvidence,
  orderCheckpointItems,
  skippedCheckpointStrands,
  testPublishesLevel,
} from '../../../lib/checkpoint-flow';
import { normalizeBand } from '../../../lib/cefr-proficiency';
import { useProficiencyReport } from '../../../hooks/useProficiencyReport';
import { spacing } from '../../../config/theme';
import type { LanguageCode, ProficiencyLevel } from '../../../types';

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

  // Whether this result will BECOME the learner's level, which they have to be
  // told before they spend five minutes on it and again when they read the
  // band. `practiceLevel`, deliberately, not the store's `measuredBand`: that
  // mirror already holds a previously-tested band, so reading it would tell a
  // learner on their second test that their level is safe when it is not.
  const { report } = useProficiencyReport();
  const publishes = testPublishesLevel(report?.practiceLevel ?? null);

  const [items, setItems] = useState<CheckpointItem[] | null>(null);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  // The conversation the attempt is bound to. Null when the server could not
  // open one, which costs the strand and nothing else.
  const [interaction, setInteraction] = useState<{ sessionId: string; turns: number } | null>(null);
  const [replies, setReplies] = useState(0);
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
      setInteraction(
        started.interactionSessionId
          ? { sessionId: started.interactionSessionId, turns: started.interactionTurns }
          : null,
      );
      setReplies(0);
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
          title="Level test"
          // Eight, not five. The conversation added about three minutes and the
          // claim moves with it rather than quietly drifting.
          subtitle={result ? 'Your result' : `About eight minutes · around ${band}`}
          onBack={() => goBack()}
        />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {result ? (
            <ResultBody result={result} items={items ?? []} answers={answers} publishes={publishes} />
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
                  your practice. Each skill is asked just below, at, and just above {band}, so
                  the result finds your level rather than confirming a guess — and it ends with
                  a short spoken conversation, which counts for more than the rest put together.
                </Body>
                {/* The consequence, stated before the first question rather than
                    after the result. A learner is entitled to know whether five
                    minutes is about to set the number the whole app shows. */}
                <Body size="sm" tone="secondary" style={styles.spaced}>
                  {publishes
                    ? 'Your practice history has not measured a level yet, so this result becomes the level on your report — until your practice has enough evidence to take over.'
                    : 'Your report keeps the level measured from your practice. This is a second opinion you can compare against it.'}
                </Body>
              </SlabCard>

              {items.map((item) => (
                <CheckpointQuestion
                  key={item.id}
                  item={item}
                  label={checkpointRungLabel(item, items)}
                  value={answers[item.id] ?? ''}
                  onAnswer={setAnswer}
                  userId={user?.id ?? null}
                  language={targetLanguage as LanguageCode | null}
                  locked={submitting}
                />
              ))}

              {/* Last, for the same reason speaking is last: it is the strand
                  that can fail for reasons that are not the learner's, and a
                  failure at the end costs the strand rather than the test. */}
              {interaction && targetLanguage && user?.id ? (
                <InteractionBlock
                  userId={user.id}
                  sessionId={interaction.sessionId}
                  turns={interaction.turns}
                  language={targetLanguage as LanguageCode}
                  level={profile?.level ?? 'beginner'}
                  band={band}
                  locked={submitting}
                  replies={replies}
                  onReply={() => setReplies((n) => n + 1)}
                />
              ) : null}

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
  /** "Listening · 2 of 3". See `checkpointRungLabel`. */
  label: string;
  value: string;
  onAnswer: (id: string, value: string) => void;
  userId: string | null;
  language: LanguageCode | null;
  locked: boolean;
}

function CheckpointQuestion({ item, label, value, onAnswer, userId, language, locked }: QuestionProps) {
  // `shape` rather than a literal radius: the option rows follow
  // `components/ui2/OptionRow`, the established picker idiom.
  const { c, shape } = useUi2Theme();

  return (
    <SlabCard style={styles.card}>
      {/* The rung's position in its strand, not the global question number:
          with three listening rungs in an attempt, "Listening · 4" said nothing
          a learner could use. */}
      <Caption tone="tertiary">{label}</Caption>
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

// ─── The conversation ───────────────────────────────────────────

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface InteractionBlockProps {
  userId: string;
  sessionId: string;
  turns: number;
  language: LanguageCode;
  /** The learner's declared level. Still sent, still the fallback band. */
  level: ProficiencyLevel;
  /**
   * The band the conversation runs at — the band this ATTEMPT was set at, not
   * `conversationCefrBand`'s usual one-rung stretch.
   *
   * That stretch exists so practice evidence tagged at a band the learner
   * already holds cannot fail to promote them. A test is the opposite problem:
   * `interactionGraded` records the strand at the set band, so the conversation
   * has to be held there or the rung would be scored against a sample taken at
   * a different level.
   */
  band: string;
  locked: boolean;
  /** Learner replies sent so far, so the parent can label the strand's state. */
  replies: number;
  onReply: () => void;
}

/**
 * The spoken conversation: the strand worth 0.55 of a level, which this test
 * did not measure at all until now.
 *
 * It is a real `ai-chat` conversation, not a special case. The learner speaks,
 * `transcribe` turns it into text and a recogniser confidence, `ai-chat` scores
 * the turn through `_shared/conversation-evidence.ts` and stamps the row with
 * this attempt's `chat_session_id`, and the checkpoint reads those rows back at
 * submit. Nothing about the scoring is test-specific — which is the point: a
 * turn has to be worth the same here as it is in practice, or the test and the
 * report would be measuring different things and calling both a CEFR band.
 *
 * SPOKEN ONLY. There is no type-instead affordance, which makes this the most
 * failure-prone thing in the test and the most expensive to lose: a denied
 * microphone costs 0.55 of the model where a failed pronunciation item costs
 * 0.08. Two rules hold because of it, and neither is optional —
 *
 *  - Failure is always named and never fatal. Every error path leaves the
 *    finish button enabled and says the conversation can be left out.
 *  - The strand is EXCLUDED, never zeroed. That is enforced on the server
 *    (`interactionScore` returns null below three scored turns) rather than
 *    here, because the client cannot be the thing that decides it.
 *
 * The tutor's replies are shown as text rather than played back. The learner is
 * reading them anyway to answer, audio would double the length of a test
 * already going from five minutes to eight, and a spoken reply the learner
 * mishears is a listening measurement smuggled into the conversation strand.
 */
function InteractionBlock({
  userId,
  sessionId,
  turns,
  language,
  level,
  band,
  locked,
  replies,
  onReply,
}: InteractionBlockProps) {
  const { recording, startRecording, stopRecording, getBase64 } = useAudioRecorder();
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  // `requestedRepair` is echoed back so the tutor does not ask a learner to fix
  // the same thing twice — carried, never interpreted, exactly as chat does it.
  const repairRef = useRef(false);

  const tutorTurns = history.filter((t) => t.role === 'assistant').length;
  const done = tutorTurns >= turns && replies >= turns;

  /**
   * One turn. `said` empty opens the conversation; the tutor's reply is
   * appended to the history that is sent back on the next turn.
   *
   * The history is passed explicitly rather than read from state because both
   * callers already know what it is and `setHistory` has not flushed yet — a
   * turn built from stale state would drop the learner's own last sentence
   * from the context the tutor answers.
   */
  const exchange = useCallback(
    async (prior: ConversationTurn[], said: string, confidence: number | null) => {
      const messages = said
        ? [...prior, { role: 'user' as const, content: said }]
        : prior;
      const response = await sendChatMessage({
        userId,
        messages,
        targetLanguage: language,
        nativeLanguage: 'en',
        level,
        cefrLevel: band,
        scenarioKey: 'level_test',
        chatSessionId: sessionId,
        modality: 'speaking',
        ...(confidence !== null ? { recognizerConfidence: confidence } : {}),
        previousTurnRequestedRepair: repairRef.current,
        // The last reply should close rather than open a new thread.
        isClosing: said.length > 0 && replies + 1 >= turns,
      });
      repairRef.current = response.requestedRepair === true;
      setHistory([...messages, { role: 'assistant', content: response.reply }]);
    },
    [userId, language, level, band, sessionId, replies, turns],
  );

  const open = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // An empty first message asks the tutor to open. The learner has said
      // nothing yet, so there is nothing to score and no evidence row is
      // written for it.
      await exchange([], '', null);
      setOpened(true);
    } catch (err) {
      setError(loadErrorCopy(err, 'the conversation').message);
    } finally {
      setBusy(false);
    }
  }, [exchange]);

  const answer = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await stopRecording();
      const audioBase64 = await getBase64();
      if (!audioBase64) {
        setError('That recording did not come through.');
        return;
      }

      const heard = await transcribeAudio(audioBase64, language);
      const said = (heard.text ?? '').trim();
      if (!said) {
        // Nothing recognised is not a wrong answer and must not be sent as one:
        // an empty turn would score as an accuracy floor on a strand worth
        // 0.55. Ask again instead.
        setError('That did not come through clearly. Try saying it again.');
        return;
      }

      // The SAME derivation `components/chat/ChatInput.tsx` uses. It is half of
      // what a spoken turn scores (`combineTurn`), so deriving it differently
      // here would make a turn worth a different amount inside the test than
      // outside it — and both numbers are called a CEFR band.
      const confidence = sttConfidence({
        noSpeechProb: heard.noSpeechProb,
        avgLogprob: heard.avgLogprob,
        transcript: said,
        speechDurationMs: (heard.durationSeconds ?? 0) * 1000,
      });

      onReply();
      await exchange(history, said, confidence);
      haptic('buttonPress');
    } catch (err) {
      setError(saveErrorCopy(err, 'your answer').message);
    } finally {
      setBusy(false);
    }
  }, [stopRecording, getBase64, language, exchange, onReply, history]);

  return (
    <SlabCard style={styles.card}>
      <Caption tone="tertiary">
        {STRAND_LABELS.interaction}
        {opened ? ` · ${Math.min(replies + 1, turns)} of ${turns}` : ''}
      </Caption>
      <Body weight="semibold" style={styles.spaced}>
        {done ? 'Conversation finished.' : 'Speak with Sol for a few turns.'}
      </Body>
      {/* Said before the mic is ever tapped. Conversation is the heaviest
          strand, and a learner deciding whether to bother is entitled to know
          that both halves of that are true: it counts for the most, and
          skipping it does not sink the test. */}
      {!opened ? (
        <Body size="sm" tone="secondary" style={styles.spaced}>
          This counts for more than any other part of the test. It is spoken, so
          if your microphone will not cooperate you can leave it out — the rest
          still counts.
        </Body>
      ) : null}

      {history.map((turn, index) => (
        <View key={`${turn.role}-${index}`} style={styles.spaced}>
          <Caption tone="tertiary">{turn.role === 'assistant' ? 'Sol' : 'You'}</Caption>
          <Body size="sm" tone={turn.role === 'assistant' ? 'primary' : 'secondary'}>
            {turn.content}
          </Body>
        </View>
      ))}

      {busy ? (
        <View style={styles.waiting}>
          <ActivityIndicator />
        </View>
      ) : done ? (
        <Caption tone="tertiary" style={styles.spaced}>
          {interactionIsEvidence(replies)
            ? 'Scored when you finish.'
            : 'Too short to score, so conversation will be left out.'}
        </Caption>
      ) : !opened ? (
        <SlabButton
          label="Start the conversation"
          onPress={open}
          arrow={false}
          disabled={locked}
          style={styles.spaced}
        />
      ) : (
        <SlabButton
          label={recording ? 'Stop and send' : 'Answer out loud'}
          onPress={recording ? answer : startRecording}
          arrow={false}
          disabled={locked}
          style={styles.spaced}
        />
      )}

      {error ? (
        <Caption tone="tertiary" style={styles.spaced}>
          {error} You can leave the conversation out — the rest still counts.
        </Caption>
      ) : null}
    </SlabCard>
  );
}

// ─── Result ─────────────────────────────────────────────────────

function ResultBody({
  result,
  items,
  answers,
  publishes,
}: {
  result: CheckpointResult;
  items: CheckpointItem[];
  answers: Record<string, string>;
  /** Whether this result became the level on the report. See `testPublishesLevel`. */
  publishes: boolean;
}) {
  const lines = checkpointScoreLines(result);
  const skipped = skippedCheckpointStrands(items, answers);

  return (
    <>
      <SlabCard tint="primary" style={styles.card}>
        <Caption tone="accent">Level test</Caption>
        {/* The BAND leads, not the percentage. The percentage is how the learner
            did on this instrument; the band is what the five minutes were for,
            and when it publishes it is the number the whole app now shows. */}
        <Heading level={2} style={styles.spaced}>
          {result.composite === null ? 'Not scored' : result.band}
        </Heading>
        <Body size="sm" style={styles.spaced}>
          {checkpointOutcomeLine(result, publishes)}
        </Body>
        {result.composite !== null ? (
          <Caption tone="accent" style={styles.spaced}>
            Scored {Math.round(result.composite * 100)}% across the skills you answered
          </Caption>
        ) : null}
      </SlabCard>

      <SlabCard style={styles.card}>
        <Caption tone="tertiary">By skill</Caption>
        {/* Conversation first — CHECKPOINT_SCORE_ORDER — because it is the
            heaviest thing in the measurement and should be the first number a
            learner meets. */}
        {lines.map((line) => (
          <View key={line.strand} style={styles.scoreRow}>
            <Body size="sm">{STRAND_LABELS[line.strand]}</Body>
            <Body size="sm" tone={line.percent === null ? 'tertiary' : 'primary'}>
              {line.percent === null ? 'Not measured' : `${line.percent}%`}
            </Body>
          </View>
        ))}
      </SlabCard>

      {/* "Not measured" on the conversation row is the one that needs saying
          out loud. It is spoken-only, it is the heaviest strand, and a learner
          who sees a blank next to it should know it was left out of the score
          rather than counted as a failure. */}
      {result.scores.interaction === null || result.scores.interaction === undefined ? (
        <Caption tone="tertiary" style={styles.spaced}>
          The conversation was not scored, so it is left out of this result rather than counted
          against it. It needs at least {MIN_INTERACTION_REPLIES} answers long enough to measure.
        </Caption>
      ) : null}

      {skipped.length > 0 ? (
        // Named rather than counted: a composite over three strands is a
        // different claim from one over four, and a learner who skipped
        // speaking must not read their number as though it included it.
        <Caption tone="tertiary" style={styles.spaced}>
          {skipped.map((s) => STRAND_LABELS[s]).join(' and ')}{' '}
          {skipped.length === 1 ? 'was' : 'were'} left out, so {skipped.length === 1 ? 'it is' : 'they are'} not in this score.
        </Caption>
      ) : null}

      {/* Restated where it cannot be missed, in whichever direction is true.
          The publishing case is the one that needs saying twice: a learner has
          just changed the app's central number in five minutes and should know
          both that it happened and that it is provisional. */}
      <SlabCard style={[styles.card, styles.row]}>
        <Ionicons name="information-circle-outline" size={18} style={styles.icon} />
        <Body size="sm" tone="secondary" style={styles.flex}>
          {publishes
            ? `Your report now shows ${result.band}, measured by this test. It does not include live conversation, which is the biggest part of the level measured from practice — so once you have practised enough, that measurement takes over.`
            : 'Your level on the proficiency report has not changed. That still comes from everything you have practised — this is a second opinion to compare it against.'}
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
