import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../../hooks/useAuth';
import {
  fetchBookById,
  fetchBookAnnotations,
  fetchUserBookProgress,
  upsertBookProgress,
  upsertReviewItem,
  addXp,
  fetchSubscription,
} from '../../../../../lib/supabase-queries';
import { BookReader } from '../../../../../components/reading/BookReader';
import { supabase } from '../../../../../lib/supabase';
import type { ReadingBook, BookAnnotation, UserBookProgress, Subscription } from '../../../../../types';
import { colors } from '../../../../../config/theme';

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [book, setBook] = useState<ReadingBook | null>(null);
  const [annotations, setAnnotations] = useState<BookAnnotation[]>([]);
  const [progress, setProgress] = useState<UserBookProgress | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against re-awarding XP when the reader re-fires onComplete (paging
  // back and forth across the last page, narration auto-advance, etc.).
  const hasCompletedRef = useRef(false);

  const isUnlimitedPlan = subscription?.tier === 'vip' && subscription?.isActive;

  useEffect(() => {
    if (!bookId || !user) return;

    const load = async () => {
      try {
        const [bookData, annData, progressData, sub] = await Promise.all([
          fetchBookById(bookId),
          fetchBookAnnotations(bookId),
          fetchUserBookProgress(user.id, bookId),
          fetchSubscription(user.id),
        ]);

        setBook(bookData);
        setAnnotations(annData);
        setProgress(progressData[0] ?? null);
        setSubscription(sub);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load book');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [bookId, user]);

  const handlePositionChange = useCallback(async (position: number, percent: number) => {
    if (!user || !bookId) return;
    try {
      const updated = await upsertBookProgress(user.id, bookId, {
        currentPosition: position,
        percentComplete: percent,
      });
      setProgress(updated);
    } catch {
      // Silent fail for position saves
    }
  }, [user, bookId]);

  const handleWordLookup = useCallback(async () => {
    if (!user || !bookId || !progress) return;
    try {
      await upsertBookProgress(user.id, bookId, {
        wordsLookedUp: (progress.wordsLookedUp ?? 0) + 1,
      });
    } catch {
      // Silent fail
    }
  }, [user, bookId, progress]);

  const handleAddToReview = useCallback(async (annotation: BookAnnotation) => {
    if (!user || !book) return null;

    // Find the user's active course for this language to associate the card
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('target_language', book.language)
      .eq('is_published', true)
      .limit(1)
      .single();

    if (!courses) {
      Alert.alert('Error', 'No course found for this language');
      return null;
    }

    // Create a card from the book annotation
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .insert({
        course_id: courses.id,
        native_text: annotation.translation,
        target_text: annotation.wordOrPhrase,
        audio_url: annotation.audioUrl,
        part_of_speech: annotation.partOfSpeech,
        tags: ['reading', 'book'],
      })
      .select()
      .single();

    if (cardError) {
      Alert.alert('Error', 'Failed to create review card');
      return null;
    }

    return upsertReviewItem({
      userId: user.id,
      cardId: card.id,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextDue: new Date().toISOString(),
      lastReviewedAt: null,
      status: 'new',
    });
  }, [user, book]);

  const handleComplete = useCallback(async () => {
    if (!user || !bookId || !book) return;
    // Award once per session, and never re-award a book already finished.
    if (hasCompletedRef.current || progress?.completedAt) {
      setIsReading(false);
      return;
    }
    hasCompletedRef.current = true;
    try {
      await upsertBookProgress(user.id, bookId, {
        percentComplete: 100,
        completedAt: new Date().toISOString(),
      });

      // Award XP: wordCount / 10, capped at 500
      const xpReward = Math.min(500, Math.round(book.wordCount / 10));
      await addXp(user.id, xpReward);

      Alert.alert(
        'Book Completed!',
        `You earned ${xpReward} XP for finishing "${book.title}"!`,
        [{ text: 'Continue', onPress: () => setIsReading(false) }]
      );
    } catch {
      hasCompletedRef.current = false; // allow a retry if the write failed
      Alert.alert('Error', 'Failed to save completion');
    }
  }, [user, bookId, book, progress?.completedAt]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.raised, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#818CF8" />
      </View>
    );
  }

  if (error || !book) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface.raised, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: colors.error.light, textAlign: 'center' }}>{error ?? 'Book not found'}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }} accessibilityRole="button">
          <Text style={{ fontSize: 16, color: colors.action.accent }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Reading mode
  if (isReading) {
    return (
      <BookReader
        book={book}
        annotations={annotations}
        initialPosition={progress?.currentPosition ?? 0}
        isUnlimitedPlan={isUnlimitedPlan}
        onPositionChange={handlePositionChange}
        onWordLookup={handleWordLookup}
        onAddToReview={handleAddToReview}
        onComplete={handleComplete}
        onExit={() => setIsReading(false)}
      />
    );
  }

  // Book detail view
  const isStarted = progress && progress.percentComplete > 0;
  const isCompleted = progress?.completedAt !== null && progress?.completedAt !== undefined;
  const estimatedMinutes = Math.round(book.wordCount / 200); // ~200 wpm reading speed

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.raised }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#666" />
        </Pressable>
      </View>

      {/* Book Info */}
      <View style={{ padding: 20, flex: 1 }}>
        {/* Cover Image */}
        {book.imageUrl && (
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Image
              source={{ uri: book.imageUrl }}
              style={{ width: 140, height: 200, borderRadius: 8 }}
              resizeMode="cover"
              accessibilityLabel={`Cover of ${book.title}`}
            />
          </View>
        )}

        {/* CEFR Badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ backgroundColor: colors.action.primaryTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 14, color: colors.action.accent, fontWeight: '600' }}>{book.cefrLevel}</Text>
          </View>
          <View style={{ backgroundColor: colors.surface.cardAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 }}>
            <Text style={{ fontSize: 13, color: colors.text.tertiary }}>{book.source === 'ai_generated' ? 'AI Story' : book.source === 'gutenberg' ? 'Classic' : 'Wikisource'}</Text>
          </View>
        </View>

        {/* Title & Author */}
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text.primary, marginBottom: 4 }}>{book.title}</Text>
        {book.author && (
          <Text style={{ fontSize: 16, color: colors.text.tertiary, marginBottom: 12 }}>by {book.author}</Text>
        )}

        {/* Description */}
        {book.description && (
          <Text style={{ fontSize: 15, color: colors.text.tertiary, lineHeight: 22, marginBottom: 16 }}>{book.description}</Text>
        )}

        {/* Stats */}
        <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="document-text-outline" size={20} color="#818CF8" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, marginTop: 4 }}>
                {book.wordCount.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.tertiary }}>words</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="time-outline" size={20} color="#818CF8" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, marginTop: 4 }}>
                ~{estimatedMinutes} min
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.tertiary }}>to read</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="star-outline" size={20} color="#818CF8" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, marginTop: 4 }}>
                {Math.min(500, Math.round(book.wordCount / 10))} XP
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.tertiary }}>reward</Text>
            </View>
          </View>
        </View>

        {/* Progress (if started) */}
        {isStarted && !isCompleted && (
          <View style={{ backgroundColor: colors.surface.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.tertiary, marginBottom: 8 }}>Your Progress</Text>
            <View style={{ height: 8, backgroundColor: colors.surface.cardAlt, borderRadius: 4 }}>
              <View style={{
                height: 8, backgroundColor: '#4F46E5', borderRadius: 4,
                width: `${Math.round(progress!.percentComplete)}%`,
              }} />
            </View>
            <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 4 }}>
              {Math.round(progress!.percentComplete)}% complete
            </Text>
          </View>
        )}

        {isCompleted && (
          <View style={{ backgroundColor: colors.success.tint, borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.success.light, marginLeft: 8 }}>Completed!</Text>
          </View>
        )}

        {/* Audiobook upsell for non-unlimited users */}
        {!isUnlimitedPlan && (
          <Pressable
            onPress={() => router.push('/(app)/profile/subscription')}
            style={{ backgroundColor: '#EEF2FF', borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to listen to this book"
          >
            <Ionicons name="headset-outline" size={24} color="#818CF8" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text.primary }}>Listen to this book</Text>
              <Text style={{ fontSize: 13, color: colors.text.tertiary, marginTop: 2 }}>Upgrade to VIP for audiobook narration</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#818CF8" />
          </Pressable>
        )}
      </View>

      {/* CTA Button */}
      <View style={{ padding: 20, paddingBottom: 100, borderTopWidth: 1, borderTopColor: colors.border.default }}>
        <Pressable
          onPress={() => setIsReading(true)}
          style={{ backgroundColor: '#4F46E5', paddingVertical: 16, borderRadius: 14, alignItems: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={isStarted ? 'Continue reading' : 'Start reading'}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
            {isCompleted ? 'Read Again' : isStarted ? 'Continue Reading' : 'Start Reading'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
