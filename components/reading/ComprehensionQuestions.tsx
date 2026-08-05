import { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ProgressBar } from '../ui/ProgressBar';
import { gradeAnswer } from '../../lib/grading';
import type { ReadingQuestion } from '../../types';
import { colors } from '../../config/theme';

interface Props {
  questions: ReadingQuestion[];
  onComplete: (comprehensionScore: number) => void;
  onExit: () => void;
}

export function ComprehensionQuestions({ questions, onComplete, onExit }: Props) {
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.raised }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Pressable onPress={onExit} style={{ padding: 8, marginRight: 8 }} accessibilityRole="button" accessibilityLabel="Exit">
            <Text style={{ fontSize: 24, color: colors.text.tertiary }}>x</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={progress} />
          </View>
          <Text style={{ marginLeft: 12, fontSize: 14, color: colors.text.tertiary }}>
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
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.action.accent, marginBottom: 8 }}>
          Comprehension
        </Text>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: 20, lineHeight: 26 }}>
          {question.questionText}
        </Text>

        {/* Multiple Choice */}
        {(question.questionType === 'multiple_choice' || question.questionType === 'true_false') && question.options && (
          <View>
            {question.options.map((option, index) => {
              // Answer-state fills are the theme's dark tints, not the light
              // green/red (#DCFCE7 / #FEE2E2) this used before the surface went
              // dark — those left the option text at ~1.4:1.
              let bgColor: string = colors.surface.cardAlt;
              let borderColor = 'transparent';

              if (isRevealed) {
                if (option === question.correctAnswer) {
                  bgColor = colors.success.tint;
                  borderColor = colors.success.base;
                } else if (option === selectedOption && !isCorrect) {
                  bgColor = colors.error.tint;
                  borderColor = colors.error.base;
                }
              } else if (option === selectedOption) {
                bgColor = colors.action.primaryTint;
                borderColor = colors.indigo[500];
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
                  <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text.primary }}>{option}</Text>
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
              placeholderTextColor={colors.text.quaternary}
              editable={!isRevealed}
              style={{
                borderWidth: 2,
                borderColor: isRevealed ? (isCorrect ? '#22C55E' : '#EF4444') : colors.border.default,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: 'top',
                color: colors.text.primary,
              }}
              multiline
              accessibilityLabel="Your answer"
            />
            {isRevealed && !isCorrect && (
              <Text style={{ fontSize: 14, color: colors.error.light, marginTop: 8 }}>
                Correct answer: {question.correctAnswer}
              </Text>
            )}
          </View>
        )}

        {/* Feedback */}
        {isRevealed && (
          <View style={{
            backgroundColor: isCorrect ? colors.success.tint : colors.error.tint,
            borderRadius: 14,
            padding: 16,
            marginTop: 16,
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: isCorrect ? colors.success.light : colors.error.light,
            }}>
              {isCorrect ? 'Correct!' : 'Not quite.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Button */}
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: colors.border.default }}>
        {!isRevealed ? (
          <Pressable
            onPress={handleCheck}
            disabled={!canCheck}
            style={{
              backgroundColor: canCheck ? '#4F46E5' : '#C7D2FE',
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Check answer"
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Check</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            style={{
              backgroundColor: '#4F46E5',
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel={currentIndex + 1 < questions.length ? 'Next question' : 'Finish'}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
              {currentIndex + 1 < questions.length ? 'Next' : 'Finish'}
            </Text>
          </Pressable>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
