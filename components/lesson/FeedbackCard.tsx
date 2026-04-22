import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Speech from 'expo-speech';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { RuleCard } from './RuleCard';
import { logExerciseCorrection } from '../../lib/supabase-queries';
import type { Exercise, FeedbackErrorType } from '../../types';
import type { GradeResult } from '../../lib/grading';

interface FeedbackCardProps {
  result: GradeResult;
  exercise: Exercise;
  language: string;
  cefrLevel?: string;
  userId?: string;
  /** Optional — only shown for incorrect grammar/lexical errors. */
  onRetry?: () => void;
  /** Always shown on the correct branch + on final reveal of incorrect. */
  onContinue: () => void;
}

/**
 * Error-type-differentiated feedback card (Lyster & Ranta — research.md §10).
 *
 *  correct       -> green success card.
 *  grammar/lexical -> metalinguistic cue + RuleCard + Try Again (elicitation).
 *                     Correct answer hidden until a second failure.
 *  phonological  -> recast: auto-play the correct audio, invite repeat.
 *  spelling      -> inline strike-through + green corrected form; auto-advance.
 *  null/unknown  -> fall back to the generic "Incorrect. The correct answer
 *                   is: ..." pattern the codebase uses today.
 */
export function FeedbackCard({
  result,
  exercise,
  language,
  cefrLevel,
  userId,
  onRetry,
  onContinue,
}: FeedbackCardProps) {
  const { play } = useAudioPlayer();
  const [retryCount, setRetryCount] = useState(0);
  const logged = useRef(false);
  const audioPlayed = useRef(false);
  const autoAdvanceScheduled = useRef(false);

  // Fire-and-forget log to correction_log on first render for incorrect
  // answers with a classified errorType. Swallow errors so a logging hiccup
  // never breaks the lesson.
  useEffect(() => {
    if (logged.current) return;
    if (result.isCorrect) return;
    if (!userId) return;
    const errorType: FeedbackErrorType | null | undefined = result.errorType;
    if (!errorType) return;
    logged.current = true;

    void logExerciseCorrection({
      userId,
      exerciseId: exercise.id,
      errorType,
      original: result.normalizedUserAnswer || '',
      corrected: exercise.correctAnswer,
      shortLabel:
        exercise.targetGrammar ||
        exercise.targetWord ||
        exercise.subskill ||
        errorType,
      explanation: exercise.explanation ?? null,
      severity: 'minor',
      targetLanguage: language,
    }).catch((err) => {
      console.warn('[FeedbackCard] logExerciseCorrection failed:', err);
    });
  }, [result, exercise, userId, language]);

  // Phonological recast: auto-play the correct audio on first render.
  useEffect(() => {
    if (audioPlayed.current) return;
    if (result.isCorrect) return;
    if (result.errorType !== 'phonological') return;
    audioPlayed.current = true;

    if (exercise.promptAudioUrl) {
      play(exercise.promptAudioUrl).catch(() => {});
    } else if (exercise.correctAnswer) {
      try {
        Speech.speak(exercise.correctAnswer, { language });
      } catch {
        // noop
      }
    }
  }, [result, exercise, language, play]);

  // Spelling: auto-advance after a short dwell so the learner sees the
  // strike-through -> green transition.
  useEffect(() => {
    if (autoAdvanceScheduled.current) return;
    if (result.isCorrect) return;
    if (result.errorType !== 'spelling') return;
    autoAdvanceScheduled.current = true;
    const t = setTimeout(() => {
      onContinue();
    }, 1500);
    return () => clearTimeout(t);
    // Intentionally depend on errorType only; onContinue identity may change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.errorType, result.isCorrect]);

  // ─── Correct branch ────────────────────────────────────────────
  if (result.isCorrect) {
    return (
      <View className="mt-3 p-4 rounded-[14px] bg-success-bg">
        <Text className="text-success text-base font-sans-semibold mb-1">
          Correct!
        </Text>
        {exercise.explanation ? (
          <Text className="text-text-primary text-sm mb-3">
            {exercise.explanation}
          </Text>
        ) : null}
        <Pressable
          onPress={onContinue}
          className="bg-primary py-3 rounded-[12px] items-center mt-2"
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text className="text-white text-base font-sans-semibold">Continue</Text>
        </Pressable>
      </View>
    );
  }

  const errorType = result.errorType ?? null;

  // ─── Grammar / Lexical: metalinguistic cue + RuleCard + retry ──
  if (errorType === 'grammar' || errorType === 'lexical') {
    const cue =
      errorType === 'grammar'
        ? 'Check the grammar — think about the form.'
        : 'Check the word choice — something else fits better.';
    const revealAnswer = retryCount >= 1; // show correct after first retry

    return (
      <View className="mt-3 p-4 rounded-[14px] bg-warning-bg border border-warning/30">
        <Text className="text-warning text-sm font-sans-semibold mb-1">
          Not quite
        </Text>
        <Text className="text-text-primary text-[15px] mb-2">{cue}</Text>

        {revealAnswer ? (
          <View className="mt-1 mb-2">
            <Text className="text-text-secondary text-xs">Correct answer</Text>
            <Text className="text-success text-base font-sans-semibold">
              {exercise.correctAnswer}
            </Text>
          </View>
        ) : null}

        {errorType === 'grammar' || exercise.targetGrammar ? (
          <RuleCard
            ruleName={exercise.targetGrammar ?? null}
            targetGrammar={exercise.targetGrammar ?? null}
            language={language}
            cefrLevel={cefrLevel}
          />
        ) : null}

        <View className="flex-row gap-2 mt-3">
          {onRetry && !revealAnswer ? (
            <Pressable
              onPress={() => {
                setRetryCount((c) => c + 1);
                onRetry();
              }}
              className="flex-1 bg-primary py-3 rounded-[12px] items-center"
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text className="text-white text-base font-sans-semibold">
                Try again
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onContinue}
            className={`${
              onRetry && !revealAnswer ? 'flex-1' : 'flex-1'
            } bg-dark-card-alt py-3 rounded-[12px] items-center border border-white/10`}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text className="text-text-primary text-base font-sans-semibold">
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Phonological: recast via audio ────────────────────────────
  if (errorType === 'phonological') {
    return (
      <View className="mt-3 p-4 rounded-[14px] bg-error-bg border border-error/30">
        <Text className="text-error text-sm font-sans-semibold mb-1">
          Listen to the correct pronunciation.
        </Text>
        <Text className="text-text-primary text-[15px] mb-3">
          {exercise.correctAnswer}
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => {
              if (exercise.promptAudioUrl) {
                play(exercise.promptAudioUrl).catch(() => {});
              } else {
                try {
                  Speech.speak(exercise.correctAnswer, { language });
                } catch {
                  /* noop */
                }
              }
            }}
            className="flex-1 bg-primary py-3 rounded-[12px] items-center"
            accessibilityRole="button"
            accessibilityLabel="Repeat audio"
          >
            <Text className="text-white text-base font-sans-semibold">Repeat</Text>
          </Pressable>
          <Pressable
            onPress={onContinue}
            className="flex-1 bg-dark-card-alt py-3 rounded-[12px] items-center border border-white/10"
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text className="text-text-primary text-base font-sans-semibold">
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Spelling: inline strike-through + green correction ────────
  if (errorType === 'spelling') {
    const userText = result.normalizedUserAnswer || '';
    return (
      <View className="mt-3 p-4 rounded-[14px] bg-dark-card-alt border border-white/10">
        <Text className="text-text-secondary text-sm font-sans-medium mb-2">
          Small typo
        </Text>
        <View className="flex-row items-center flex-wrap">
          <Text className="text-error text-base line-through mr-2">
            {userText}
          </Text>
          <Text className="text-success text-base font-sans-semibold">
            {exercise.correctAnswer}
          </Text>
        </View>
        <Pressable
          onPress={onContinue}
          className="bg-primary py-3 rounded-[12px] items-center mt-3"
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text className="text-white text-base font-sans-semibold">
            Continue
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── null / unknown: legacy generic ──────────────────────────
  return (
    <View className="mt-3 p-3 rounded-[14px] bg-error-bg">
      <Text className="text-error text-sm font-sans-medium mb-2">
        {result.feedback || `Incorrect. The correct answer is: ${exercise.correctAnswer}`}
      </Text>
      <Pressable
        onPress={onContinue}
        className="bg-primary py-3 rounded-[12px] items-center mt-2"
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text className="text-white text-base font-sans-semibold">Continue</Text>
      </Pressable>
    </View>
  );
}
