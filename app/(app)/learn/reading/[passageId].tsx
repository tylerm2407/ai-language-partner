import { useState } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useReadingPassage } from '../../../../hooks/useReadingPassage';
import { ReadingPassageViewer } from '../../../../components/reading/ReadingPassageViewer';
import { ComprehensionQuestions } from '../../../../components/reading/ComprehensionQuestions';

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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  if (error || !passage) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: '#999' }}>{error ?? 'Passage not found.'}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, color: '#6366F1' }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    const scorePercent = Math.round(score * 100);
    const scoreColor = scorePercent >= 80 ? '#22C55E' : scorePercent >= 60 ? '#CA8A04' : '#EF4444';
    const scoreBg = scorePercent >= 80 ? '#DCFCE7' : scorePercent >= 60 ? '#FEF9C3' : '#FEE2E2';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }} accessibilityRole="header">
            Reading Complete!
          </Text>
          <Text style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>{passage.title}</Text>

          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: scoreBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24,
          }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: scoreColor }}>{scorePercent}%</Text>
          </View>

          <Text style={{ fontSize: 14, color: '#666', marginBottom: 32 }}>Comprehension Score</Text>

          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: '#6366F1', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Continue</Text>
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
