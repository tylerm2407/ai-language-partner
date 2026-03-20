import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ConversationReview } from '../../../components/practice/ConversationReview';
import { useVoiceSession } from '../../../hooks/useVoiceSession';
import type { VocabItem } from '../../../types';

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { elapsedSeconds, xpEarned, transcript, corrections, vocabulary } = useVoiceSession();

  const handleAddToFlashcards = async (vocab: VocabItem) => {
    // TODO: Create a card and review item in the SRS system
    // This would call createCard + upsertReviewItem from supabase-queries
    // For now, track the event (implemented in ConversationReview component)
  };

  const handlePracticeAgain = () => {
    const source = params.source as string;
    if (source === 'driving') {
      router.replace('/(app)/practice/driving');
    } else {
      router.replace('/(app)/practice/voice');
    }
  };

  const handleGoBack = () => {
    router.replace('/(app)/practice');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ConversationReview
        durationSeconds={elapsedSeconds}
        xpEarned={xpEarned}
        transcript={transcript}
        corrections={corrections}
        vocabulary={vocabulary}
        onAddToFlashcards={handleAddToFlashcards}
        onPracticeAgain={handlePracticeAgain}
        onGoBack={handleGoBack}
      />
    </SafeAreaView>
  );
}
