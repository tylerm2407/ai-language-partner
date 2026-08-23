import { useState } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { HighlightedText } from '../shared/HighlightedText';
import { colors } from '../../config/theme';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { usePhonemeDrill } from '../../hooks/usePhonemeDrill';
import { scorePronunciation } from '../../lib/ai';
import type { GradeResult } from '../../lib/grading';
import { parseSpeakingScore } from '../../lib/exercise-restore';
import type { Exercise, LanguageCode } from '../../types';

interface SpeakingExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. Encoded
   *  as `score:NN` — see lib/exercise-restore.ts for why only the number
   *  comes back. */
  selected?: string | null;
  userId: string;
  targetLanguage: LanguageCode;
  cefrLevel?: string;
}

export function SpeakingExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  targetLanguage,
  cefrLevel,
}: SpeakingExerciseProps) {
  const { recording, audioUri, error: recorderError, startRecording, stopRecording, getBase64 } = useAudioRecorder();
  const { playing, error: playerError, play } = useAudioPlayer();
  const [scoring, setScoring] = useState(false);
  // Seeded from the recorded pick so Previous shows the score the learner
  // earned rather than an empty recorder. Only the number was ever stored —
  // the spoken feedback and transcription came from the scoring service and
  // are not reconstructable, so the restored line states the score and
  // nothing more. `result` stays null on a restore for the same reason:
  // FeedbackCard's phonological branch would auto-play a recast and render
  // evaluation prose this component no longer has.
  const [scoreState, setScoreState] = useState<
    | { score: number; feedback: string; transcription?: string }
    | null
  >(() => {
    const restoredScore = parseSpeakingScore(selected);
    return restoredScore === null
      ? null
      : { score: restoredScore, feedback: `You scored ${Math.round(restoredScore)}% on this earlier.` };
  });
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
            <Ionicons name={playing ? 'volume-high' : 'play-circle'} size={28} color={colors.indigo[400]} />
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
              <ActivityIndicator size="small" color={colors.indigo[400]} />
            ) : (
              <Ionicons name="refresh" size={20} color={colors.indigo[400]} />
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

      {/* Mic/audio failure — distinct from "no answer recorded yet" */}
      {(recorderError || playerError) && (
        <View
          className="flex-row items-center justify-center mb-4 px-4"
          accessibilityRole="alert"
          accessibilityLabel={`Audio error: ${recorderError ?? playerError}`}
        >
          <Ionicons name="alert-circle" size={16} color={colors.error.base} />
          <Text className="text-error text-sm ml-1 text-center flex-shrink">
            {recorderError ?? playerError}
          </Text>
        </View>
      )}

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
          <ActivityIndicator size="large" color={colors.indigo[400]} />
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
          <View className="flex-row items-center mt-3">
            <Ionicons
              name={scoreState.score >= 60 ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={scoreState.score >= 60 ? colors.success.base : colors.error.base}
              style={{ marginRight: 6 }}
            />
            <Text className="text-text-primary text-base text-center">{scoreState.feedback}</Text>
          </View>
          {scoreState.transcription && (
            <Text className="text-text-tertiary text-xs mt-2 text-center italic">
              Heard: "{scoreState.transcription}"
            </Text>
          )}
        </View>
      )}

      {/* Differentiated feedback — phonological recast on failure */}
      {result ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={targetLanguage}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
        />
      ) : null}
    </ExerciseCard>
  );
}
