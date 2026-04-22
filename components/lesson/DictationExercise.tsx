import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioPlayButton } from '../audio/AudioPlayButton';
import { FeedbackCard } from './FeedbackCard';
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
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#6366F1', marginBottom: 8 }}>
        Dictation
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 20 }}>
        Listen and type what you hear
      </Text>

      {/* Audio Player */}
      <View style={{
        backgroundColor: '#F9FAFB', borderRadius: 20, padding: 24, marginBottom: 20,
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
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8 }}>
              Tap to play {playCount > 0 ? '(replay)' : ''}
            </Text>
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
                  marginTop: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#C7D2FE',
                  backgroundColor: '#EEF2FF',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {phonemeDrill.isPlaying ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text style={{ color: '#4338CA', fontSize: 13, fontWeight: '600' }}>
                    Replay in a different voice
                  </Text>
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
                backgroundColor: '#6366F1',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {phonemeDrill.isPlaying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>
                  {'▶'}
                </Text>
              )}
            </Pressable>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8 }}>
              Tap to play {playCount > 0 ? '(replay)' : ''}
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 16, color: '#999' }}>No audio available</Text>
        )}
      </View>

      {/* Text Input */}
      <TextInput
        value={userInput}
        onChangeText={setUserInput}
        placeholder="Type what you heard..."
        placeholderTextColor="#999"
        editable={!isRevealed}
        multiline
        style={{
          borderWidth: 2,
          borderColor: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : '#D1D5DB',
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          fontSize: 16,
          minHeight: 80,
          textAlignVertical: 'top',
          color: '#111',
          marginBottom: 16,
        }}
        accessibilityLabel="Type what you heard"
      />

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
            backgroundColor: userInput.trim().length > 0 ? '#6366F1' : '#C7D2FE',
            paddingVertical: 16, borderRadius: 14, alignItems: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Check answer"
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Check</Text>
        </Pressable>
      )}
    </View>
  );
}
