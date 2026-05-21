import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { FeedbackCard } from './FeedbackCard';
import { Body, Caption } from '../ui/Text';
import { colors, spacing, radii } from '../../config/theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { usePhonemeDrill } from '../../hooks/usePhonemeDrill';
import type { Exercise, LanguageCode } from '../../types';

interface Props {
  exercise: Exercise;
  onAnswer: (isCorrect: boolean, answer: string) => void;
  /** Needed so the HVPT replay path can rotate through per-language voices. */
  targetLanguage?: LanguageCode;
  /** For per-tier voice-minute metering on the TTS edge function. */
  userId?: string;
  /** Used by FeedbackCard to look up grammar rules. Defaults to targetLanguage. */
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function DictationExercise({
  exercise,
  onAnswer,
  targetLanguage,
  userId,
  language,
  cefrLevel,
  onContinue,
}: Props) {
  const [userInput, setUserInput] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [playCount, setPlayCount] = useState(0);

  // HVPT replay: after the first play, subsequent "replay" taps rotate
  // through ≥4 distinct ElevenLabs voices for the target language so the
  // learner hears the same utterance in multiple voices (Thomson meta-
  // analyses; see research.md §9). First play still uses the pre-recorded
  // promptAudioUrl to preserve existing auto-play semantics.
  const phonemeDrill = usePhonemeDrill(targetLanguage ?? 'en', 4, { userId });

  const handleCheck = () => {
    const grade = gradeAnswer(userInput, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
      },
    });
    setResult(grade);
    setIsRevealed(true);

    if (grade.isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    onAnswer(grade.isCorrect, userInput);
  };

  const handleRetry = () => {
    setUserInput('');
    setIsRevealed(false);
    setResult(null);
  };

  const effectiveLanguage = language ?? targetLanguage;
  const isCorrect = result?.isCorrect ?? false;

  return (
    <View style={{ flex: 1 }}>
      <Caption tone="accent" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        Dictation
      </Caption>
      <Body size="lg" weight="semibold" style={{ marginBottom: spacing.lg + spacing.xxs }}>
        Listen and type what you hear
      </Body>

      {/* Audio Player */}
      <View style={{
        backgroundColor: colors.surface.cardAlt, borderRadius: radii.xxl, padding: spacing.lg, marginBottom: spacing.lg + spacing.xxs,
        alignItems: 'center', minHeight: 120, justifyContent: 'center',
      }}>
        {exercise.promptAudioUrl ? (
          <View style={{ alignItems: 'center' }}>
            <Pressable
              onPress={() => setPlayCount((n) => n + 1)}
              accessibilityRole="button"
              accessibilityLabel="Play audio"
            >
              <AudioPlayButton audioUrl={exercise.promptAudioUrl} size={64} />
            </Pressable>
            <Caption tone="tertiary" style={{ marginTop: spacing.xs }}>
              Tap to play {playCount > 0 ? '(replay)' : ''}
            </Caption>
            {/* HVPT replay: rotate voices on subsequent listens. Only
                offered when we know the target language. */}
            {targetLanguage ? (
              <Pressable
                onPress={() => {
                  setPlayCount((n) => n + 1);
                  phonemeDrill.playNext(exercise.correctAnswer);
                }}
                disabled={phonemeDrill.isPlaying}
                accessibilityRole="button"
                accessibilityLabel="Replay in a different voice"
                style={{
                  marginTop: spacing.sm,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: spacing.xs,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.surface.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {phonemeDrill.isPlaying ? (
                  <ActivityIndicator size="small" color={colors.indigo[500]} />
                ) : (
                  <Caption tone="accent" style={{ fontWeight: '600' }}>
                    Replay in a different voice
                  </Caption>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : targetLanguage ? (
          // No pre-recorded URL — fall back entirely to HVPT TTS drill.
          <View style={{ alignItems: 'center' }}>
            <Pressable
              onPress={() => {
                setPlayCount((n) => n + 1);
                phonemeDrill.playNext(exercise.correctAnswer);
              }}
              disabled={phonemeDrill.isPlaying}
              accessibilityRole="button"
              accessibilityLabel="Play audio"
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: colors.indigo[500],
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {phonemeDrill.isPlaying ? (
                <ActivityIndicator color={colors.text.onPrimary} />
              ) : (
                <Text style={{ color: colors.text.onPrimary, fontSize: 24, fontWeight: '700' }}>
                  {'▶'}
                </Text>
              )}
            </Pressable>
            <Caption tone="tertiary" style={{ marginTop: spacing.xs }}>
              Tap to play {playCount > 0 ? '(replay)' : ''}
            </Caption>
          </View>
        ) : (
          <Body tone="tertiary">No audio available</Body>
        )}
      </View>

      {/* Text Input */}
      <View>
        <TextInput
          value={userInput}
          onChangeText={setUserInput}
          placeholder="Type what you heard..."
          placeholderTextColor={colors.text.quaternary}
          editable={!isRevealed}
          multiline
          style={{
            borderWidth: 2,
            borderColor: isRevealed ? (isCorrect ? colors.success.base : colors.error.base) : colors.border.strong,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            fontSize: 16,
            minHeight: 80,
            textAlignVertical: 'top',
            color: colors.text.primary,
            marginBottom: spacing.md,
          }}
          accessibilityLabel="Type what you heard"
        />
        {isRevealed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={isCorrect ? colors.success.base : colors.error.base}
              style={{ marginRight: spacing.xxs }}
            />
            <Caption style={{ color: isCorrect ? colors.success.base : colors.error.base }}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </Caption>
          </View>
        )}
      </View>

      {/* Differentiated feedback */}
      {result && isRevealed && effectiveLanguage && onContinue ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={effectiveLanguage}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
          onContinue={onContinue}
        />
      ) : null}

      {/* Check button */}
      {!isRevealed && (
        <Pressable
          onPress={handleCheck}
          disabled={userInput.trim().length === 0}
          style={{
            backgroundColor: userInput.trim().length > 0 ? colors.indigo[500] : colors.indigo[200],
            paddingVertical: spacing.md, borderRadius: radii.lg, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Body size="lg" weight="semibold" tone="onPrimary">Check</Body>
        </Pressable>
      )}
    </View>
  );
}
