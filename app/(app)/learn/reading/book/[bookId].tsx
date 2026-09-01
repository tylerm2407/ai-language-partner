import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '../../../../../hooks/useSafeBack';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { useAuth } from '../../../../../hooks/useAuth';
import { useProfile } from '../../../../../hooks/useProfile';
import { useWordLookup } from '../../../../../hooks/useWordLookup';
import {
  fetchBookMeta,
  fetchBookContent,
  fetchBookAnnotations,
  fetchUserBookProgress,
  upsertBookProgress,
  addCardFromAnnotation,
  NewCardsCapReachedError,
  incrementXpIdempotent,
  fetchSubscription,
  type AnnotationCardSource,
} from '../../../../../lib/supabase-queries';
import { BookReader } from '../../../../../components/reading/BookReader';
import { getCached, readCacheKey, setCached } from '../../../../../lib/read-cache';
import { supabase } from '../../../../../lib/supabase';
import { loadErrorCopy, saveErrorCopy, type ErrorCopy } from '../../../../../lib/error-copy';
import { bookXpKey } from '../../../../../lib/offline-queue';
import { cefrBandColors, cefrCanDo, cefrAccessibilityLabel } from '../../../../../lib/cefr-labels';
import type { ReadingBook, BookAnnotation, UserBookProgress, Subscription } from '../../../../../types';
import { colors } from '../../../../../config/theme';

export default function BookDetailScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const router = useRouter();
  const goBack = useSafeBack('/(app)');
  const { user } = useAuth();
  const { profile } = useProfile();
  const [book, setBook] = useState<ReadingBook | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [annotations, setAnnotations] = useState<BookAnnotation[]>([]);
  const [progress, setProgress] = useState<UserBookProgress | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  // Guards against re-awarding XP when the reader re-fires onComplete (paging
  // back and forth across the last page, narration auto-advance, etc.).
  const hasCompletedRef = useRef(false);

  const isUnlimitedPlan = subscription?.tier === 'vip' && subscription?.isActive;

  const load = useCallback(async () => {
    if (!bookId || !user) return;
    setIsLoading(true);
    setError(null);
    try {
      // Metadata only. `content` is fetched behind the Read button below —
      // it averages 211 kB and reaches 1.8 MB, and making the cover screen
      // wait on the whole book was the slowest thing in the reader.
      const [bookData, annData, progressData, sub] = await Promise.all([
        fetchBookMeta(bookId),
        fetchBookAnnotations(bookId),
        fetchUserBookProgress(user.id, bookId),
        fetchSubscription(user.id),
      ]);

      setBook(bookData);
      setAnnotations(annData);
      setProgress(progressData[0] ?? null);
      setSubscription(sub);
    } catch (e) {
      // Was `setError(e.message)`, which rendered the raw Supabase/Postgres
      // string straight into the UI. See lib/error-copy.ts.
      setError(loadErrorCopy(e, 'this book'));
    } finally {
      setIsLoading(false);
    }
  }, [bookId, user]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Fetch the book's text, from the device cache when possible.
   *
   * Published books are immutable, so a cache hit needs no revalidation —
   * which is why this uses getCached/setCached rather than `cachedFetch`,
   * whose whole job is to re-run the fetcher every time.
   */
  const loadContent = useCallback(async (): Promise<string | null> => {
    if (!bookId) return null;
    const key = readCacheKey('book-content', bookId);
    const cached = await getCached<string>(key);
    if (cached) return cached;

    const fetched = await fetchBookContent(bookId);
    if (fetched) await setCached(key, fetched);
    return fetched;
  }, [bookId]);

  const startReading = useCallback(async () => {
    if (content !== null) {
      setIsReading(true);
      return;
    }
    setIsLoadingContent(true);
    try {
      const text = await loadContent();
      if (text === null) {
        setError(loadErrorCopy(new Error('missing content'), 'this book'));
        return;
      }
      setContent(text);
      setIsReading(true);
    } catch (e) {
      setError(loadErrorCopy(e, 'this book'));
    } finally {
      setIsLoadingContent(false);
    }
  }, [content, loadContent]);

  // Every word in the book is tappable; `book_annotations` is a free first
  // hit where it exists (28 of 10,375 books) and the `translate` function
  // answers for the rest.
  const help = useWordLookup({
    sourceLanguage: book?.language ?? profile?.targetLanguage ?? 'en',
    targetLanguage: profile?.nativeLanguage ?? 'en',
    cefrLevel: book?.cefrLevel ?? 'A1',
    annotations,
    bookId: bookId ?? undefined,
  });

  const handlePositionChange = useCallback(async (position: number, percent: number) => {
    if (!user || !bookId) return;
    try {
      const updated = await upsertBookProgress(user.id, bookId, {
        currentPosition: position,
        percentComplete: percent,
      });
      setProgress(updated);
    } catch (err) {
      // Not silent. Losing this is losing the learner's place in a book, which
      // they discover by reopening it at chapter one. Non-fatal — reading
      // continues — but it must be reportable.
      console.warn('[book] position save failed:', err);
      Sentry.captureException(err, { tags: { area: 'book-position-save' } });
    }
  }, [user, bookId]);

  const handleAddToReview = useCallback(async (source: AnnotationCardSource) => {
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
      // Not a failure — there is genuinely nowhere to file the card yet.
      Alert.alert(
        "Can't save that word",
        `There's no ${book.language.toUpperCase()} course yet, so there's nowhere to add this card. It will work once one is published.`,
      );
      return null;
    }

    // Books used to build the card and review item inline here, which meant
    // the daily new-card cap was enforced on passages but not on books — and
    // since migration 084 that cap IS the free-tier limit, so the book reader
    // was an unmetered way around it. One shared path, one cap.
    try {
      return await addCardFromAnnotation(user.id, source, courses.id, ['reading', 'book']);
    } catch (err) {
      if (err instanceof NewCardsCapReachedError) {
        Alert.alert(
          "That's all your new words for today",
          `You've started ${err.cap} new words today. This one will still be here tomorrow — reviewing what you've already started is always unlimited.`,
        );
        return null;
      }
      const { title, message } = saveErrorCopy(err, 'that word to your reviews');
      Alert.alert(title, message);
      return null;
    }
  }, [user, book]);

  /**
   * Persist how many words were looked up this session.
   *
   * Written on exit rather than per tap: the reader now makes EVERY word
   * tappable, so a per-tap write would be a row update per word. The count
   * comes from the lookup hook, which is the only thing that knows a tap
   * resolved rather than being a stray press on punctuation.
   */
  const saveLookupCount = useCallback(async () => {
    if (!user || !bookId || help.lookupCount === 0) return;
    try {
      await upsertBookProgress(user.id, bookId, {
        wordsLookedUp: (progress?.wordsLookedUp ?? 0) + help.lookupCount,
      });
    } catch (err) {
      // Cosmetic counter, but a swallowed catch here hid a broken write path
      // that also carries the position save above.
      console.warn('[book] word-lookup counter failed:', err);
    }
  }, [user, bookId, progress?.wordsLookedUp, help.lookupCount]);

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
      // One payout per book, ever. `hasCompletedRef` only guards this session,
      // so re-opening a finished book in a later session paid again through the
      // non-idempotent `increment_xp`.
      await incrementXpIdempotent(xpReward, bookXpKey(bookId));

      // The XP above still accrues, but it is a server-side ledger the learner
      // never sees — so the congratulation names the thing they actually did.
      Alert.alert(
        'Book finished',
        `You read all ${book.wordCount.toLocaleString()} words of "${book.title}".`,
        [{ text: 'Continue', onPress: () => setIsReading(false) }]
      );
    } catch (err) {
      hasCompletedRef.current = false; // allow a retry if the write failed
      const { title, message } = saveErrorCopy(err, 'your progress on this book');
      Alert.alert(title, message);
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
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.error.light, textAlign: 'center' }}>
          {error?.title ?? 'Book not found'}
        </Text>
        <Text style={{ fontSize: 15, color: colors.text.tertiary, textAlign: 'center', marginTop: 8 }}>
          {error?.message ?? "We couldn't find this book. It may have been removed."}
        </Text>
        {/* A failed load is usually transient, so retry comes before leaving. */}
        {error && (
          <Pressable
            onPress={load}
            style={{ marginTop: 16, minHeight: 44, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Try loading this book again"
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.action.accent }}>Try again</Text>
          </Pressable>
        )}
        <Pressable onPress={() => goBack()} style={{ marginTop: 16, minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
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
        content={content ?? ''}
        initialPosition={progress?.currentPosition ?? 0}
        isUnlimitedPlan={isUnlimitedPlan}
        onPositionChange={handlePositionChange}
        selectedRef={help.selectedRef}
        lookup={help.state}
        explanation={help.explanation}
        onWordPress={help.onWordPress}
        onExplain={(paragraph) => help.explain(paragraph.index, paragraph.text)}
        onRetryLookup={help.retry}
        onDismissHelp={help.dismiss}
        onAddToReview={() =>
          help.cardSource ? handleAddToReview(help.cardSource) : Promise.resolve(null)
        }
        onUpgrade={() => router.push('/(app)/profile/subscription')}
        onComplete={handleComplete}
        onExit={() => {
          void saveLookupCount();
          setIsReading(false);
        }}
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
        <Pressable onPress={() => goBack()} hitSlop={8} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
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

        {/* CEFR Badge. The badge is keyed to the band rather than always indigo,
            so it matches the same book's chip in the library grid. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ backgroundColor: cefrBandColors(book.cefrLevel).bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text
              style={{ fontSize: 14, color: cefrBandColors(book.cefrLevel).text, fontWeight: '600' }}
              accessibilityLabel={cefrAccessibilityLabel(book.cefrLevel)}
            >
              {book.cefrLevel}
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surface.cardAlt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 }}>
            <Text style={{ fontSize: 13, color: colors.text.tertiary }}>{book.source === 'ai_generated' ? 'AI Story' : book.source === 'gutenberg' ? 'Classic' : 'Wikisource'}</Text>
          </View>
        </View>

        {/* This screen is where a learner decides whether a book is for them, so
            it spells the band out rather than making them decode the chip. */}
        {cefrCanDo(book.cefrLevel) ? (
          <Text
            style={{ fontSize: 13, color: colors.text.tertiary, marginBottom: 12 }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {cefrCanDo(book.cefrLevel)}
          </Text>
        ) : null}

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
        {/* The book's text is fetched here, not with the cover — so this is
            the one button in the app that can legitimately sit spinning for a
            moment on a long novel. */}
        <Pressable
          onPress={() => void startReading()}
          disabled={isLoadingContent}
          style={{
            backgroundColor: colors.action.primaryFill,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: 'center',
            opacity: isLoadingContent ? 0.7 : 1,
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoadingContent, busy: isLoadingContent }}
          accessibilityLabel={isStarted ? 'Continue reading' : 'Start reading'}
        >
          {isLoadingContent ? (
            <ActivityIndicator size="small" color={colors.text.onPrimary} />
          ) : (
            <Text style={{ color: colors.text.onPrimary, fontSize: 18, fontWeight: '600' }}>
              {isCompleted ? 'Read Again' : isStarted ? 'Continue Reading' : 'Start Reading'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
