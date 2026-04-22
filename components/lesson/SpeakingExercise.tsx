import { useState } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { usePhonemeDrill } from '../../hooks/usePhonemeDrill';
import { scorePronunciation } from '../../lib/ai';
import type { GradeResult } from '../../lib/grading';
import type { Exercise, LanguageCode } from '../../types';

interface SpeakingExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId: string;
  targetLanguage: LanguageCode;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function SpeakingExercise({
  exercise,
  onAnswer,
  showResult,
  userId,
  targetLanguage,
  cefrLevel,
  onContinue,
}: SpeakingExerciseProps) {
  const { recording, audioUri, startRecording, stopRecording, getBase64 } = useAudioRecorder();
  const { playing, play } = useAudioPlayer();
  const [scoring, setScoring] = useState(false);
  const [scoreState, setScoreState] = useState<
    | { score: number; feedback: string; transcription?: string }
    | null
  >(null);
  const [result, setResult] = useState<GradeResult | null>(null);

  // HVPT replay: when the learner asks to hear the prompt again, cycle
  // through ≥4 distinct ElevenLabs voices for this language so they get
  // phoneme variability across repetitions (Thomson meta-analyses;
  // research.md §9). First play still uses the pre-recorded
  // promptAudioUrl when present, so this only affects the replay path.
  const phonemeDrill = usePhonemeDrill(targetLanguage, 4, { userId });

  const handleToggleRecord = async () => {
    if (recording) {
      await stopRecording();
    } else {
      await startRecording();
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
    }
  };

  const handleScore = async () => {
    if (!audioUri) return;
    setScoring(true);

    try {
      const base64 = await getBase64();
      if (!base64) {
        setScoreState({ score: 0, feedback: 'Could not process audio.' });
        return;
      }

      const pronounciation = await scorePronunciation({
        userId,
        audioBase64: base64,
        expectedText: exercise.correctAnswer,
        language: targetLanguage,
        acceptedVariants: exercise.acceptedSpeechVariants,
        targetWord: exercise.targetWord,
      });

      setScoreState({
        score: pronounciation.score,
        feedback: pronounciation.feedback,
        transcription: pronounciation.transcription,
      });

      const isCorrect = pronounciation.score >= 60;
      // Synthesize a GradeResult so FeedbackCard can show the phonological
      // recast branch on failure. Speaking is the only exercise type that
      // maps to 'phonological' (see classifyError in lib/grading.ts).
      const grade: GradeResult = {
        isCorrect,
        accuracy: pronounciation.score / 100,
        feedback: pronounciation.feedback,
        normalizedUserAnswer: pronounciation.transcription ?? '',
        normalizedCorrectAnswer: exercise.correctAnswer,
        errorType: isCorrect ? null : 'phonological',
      };
      setResult(grade);

      if (Platform.OS !== 'web') {
        if (isCorrect) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }

      onAnswer(isCorrect, `score:${pronounciation.score}`);
    } catch {
      setScoreState({ score: 0, feedback: 'Scoring failed. Please try again.' });
    } finally {
      setScoring(false);
    }
  };

  const handleRetry = () => {
    setScoreState(null);
    setResult(null);
  };

  const getScoreColor = () => {
    if (!scoreState) return {};
    if (scoreState.score >= 80) return { bg: 'bg-success-bg', text: 'text-success' };
    if (scoreState.score >= 60) return { bg: 'bg-warning-bg', text: 'text-warning' };
    return { bg: 'bg-error-bg', text: 'text-error' };
  };

  const highlight = exercise.targetWord ?? exercise.targetGrammar;
  const promptNode = (
    <HighlightedText
      text={exercise.prompt}
      highlight={highlight}
      className="text-text-primary text-[22px] font-sans-semibold"
    />
  );

  return (
    <ExerciseCard type={exercise.type} promptNode={promptNode}>
      {/* Prompt audio playback */}
      {exercise.promptAudioUrl && (
        <View className="mb-4">
          <Pressable
            className="bg-dark-card-alt rounded-[14px] p-4 flex-row items-center"
            onPress={() => play(exercise.promptAudioUrl!)}
            accessibilityRole="button"
            accessibilityLabel="Play prompt audio"
          >
            <Ionicons name={playing ? 'volume-high' : 'play-circle'} size={28} color="#38BDF8" />
            <Text className="text-text-primary text-base ml-3">Listen to the prompt</Text>
          </Pressable>
          {/* HVPT replay: rotate through per-language voices on each tap. */}
          <Pressable
            className="bg-dark-card-alt/60 rounded-[12px] p-3 flex-row items-center mt-2 self-start"
            onPress={() => phonemeDrill.playNext(exercise.correctAnswer)}
            disabled={phonemeDrill.isPlaying}
            accessibilityRole="button"
            accessibilityLabel="Replay in a different voice"
          >
            {phonemeDrill.isPlaying ? (
              <ActivityIndicator size="small" color="#38BDF8" />
            ) : (
              <Ionicons name="refresh" size={20} color="#38BDF8" />
            )}
            <Text className="text-text-secondary text-sm ml-2">Replay in a different voice</Text>
          </Pressable>
        </View>
      )}

      {/* Record button */}
      <Pressable
        className={`w-20 h-20 rounded-full items-center justify-center self-center mb-4 ${recording ? 'bg-error' : 'bg-primary'}`}
        onPress={handleToggleRecord}
        disabled={scoring || scoreState !== null}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      >
        <Ionicons
          name={recording ? 'stop' : 'mic'}
          size={36}
          color="white"
        />
      </Pressable>

      <Text className="text-text-secondary text-sm text-center mb-4">
        {recording ? 'Recording... Tap to stop' : scoreState ? '' : 'Tap to record your answer'}
      </Text>

      {/* Score button */}
      {audioUri && !scoreState && !scoring && (
        <Pressable
          className="bg-primary py-4 px-12 rounded-[14px] items-center"
          onPress={handleScore}
          accessibilityRole="button"
          accessibilityLabel="Score pronunciation"
        >
          <Text className="text-white text-lg font-semibold">Score My Answer</Text>
        </Pressable>
      )}

      {scoring && (
        <View className="items-center py-4">
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text className="text-text-tertiary text-sm mt-2">Scoring pronunciation...</Text>
        </View>
      )}

      {/* Score display */}
      {scoreState && (
        <View className="items-center">
          <View className={`w-[100px] h-[100px] rounded-full items-center justify-center ${getScoreColor().bg}`}>
            <Text className={`text-[32px] font-bold ${getScoreColor().text}`}>
              {scoreState.score}%
            </Text>
          </View>
          <Text className="text-text-primary text-base mt-3 text-center">{scoreState.feedback}</Text>
          {scoreState.transcription && (
            <Text className="text-text-tertiary text-xs mt-2 text-center italic">
              Heard: "{scoreState.transcription}"
            </Text>
          )}
        </View>
      )}

      {/* Differentiated feedback — phonological recast on failure */}
      {result && onContinue ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={targetLanguage}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
          onContinue={onContinue}
        />
      ) : null}
    </ExerciseCard>
  );
}
