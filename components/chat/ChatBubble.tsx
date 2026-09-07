import { useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { getTextToSpeech, translateText, VoiceError } from '../../lib/ai';
import { saveCorrectionAsCard } from '../../lib/supabase-queries';
import { isClose } from '../../lib/fuzzyMatch';
import type { VoiceGender } from '../../lib/voice-preference';
import { radii, spacing, typography, type Ui2Palette } from '../../config/theme';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { ReportContentSheet } from '../ui/ReportContentSheet';
import {
  normalizeCorrection,
  type ConversationMessage,
  type CorrectionDetail,
  type CorrectionErrorType,
  type CorrectionSeverity,
} from '../../types';

interface ChatBubbleProps {
  message: ConversationMessage;
  targetLanguage?: string;
  userId?: string;
  /** CEFR band the conversation is being held at. Files a saved correction in
   *  a band so it counts toward measured vocabulary — a card with a null
   *  `cefr_level` is skipped by `analyzeBands` and never counts at all. */
  cefrLevel?: string | null;
  /** User's native language from profile; target of Translate button. Defaults to 'en'. */
  nativeLanguage?: string;
  /** Learner's tutor voice preference, so replaying a line matches the voice
   *  that first spoke it instead of reverting to the default. */
  voiceGender?: VoiceGender;
  /**
   * Native-language gloss of this reply, returned by ai-chat in the same call
   * that produced the reply itself.
   *
   * When it is here, Translate is a pure toggle — no network, no second paid
   * model call to translate text we generated a moment ago. When it is absent
   * (a user message, a reloaded transcript, the safety fallback reply) the
   * button falls back to the `translate` function as before. Assistant
   * messages only; a learner's own words were never ours to pre-gloss.
   */
  gloss?: string | null;
}

/** Render message content with **bold** words highlighted as vocabulary. */
function HighlightedContent({ text, isUser }: { text: string; isUser: boolean }) {
  const { c } = useUi2Theme();
  // Split on **word** patterns, keeping the delimiters
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    // Deck: bubble copy is body/600, not regular.
    <Text className="text-base font-sans-semibold" style={{ color: isUser ? c.onPrimary : c.ink }}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const word = part.slice(2, -2);
          return (
            <Text
              key={index}
              // font-sans-bold, not font-bold: a fontWeight on top of a custom
              // family makes Android synthesize a second bolding pass.
              className="font-sans-bold"
              style={!isUser ? { backgroundColor: c.primaryTint, borderRadius: spacing.xxs } : undefined}
            >
              {word}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Cache loaded Audio.Sound objects by message ID to avoid re-fetching.
// Bounded LRU: native Audio.Sound objects hold memory, so evict + unload the
// oldest once we exceed the cap (long chats would otherwise grow unbounded).
const audioCache = new Map<string, Audio.Sound>();
const MAX_AUDIO_CACHE = 12;

async function cacheSound(id: string, sound: Audio.Sound): Promise<void> {
  if (audioCache.size >= MAX_AUDIO_CACHE) {
    const oldestKey = audioCache.keys().next().value;
    if (oldestKey !== undefined) {
      const old = audioCache.get(oldestKey);
      audioCache.delete(oldestKey);
      try {
        await old?.unloadAsync();
      } catch {
        // already unloaded — ignore
      }
    }
  }
  audioCache.set(id, sound);
}

// Cache translated text by message ID — translations are deterministic enough
// that one tap per message is plenty; subsequent toggles are instant.
const translationCache = new Map<string, string>();

export function ChatBubble({ message, targetLanguage, userId, nativeLanguage, cefrLevel, voiceGender, gloss }: ChatBubbleProps) {
  const { c } = useUi2Theme();
  const isUser = message.role === 'user';
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Normalize the correction once per message change. Handles both legacy
  // string rows (persisted pre-CorrectionDetail) and fresh object responses.
  const normalizedCorrection = useMemo(
    () => normalizeCorrection(message.correction),
    [message.correction]
  );

  // Translation state (only used for assistant messages; prop list identical
  // across all instances is cheaper than conditional hook calls).
  const [showTranslation, setShowTranslation] = useState(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  // Reporting offensive AI output — required by Google Play's generative-AI policy.
  const [reportOpen, setReportOpen] = useState(false);
  // The gloss came back with the reply, so it outranks the on-demand cache:
  // it is the same meaning, already paid for, and already through the
  // content-safety pipeline that every ai-chat completion passes.
  const translation = gloss ?? translationCache.get(message.id) ?? null;

  const handleTranslate = async () => {
    // Toggle off if already showing
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    // Pre-generated gloss — reveal it, no network call at all. This is the
    // whole point: translating our OWN output used to cost a second round trip
    // per tap, on text the model had just written.
    if (gloss) {
      setShowTranslation(true);
      return;
    }
    // Cached — instant open
    if (translationCache.has(message.id)) {
      setShowTranslation(true);
      return;
    }
    // Fresh fetch
    setIsLoadingTranslation(true);
    setTranslationError(null);
    try {
      const result = await translateText(
        message.content,
        targetLanguage ?? 'en',
        nativeLanguage ?? 'en'
      );
      translationCache.set(message.id, result);
      setShowTranslation(true);
    } catch (err) {
      console.warn('[chat] translate failed:', err);
      setTranslationError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsLoadingTranslation(false);
    }
  };

  const handleSpeak = async () => {
    // If already playing, stop
    if (isPlaying && soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      return;
    }

    // Check cache first
    const cached = audioCache.get(message.id);
    if (cached) {
      soundRef.current = cached;
      setIsPlaying(true);
      await cached.replayAsync();
      cached.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      return;
    }

    setIsLoadingAudio(true);
    try {
      const base64 = await getTextToSpeech(
        message.content,
        targetLanguage ?? 'en',
        userId,
        { voiceGender }
      );
      const dataUri = `data:audio/mpeg;base64,${base64}`;

      const { sound } = await Audio.Sound.createAsync({ uri: dataUri });
      soundRef.current = sound;
      await cacheSound(message.id, sound);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      setIsPlaying(true);
      await sound.playAsync();
    } catch (err) {
      console.error('TTS playback failed:', err);
      const message = err instanceof VoiceError
        ? err.code === 'DAILY_LIMIT'
          ? "You've reached your daily voice limit. Upgrade your plan for more."
          : err.code === 'NOT_CONFIGURED'
            ? 'Voice features are not yet configured. Please try again later.'
            : 'Voice features are temporarily unavailable. You can continue using text.'
        : 'Voice features are temporarily unavailable. You can continue using text.';
      Alert.alert('Voice Unavailable', message, [{ text: 'OK' }]);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <View className={`mb-2 max-w-[84%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`p-3 rounded-[18px] ${isUser ? 'rounded-br-[4px]' : 'rounded-bl-[4px] border'}`}
        style={
          isUser
            ? { backgroundColor: c.primary }
            : { backgroundColor: c.card, borderColor: c.cardBorder }
        }
        accessibilityLabel={`${isUser ? 'You' : 'Assistant'}: ${message.content}`}
      >
        <HighlightedContent text={message.content} isUser={isUser} />

        {/* Action row — Listen always, Translate on AI replies only. */}
        <View className="flex-row items-center mt-2" style={{ gap: spacing.sm }}>
          {/* Speaker button — available on every message so learners can hear
              their own sentences pronounced by a native voice too. */}
          <Pressable
            onPress={handleSpeak}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Stop audio' : 'Listen to this message'}
            className={`flex-row items-center ${isPlaying ? 'rounded-lg px-2 py-1' : ''}`}
            style={isPlaying ? { backgroundColor: c.surface2 } : undefined}
            hitSlop={8}
          >
            {isLoadingAudio ? (
              <ActivityIndicator size="small" color={isUser ? c.onPrimary : c.primary} />
            ) : (
              <Ionicons
                name={isPlaying ? 'stop-circle' : 'volume-medium-outline'}
                size={isPlaying ? 20 : 16}
                color={isPlaying ? c.error : isUser ? c.onPrimary : c.primary}
              />
            )}
            <Text
              className="text-xs ml-1"
              style={{ color: isUser ? c.onPrimaryMuted : c.primary }}
            >
              {isLoadingAudio ? 'Loading...' : isPlaying ? 'Stop' : 'Listen'}
            </Text>
          </Pressable>

          {/* Translate button — AI replies only. Per-message toggle. */}
          {!isUser && (
            <Pressable
              onPress={handleTranslate}
              accessibilityRole="button"
              accessibilityLabel={showTranslation ? 'Hide translation' : 'Translate this message'}
              className="flex-row items-center"
              hitSlop={8}
              disabled={isLoadingTranslation}
            >
              {isLoadingTranslation ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : (
                <Ionicons name="language-outline" size={16} color={c.primary} />
              )}
              <Text className="text-xs ml-1" style={{ color: c.primary }}>
                {isLoadingTranslation ? 'Translating...' : showTranslation ? 'Hide' : 'Translate'}
              </Text>
            </Pressable>
          )}

          {/* Report — AI replies only. Google Play requires an in-app way to
              flag offensive generative-AI output. */}
          {!isUser && (
            <Pressable
              onPress={() => setReportOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Report this response"
              className="flex-row items-center"
              hitSlop={8}
            >
              <Ionicons name="flag-outline" size={14} color={c.idle} />
              <Text className="text-xs ml-1" style={{ color: c.idle }}>
                Report
              </Text>
            </Pressable>
          )}
        </View>

        {!isUser && translationError && (
          <Text className="text-xs mt-2" style={{ color: c.error }}>
            Couldn't translate. Tap to retry.
          </Text>
        )}
      </View>

      {/* Translation sits OUTSIDE the bubble as a caption, per the deck. It stays
          opt-in rather than always-on as the deck draws it: the gloss is free
          once the reply exists, but a message without one still bills a
          translate call, and showing it unasked would bill every turn. */}
      {!isUser && showTranslation && translation && (
        <Text
          className="text-[13px] mt-1 ml-1"
          style={{ color: c.idle }}
        >
          {translation}
        </Text>
      )}

      {/* Timestamp */}
      <Text className={`text-[10px] mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`} style={{ color: c.muted }}>
        {formatTimestamp(message.timestamp)}
      </Text>

      {normalizedCorrection && (
        <CorrectionBanner
          correction={normalizedCorrection}
          messageId={message.id}
          isUser={isUser}
          targetLanguage={targetLanguage ?? 'en'}
          nativeLanguage={nativeLanguage ?? 'en'}
          userId={userId}
          cefrLevel={cefrLevel}
          voiceGender={voiceGender}
        />
      )}

      {!isUser && (
        <ReportContentSheet
          visible={reportOpen}
          onDismiss={() => setReportOpen(false)}
          content={message.content}
          surface="chat"
          context={{ messageId: message.id, targetLanguage: targetLanguage ?? null }}
        />
      )}
    </View>
  );
}

// ─── CorrectionBanner ──────────────────────────────────────────────────────
// Rich rendering of a CorrectionDetail. Implements all 10 ideas from the
// brainstorm:
//   1. Error-type chip (colored by type)
//   2. Inline diff (original strikethrough red / corrected highlighted green)
//   3. "Why?" expandable explanation (collapsed by default)
//   4. "Save" — pushes the corrected phrase into the user's SRS deck
//   5. Audio of corrected form via ElevenLabs TTS
//   6. Repetition counter ("N× this week") from correction.repetitionCount
//   7. Native-language explanation (guaranteed by the ai-chat system prompt)
//   8. Mini-drill — inline "Try again" exercise, fuzzy-matched
//   9. Severity indicator — banner background + border tint by severity
//  10. Example usage — extra sentence demonstrating correct pattern

/**
 * Severity: border colour on the banner, plus the `· MINOR` text label.
 *
 * The chip PLATE is `c.card` for all three rather than a severity tint. It sits
 * on top of the type tint below, and two tints stacked (a MODERATE chip on a
 * word_order banner, both yellow) cancel each other out. A flat card plate
 * reads on every one of the seven fills in both schemes, and severity keeps
 * both of the carriers DESIGN.md actually names for it: the banner border and
 * the written label.
 *
 * Arrow consts rather than module constants because UI 2.0 colour is a function
 * of the phone's scheme — a module-level table would freeze one of them.
 */
const severityStyles = (c: Ui2Palette): Record<CorrectionSeverity, { bg: string; border: string; label: string }> => ({
  minor:    { bg: c.card, border: c.cardBorder,   label: 'MINOR' },
  moderate: { bg: c.card, border: c.yellowBorder, label: 'MODERATE' },
  critical: { bg: c.card, border: c.error,        label: 'CRITICAL' },
});

/**
 * Error type: the banner FILL, plus the chip's written label.
 *
 * UI 2.0 ships four tint families where Dark Glow had seven bespoke chip
 * colours, so vocabulary/gender and spelling/other now share a fill. That is
 * safe precisely because the type was never colour-only: `typeStyle.label`
 * spells it out on the chip, which is the cue DESIGN.md §Accessibility
 * requires. Inventing three more tints here would be a palette change, and the
 * palette is not this component's to extend.
 *
 * `text` is `onTint` throughout — the one token guaranteed to clear AA on
 * every tint in both schemes, and it is also what colours the Save/Practice
 * row, which sits directly on the fill.
 */
const errorTypeStyles = (c: Ui2Palette): Record<CorrectionErrorType, { bg: string; text: string; label: string }> => ({
  grammar:    { bg: c.primaryTint, text: c.onTint, label: 'GRAMMAR' },
  vocabulary: { bg: c.pinkTint,    text: c.onTint, label: 'VOCAB' },
  spelling:   { bg: c.surface2,    text: c.onTint, label: 'SPELLING' },
  word_order: { bg: c.yellowTint,  text: c.onTint, label: 'WORD ORDER' },
  tense:      { bg: c.greenTint,   text: c.onTint, label: 'TENSE' },
  gender:     { bg: c.pinkTint,    text: c.onTint, label: 'GENDER' },
  other:      { bg: c.surface2,    text: c.onTint, label: 'CORRECTION' },
});

interface CorrectionBannerProps {
  correction: CorrectionDetail;
  messageId: string;
  isUser: boolean;
  targetLanguage: string;
  nativeLanguage: string;
  userId?: string;
  /** CEFR band the conversation is at; files a saved correction in a band so
   *  it counts toward measured vocabulary. */
  cefrLevel?: string | null;
  /** Matches the corrected-line playback to the learner's chosen tutor voice. */
  voiceGender?: VoiceGender;
}

export function CorrectionBanner({
  correction,
  messageId,
  isUser,
  targetLanguage,
  nativeLanguage,
  userId,
  cefrLevel,
  voiceGender,
}: CorrectionBannerProps) {
  const { c } = useUi2Theme();
  const severityStyle = severityStyles(c)[correction.severity];
  const typeStyle = errorTypeStyles(c)[correction.errorType];
  const hasDiff = Boolean(correction.original && correction.corrected);

  // ─── State ──────────────────────────────────────────────────────────────
  const [whyExpanded, setWhyExpanded] = useState(false);

  // Save to Review
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Corrected-audio playback (reuses same pattern as the message Listen btn)
  const [isLoadingCorrectedAudio, setIsLoadingCorrectedAudio] = useState(false);
  const [isPlayingCorrectedAudio, setIsPlayingCorrectedAudio] = useState(false);
  const correctedSoundRef = useRef<Audio.Sound | null>(null);

  // Explanation translate (belt-and-suspenders: if AI ignored the
  // native-language instruction, user can translate on demand)
  const [translatedExplanation, setTranslatedExplanation] = useState<string | null>(null);
  const [isTranslatingExplanation, setIsTranslatingExplanation] = useState(false);

  // Mini drill
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillInput, setDrillInput] = useState('');
  const [drillResult, setDrillResult] = useState<'correct' | 'incorrect' | null>(null);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleSaveToReview = async () => {
    if (saveState === 'saving' || saveState === 'saved') return;
    if (!userId) {
      Alert.alert('Sign in required', 'You need to be signed in to save corrections.');
      return;
    }
    if (!correction.corrected.trim()) {
      Alert.alert('Nothing to save', 'This correction has no target phrase to save.');
      return;
    }
    setSaveState('saving');
    try {
      await saveCorrectionAsCard({
        userId,
        targetLanguage,
        original: correction.original,
        corrected: correction.corrected,
        shortLabel: correction.shortLabel,
        explanation: correction.explanation,
        cefrLevel,
      });
      setSaveState('saved');
    } catch (err) {
      console.warn('[correction] saveCorrectionAsCard failed:', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const handlePlayCorrected = async () => {
    if (!correction.corrected.trim()) return;
    if (isPlayingCorrectedAudio && correctedSoundRef.current) {
      try { await correctedSoundRef.current.stopAsync(); } catch { /* ignore */ }
      setIsPlayingCorrectedAudio(false);
      return;
    }
    setIsLoadingCorrectedAudio(true);
    try {
      const base64 = await getTextToSpeech(correction.corrected, targetLanguage, userId, { voiceGender });
      const { sound } = await Audio.Sound.createAsync({ uri: `data:audio/mpeg;base64,${base64}` });
      correctedSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingCorrectedAudio(false);
          sound.unloadAsync().catch(() => { /* ignore */ });
        }
      });
      setIsPlayingCorrectedAudio(true);
      await sound.playAsync();
    } catch (err) {
      console.warn('[correction] corrected-audio TTS failed:', err);
      const msg = err instanceof VoiceError
        ? 'Voice features temporarily unavailable.'
        : 'Could not play audio.';
      Alert.alert('Audio', msg);
    } finally {
      setIsLoadingCorrectedAudio(false);
    }
  };

  const handleTranslateExplanation = async () => {
    if (translatedExplanation) {
      setTranslatedExplanation(null);
      return;
    }
    if (!correction.explanation.trim()) return;
    setIsTranslatingExplanation(true);
    try {
      // Assume the explanation is in nativeLanguage already per ai-chat prompt;
      // if user taps this, they want it in the target language for immersion.
      const t = await translateText(correction.explanation, nativeLanguage, targetLanguage);
      setTranslatedExplanation(t);
    } catch (err) {
      console.warn('[correction] explanation translate failed:', err);
    } finally {
      setIsTranslatingExplanation(false);
    }
  };

  const handleSubmitDrill = () => {
    if (!drillInput.trim()) return;
    setDrillResult(isClose(drillInput, correction.corrected) ? 'correct' : 'incorrect');
  };

  const handleResetDrill = () => {
    setDrillInput('');
    setDrillResult(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  const showRepetition = (correction.repetitionCount ?? 0) > 1;

  return (
    <View
      className={`rounded-xl p-3 mt-1 ${isUser ? 'self-end' : 'self-start'}`}
      style={{
        // Fill carries the error TYPE (the deck's lilac banner is simply the
        // vocabulary family); the border carries SEVERITY, so both signals
        // survive collapsing to one tint. The "· MINOR" label below is the
        // non-colour cue severity still needs.
        backgroundColor: typeStyle.bg,
        borderWidth: 1,
        borderColor: severityStyle.border,
        maxWidth: '100%',
      }}
    >
      {/* Header: chip row */}
      <View className="flex-row items-center" style={{ gap: 6, flexWrap: 'wrap' }}>
        <View
          style={{
            backgroundColor: severityStyle.bg,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              color: typeStyle.text,
              fontFamily: typography.family.mono,
              fontSize: 10,
              letterSpacing: 0.6,
            }}
          >
            {typeStyle.label}
          </Text>
        </View>
        <Text style={{ color: c.muted, fontFamily: typography.family.semibold, fontSize: 10 }}>
          · {severityStyle.label}
        </Text>
        {showRepetition && (
          <Text style={{ color: c.error, fontFamily: typography.family.semibold, fontSize: 10 }}>
            · {correction.repetitionCount}× this week
          </Text>
        )}
      </View>

      {/* Diff — deck's inline original → arrow → corrected. Colour is kept on
          both halves: strikethrough and weight alone are weaker error cues. */}
      {hasDiff && (
        <View
          className="flex-row items-center"
          style={{ gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}
        >
          <Text
            style={{
              color: c.error,
              fontSize: 14,
              textDecorationLine: 'line-through',
              textDecorationColor: c.error,
            }}
          >
            {correction.original}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={c.idle} />
          <Text
            style={{
              color: c.green,
              fontFamily: typography.family.extrabold,
              fontSize: 14,
            }}
          >
            {correction.corrected}
          </Text>
          <Pressable
            onPress={handlePlayCorrected}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Listen to corrected phrase"
          >
            {isLoadingCorrectedAudio ? (
              <ActivityIndicator size="small" color={c.green} />
            ) : (
              <Ionicons
                name={isPlayingCorrectedAudio ? 'stop-circle' : 'volume-medium-outline'}
                size={16}
                color={isPlayingCorrectedAudio ? c.error : c.green}
              />
            )}
          </Pressable>
        </View>
      )}

      {/* shortLabel — always visible */}
      <Text style={{ color: c.muted, fontSize: 12, marginTop: hasDiff ? spacing.xxs : 6 }}>
        {correction.shortLabel}
      </Text>

      {/* "Why?" expandable */}
      {correction.explanation && (
        <View style={{ marginTop: 6 }}>
          <Pressable
            onPress={() => setWhyExpanded((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={whyExpanded ? 'Hide explanation' : 'Show explanation'}
            className="flex-row items-center"
          >
            <Ionicons
              name={whyExpanded ? 'chevron-down-outline' : 'chevron-forward-outline'}
              size={14}
              color={c.primary}
            />
            <Text style={{ color: c.primary, fontSize: 12, marginLeft: 2, fontWeight: '600' }}>
              Why?
            </Text>
          </Pressable>
          {whyExpanded && (
            <View style={{ marginTop: spacing.xxs, paddingLeft: spacing.md }}>
              <Text style={{ color: c.ink, fontSize: 13, lineHeight: 18 }}>
                {translatedExplanation ?? correction.explanation}
              </Text>
              <Pressable
                onPress={handleTranslateExplanation}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={translatedExplanation ? 'Show explanation in native language' : 'Translate explanation to target language'}
                className="flex-row items-center mt-2"
              >
                {isTranslatingExplanation ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : (
                  <Ionicons name="language-outline" size={12} color={c.primary} />
                )}
                <Text style={{ color: c.primary, fontSize: 11, marginLeft: spacing.xxs }}>
                  {isTranslatingExplanation
                    ? 'Translating…'
                    : translatedExplanation
                      ? `Show in ${nativeLanguage.toUpperCase()}`
                      : `Show in ${targetLanguage.toUpperCase()}`}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Example usage */}
      {correction.example && (
        <View
          style={{
            marginTop: spacing.xs,
            paddingLeft: spacing.xs,
            borderLeftWidth: 2,
            borderLeftColor: c.greenBorder,
          }}
        >
          <Text style={{ color: c.idle, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
            EXAMPLE
          </Text>
          <Text style={{ color: c.ink, fontSize: 13, fontStyle: 'italic' }}>
            {correction.example}
          </Text>
        </View>
      )}

      {/* Action row: Save + Try again. Deck separates it with a hairline. */}
      <View
        className="flex-row items-center"
        style={{
          gap: spacing.md,
          marginTop: spacing.xs,
          paddingTop: spacing.xs,
          borderTopWidth: 1,
          borderTopColor: c.cardBorder,
        }}
      >
        <Pressable
          onPress={handleSaveToReview}
          disabled={saveState === 'saving' || saveState === 'saved'}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saveState === 'saved' ? 'Saved to review deck' : 'Save this correction to review'}
          className="flex-row items-center"
          style={{ opacity: saveState === 'saved' ? 0.7 : 1 }}
        >
          {saveState === 'saving' ? (
            <ActivityIndicator size="small" color={typeStyle.text} />
          ) : (
            <Ionicons
              name={saveState === 'saved' ? 'checkmark-circle' : 'layers'}
              size={12}
              color={saveState === 'saved' ? c.green : saveState === 'error' ? c.error : typeStyle.text}
            />
          )}
          <Text
            style={{
              color: saveState === 'saved' ? c.green : saveState === 'error' ? c.error : typeStyle.text,
              fontFamily: typography.family.bold,
              fontSize: 12,
              marginLeft: spacing.xxs,
            }}
          >
            {saveState === 'saving' ? 'Saving…' :
              saveState === 'saved' ? 'Saved to Review' :
              saveState === 'error' ? 'Retry Save' :
              'Save to Review'}
          </Text>
        </Pressable>

        {correction.corrected && (
          <Pressable
            onPress={() => {
              if (drillOpen) {
                handleResetDrill();
                setDrillOpen(false);
              } else {
                setDrillOpen(true);
              }
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={drillOpen ? 'Close practice drill' : 'Practice this correction'}
            className="flex-row items-center"
          >
            <Ionicons
              name={drillOpen ? 'close-circle-outline' : 'pencil-outline'}
              size={12}
              color={typeStyle.text}
            />
            <Text
              style={{
                color: typeStyle.text,
                fontFamily: typography.family.bold,
                fontSize: 12,
                marginLeft: spacing.xxs,
              }}
            >
              {drillOpen ? 'Cancel' : 'Practice'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Mini drill */}
      {drillOpen && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: c.idle, fontSize: 11, marginBottom: 6 }}>
            Type the corrected version:
          </Text>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <TextInput
              value={drillInput}
              onChangeText={(text) => {
                setDrillInput(text);
                if (drillResult) setDrillResult(null);
              }}
              placeholder={correction.original || '...'}
              placeholderTextColor={c.idle}
              style={{
                flex: 1,
                backgroundColor: c.card,
                borderRadius: radii.sm,
                paddingHorizontal: 10,
                paddingVertical: spacing.xs,
                color: c.ink,
                fontSize: 13,
                borderWidth: 1,
                borderColor: c.cardBorder,
              }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={drillResult !== 'correct'}
            />
            <Pressable
              onPress={drillResult === 'correct' ? handleResetDrill : handleSubmitDrill}
              disabled={!drillInput.trim() && drillResult !== 'correct'}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={drillResult === 'correct' ? 'Try again' : 'Submit attempt'}
              style={{
                backgroundColor: c.primary,
                borderRadius: radii.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                opacity: !drillInput.trim() && drillResult !== 'correct' ? 0.4 : 1,
              }}
            >
              <Text style={{ color: c.onPrimary, fontSize: 12, fontWeight: '700' }}>
                {drillResult === 'correct' ? 'Again' : 'Check'}
              </Text>
            </Pressable>
          </View>
          {drillResult === 'correct' && (
            <Text style={{ color: c.green, fontSize: 12, marginTop: 6, fontWeight: '600' }}>
              ✓ Nailed it!
            </Text>
          )}
          {drillResult === 'incorrect' && (
            <Text style={{ color: c.error, fontSize: 12, marginTop: 6 }}>
              ✗ Not quite — the target was "{correction.corrected}". Try again.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
