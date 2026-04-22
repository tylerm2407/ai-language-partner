import { useState } from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ExerciseCard } from './ExerciseCard';
import { FeedbackCard } from './FeedbackCard';
import { Button } from '../ui/Button';
import { gradeAnswer } from '../../lib/grading';
import type { GradeResult } from '../../lib/grading';
import type { Exercise } from '../../types';

interface DialogueLine {
  speaker: string;
  text: string;
}

interface MiniDialogueExerciseProps {
  exercise: Exercise;
  onAnswer: (correct: boolean, answer: string) => void;
  showResult: boolean;
  userId?: string;
  language?: string;
  cefrLevel?: string;
  onContinue?: () => void;
}

export function MiniDialogueExercise({
  exercise,
  onAnswer,
  showResult,
  userId,
  language,
  cefrLevel,
  onContinue,
}: MiniDialogueExerciseProps) {
  const dialogue = (exercise.metadata?.dialogue as DialogueLine[]) ?? [];
  const blankIndices = (exercise.metadata?.blankIndices as number[]) ?? [];

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  // correctAnswer may contain pipe-separated answers for multiple blanks
  const correctAnswers = exercise.correctAnswer.split('|').map((a) => a.trim());
  const acceptedPerBlank: string[][] = blankIndices.map((_, i) => {
    if (blankIndices.length === 1) {
      return exercise.acceptedAnswers;
    }
    return exercise.acceptedAnswers
      .map((a) => {
        const parts = a.split('|');
        return parts[i]?.trim();
      })
      .filter((a): a is string => !!a);
  });

  const handleChangeAnswer = (blankIdx: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [blankIdx]: text }));
  };

  const allFilled = blankIndices.every((idx) => (answers[idx] ?? '').trim().length > 0);

  const handleSubmit = () => {
    if (!allFilled || submitted) return;

    // Grade each blank individually; aggregate into a single GradeResult
    // for the FeedbackCard. The aggregate errorType is the first non-null
    // child type — this keeps the UX coherent on a single failure card.
    let allCorrect = true;
    let firstChildErrorType: GradeResult['errorType'] = null;
    const originals: string[] = [];
    const corrects: string[] = [];

    blankIndices.forEach((blankIdx, i) => {
      const userAnswer = answers[blankIdx] ?? '';
      const correct = correctAnswers[i] ?? '';
      const accepted = acceptedPerBlank[i] ?? [];
      originals.push(userAnswer);
      corrects.push(correct);

      const grade = gradeAnswer(userAnswer, correct, accepted, {
        exerciseHints: {
          exerciseType: exercise.type,
          skillType: exercise.skillType,
          targetGrammar: exercise.targetGrammar,
          targetWord: exercise.targetWord,
        },
      });
      if (!grade.isCorrect) {
        allCorrect = false;
        if (!firstChildErrorType && grade.errorType) {
          firstChildErrorType = grade.errorType;
        }
      }
    });

    const aggregate: GradeResult = {
      isCorrect: allCorrect,
      accuracy: allCorrect ? 1 : 0,
      feedback: allCorrect
        ? 'Correct!'
        : `Incorrect. The correct answer is: ${exercise.correctAnswer}`,
      normalizedUserAnswer: originals.join(' | '),
      normalizedCorrectAnswer: corrects.join(' | '),
      errorType: allCorrect ? null : firstChildErrorType,
    };
    setResult(aggregate);
    setSubmitted(true);

    if (Platform.OS !== 'web') {
      if (allCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }

    const combinedAnswer = blankIndices.map((idx) => answers[idx] ?? '').join(' | ');
    onAnswer(allCorrect, combinedAnswer);
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  };

  const getBorderClass = (blankIndex: number) => {
    if (!submitted) return 'border-input-border';

    const i = blankIndices.indexOf(blankIndex);
    const userAnswer = answers[blankIndex] ?? '';
    const correct = correctAnswers[i] ?? '';
    const accepted = acceptedPerBlank[i] ?? [];
    const grade = gradeAnswer(userAnswer, correct, accepted);

    return grade.isCorrect ? 'border-success' : 'border-error';
  };

  return (
    <ExerciseCard type={exercise.type} prompt={exercise.prompt}>
      <View className="mb-4">
        {dialogue.map((line, index) => {
          const isBlank = blankIndices.includes(index);
          const isEven = index % 2 === 0;

          return (
            <View
              key={index}
              className={`mb-2.5 flex-row ${isEven ? 'justify-start' : 'justify-end'}`}
            >
              <View
                className={`max-w-[80%] p-3 rounded-[14px] ${
                  isEven ? 'bg-dark-card-alt rounded-tl-sm' : 'bg-primary/15 rounded-tr-sm'
                }`}
              >
                <Text className="text-text-secondary text-xs font-medium mb-1">
                  {line.speaker}
                </Text>
                {isBlank ? (
                  <TextInput
                    className={`border-2 ${getBorderClass(index)} rounded-[10px] px-3 py-2 text-base text-text-primary min-w-[150px]`}
                    placeholder="Type your line..."
                    placeholderTextColor="#64748B"
                    value={answers[index] ?? ''}
                    onChangeText={(text) => handleChangeAnswer(index, text)}
                    editable={!submitted && !showResult}
                    autoCapitalize="none"
                    accessibilityLabel={`Dialogue line ${index + 1} input for ${line.speaker}`}
                    accessibilityHint="Type the missing dialogue line"
                  />
                ) : (
                  <Text className="text-text-primary text-[15px] leading-6">
                    {line.text}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {result && onContinue && language ? (
        <FeedbackCard
          result={result}
          exercise={exercise}
          language={language}
          cefrLevel={cefrLevel}
          userId={userId}
          onRetry={handleRetry}
          onContinue={onContinue}
        />
      ) : null}

      {!submitted && !showResult && (
        <View className="mt-4">
          <Button
            label="Check"
            onPress={handleSubmit}
            disabled={!allFilled}
          />
        </View>
      )}
    </ExerciseCard>
  );
}
