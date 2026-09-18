/**
 * PhraseHelpSheet — "How do I say…", the learner's escape hatch mid-chat.
 *
 * The learner types what they want to say in their OWN language and gets one
 * target-language phrase back with a gloss. It goes through `getPhraseHelp`
 * (the `phrase-help` function), not `ai-chat`, so the tutor never sees the
 * question and the tutor stays in character. Metered on the daily hints budget.
 *
 * Two modes, one sheet. In the text composer the answer is inserted into the
 * draft ("Insert"); in hold-to-talk there is no draft to insert into, so the
 * button just closes ("Got it") and the learner says it. The hands-free loop
 * never opens this sheet at all — see the note on `onHelp` in ChatInput.
 *
 * ANALYTICS NEVER CARRY THE ASK OR THE PHRASE. `phrase_help_requested` says
 * whether an answer came back and, if not, the refusal code. The question is
 * the learner's own words and the phrase is derived from them; neither is a
 * closed key, and lib/analytics.ts's schema has no field for free text on
 * purpose.
 *
 * WHY `quota_exhausted` IS EMITTED DIRECTLY rather than via `trackRefusal`:
 * that helper decides "is this a quota?" by looking for `LIMIT_REACHED` or
 * `CAP_REACHED` in the code, and `HINT_QUOTA_REACHED` contains neither, so it
 * would file this refusal under `feature_unavailable` — a real quota hit
 * counted as an outage. The event and properties here are exactly what the
 * helper would have produced had it matched.
 *
 * AUDIO COSTS A LESSON-AUDIO SLOT, so it is synthesised on tap only, never on
 * arrival. `getLessonAudioUri` checks the on-device cache first; a `DAILY_LIMIT`
 * refusal parks the play well on a muted glyph rather than alerting — the
 * phrase itself is still on screen, which is the thing the learner asked for.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { minLineHeight, radii, spacing, typography } from '../../config/theme';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { getPhraseHelp, MissionApiError, VoiceError, type PhraseHelp } from '../../lib/ai';
import { trackEvent } from '../../lib/analytics';
import { loadErrorCopy } from '../../lib/error-copy';
import { getLessonAudioUri } from '../../lib/lesson-audio';
import { showLimitAlert } from '../../lib/limit-messaging';
import { SlabButton } from '../ui2/SlabButton';
import { Ui2InlineError } from '../ui2/Ui2InlineError';
import { Ui2Input } from '../ui2/Ui2Input';
import { Ui2Sheet } from '../ui2/Ui2Sheet';
import { Caption, Heading } from '../ui2/Ui2Text';
import type { LanguageCode, ProficiencyLevel } from '../../types';
import type { ScenarioKey } from '../../types/scenarios';

export interface PhraseHelpSheetProps {
  visible: boolean;
  /** `text` → "Insert" hands the phrase back; `voice` → "Got it" just closes. */
  mode: 'text' | 'voice';
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  level: ProficiencyLevel;
  scenarioKey?: ScenarioKey;
  userId: string;
  /** The EFFECTIVE tier — decides upsell vs. honest reset copy on a quota hit. */
  tier: string;
  onInsert: (phrase: string) => void;
  onClose: () => void;
}

/** Server cap on the ask; mirrored here so the keyboard stops where the
 *  function would have rejected. */
const ASK_MAX_LENGTH = 200;
const PHRASE_FONT_SIZE = 18;
const PLAY_WELL_SIZE = 40;

export function PhraseHelpSheet({
  visible,
  mode,
  targetLanguage,
  nativeLanguage,
  level,
  scenarioKey,
  userId,
  tier,
  onInsert,
  onClose,
}: PhraseHelpSheetProps) {
  const { c } = useUi2Theme();
  const router = useRouter();
  const { playing, loading: audioLoading, error: playbackError, play, stop, cleanup } =
    useAudioPlayer();

  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<PhraseHelp | null>(null);
  const [hintQuotaOut, setHintQuotaOut] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [audioQuotaOut, setAudioQuotaOut] = useState(false);
  const [synthesisFailed, setSynthesisFailed] = useState(false);

  // A request that resolves after the sheet closed (or after a newer ask went
  // out) must not repopulate it. Each ask takes a ticket; close bumps it.
  const requestRef = useRef(0);

  /**
   * Everything resets on close, INCLUDING the hint-quota flag. That looks
   * wasteful — reopening after a quota hit costs one more 429 — but the flag
   * is a snapshot of the server's answer, and the server's answer changes at
   * the learner's local midnight while this component may well stay mounted.
   * A sticky flag would keep the sheet dead past the reset.
   */
  useEffect(() => {
    if (visible) return;
    requestRef.current += 1;
    setAsk('');
    setAsking(false);
    setResult(null);
    setHintQuotaOut(false);
    setRateLimited(false);
    setFailure(null);
    setSynthesizing(false);
    setAudioQuotaOut(false);
    setSynthesisFailed(false);
    // Release the native player, not just pause it: a closed sheet holding a
    // loaded Audio.Sound is the leak useAudioPlayer's teardown exists to stop.
    void cleanup().catch(() => {});
  }, [visible, cleanup]);

  const submit = useCallback(async () => {
    const text = ask.trim();
    if (!text || asking || hintQuotaOut) return;
    const ticket = ++requestRef.current;
    setAsking(true);
    setRateLimited(false);
    setFailure(null);
    if (playing) void stop().catch(() => {});

    try {
      const next = await getPhraseHelp({ ask: text, targetLanguage, nativeLanguage, level, scenarioKey });
      if (ticket !== requestRef.current) return;
      trackEvent('phrase_help_requested', { ok: true });
      setResult(next);
      // A fresh phrase is fresh audio: the previous clip's failure or quota
      // state says nothing about this one. (A DAILY_LIMIT will simply come
      // straight back on the next tap, which is cheap.)
      setSynthesisFailed(false);
      setAudioQuotaOut(false);
    } catch (err) {
      if (ticket !== requestRef.current) return;
      const code = err instanceof MissionApiError ? err.code : undefined;
      trackEvent('phrase_help_requested', { ok: false, ...(code ? { code } : {}) });

      if (code === 'HINT_QUOTA_REACHED') {
        setHintQuotaOut(true);
        trackEvent('quota_exhausted', { code, quota: 'hints' });
        showLimitAlert('hints', tier, () => {
          // Leave the sheet before navigating — a route push under an open
          // Modal lands behind it.
          onClose();
          router.push('/(app)/profile/subscription');
        });
      } else if (code === 'RATE_LIMITED') {
        setRateLimited(true);
      } else {
        setFailure(err);
      }
    } finally {
      if (ticket === requestRef.current) setAsking(false);
    }
  }, [ask, asking, hintQuotaOut, playing, stop, targetLanguage, nativeLanguage, level, scenarioKey, tier, onClose, router]);

  const handlePlay = useCallback(async () => {
    if (!result || audioQuotaOut) return;
    if (playing) {
      await stop().catch(() => {});
      return;
    }
    setSynthesizing(true);
    setSynthesisFailed(false);
    try {
      const uri = await getLessonAudioUri({ text: result.phrase, language: targetLanguage, userId });
      await play(uri);
    } catch (err) {
      if (err instanceof VoiceError && err.code === 'DAILY_LIMIT') {
        setAudioQuotaOut(true);
      } else {
        setSynthesisFailed(true);
      }
    } finally {
      setSynthesizing(false);
    }
  }, [result, audioQuotaOut, playing, stop, play, targetLanguage, userId]);

  const handleInsert = useCallback(() => {
    if (!result) return;
    onInsert(result.phrase);
    onClose();
  }, [result, onInsert, onClose]);

  const audioBusy = synthesizing || audioLoading;
  const audioFailed = synthesisFailed || !!playbackError;
  const askDisabled = !ask.trim() || hintQuotaOut;

  // The play well's five faces. `busy` and `quota` are exclusive with the
  // others; failed and playing are decided by the last thing that happened.
  const playGlyph: { name: keyof typeof Ionicons.glyphMap; color: string; label: string } =
    audioQuotaOut
      ? { name: 'volume-mute-outline', color: c.idle, label: 'Audio limit reached for today' }
      : playing
        ? { name: 'volume-high', color: c.green, label: 'Stop audio' }
        : audioFailed
          ? { name: 'alert-circle-outline', color: c.error, label: 'Audio failed, tap to retry' }
          : { name: 'volume-medium-outline', color: c.primary, label: 'Play phrase' };

  return (
    <Ui2Sheet visible={visible} onDismiss={onClose}>
      {/* Inside the sheet, not inside Ui2Sheet: most sheets have no input and
          would pay for the avoidance for nothing. No `flex: 1` — the sheet is
          auto-height, and a flex-1 KAV inside an auto-height parent collapses
          to zero (see ReportContentSheet). */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <Heading level={2} accessibilityRole="header" style={styles.heading}>
          How do I say…
        </Heading>

        <Ui2Input
          value={ask}
          onChangeText={setAsk}
          placeholder="Type it in your language"
          accessibilityLabel="Your question"
          accessibilityHint="Ask in your own language to get one phrase back"
          // Autocorrect stays ON here, unlike the message composer: the learner
          // is typing the language their keyboard is already set to.
          autoCorrect
          returnKeyType="search"
          onSubmitEditing={() => void submit()}
          maxLength={ASK_MAX_LENGTH}
          editable={!asking && !hintQuotaOut}
          containerStyle={styles.input}
        />

        <SlabButton
          label="Ask"
          onPress={() => void submit()}
          disabled={askDisabled}
          loading={asking}
          arrow={false}
        />

        {hintQuotaOut ? (
          <Caption tone="secondary" style={styles.note} accessibilityRole="text">
            You are out of hints for today
          </Caption>
        ) : rateLimited ? (
          <Caption tone="secondary" style={styles.note} accessibilityRole="text">
            Too fast — try again in a moment
          </Caption>
        ) : null}

        {failure ? (
          <Ui2InlineError copy={loadErrorCopy(failure, 'that phrase')} onRetry={() => void submit()} />
        ) : null}

        {result ? (
          <View style={[styles.result, { backgroundColor: c.surface2, borderRadius: radii.lg }]}>
            <View style={styles.resultText}>
              <Text
                selectable
                accessibilityRole="text"
                maxFontSizeMultiplier={1.6}
                style={{
                  fontFamily: typography.family.mono,
                  fontSize: PHRASE_FONT_SIZE,
                  lineHeight: minLineHeight(PHRASE_FONT_SIZE, 'mono'),
                  color: c.ink,
                }}
              >
                {result.phrase}
              </Text>
              <Caption tone="secondary" style={styles.gloss}>
                {result.gloss}
              </Caption>
            </View>

            <Pressable
              onPress={() => void handlePlay()}
              disabled={audioBusy || audioQuotaOut}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={playGlyph.label}
              accessibilityState={{ disabled: audioBusy || audioQuotaOut, busy: audioBusy }}
              style={[styles.playWell, { backgroundColor: c.card, borderRadius: radii.md }]}
            >
              {audioBusy ? (
                <ActivityIndicator color={c.primary} />
              ) : (
                <Ionicons name={playGlyph.name} size={20} color={playGlyph.color} />
              )}
            </Pressable>
          </View>
        ) : null}

        {result ? (
          mode === 'text' ? (
            <SlabButton label="Insert" onPress={handleInsert} arrow={false} style={styles.cta} />
          ) : (
            <SlabButton label="Got it" onPress={onClose} arrow={false} style={styles.cta} />
          )
        ) : null}
      </KeyboardAvoidingView>
    </Ui2Sheet>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.sm },
  input: { marginBottom: spacing.sm },
  note: { marginTop: spacing.xs, textAlign: 'center' },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  resultText: { flex: 1 },
  gloss: { marginTop: spacing.xxs },
  playWell: {
    width: PLAY_WELL_SIZE,
    height: PLAY_WELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { marginTop: spacing.sm },
});
