import { useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { getTextToSpeech, translateText, VoiceError } from '../../lib/ai';
import { saveCorrectionAsCard } from '../../lib/supabase-queries';
import { isClose } from '../../lib/fuzzyMatch';
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
  /** User's native language from profile; target of Translate button. Defaults to 'en'. */
  nativeLanguage?: string;
}

/** Render message content with **bold** words highlighted as vocabulary. */
function HighlightedContent({ text, isUser }: { text: string; isUser: boolean }) {
  // Split on **word** patterns, keeping the delimiters
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <Text className={isUser ? 'text-white text-base' : 'text-text-primary text-base'}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const word = part.slice(2, -2);
          return (
            <Text
              key={index}
              className="font-bold"
              style={!isUser ? { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderRadius: 4 } : undefined}
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

// Cache audio URIs by message ID to avoid re-fetching
const audioCache = new Map<string, Audio.Sound>();

// Cache translated text by message ID — translations are deterministic enough
// that one tap per message is plenty; subsequent toggles are instant.
const translationCache = new Map<string, string>();

export function ChatBubble({ message, targetLanguage, userId, nativeLanguage }: ChatBubbleProps) {
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
  const translation = translationCache.get(message.id) ?? null;

  const handleTranslate = async () => {
    // Toggle off if already showing
    if (showTranslation) {
      setShowTranslation(false);
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
        userId
      );
      const dataUri = `data:audio/mpeg;base64,${base64}`;

      const { sound } = await Audio.Sound.createAsync({ uri: dataUri });
      soundRef.current = sound;
      audioCache.set(message.id, sound);

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
    <View className={`mb-2 max-w-[82%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`p-[14px] ${
          isUser
            ? 'bg-primary rounded-[18px] rounded-br-[4px]'
            : 'bg-dark-card rounded-[18px] rounded-bl-[4px]'
        }`}
        accessibilityLabel={`${isUser ? 'You' : 'Assistant'}: ${message.content}`}
      >
        <HighlightedContent text={message.content} isUser={isUser} />

        {/* Action row — Listen always, Translate on AI replies only. */}
        <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
          {/* Speaker button — available on every message so learners can hear
              their own sentences pronounced by a native voice too. */}
          <Pressable
            onPress={handleSpeak}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Stop audio' : 'Listen to this message'}
            className={`flex-row items-center ${isPlaying ? 'bg-error-bg rounded-lg px-2 py-1' : ''}`}
            hitSlop={8}
          >
            {isLoadingAudio ? (
              <ActivityIndicator size="small" color={isUser ? '#FFFFFF' : '#7DD3FC'} />
            ) : (
              <Ionicons
                name={isPlaying ? 'stop-circle' : 'volume-medium-outline'}
                size={isPlaying ? 20 : 16}
                color={isPlaying ? '#EF4444' : isUser ? '#FFFFFF' : '#7DD3FC'}
              />
            )}
            <Text
              className="text-xs ml-1"
              style={{ color: isUser ? 'rgba(255,255,255,0.9)' : '#C4B5FD' }}
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
                <ActivityIndicator size="small" color="#7DD3FC" />
              ) : (
                <Ionicons name="language-outline" size={16} color="#7DD3FC" />
              )}
              <Text className="text-xs ml-1" style={{ color: '#C4B5FD' }}>
                {isLoadingTranslation ? 'Translating...' : showTranslation ? 'Hide' : 'Translate'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Translation body — shown when toggled on. Muted italic; not red
            (red is reserved for Correction). */}
        {!isUser && showTranslation && translation && (
          <Text
            className="text-sm italic mt-2"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            {translation}
          </Text>
        )}
        {!isUser && translationError && (
          <Text className="text-xs mt-2" style={{ color: '#FCA5A5' }}>
            Couldn't translate. Tap to retry.
          </Text>
        )}
      </View>

      {/* Timestamp */}
      <Text className={`text-[10px] text-text-secondary mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
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

const SEVERITY_STYLES: Record<CorrectionSeverity, { bg: string; border: string; label: string }> = {
  minor:    { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.35)', label: 'MINOR' },
  moderate: { bg: 'rgba(251, 191, 36, 0.15)',  border: 'rgba(251, 191, 36, 0.35)',  label: 'MODERATE' },
  critical: { bg: 'rgba(239, 68, 68, 0.15)',   border: 'rgba(239, 68, 68, 0.40)',   label: 'CRITICAL' },
};

const ERROR_TYPE_STYLES: Record<CorrectionErrorType, { bg: string; text: string; label: string }> = {
  grammar:    { bg: 'rgba(56, 189, 248, 0.22)', text: '#7DD3FC', label: 'GRAMMAR' },
  vocabulary: { bg: 'rgba(168, 85, 247, 0.22)', text: '#C084FC', label: 'VOCAB' },
  spelling:   { bg: 'rgba(148, 163, 184, 0.22)', text: '#CBD5E1', label: 'SPELLING' },
  word_order: { bg: 'rgba(251, 146, 60, 0.22)', text: '#FB923C', label: 'WORD ORDER' },
  tense:      { bg: 'rgba(52, 211, 153, 0.22)', text: '#6EE7B7', label: 'TENSE' },
  gender:     { bg: 'rgba(244, 114, 182, 0.22)', text: '#F472B6', label: 'GENDER' },
  other:      { bg: 'rgba(148, 163, 184, 0.22)', text: '#CBD5E1', label: 'CORRECTION' },
};

interface CorrectionBannerProps {
  correction: CorrectionDetail;
  messageId: string;
  isUser: boolean;
  targetLanguage: string;
  nativeLanguage: string;
  userId?: string;
}

export function CorrectionBanner({
  correction,
  messageId,
  isUser,
  targetLanguage,
  nativeLanguage,
  userId,
}: CorrectionBannerProps) {
  const severityStyle = SEVERITY_STYLES[correction.severity];
  const typeStyle = ERROR_TYPE_STYLES[correction.errorType];
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
      const base64 = await getTextToSpeech(correction.corrected, targetLanguage, userId);
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
        backgroundColor: severityStyle.bg,
        borderWidth: 1,
        borderColor: severityStyle.border,
        maxWidth: '100%',
      }}
    >
      {/* Header: chip row */}
      <View className="flex-row items-center" style={{ gap: 6, flexWrap: 'wrap' }}>
        <View
          style={{
            backgroundColor: typeStyle.bg,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{ color: typeStyle.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}
          >
            {typeStyle.label}
          </Text>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600' }}>
          · {severityStyle.label}
        </Text>
        {showRepetition && (
          <Text style={{ color: '#FBBF24', fontSize: 10, fontWeight: '600' }}>
            · {correction.repetitionCount}× this week
          </Text>
        )}
      </View>

      {/* Diff block */}
      {hasDiff && (
        <View style={{ marginTop: 8 }}>
          <View className="flex-row items-start" style={{ gap: 6 }}>
            <Text style={{ color: '#FCA5A5', fontSize: 14, fontWeight: '700' }}>✗</Text>
            <Text
              style={{
                color: '#FCA5A5',
                fontSize: 14,
                flex: 1,
                textDecorationLine: 'line-through',
                textDecorationColor: '#FCA5A5',
              }}
            >
              {correction.original}
            </Text>
          </View>
          <View className="flex-row items-start mt-1" style={{ gap: 6 }}>
            <Text style={{ color: '#6EE7B7', fontSize: 14, fontWeight: '700' }}>✓</Text>
            <Text style={{ color: '#6EE7B7', fontSize: 14, fontWeight: '600', flex: 1 }}>
              {correction.corrected}
            </Text>
            <Pressable
              onPress={handlePlayCorrected}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Listen to corrected phrase"
            >
              {isLoadingCorrectedAudio ? (
                <ActivityIndicator size="small" color="#6EE7B7" />
              ) : (
                <Ionicons
                  name={isPlayingCorrectedAudio ? 'stop-circle' : 'volume-medium-outline'}
                  size={16}
                  color={isPlayingCorrectedAudio ? '#EF4444' : '#6EE7B7'}
                />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* shortLabel — always visible */}
      <Text style={{ color: '#F1F5F9', fontSize: 13, fontWeight: '600', marginTop: hasDiff ? 8 : 6 }}>
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
              color="#C4B5FD"
            />
            <Text style={{ color: '#C4B5FD', fontSize: 12, marginLeft: 2, fontWeight: '600' }}>
              Why?
            </Text>
          </Pressable>
          {whyExpanded && (
            <View style={{ marginTop: 4, paddingLeft: 16 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 }}>
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
                  <ActivityIndicator size="small" color="#7DD3FC" />
                ) : (
                  <Ionicons name="language-outline" size={12} color="#7DD3FC" />
                )}
                <Text style={{ color: '#7DD3FC', fontSize: 11, marginLeft: 4 }}>
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
            marginTop: 8,
            paddingLeft: 8,
            borderLeftWidth: 2,
            borderLeftColor: 'rgba(110, 231, 183, 0.4)',
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
            EXAMPLE
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontStyle: 'italic' }}>
            {correction.example}
          </Text>
        </View>
      )}

      {/* Action row: Save + Try again */}
      <View className="flex-row items-center mt-3" style={{ gap: 12 }}>
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
            <ActivityIndicator size="small" color="#7DD3FC" />
          ) : (
            <Ionicons
              name={saveState === 'saved' ? 'checkmark-circle' : 'bookmark-outline'}
              size={14}
              color={saveState === 'saved' ? '#6EE7B7' : saveState === 'error' ? '#FCA5A5' : '#7DD3FC'}
            />
          )}
          <Text
            style={{
              color: saveState === 'saved' ? '#6EE7B7' : saveState === 'error' ? '#FCA5A5' : '#C4B5FD',
              fontSize: 12,
              marginLeft: 4,
              fontWeight: '600',
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
              size={14}
              color="#7DD3FC"
            />
            <Text style={{ color: '#C4B5FD', fontSize: 12, marginLeft: 4, fontWeight: '600' }}>
              {drillOpen ? 'Cancel' : 'Try again'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Mini drill */}
      {drillOpen && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 6 }}>
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
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.25)',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                color: '#F1F5F9',
                fontSize: 13,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
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
                backgroundColor: '#38BDF8',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: !drillInput.trim() && drillResult !== 'correct' ? 0.4 : 1,
              }}
            >
              <Text style={{ color: '#0C0F14', fontSize: 12, fontWeight: '700' }}>
                {drillResult === 'correct' ? 'Again' : 'Check'}
              </Text>
            </Pressable>
          </View>
          {drillResult === 'correct' && (
            <Text style={{ color: '#6EE7B7', fontSize: 12, marginTop: 6, fontWeight: '600' }}>
              ✓ Nailed it!
            </Text>
          )}
          {drillResult === 'incorrect' && (
            <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 6 }}>
              ✗ Not quite — the target was "{correction.corrected}". Try again.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
