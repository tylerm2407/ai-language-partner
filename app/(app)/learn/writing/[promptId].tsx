import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../hooks/useAuth';
import { fetchWritingPromptById, submitWriting, updateWritingFeedback } from '../../../../lib/supabase-queries';
import { WritingExercise } from '../../../../components/writing/WritingExercise';
import { WritingFeedbackView } from '../../../../components/writing/WritingFeedbackView';
import { supabase } from '../../../../lib/supabase';
import type { WritingPrompt, WritingFeedback } from '../../../../types';

export default function WritingPromptScreen() {
  const { promptId } = useLocalSearchParams<{ promptId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!promptId) return;
    fetchWritingPromptById(promptId).then((data) => {
      setPrompt(data);
      setIsLoading(false);
    }).catch((e) => {
      setError(e.message);
      setIsLoading(false);
    });
  }, [promptId]);

  const handleSubmit = async (text: string, wordCount: number, timeSpentMs: number) => {
    if (!user || !prompt) return;

    try {
      setIsGrading(true);

      // Save submission
      const submission = await submitWriting(user.id, prompt.id, text, wordCount, timeSpentMs);

      // Call grade-writing edge function
      const { data, error: fnError } = await supabase.functions.invoke('grade-writing', {
        body: {
          submissionId: submission.id,
          submissionText: text,
          promptId: prompt.id,
          targetLanguage: 'es', // TODO: get from course
          cefrLevel: prompt.cefrLevel,
          userId: user.id,
        },
      });

      if (fnError) throw fnError;

      const gradeFeedback = data as WritingFeedback;
      setFeedback(gradeFeedback);

      // Save feedback — average all 5 dimensions (backward-compatible: default missing to 0)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grade writing');
    } finally {
      setIsGrading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  if (error && !feedback) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: '#EF4444', textAlign: 'center' }}>{error}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, color: '#6366F1' }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (feedback) {
    return (
      <WritingFeedbackView
        feedback={feedback}
        onTryAgain={() => { setFeedback(null); setError(null); }}
        onContinue={() => router.back()}
      />
    );
  }

  if (!prompt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: '#999' }}>Writing prompt not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <WritingExercise
      prompt={prompt}
      isGrading={isGrading}
      onSubmit={handleSubmit}
      onExit={() => router.back()}
    />
  );
}
