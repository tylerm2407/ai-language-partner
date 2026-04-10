import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../hooks/useAuth';
import { useAppStore } from '../../../../stores/useAppStore';
import { GradientBackground } from '../../../../components/ui/GradientBackground';
import {
  fetchWritingPromptById,
  submitWriting,
  updateWritingFeedback,
  fetchWritingSubmissionsByPrompt,
  addXp,
} from '../../../../lib/supabase-queries';
import { WritingExercise } from '../../../../components/writing/WritingExercise';
import { WritingFeedbackView } from '../../../../components/writing/WritingFeedbackView';
import { supabase } from '../../../../lib/supabase';
import type { WritingPrompt, WritingFeedback, WritingSubmission } from '../../../../types';

export default function WritingPromptScreen() {
  const { promptId } = useLocalSearchParams<{ promptId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useAppStore();
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [pastSubmissions, setPastSubmissions] = useState<WritingSubmission[]>([]);

  useEffect(() => {
    if (!promptId || !user) return;

    const load = async () => {
      try {
        const [promptData, submissions] = await Promise.all([
          fetchWritingPromptById(promptId),
          fetchWritingSubmissionsByPrompt(user.id, promptId),
        ]);
        setPrompt(promptData);
        setPastSubmissions(submissions);

        // Set attempt number based on past submissions
        if (submissions.length > 0) {
          const maxAttempt = Math.max(...submissions.map((s) => s.attemptNumber));
          setAttemptNumber(maxAttempt + 1);
          // Get the most recent score for delta calculation
          const latestWithScore = [...submissions].reverse().find((s) => s.overallScore != null);
          if (latestWithScore) {
            setPreviousScore(latestWithScore.overallScore);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [promptId, user]);

  const handleSubmit = async (text: string, wordCount: number, timeSpentMs: number) => {
    if (!user || !prompt) return;

    try {
      setIsGrading(true);

      // Save submission with attempt number
      const submission = await submitWriting(user.id, prompt.id, text, wordCount, timeSpentMs, attemptNumber);

      // Call grade-writing edge function
      const { data, error: fnError } = await supabase.functions.invoke('grade-writing', {
        body: {
          submissionId: submission.id,
          submissionText: text,
          promptId: prompt.id,
          targetLanguage: profile?.targetLanguage ?? 'es',
          cefrLevel: prompt.cefrLevel,
          userId: user.id,
        },
      });

      if (fnError) throw fnError;

      const gradeFeedback = data as WritingFeedback;
      setFeedback(gradeFeedback);

      // Save feedback — average all 5 dimensions
      const scores = [
        gradeFeedback.grammarScore,
        gradeFeedback.spellingScore ?? 0,
        gradeFeedback.sentenceStructureScore ?? 0,
        gradeFeedback.vocabularyScore,
        gradeFeedback.coherenceScore,
      ];
      const validScores = scores.filter((s) => s > 0);
      const overallScore = validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length / 100
        : 0;
      await updateWritingFeedback(submission.id, gradeFeedback, overallScore);

      // Award XP based on CEFR level
      const xpMap: Record<string, number> = { A1: 5, A2: 10, B1: 15, B2: 20, C1: 25, C2: 30 };
      const baseXp = xpMap[prompt.cefrLevel] ?? 10;
      const bonusXp = Math.round(overallScore * 15);
      await addXp(user.id, baseXp + bonusXp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grade writing');
    } finally {
      setIsGrading(false);
    }
  };

  const handleTryAgain = () => {
    // Store previous score for delta display
    if (feedback) {
      const scores = [
        feedback.grammarScore,
        feedback.spellingScore ?? 0,
        feedback.sentenceStructureScore ?? 0,
        feedback.vocabularyScore,
        feedback.coherenceScore,
      ];
      const validScores = scores.filter((s) => s > 0);
      const prevScore = validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length / 100
        : 0;
      setPreviousScore(prevScore);
    }
    setAttemptNumber((prev) => prev + 1);
    setFeedback(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#6366F1" />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (error && !feedback) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: '#EF4444', textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }} accessibilityRole="button">
            <Text style={{ fontSize: 16, color: '#6366F1' }}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (feedback && prompt) {
    return (
      <WritingFeedbackView
        feedback={feedback}
        previousScore={previousScore}
        attemptNumber={attemptNumber}
        maxAttempts={prompt.maxAttempts}
        onTryAgain={handleTryAgain}
        onContinue={() => router.back()}
      />
    );
  }

  if (!prompt) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#9CA3AF' }}>Writing prompt not found.</Text>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <WritingExercise
      prompt={prompt}
      isGrading={isGrading}
      attemptNumber={attemptNumber}
      onSubmit={handleSubmit}
      onExit={() => router.back()}
    />
  );
}
