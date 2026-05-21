import { useState } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useReadingPassage } from '../../../../hooks/useReadingPassage';
import { ReadingPassageViewer } from '../../../../components/reading/ReadingPassageViewer';
import { ComprehensionQuestions } from '../../../../components/reading/ComprehensionQuestions';
import { colors } from '../../../../config/theme';

export default function ReadingPassageScreen() {
  const { passageId } = useLocalSearchParams<{ passageId: string }>();
  const router = useRouter();
  const {
    passage,
    annotations,
    questions,
    isLoading,
    error,
    selectedAnnotation,
    selectWord,
    dismissTooltip,
    addToReview,
    completeReading,
  } = useReadingPassage(passageId ?? null);

  const [phase, setPhase] = useState<'reading' | 'questions' | 'complete'>('reading');
  const [score, setScore] = useState(0);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.indigo[500]} />
      </SafeAreaView>
    );
  }

  if (error || !passage) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: colors.text.quaternary }}>{error ?? 'Passage not found.'}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, color: colors.indigo[500] }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    const scorePercent = Math.round(score * 100);
    const scoreColor = scorePercent >= 80 ? colors.success.base : scorePercent >= 60 ? colors.warning.base : colors.error.base;
    const scoreBg = scorePercent >= 80 ? 'rgba(34, 197, 94, 0.15)' : scorePercent >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8, color: colors.text.primary }} accessibilityRole="header">
            Reading Complete!
          </Text>
          <Text style={{ fontSize: 16, color: colors.text.tertiary, marginBottom: 24 }}>{passage.title}</Text>

          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: scoreBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24,
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: scoreColor }}>{scorePercent}%</Text>
          </View>

          <Text style={{ fontSize: 14, color: colors.text.tertiary, marginBottom: 32 }}>Comprehension Score</Text>

          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: colors.indigo[500], paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={{ color: colors.text.onPrimary, fontSize: 18, fontWeight: '600' }}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'questions' && questions.length > 0) {
    return (
      <ComprehensionQuestions
        questions={questions}
        onComplete={async (comprehensionScore) => {
          setScore(comprehensionScore);
          await completeReading(comprehensionScore);
          setPhase('complete');
        }}
        onExit={() => router.back()}
      />
    );
  }

  return (
    <ReadingPassageViewer
      passage={passage}
      annotations={annotations}
      selectedAnnotation={selectedAnnotation}
      onSelectWord={selectWord}
      onDismissTooltip={dismissTooltip}
      onAddToReview={(annotation) => addToReview(annotation, passage.courseId)}
      onContinue={() => {
        if (questions.length > 0) {
          setPhase('questions');
        } else {
          completeReading(1);
          router.back();
        }
      }}
      onExit={() => router.back()}
    />
  );
}
