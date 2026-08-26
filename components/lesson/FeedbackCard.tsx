import { useEffect, useRef } from 'react';
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
  /**
   * May the correct answer be shown yet?
   *
   * The runner owns this: it is false while a second attempt is open, and it
   * gates EVERY branch below, not just the grammar one. The correct answer
   * leaks from four places in this file — the grammar reveal, the phonological
   * recast (where for a speaking exercise the audio IS the answer), the
   * spelling correction, and the generic fallback string — and a second chance
   * where one of the four quietly tells you the answer is not a second chance.
   */
  revealAnswer: boolean;
}

/**
 * Error-type-differentiated feedback card (Lyster & Ranta — research.md §10).
 *
 *  correct       -> green success card.
 *  grammar/lexical -> metalinguistic cue + RuleCard.
 *  phonological  -> recast: auto-play the correct audio, invite repeat.
 *  spelling      -> inline strike-through + green corrected form.
 *  null/unknown  -> fall back to the generic "Incorrect. The correct answer
 *                   is: ..." pattern the codebase uses today.
 *
 * Every one of those branches is gated on `revealAnswer`, so while a second
 * attempt is open the card says what KIND of mistake it was without saying
 * what the answer is.
 *
 * This card no longer advances the lesson and no longer renders a Continue
 * button: ExerciseChrome's pinned footer owns forward navigation, and two
 * forward affordances on one screen is one too many. It also no longer owns a
 * "Try again" button — the runner gives every exercise a second attempt now,
 * so the old card-local retry (which only ever fired for grammar and lexical
 * errors, and which could not actually unlock the input on ten of the fourteen
 * exercise types) would have been a second, competing retry mechanism. What is
 * left here is the part the footer cannot carry — the metalinguistic cue, the
 * grammar RuleCard, the audio recast, and the correction_log write.
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
  revealAnswer,
}: FeedbackCardProps) {
  const { play } = useAudioPlayer();
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
    // For a speaking exercise the recast IS the answer, spoken aloud. Playing
    // it before the second attempt is spent would hand the answer over.
    if (!revealAnswer) return;
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
  }, [result, exercise, language, play, revealAnswer]);

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

      </View>
    );
  }

  // ─── Phonological: recast via audio ────────────────────────────
  if (errorType === 'phonological') {
    // Before the reveal: name the problem, play nothing, show nothing. The
    // learner still gets a second attempt at hearing it themselves.
    if (!revealAnswer) {
      return (
        <View className="mt-3 p-4 rounded-[14px] bg-error-bg border border-error/30">
          <Text className="text-error text-sm font-sans-semibold mb-1">Not quite</Text>
          <Text className="text-text-primary text-[15px]">
            Try saying it once more.
          </Text>
        </View>
      );
    }
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
    // Before the reveal: show what they wrote struck through, so they can see
    // it is a typo, without handing over the spelling that fixes it.
    if (!revealAnswer) {
      return (
        <View className="mt-3 p-4 rounded-[14px] bg-dark-card-alt border border-white/10">
          <Text className="text-text-secondary text-sm font-sans-medium mb-2">
            Close — check your spelling
          </Text>
          <Text className="text-error text-base line-through">{userText}</Text>
        </View>
      );
    }
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
  // The generic fallback string embeds the correct answer, so before the
  // reveal it is dropped entirely rather than shown — result.feedback from the
  // grader can itself contain the expected answer.
  return (
    <View className="mt-3 p-3 rounded-[14px] bg-error-bg">
      <Text className="text-error text-sm font-sans-medium mb-2">
        {revealAnswer
          ? result.feedback || `Incorrect. The correct answer is: ${exercise.correctAnswer}`
          : 'Not quite — give it one more try.'}
      </Text>
    </View>
  );
}
