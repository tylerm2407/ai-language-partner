import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '../../lib/haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { SlabButton } from '../ui2/SlabButton';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import { isRestored, regradePick } from '../../lib/exercise-restore';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { VoiceError } from '../../lib/ai';
import { getLessonAudioUri, LESSON_SLOW_RATE } from '../../lib/lesson-audio';
import type { Exercise, LanguageCode } from '../../types';

interface ListeningExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. Covers
   *  both modes — the choice path and the typed path both land in `answer`. */
  selected?: string | null;
  userId?: string;
  language?: string;
  cefrLevel?: string;
}

export function ListeningExercise({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
}: ListeningExerciseProps) {
  const { c } = useUi2Theme();
  // Seeded from the recorded pick so Previous comes back to the answer the
  // learner actually gave, in its graded state — see lib/exercise-restore.ts.
  const [answer, setAnswer] = useState(selected ?? '');
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() =>
    regradePick(exercise, selected),
  );
  const { playing, loading, error: audioError, play } = useAudioPlayer();
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);
  // The "slower" affordance is offered only once the learner has heard the
  // clip at normal speed — before that it is noise, and it is a real request
  // that costs a separate synthesis and a separate allowance unit.
  const [hasPlayed, setHasPlayed] = useState(false);
  // A quota refusal is terminal for the session, so stop offering the button
  // that would just refuse again.
  const quotaExhaustedRef = useRef(false);
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const isChoiceType = exercise.type === 'listening_choice' && exercise.options;

  // `prompt` carries the text to be spoken — the card header shows a fixed
  // "Listen and answer" label, so the field is never rendered. For
  // listening_type that is the sentence the learner transcribes; for
  // listening_choice it is the sentence they pick a translation of.
  const canSynthesize = !exercise.promptAudioUrl && !!language && !!exercise.prompt;

  const handlePlayAudio = async (rate?: number) => {
    if (exercise.promptAudioUrl && rate === undefined) {
      play(exercise.promptAudioUrl);
      setHasPlayed(true);
      return;
    }
    if (!canSynthesize) return;

    // No content pack ships pre-recorded audio, so listening exercises are
    // voiced on demand. getLessonAudioUri checks the on-device cache first, so
    // a replay costs nothing and works offline; a miss goes to the TTS function,
    // which is content-addressed server-side, so the first learner to hear a
    // given word pays for it and everyone after gets a cache hit.
    setSynthesizing(true);
    setSynthesisError(null);
    try {
      const uri = await getLessonAudioUri({
        text: exercise.prompt,
        language: language!,
        userId,
        rate,
      });
      await play(uri);
      setHasPlayed(true);
    } catch (err) {
      if (err instanceof VoiceError && err.code === 'DAILY_LIMIT') {
        quotaExhaustedRef.current = true;
        setQuotaExhausted(true);
      }
      setSynthesisError(
        err instanceof Error ? err.message : 'Could not load the audio for this exercise',
      );
    } finally {
      setSynthesizing(false);
    }
  };

  const handleSelectOption = (option: string) => {
    if (submitted || showResult) return;
    const grade = gradeAnswer(option, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
        language: language as LanguageCode | undefined,
      },
    });
    setAnswer(option);
    setSubmitted(true);
    setResult(grade);

    haptic(grade.isCorrect ? 'correct' : 'incorrect');

    onAnswer(grade.isCorrect, option);
  };

  const handleSubmitTyped = () => {
    if (!answer.trim() || submitted) return;

    const grade = gradeAnswer(answer, exercise.correctAnswer, exercise.acceptedAnswers, {
      exerciseHints: {
        exerciseType: exercise.type,
        skillType: exercise.skillType,
        targetGrammar: exercise.targetGrammar,
        targetWord: exercise.targetWord,
        language: language as LanguageCode | undefined,
      },
    });
    setResult(grade);
    setSubmitted(true);

    haptic(grade.isCorrect ? 'correct' : 'incorrect');

    onAnswer(grade.isCorrect, answer);
  };


  /** A style object rather than the Tailwind classes it used to return: the
   *  fills are palette tokens now, so they follow the phone's scheme. */
  const getOptionStyle = (option: string): ViewStyle => {
    if (!submitted && !showResult) {
      return { backgroundColor: c.surface2, borderColor: 'transparent' };
    }
    const isCorrectOption =
      option.toLowerCase() === exercise.correctAnswer.toLowerCase() ||
      exercise.acceptedAnswers.map((a) => a.toLowerCase()).includes(option.toLowerCase());

    if ((submitted || showResult) && isCorrectOption) {
      return { backgroundColor: c.greenTint, borderColor: c.green };
    }
    if (option === answer && !isCorrectOption) {
      return { backgroundColor: c.pinkTint, borderColor: c.error };
    }
    return { backgroundColor: c.surface2, borderColor: 'transparent' };
  };

  return (
    <ExerciseCard type={exercise.type} prompt="Listen and answer">
      {/* Audio play button */}
      <Pressable
        className="w-20 h-20 rounded-full items-center justify-center self-center mb-6"
        style={{ backgroundColor: c.primary }}
        onPress={() => handlePlayAudio()}
        disabled={playing || loading || synthesizing || (!exercise.promptAudioUrl && !canSynthesize)}
        accessibilityRole="button"
        accessibilityLabel={
          synthesizing ? 'Loading audio' : playing ? 'Audio playing' : 'Play audio'
        }
      >
        <Ionicons
          name={synthesizing ? 'hourglass' : playing ? 'volume-high' : 'play'}
          size={36}
          color={c.onPrimary}
        />
      </Pressable>

      {/* Play it again, slower. Offered only after a normal-speed play, and
          withdrawn once the lesson-audio allowance is spent — a button that
          can only refuse is worse than no button. */}
      {hasPlayed && canSynthesize && !quotaExhausted && (
        <Pressable
          className="flex-row items-center self-center mb-6 px-4 rounded-[12px]"
          style={{ minHeight: 44, backgroundColor: c.surface2 }}
          onPress={() => handlePlayAudio(LESSON_SLOW_RATE)}
          disabled={playing || loading || synthesizing}
          accessibilityRole="button"
          accessibilityLabel="Play the audio again, slower"
        >
          <Ionicons name="play-outline" size={18} color={c.primary} />
          <Text className="text-sm ml-2" style={{ color: c.muted }}>Slower</Text>
        </Pressable>
      )}

      {!exercise.promptAudioUrl && !canSynthesize && (
        <Text className="text-sm text-center mb-4" style={{ color: c.idle }}>
          No audio available for this exercise
        </Text>
      )}

      {/* Synthesis failure — the audio could not be produced at all, which is
          distinct from a clip that exists but failed to play. */}
      {synthesisError && (
        <View
          className="flex-row items-center justify-center mb-4"
          accessibilityRole="alert"
          accessibilityLabel={`Audio unavailable. ${synthesisError}. Tap play to retry.`}
        >
          <Ionicons name="alert-circle" size={16} color={c.error} />
          <Text className="text-sm ml-1 flex-1" style={{ color: c.error }}>
            Couldn&apos;t load the audio — tap play to retry
          </Text>
        </View>
      )}

      {/* Playback failure — distinct from "no audio available" */}
      {audioError && (
        <View
          className="flex-row items-center justify-center mb-4"
          accessibilityRole="alert"
          accessibilityLabel="Audio failed to play. Tap play to retry."
        >
          <Ionicons name="alert-circle" size={16} color={c.error} />
          <Text className="text-sm ml-1" style={{ color: c.error }}>
            Audio failed to play — tap play to retry
          </Text>
        </View>
      )}

      {/* Choice or typed answer */}
      {isChoiceType ? (
        <View>
          {exercise.options!.map((option, index) => (
            <Pressable
              key={index}
              className="p-4 rounded-[14px] mb-2.5 flex-row items-center border-2"
              style={getOptionStyle(option)}
              onPress={() => handleSelectOption(option)}
              disabled={submitted || showResult}
              accessibilityRole="button"
              accessibilityLabel={`Option ${index + 1}: ${option}`}
            >
              {(submitted || showResult) && (() => {
                const isCorrectOption =
                  option.toLowerCase() === exercise.correctAnswer.toLowerCase() ||
                  exercise.acceptedAnswers.map((a) => a.toLowerCase()).includes(option.toLowerCase());
                const isSelected = option === answer;
                if (isCorrectOption) {
                  return <Ionicons name="checkmark-circle" size={20} color={c.green} style={{ marginRight: 8 }} />;
                }
                if (isSelected && !isCorrectOption) {
                  return <Ionicons name="close-circle" size={20} color={c.error} style={{ marginRight: 8 }} />;
                }
                return null;
              })()}
              <Text className="text-[17px] font-semibold flex-1" style={{ color: c.ink }}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <TextInput
            className="border-2 rounded-[14px] px-4 py-2.5 text-base"
            style={{
              borderColor: submitted ? (result?.isCorrect ? c.green : c.error) : c.cardBorder,
              color: c.ink,
            }}
            placeholder="Type what you heard..."
            placeholderTextColor={c.idle}
            value={answer}
            onChangeText={setAnswer}
            editable={!submitted && !showResult}
            autoCapitalize="none"
            accessibilityLabel="Listening answer input"
          />
          {submitted && result && (
            <View className="flex-row items-center mt-2">
              <Ionicons
                name={result.isCorrect ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={result.isCorrect ? c.green : c.error}
              />
              <Text className="ml-1 text-sm font-semibold" style={{ color: c.ink }}>
                {result.isCorrect ? 'Correct' : 'Incorrect'}
              </Text>
            </View>
          )}
          {!submitted && !showResult && (
            <View className="mt-4">
              <SlabButton
                label="Check"
                onPress={handleSubmitTyped}
                disabled={!answer.trim()}
              />
            </View>
          )}
        </>
      )}

      {result && language ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          revealAnswer={showResult}
        />
      ) : null}
    </ExerciseCard>
  );
}
