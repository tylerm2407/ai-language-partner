import { useState, useRef } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useReadingPassage } from '../../../../hooks/useReadingPassage';
import { ReadingPassageViewer } from '../../../../components/reading/ReadingPassageViewer';
import { ComprehensionQuestions } from '../../../../components/reading/ComprehensionQuestions';
import { haptic } from '../../../../lib/haptics';
import { colors } from '../../../../config/theme';
import { GlowLayer } from '../../../../components/ui/GlowBackground';

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
  const finishingRef = useRef(false);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base, justifyContent: 'center', alignItems: 'center' }}>
        <GlowLayer drift={false} />
        <ActivityIndicator size="large" color={colors.action.accent} />
      </SafeAreaView>
    );
  }

  if (error || !passage) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.base, justifyContent: 'center', alignItems: 'center' }}>
        <GlowLayer drift={false} />
        <Text style={{ fontSize: 16, color: colors.text.quaternary }}>{error ?? 'Passage not found.'}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, color: colors.action.accent }}>Go Back</Text>
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
        <GlowLayer drift={false} />
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
            onPress={() => {
              haptic('buttonPress');
              router.back();
            }}
            style={{
              backgroundColor: colors.action.primaryFill, paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14,
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
          // Fired here rather than in an effect on the 'complete' phase because
          // this is a handler on a real tap — no mount/remount to guard against.
          // The last question's own verdict buzz came from a separate gesture
          // (Check), so the two do not stack.
          haptic('complete');
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
      onContinue={async () => {
        if (questions.length > 0) {
          setPhase('questions');
          return;
        }
        // No comprehension questions — mark read. Await the write before
        // navigating so it isn't cancelled on unmount; guard double-taps.
        if (finishingRef.current) return;
        finishingRef.current = true;
        await completeReading(1);
        // A passage with no comprehension questions never reaches the
        // 'complete' screen — it just pops back. The learner still finished
        // something, and this is the only acknowledgement they get.
        haptic('complete');
        router.back();
      }}
      onExit={() => router.back()}
    />
  );
}
