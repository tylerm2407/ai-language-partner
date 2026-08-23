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
 *
 * This card no longer advances the lesson and no longer renders a Continue
 * button: ExerciseChrome's pinned footer owns forward navigation, and two
 * forward affordances on one screen is one too many. What is left here is the
 * part the footer cannot carry — the metalinguistic cue, the grammar RuleCard,
 * the elicitation retry, the audio recast, and the correction_log write.
 *
 * The correct branch renders nothing at all, because the footer note already
 * says CORRECT and shows the same `exercise.explanation`.
 */
export function FeedbackCard({
  result,
  exercise,
  language,
  cefrLevel,
  userId,
  onRetry,
}: FeedbackCardProps) {
  const { play } = useAudioPlayer();
  const [retryCount, setRetryCount] = useState(0);
  const logged = useRef(false);
  const audioPlayed = useRef(false);

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

  // The spelling branch used to auto-advance after a 1.5s dwell. It no longer
  // does: advancing is the footer's Next button, and auto-advancing would pull
  // the note out from under a learner mid-sentence.

  // ─── Correct branch ────────────────────────────────────────────
  // Nothing to add: the footer note already reads "CORRECT — <explanation>",
  // and repeating it here put two success panels on one screen.
  if (result.isCorrect) return null;

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

        {/* Try again is elicitation, not navigation — it re-opens the input
            rather than moving on, so it survives the footer taking over
            forward movement. */}
        {onRetry && !revealAnswer ? (
          <View className="flex-row mt-3">
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
          </View>
        ) : null}
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
        <View className="flex-row">
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
      </View>
    );
  }

  // ─── null / unknown: legacy generic ──────────────────────────
  return (
    <View className="mt-3 p-3 rounded-[14px] bg-error-bg">
      <Text className="text-error text-sm font-sans-medium mb-2">
        {result.feedback || `Incorrect. The correct answer is: ${exercise.correctAnswer}`}
      </Text>
    </View>
  );
}
