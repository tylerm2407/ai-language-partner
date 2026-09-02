import { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '../../../../hooks/useSafeBack';
import { useAuth } from '../../../../hooks/useAuth';
import { useAppStore, effectiveTier } from '../../../../stores/useAppStore';
import { GradientBackground } from '../../../../components/ui/GradientBackground';
import {
  fetchWritingPromptById,
  submitWriting,
  updateWritingFeedback,
  fetchWritingSubmissionsByPrompt,
  incrementXpIdempotent,
} from '../../../../lib/supabase-queries';
import { WritingExercise } from '../../../../components/writing/WritingExercise';
import { WritingFeedbackView } from '../../../../components/writing/WritingFeedbackView';
import { supabase } from '../../../../lib/supabase';
import { getTargetLanguage } from '../../../../lib/language';
import { writingXpKey } from '../../../../lib/offline-queue';
import { limitCopy } from '../../../../lib/limit-messaging';
import type { WritingPrompt, WritingFeedback, WritingSubmission } from '../../../../types';
import { colors } from '../../../../config/theme';

export default function WritingPromptScreen() {
  const { promptId } = useLocalSearchParams<{ promptId: string }>();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const { profile, subscription, entitledTier } = useAppStore();
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  /** Closes the same-React-batch double-tap window that `isGrading` cannot. */
  const submittingRef = useRef(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [, setPastSubmissions] = useState<WritingSubmission[]>([]);

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
    // A ref, not the `isGrading` state: two taps dispatched in the same React
    // batch both read the pre-update value, and this handler had no guard at
    // all. Two taps meant two submissions, two paid Claude grading calls, and
    // two XP awards. Same pattern as `claimInFlight` in useDailyChallenges.
    if (submittingRef.current) return;

    // Grading must use the user's real target language — if the profile
    // hasn't loaded yet, don't grade in a defaulted language.
    const targetLanguage = getTargetLanguage(profile);
    if (!user || !prompt || !targetLanguage) return;

    submittingRef.current = true;
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
          targetLanguage,
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
      // Keyed on the submission: a retried grade of the same piece of work must
      // not pay twice. `addXp` went through the non-idempotent `increment_xp`.
      await incrementXpIdempotent(baseXp + bonusXp, writingXpKey(submission.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to grade writing';
      // Surface plan limits clearly instead of a raw "429: …[CODE]" string.
      if (msg.includes('DAILY_WRITING_LIMIT_REACHED')) {
        // The free tier's writing-grade quota is 0, so the server refuses with
        // the same code it uses for a subscriber who has spent today's
        // allowance. They are not the same situation and must not read the
        // same: telling someone they have "used all" of an allowance they were
        // never given is simply untrue. The writing itself is already saved
        // either way — free writing practice works, only the AI grade doesn't.
        const tier = effectiveTier(subscription, entitledTier);
        setError(
          tier === 'starter'
            ? 'Your writing is saved. AI grading is part of a paid plan — see Profile → Subscription.'
            // Paid tiers: limitCopy decides upsell vs reset time, so a vip
            // subscriber is told when their grades come back rather than
            // being sold the plan they are already on.
            : limitCopy('writing feedback', tier).message,
        );
      } else if (msg.includes('RATE_LIMITED')) {
        setError("You're submitting too quickly. Please wait a moment and try again.");
      } else {
        setError('We couldn’t grade your writing. Please try again — your submission was saved.');
      }
    } finally {
      submittingRef.current = false;
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
      <GradientBackground variant="raised">
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.action.accent} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (error && !feedback) {
    return (
      <GradientBackground variant="raised">
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: colors.error.base, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={() => goBack()} style={{ marginTop: 16 }} accessibilityRole="button">
            <Text style={{ fontSize: 16, color: colors.action.accent }}>Go Back</Text>
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
        onContinue={() => goBack()}
      />
    );
  }

  if (!prompt) {
    return (
      <GradientBackground variant="raised">
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.text.tertiary }}>Writing prompt not found.</Text>
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
      onExit={() => goBack()}
    />
  );
}
