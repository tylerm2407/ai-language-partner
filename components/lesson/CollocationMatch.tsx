import { useState } from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import { haptic } from '../../lib/haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { SlabButton } from '../ui2/SlabButton';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import type { GradeResult } from '../../lib/grading';
import { isRestored, splitJoinedAnswer } from '../../lib/exercise-restore';
import type { Exercise } from '../../types';

interface CollocationMatchProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  /** Previously recorded answer, restored by the runner on Previous. Encoded
   *  as the comma-joined selection, exactly as `handleSubmit` reports it. */
  selected?: string | null;
  userId?: string;
  language?: string;
  cefrLevel?: string;
}

export function CollocationMatch({
  exercise,
  onAnswer,
  showResult,
  selected = null,
  userId,
  language,
  cefrLevel,
}: CollocationMatchProps) {
  const { c } = useUi2Theme();
  const collocations: string[] = (exercise.metadata?.collocations as string[]) ?? [];
  const distractors: string[] = exercise.distractors ?? [];
  const allOptions = [...collocations, ...distractors];
  const targetWord = exercise.targetWord ?? exercise.prompt;

  /**
   * Grade a selection. Hoisted out of the submit handler so the same code
   * rebuilds the result when Previous restores an earlier answer — this type
   * synthesizes its own GradeResult rather than going through `gradeAnswer`,
   * so there is nothing generic to re-run.
   */
  const gradeSelection = (selectedArr: string[]): GradeResult => {
    // `w`, not `c`: `c` is the palette in this scope now.
    const correctSet = new Set(collocations.map((w) => w.toLowerCase()));
    const lowered = selectedArr.map((sel) => sel.toLowerCase());
    const allCorrectSelected = collocations.every((w) => lowered.includes(w.toLowerCase()));
    const noWrongSelected = lowered.every((sel) => correctSet.has(sel));
    const isCorrect = allCorrectSelected && noWrongSelected;
    const joined = selectedArr.join(', ');

    // Lexical error type: a wrong collocation is a vocabulary miss (the
    // target word itself is known).
    return {
      isCorrect,
      accuracy: isCorrect ? 1 : 0,
      feedback: isCorrect
        ? 'Correct!'
        : `Incorrect. The correct collocations are: ${collocations.join(', ')}`,
      normalizedUserAnswer: joined,
      normalizedCorrectAnswer: collocations.join(', '),
      errorType: isCorrect ? null : 'lexical',
    };
  };

  // Seeded from the recorded pick so Previous comes back to the selection the
  // learner actually made, in its graded state.
  const [selectedWords, setSelectedWords] = useState<Set<string>>(
    () => new Set(splitJoinedAnswer(selected, ', ')),
  );
  const [submitted, setSubmitted] = useState(() => isRestored(selected));
  const [result, setResult] = useState<GradeResult | null>(() =>
    isRestored(selected) ? gradeSelection(splitJoinedAnswer(selected, ', ')) : null,
  );

  const handleToggle = (word: string) => {
    if (submitted || showResult) return;

    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (submitted || selectedWords.size === 0) return;

    const selectedArr = Array.from(selectedWords);
    const grade = gradeSelection(selectedArr);
    const isCorrect = grade.isCorrect;
    const joined = grade.normalizedUserAnswer;

    setResult(grade);
    setSubmitted(true);

    haptic(isCorrect ? 'correct' : 'incorrect');

    onAnswer(isCorrect, joined);
  };


  /** Returns a style object rather than the Tailwind classes it used to: the
   *  fills are palette tokens now, and `bg-primary/20` in particular was an
   *  opacity wash over an assumed-dark ground, whose UI 2.0 equivalent is the
   *  real `primaryTint` token in each scheme. */
  const getOptionStyle = (word: string): ViewStyle => {
    const isSelected = selectedWords.has(word);
    const isCollocation = collocations.map((w) => w.toLowerCase()).includes(word.toLowerCase());

    if (!submitted && !showResult) {
      return isSelected
        ? { backgroundColor: c.primaryTint, borderColor: c.primary }
        : { backgroundColor: c.surface2, borderColor: 'transparent' };
    }

    // After submission: highlight correct/incorrect
    if (isCollocation) {
      return { backgroundColor: c.greenTint, borderColor: c.green };
    }
    if (isSelected && !isCollocation) {
      return { backgroundColor: c.pinkTint, borderColor: c.error };
    }
    return { backgroundColor: c.surface2, borderColor: 'transparent' };
  };

  return (
    <ExerciseCard type={exercise.type} prompt={exercise.prompt}>
      <View className="mb-4 items-center">
        <Text className="text-2xl font-bold" style={{ color: c.primary }}>{targetWord}</Text>
        <Text className="text-sm mt-1" style={{ color: c.muted }}>
          Select all words that collocate with this word
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-4">
        {allOptions.map((word, index) => (
          <Pressable
            key={index}
            className="px-4 py-2.5 rounded-[14px] border-2"
            style={getOptionStyle(word)}
            onPress={() => handleToggle(word)}
            disabled={submitted || showResult}
            accessibilityRole="button"
            accessibilityLabel={`Option: ${word}`}
            accessibilityState={{
              selected: selectedWords.has(word),
              disabled: submitted || showResult,
            }}
          >
            <Text className="text-[15px] font-semibold" style={{ color: c.ink }}>
              {word}
            </Text>
          </Pressable>
        ))}
      </View>

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

      {!submitted && !showResult && (
        <View className="mt-4">
          <SlabButton
            label="Check"
            onPress={handleSubmit}
            disabled={selectedWords.size === 0}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
