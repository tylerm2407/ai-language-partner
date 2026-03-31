import { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { scorePronunciation } from '../../lib/ai';
import type { Exercise, LanguageCode } from '../../types';

interface SpeakingExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId: string;
  targetLanguage: LanguageCode;
}

export function SpeakingExercise({ exercise, onAnswer, showResult, userId, targetLanguage }: SpeakingExerciseProps) {
  const { recording, audioUri, startRecording, stopRecording, getBase64 } = useAudioRecorder();
  const { playing, play } = useAudioPlayer();
  const [scoring, setScoring] = useState(false);
  const [score, setScore] = useState<{ score: number; feedback: string } | null>(null);

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
        setScore({ score: 0, feedback: 'Could not process audio.' });
        return;
      }

      const result = await scorePronunciation({
        userId,
        audioBase64: base64,
        expectedText: exercise.correctAnswer,
        language: targetLanguage,
      });

      setScore({ score: result.score, feedback: result.feedback });

      const isCorrect = result.score >= 60;
      if (Platform.OS !== 'web') {
        if (isCorrect) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }

      onAnswer(isCorrect, `score:${result.score}`);
    } catch {
      setScore({ score: 0, feedback: 'Scoring failed. Please try again.' });
    } finally {
      setScoring(false);
    }
  };

  const getScoreColor = () => {
    if (!score) return {};
    if (score.score >= 80) return { bg: 'bg-success-bg', text: 'text-success' };
    if (score.score >= 60) return { bg: 'bg-warning-bg', text: 'text-warning' };
    return { bg: 'bg-error-bg', text: 'text-error' };
  };

  return (
    <ExerciseCard type={exercise.type} prompt={exercise.prompt}>
      {/* Prompt audio playback */}
      {exercise.promptAudioUrl && (
        <Pressable
          className="bg-dark-card-alt rounded-[14px] p-4 flex-row items-center mb-4"
          onPress={() => play(exercise.promptAudioUrl!)}
          accessibilityRole="button"
          accessibilityLabel="Play prompt audio"
        >
          <Ionicons name={playing ? 'volume-high' : 'play-circle'} size={28} color="#38BDF8" />
          <Text className="text-text-primary text-base ml-3">Listen to the prompt</Text>
        </Pressable>
      )}

      {/* Record button */}
      <Pressable
        className={`w-20 h-20 rounded-full items-center justify-center self-center mb-4 ${recording ? 'bg-error' : 'bg-primary'}`}
        onPress={handleToggleRecord}
        disabled={scoring || score !== null}
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
        {recording ? 'Recording... Tap to stop' : score ? '' : 'Tap to record your answer'}
      </Text>

      {/* Score button */}
      {audioUri && !score && !scoring && (
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
      {score && (
        <View className="items-center">
          <View className={`w-[100px] h-[100px] rounded-full items-center justify-center ${getScoreColor().bg}`}>
            <Text className={`text-[32px] font-bold ${getScoreColor().text}`}>
              {score.score}%
            </Text>
          </View>
          <Text className="text-text-primary text-base mt-3 text-center">{score.feedback}</Text>
        </View>
      )}
    </ExerciseCard>
  );
}
