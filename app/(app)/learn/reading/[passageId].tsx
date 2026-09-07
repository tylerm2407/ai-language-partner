import { useState, useRef } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '../../../../hooks/useSafeBack';
import { useProfile } from '../../../../hooks/useProfile';
import { useReadingPassage } from '../../../../hooks/useReadingPassage';
import { useWordLookup } from '../../../../hooks/useWordLookup';
import { ReadingPassageViewer } from '../../../../components/reading/ReadingPassageViewer';
import { ComprehensionQuestions } from '../../../../components/reading/ComprehensionQuestions';
import { haptic } from '../../../../lib/haptics';
// `colors` is deliberately NOT imported: it is the fixed DARK palette, and a
// screen that reads it stays dark whatever the phone is set to.
import { useUi2Theme } from '../../../../hooks/useUi2Theme';
import { Heading, Body } from '../../../../components/ui2/Ui2Text';
import { useScreenView } from '../../../../hooks/useScreenView';

export default function ReadingPassageScreen() {
  useScreenView('passage');
  const { c, shape } = useUi2Theme();
  const { passageId } = useLocalSearchParams<{ passageId: string }>();
  const goBack = useSafeBack('/(app)');
  const router = useRouter();
  const { profile } = useProfile();
  const {
    passage,
    questions,
    isLoading,
    error,
    addToReview,
    completeReading,
  } = useReadingPassage(passageId ?? null);

  // Passages carry no annotations of their own — `reading_annotations` was
  // dropped in migration 094 — so every word here is looked up on demand.
  const help = useWordLookup({
    sourceLanguage: profile?.targetLanguage ?? 'en',
    targetLanguage: profile?.nativeLanguage ?? 'en',
    cefrLevel: passage?.cefrLevel ?? 'A1',
  });

  const [phase, setPhase] = useState<'reading' | 'questions' | 'complete'>('reading');
  const [score, setScore] = useState(0);
  const finishingRef = useRef(false);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  if (error || !passage) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Body tone="tertiary">{error ?? 'Passage not found.'}</Body>
        <Pressable onPress={() => goBack()} style={{ marginTop: 16 }} accessibilityRole="button">
          <Body tone="accent" weight="semibold">Go Back</Body>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === 'complete') {
    const scorePercent = Math.round(score * 100);
    // The ring's FILL carries the band; the number itself stays `ink`. The
    // hue tokens (green/yellow/pink) do not clear AA on their own tints in the
    // light scheme, and the percentage already states the score in words.
    const scoreBorder = scorePercent >= 80 ? c.greenBorder : scorePercent >= 60 ? c.yellowBorder : c.pinkTint;
    const scoreBg = scorePercent >= 80 ? c.greenTint : scorePercent >= 60 ? c.yellowTint : c.pinkTint;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Heading level={2} style={{ marginBottom: 8 }} accessibilityRole="header">
            Reading Complete!
          </Heading>
          <Body tone="tertiary" style={{ marginBottom: 24 }}>{passage.title}</Body>

          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: scoreBg, borderColor: scoreBorder, borderWidth: shape.border,
            justifyContent: 'center', alignItems: 'center', marginBottom: 24,
          }}>
            <Heading level={1}>{scorePercent}%</Heading>
          </View>

          <Body size="sm" tone="tertiary" style={{ marginBottom: 32 }}>Comprehension Score</Body>

          <Pressable
            onPress={() => {
              haptic('buttonPress');
              goBack();
            }}
            style={{
              backgroundColor: c.primary, paddingHorizontal: 48, paddingVertical: 16, borderRadius: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Body size="lg" weight="semibold" tone="onPrimary">Continue</Body>
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
          await completeReading(comprehensionScore, help.lookupCount);
          // Fired here rather than in an effect on the 'complete' phase because
          // this is a handler on a real tap — no mount/remount to guard against.
          // The last question's own verdict buzz came from a separate gesture
          // (Check), so the two do not stack.
          haptic('complete');
          setPhase('complete');
        }}
        onExit={() => goBack()}
      />
    );
  }

  return (
    <ReadingPassageViewer
      passage={passage}
      selectedRef={help.selectedRef}
      lookup={help.state}
      explanation={help.explanation}
      onWordPress={help.onWordPress}
      onExplain={(paragraph) => help.explain(paragraph.index, paragraph.text)}
      onRetryLookup={help.retry}
      onDismissHelp={help.dismiss}
      onAddToReview={() =>
        help.cardSource
          ? addToReview(help.cardSource, passage.courseId, profile?.targetLanguage ?? null)
          : Promise.resolve(null)
      }
      onUpgrade={() => router.push('/(app)/profile/subscription')}
      onContinue={async () => {
        if (questions.length > 0) {
          setPhase('questions');
          return;
        }
        // No comprehension questions — mark read. Await the write before
        // navigating so it isn't cancelled on unmount; guard double-taps.
        if (finishingRef.current) return;
        finishingRef.current = true;
        await completeReading(1, help.lookupCount);
        // A passage with no comprehension questions never reaches the
        // 'complete' screen — it just pops back. The learner still finished
        // something, and this is the only acknowledgement they get.
        haptic('complete');
        goBack();
      }}
      onExit={() => goBack()}
    />
  );
}
