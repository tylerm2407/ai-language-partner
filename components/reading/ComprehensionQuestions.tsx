import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { haptic } from '../../lib/haptics';
import { Ui2ProgressBar } from '../ui2/Ui2ProgressBar';
import { gradeAnswer } from '../../lib/grading';
import type { ReadingQuestion } from '../../types';
import { useUi2Theme } from '../../hooks/useUi2Theme';
import { ReaderThemeScope } from './ReaderThemeScope';

interface Props {
  questions: ReadingQuestion[];
  onComplete: (comprehensionScore: number) => void;
  onExit: () => void;
}

/** Stays inside the reader's theme boundary so a passage read under Night
 *  reading does not snap back to white for its questions. */
export function ComprehensionQuestions(props: Props) {
  return (
    <ReaderThemeScope>
      <ComprehensionQuestionsBody {...props} />
    </ReaderThemeScope>
  );
}

function ComprehensionQuestionsBody({ questions, onComplete, onExit }: Props) {
  const { c } = useUi2Theme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const question = questions[currentIndex];
  const progress = questions.length > 0 ? currentIndex / questions.length : 0;

  const handleCheck = useCallback(() => {
    if (!question) return;

    const userAnswer = question.questionType === 'short_answer' ? textAnswer : (selectedOption ?? '');
    const grade = gradeAnswer(userAnswer, question.correctAnswer, question.acceptedAnswers);

    setIsCorrect(grade.isCorrect);
    setIsRevealed(true);

    if (grade.isCorrect) {
      setCorrectCount((prev) => prev + 1);
      haptic('correct');
    } else {
      haptic('incorrect');
    }
  }, [question, textAnswer, selectedOption]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setTextAnswer('');
      setIsRevealed(false);
      setIsCorrect(false);
    } else {
      const score = questions.length > 0 ? correctCount / questions.length : 0;
      onComplete(score);
    }
  }, [currentIndex, questions.length, correctCount, onComplete]);

  if (!question) return null;

  const canCheck =
    question.questionType === 'short_answer'
      ? textAnswer.trim().length > 0
      : selectedOption !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Pressable onPress={onExit} style={{ padding: 8, marginRight: 8 }} accessibilityRole="button" accessibilityLabel="Exit">
            <Text style={{ fontSize: 24, color: c.muted }}>x</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Ui2ProgressBar progress={progress} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 14, color: c.muted }}>
            {currentIndex + 1}/{questions.length}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Question */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.onTint, marginBottom: 8 }}>
          Comprehension
        </Text>
        <Text style={{ fontSize: 18, fontWeight: '600', color: c.ink, marginBottom: 20, lineHeight: 26 }}>
          {question.questionText}
        </Text>

        {/* Multiple Choice */}
        {(question.questionType === 'multiple_choice' || question.questionType === 'true_false') && question.options && (
          <View>
            {question.options.map((option, index) => {
              // Answer-state fills are the UI 2.0 tints, which are defined
              // per scheme — the previous fixed pair was readable on one ground
              // only. The option text stays `ink` on every one of them, and the
              // state is never carried by the fill alone: the banner below the
              // list says "Correct!" or "Not quite." in words.
              let bgColor: string = c.surface2;
              let borderColor = c.cardBorder;

              if (isRevealed) {
                if (option === question.correctAnswer) {
                  bgColor = c.greenTint;
                  borderColor = c.green;
                } else if (option === selectedOption && !isCorrect) {
                  bgColor = c.pinkTint;
                  borderColor = c.error;
                }
              } else if (option === selectedOption) {
                bgColor = c.primaryTint;
                borderColor = c.primary;
              }

              return (
                <Pressable
                  key={index}
                  onPress={() => !isRevealed && setSelectedOption(option)}
                  style={{
                    backgroundColor: bgColor,
                    borderWidth: 2,
                    borderColor,
                    padding: 16,
                    borderRadius: 14,
                    marginBottom: 10,
                  }}
                  disabled={isRevealed}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                >
                  <Text style={{ fontSize: 17, fontWeight: '600', color: c.ink }}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Short Answer */}
        {question.questionType === 'short_answer' && (
          <View>
            <TextInput
              value={textAnswer}
              onChangeText={setTextAnswer}
              placeholder="Type your answer..."
              placeholderTextColor={c.idle}
              editable={!isRevealed}
              style={{
                borderWidth: 2,
                borderColor: isRevealed ? (isCorrect ? c.green : c.error) : c.cardBorder,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: 'top',
                color: c.ink,
              }}
              multiline
              accessibilityLabel="Your answer"
            />
            {isRevealed && !isCorrect && (
              <Text style={{ fontSize: 14, color: c.error, marginTop: 8 }}>
                Correct answer: {question.correctAnswer}
              </Text>
            )}
          </View>
        )}

        {/* Feedback */}
        {isRevealed && (
          <View style={{
            backgroundColor: isCorrect ? c.greenTint : c.pinkTint,
            borderRadius: 14,
            padding: 16,
            marginTop: 16,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: c.ink,
            }}>
              {isCorrect ? 'Correct!' : 'Not quite.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Button */}
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: c.cardBorder }}>
        {!isRevealed ? (
          <Pressable
            onPress={handleCheck}
            disabled={!canCheck}
            style={{
              backgroundColor: canCheck ? c.primary : c.track,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Check answer"
          >
            {/* The disabled label is `idle`, not white: white on the unfilled
                track is ~1.4:1 in light mode. `idle` is the palette's own
                placeholder/inactive step and clears in both schemes. */}
            <Text style={{ color: canCheck ? c.onPrimary : c.idle, fontSize: 18, fontWeight: '600' }}>Check</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            style={{
              backgroundColor: c.primary,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={currentIndex + 1 < questions.length ? 'Next question' : 'Finish'}
          >
            <Text style={{ color: c.onPrimary, fontSize: 18, fontWeight: '600' }}>
              {currentIndex + 1 < questions.length ? 'Next' : 'Finish'}
            </Text>
          </Pressable>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
